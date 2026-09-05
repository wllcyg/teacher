"""登录接口防暴力破解：基于 IP + 失败次数的内存限流。

单用户小项目没必要引入 Redis，进程内存字典即可；重启后清零，影响可忽略。
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request

_attempts: dict[str, list[float]] = defaultdict(list)

MAX_ATTEMPTS = 5  # 窗口期内最多失败次数
WINDOW_SECONDS = 15 * 60  # 窗口期：15 分钟


def _client_ip(request: Request) -> str:
    # 部署链路上有 Nginx/Cloudflare/FRP 反代时，真实 IP 在 X-Forwarded-For 里，
    # 否则 request.client.host 拿到的永远是反代服务器自己的地址，限流会形同虚设。
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_login_rate_limit(request: Request) -> None:
    ip = _client_ip(request)
    now = time.time()
    _attempts[ip] = [t for t in _attempts[ip] if now - t < WINDOW_SECONDS]
    if len(_attempts[ip]) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="尝试次数过多，请 15 分钟后再试")


def record_login_failure(request: Request) -> None:
    _attempts[_client_ip(request)].append(time.time())


def record_login_success(request: Request) -> None:
    _attempts.pop(_client_ip(request), None)
