"""Web Push API 路由。

提供：
1. GET  /api/push/vapid-public-key: 获取 VAPID 公钥
2. POST /api/push/subscribe: 注册/更新设备推送凭证
3. POST /api/push/unsubscribe: 注销设备推送凭证
4. POST /api/push/send-test: 发送测试系统通知（支持向当前设备或全体设备推送）
5. GET  /api/push/status: 获取推送服务状态与已注册设备数
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .database import get_db
from .models import PushSubscriptionModel
from .push_service import broadcast_push, get_vapid_public_key, send_push_to_subscription

push_router = APIRouter(prefix="/api/push", tags=["Push Notifications"])


class KeysSchema(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: KeysSchema
    user_agent: Optional[str] = Field(default="", description="浏览器UserAgent或设备标识")


class UnsubscribeRequest(BaseModel):
    endpoint: str


class SendTestPushRequest(BaseModel):
    title: Optional[str] = Field(default="【教师工作台】系统测试通知", description="通知标题")
    body: Optional[str] = Field(default="系统级离线推送已成功接通！即使关闭网页也能准时收到提醒。", description="通知内容")
    url: Optional[str] = Field(default="/settings", description="点击通知后跳转路由")
    badgeCount: Optional[int] = Field(default=1, description="桌面应用图标未读角标数字")
    endpoint: Optional[str] = Field(default=None, description="可选，仅向指定设备发送测试推送")


@push_router.get("/vapid-public-key")
def get_public_key():
    """获取 Base64 格式的 VAPID 公钥，用于前端 PushManager.subscribe。"""
    pub_key = get_vapid_public_key()
    return {"publicKey": pub_key}


@push_router.get("/status")
def get_push_status(db: Session = Depends(get_db)):
    """获取当前推送系统运行状态及已绑定的设备总数。"""
    count = db.query(PushSubscriptionModel).count()
    return {
        "enabled": True,
        "subscribedDevices": count,
    }


@push_router.post("/subscribe")
def subscribe_device(payload: SubscribeRequest, db: Session = Depends(get_db)):
    """保存或更新设备的 Web Push 订阅凭证。"""
    if not payload.endpoint:
        raise HTTPException(status_code=400, detail="Endpoint 不能为空")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 查重：若 endpoint 已存在则更新 keys 和时间
    sub = db.query(PushSubscriptionModel).filter(PushSubscriptionModel.endpoint == payload.endpoint).first()
    if sub:
        sub.p256dh = payload.keys.p256dh
        sub.auth = payload.keys.auth
        sub.user_agent = payload.user_agent or sub.user_agent
        sub.updated_at = now_str
    else:
        sub = PushSubscriptionModel(
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=payload.user_agent or "",
            created_at=now_str,
            updated_at=now_str,
        )
        db.add(sub)

    db.commit()
    return {"ok": True, "message": "设备订阅成功"}


@push_router.post("/unsubscribe")
def unsubscribe_device(payload: UnsubscribeRequest, db: Session = Depends(get_db)):
    """注销设备订阅凭证。"""
    sub = db.query(PushSubscriptionModel).filter(PushSubscriptionModel.endpoint == payload.endpoint).first()
    if sub:
        db.delete(sub)
        db.commit()
        return {"ok": True, "message": "已成功注销该设备"}
    return {"ok": True, "message": "设备未注册或已注销"}


@push_router.post("/send-test")
def send_test_push(payload: SendTestPushRequest, db: Session = Depends(get_db)):
    """发送一条系统级测试通知。
    若传入 endpoint 则仅推送到该设备，否则向所有已订阅的设备广播。
    """
    message_payload = {
        "title": payload.title,
        "body": payload.body,
        "url": payload.url,
        "badgeCount": payload.badgeCount,
        "tag": "test-notification",
    }

    if payload.endpoint:
        sub = db.query(PushSubscriptionModel).filter(PushSubscriptionModel.endpoint == payload.endpoint).first()
        if not sub:
            raise HTTPException(status_code=404, detail="未找到该设备的订阅记录，请先在设置中点击【开启推送】")
        ok = send_push_to_subscription(db, sub, message_payload)
        if not ok:
            raise HTTPException(status_code=500, detail="推送发送失败，可能是厂商推送通道拦截或网络异常")
        return {"ok": True, "message": "测试通知已下发至当前设备"}
    else:
        result = broadcast_push(db, message_payload)
        return {
            "ok": True,
            "message": f"广播完成: 成功 {result['success']} 台，失败 {result['failed']} 台 (共 {result['total']} 台)",
            "result": result,
        }


class BroadcastUpdateRequest(BaseModel):
    version: str = Field(..., description="新版本号，例如 v2.1.0")
    version_log: Optional[str] = Field(default="工作台已推出新版本，点击立即体验！", description="更新日志或功能亮点")
    url: Optional[str] = Field(default="/", description="打开后跳转地址")


@push_router.post("/broadcast-update")
def broadcast_system_update(payload: BroadcastUpdateRequest, db: Session = Depends(get_db)):
    """发版时广播系统更新通知。
    各终端 Service Worker 收到后将在后台静默拉取并缓存最新代码，并弹出系统级更新卡片。
    """
    message_payload = {
        "type": "SYSTEM_UPDATE",
        "title": f"✨ 教师工作台升级至 {payload.version}",
        "body": payload.version_log,
        "url": payload.url,
        "tag": "system-update",
    }

    result = broadcast_push(db, message_payload)
    return {
        "ok": True,
        "message": f"发版更新通知已广播至 {result['success']} 台在线设备",
        "result": result,
    }

