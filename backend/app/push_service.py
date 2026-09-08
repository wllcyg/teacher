"""Web Push 核心服务。

负责：
1. 自动生成并持久化 VAPID 椭圆曲线公私钥（保存在 DATA_DIR/vapid_private.pem 与 vapid_public.json）；
2. 提供前端用于订阅的 Base64 格式 VAPID 公钥；
3. 封装向终端设备发送 Web Push 消息，捕获 410/404 失效并自动清理数据库；
4. 提供批量推送与单设备测试推送能力。
"""

import json
import logging
import os
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid, b64urlencode
from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from .database import DATA_DIR
from .models import PushSubscriptionModel

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY_FILE = os.path.join(DATA_DIR, "vapid_private.pem")
VAPID_PUBLIC_KEY_FILE = os.path.join(DATA_DIR, "vapid_public.json")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:teacher-workbench@local.dev")


def _init_or_load_vapid() -> tuple[Vapid, str]:
    """初始化或加载本地持久化的 VAPID 密钥对。
    若本地不存在，则自动生成全新的椭圆曲线密钥对并安全持久化。
    返回: (Vapid实例, Base64URL公钥字符串)
    """
    vapid = Vapid()

    # 1. 检查本地是否存在私钥文件
    if os.path.exists(VAPID_PRIVATE_KEY_FILE) and os.path.exists(VAPID_PUBLIC_KEY_FILE):
        try:
            vapid = Vapid.from_file(VAPID_PRIVATE_KEY_FILE)
            with open(VAPID_PUBLIC_KEY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                public_key_b64 = data.get("public_key", "")
                if public_key_b64:
                    return vapid, public_key_b64
        except Exception as e:
            logger.warning(f"[WebPush] 加载本地 VAPID 密钥失败，重新生成: {e}")

    # 2. 本地不存在或损坏，重新生成
    vapid.generate_keys()
    vapid.save_key(VAPID_PRIVATE_KEY_FILE)

    # 生成符合 RFC 8292 规范的未压缩 EC 点（65字节）并转为 Base64URL
    raw_public_bytes = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_key_b64 = b64urlencode(raw_public_bytes)

    with open(VAPID_PUBLIC_KEY_FILE, "w", encoding="utf-8") as f:
        json.dump({"public_key": public_key_b64}, f, ensure_ascii=False, indent=2)

    logger.info("[WebPush] 已成功生成并持久化全新的 VAPID 密钥对")
    return vapid, public_key_b64


# 全局单例
_vapid_instance, _vapid_public_key = _init_or_load_vapid()


def get_vapid_public_key() -> str:
    """获取供浏览器端 PushManager.subscribe 使用的公钥字符串。"""
    return _vapid_public_key


def send_push_to_subscription(
    db: Session,
    sub: PushSubscriptionModel,
    payload: Dict[str, Any],
    ttl: int = 86400,
) -> bool:
    """向单一设备订阅发送 Web Push 消息。

    :param db: 数据库 Session（用于在 410 时清理过期订阅）
    :param sub: 设备订阅 Model
    :param payload: 字典形式的消息体（将序列化为 JSON 字符串）
    :param ttl: 消息在厂商通道中的存活时长（秒）
    :return: 是否发送成功
    """
    subscription_info = {
        "endpoint": sub.endpoint,
        "keys": {
            "p256dh": sub.p256dh,
            "auth": sub.auth,
        },
    }

    vapid_claims = {
        "sub": VAPID_CLAIMS_EMAIL,
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE_KEY_FILE,
            vapid_claims=vapid_claims,
            ttl=ttl,
        )
        return True
    except WebPushException as ex:
        status_code = getattr(ex.response, "status_code", None) if ex.response else None
        logger.warning(f"[WebPush] 发送失败 endpoint={sub.endpoint[:40]}..., status={status_code}: {ex}")

        # 410 (Gone) 或 404 说明设备已取消订阅或被用户从浏览器撤回，应主动清理数据库
        if status_code in (404, 410):
            try:
                db.delete(sub)
                db.commit()
                logger.info(f"[WebPush] 已自动清理已注销的设备订阅 id={sub.id}")
            except Exception as clean_err:
                logger.error(f"[WebPush] 清理过期订阅失败: {clean_err}")
        return False
    except Exception as e:
        logger.error(f"[WebPush] 推送异常: {e}")
        return False


def broadcast_push(
    db: Session,
    payload: Dict[str, Any],
) -> dict:
    """向所有已注册的活跃设备广播消息。"""
    subscriptions = db.query(PushSubscriptionModel).all()
    success_count = 0
    fail_count = 0

    for sub in subscriptions:
        ok = send_push_to_subscription(db, sub, payload)
        if ok:
            success_count += 1
        else:
            fail_count += 1

    return {
        "total": len(subscriptions),
        "success": success_count,
        "failed": fail_count,
    }
