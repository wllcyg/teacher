"""登录接口：不挂在受保护的 router 上（否则鸡生蛋问题——登录本身也需要 token 了）。"""

from fastapi import APIRouter, HTTPException, Request

from . import auth, rate_limit

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


@auth_router.post("/login")
def login(payload: dict, request: Request):
    rate_limit.check_login_rate_limit(request)
    password = str(payload.get("password") or "")
    if not auth.verify_password(password):
        rate_limit.record_login_failure(request)
        raise HTTPException(status_code=401, detail="密码错误")
    rate_limit.record_login_success(request)
    return {
        "access_token": auth.create_token(),
        "token_type": "bearer",
        "expires_in": auth.TOKEN_TTL_SECONDS,
    }
