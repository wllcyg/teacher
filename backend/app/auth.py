"""极简单密码 + Token 认证。

单老师场景，不需要完整的多用户账号体系：一个共享密码 + 一个 Bearer Token 即可。
Token 采用 HMAC 签名的自定义格式（不依赖 PyJWT 等第三方库），有效期 30 天，
并在临近过期时自动顺延，配合前端拦截器实现"只要在用就不掉线"。
"""

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Header, HTTPException, Request, Response

# 优先加载项目根目录下的 .env（覆盖本地开发或容器中未直接 export 的环境变量）
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv()

# 默认密码/密钥仅用于开箱即用；生产部署强烈建议通过环境变量覆盖，
# 且 APP_SECRET_KEY、APP_PASSWORD_HASH 都不应提交进代码库。
_DEFAULT_PASSWORD = "123456qw"
_DEFAULT_SECRET_KEY = "teacher-workbench-dev-secret-please-override-in-prod"

TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60  # Token 有效期：30 天
REFRESH_THRESHOLD_SECONDS = 7 * 24 * 60 * 60  # 剩余不足 7 天时自动签发新 token 顺延


def _sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# 支持两种配置方式：
# 1) 直接设置 APP_PASSWORD_HASH（sha256 十六进制串）——推荐生产环境使用；
# 2) 设置明文 APP_PASSWORD——图方便时用，程序启动时自动做一次哈希；
# 3) 都不设置——回退到内置默认密码 123456qw（仅适合本地/演示环境）。
def _resolve_password_hash() -> str:
    hash_env = os.environ.get("APP_PASSWORD_HASH", "").strip()
    if hash_env:
        return hash_env
    plain_env = os.environ.get("APP_PASSWORD", "").strip()
    if plain_env:
        return _sha256(plain_env)
    return _sha256(_DEFAULT_PASSWORD)


PASSWORD_HASH: str = _resolve_password_hash()
SECRET_KEY: str = os.environ.get("APP_SECRET_KEY", "").strip() or _DEFAULT_SECRET_KEY


def verify_password(raw_password: str) -> bool:
    """恒定时间比较，避免时序攻击。"""
    return hmac.compare_digest(_sha256(raw_password or ""), PASSWORD_HASH)


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(payload_b64: str) -> str:
    sig = hmac.new(SECRET_KEY.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(sig)


def create_token(ttl_seconds: int = TOKEN_TTL_SECONDS) -> str:
    payload_b64 = _b64encode(json.dumps({"exp": time.time() + ttl_seconds}).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64)}"


def _decode_token(token: str) -> dict | None:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(signature, _sign(payload_b64)):
        return None
    try:
        payload = json.loads(_b64decode(payload_b64))
    except Exception:
        return None
    if not isinstance(payload, dict) or "exp" not in payload:
        return None
    return payload


def require_auth(request: Request, response: Response, authorization: str = Header(default="")) -> None:
    """挂在整个受保护路由组上的认证依赖：

    - 从 `Authorization: Bearer <token>` 中取出并校验签名与有效期，失败统一 401。
    - 校验通过且距离过期不足 7 天时，通过响应头 `X-New-Token` 下发续期后的新 token，
      前端响应拦截器读取后静默替换本地存储，实现自动顺延、正常使用不掉线。
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = authorization[len("Bearer "):].strip()
    payload = _decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    exp = float(payload.get("exp", 0))
    now = time.time()
    if exp < now:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    if exp - now < REFRESH_THRESHOLD_SECONDS:
        response.headers["X-New-Token"] = create_token()
