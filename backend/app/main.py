"""FastAPI 应用入口。

启动时建表 + 灌示例数据，挂载通用 CRUD 与报表接口，并暴露静态前端（如已构建）。
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from datetime import datetime

async def rss_daily_scheduler():
    """纯原生的后台死循环定时器，每天早上 6:30 自动调用流水线"""
    while True:
        now = datetime.now()
        if now.hour == 6 and now.minute == 30:
            print("[RSS Scheduler] 到达 06:30，触发每日自动早报流水线...")
            try:
                # 动态导入，避免循环依赖，用 to_thread 避免阻塞主线程
                from rss_pipeline.workflow import run_llm_pipeline
                await asyncio.to_thread(run_llm_pipeline)
            except Exception as e:
                print(f"[RSS Scheduler] 流水线运行失败: {e}")
            # 等待 61 秒防止同一分钟内重复触发
            await asyncio.sleep(61)
        else:
            await asyncio.sleep(30)

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv()

from . import models  # noqa: F401  确保模型注册到 Base.metadata
from .auth import require_auth
from .auth_router import auth_router
from .database import Base, engine
from .routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时确保表结构已建立
    Base.metadata.create_all(bind=engine)
    from .migration import init_student_ids_and_schema
    init_student_ids_and_schema(engine)
    
    # 将早报任务作为守护协程挂载到 FastAPI 生命周期中
    rss_task = asyncio.create_task(rss_daily_scheduler())
    
    yield
    
    rss_task.cancel()


app = FastAPI(
    title="教师工作台 API",
    description="崔老师教师工作台（FastAPI + SQLite）后端",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 白名单：只允许前端实际部署的域名与本地开发端口访问，杜绝任意来源放行。
# 始终包含本地开发端口（localhost / 127.0.0.1:5173 / 4173），并从 ALLOWED_ORIGINS 追加线上域名。
_dev_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
}
_env_origins = {
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://yg.cheatppf.xyz,https://teacher.cheatppf.xyz",
    ).split(",")
    if origin.strip()
}
ALLOWED_ORIGINS = sorted(_dev_origins | _env_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # X-New-Token 是登录 Token 自动顺延用的自定义响应头，默认不对跨域 JS 可见，必须显式 expose 。
    expose_headers=["X-New-Token"],
)

# 登录接口本身不需要认证；其余全部业务接口统一挂 require_auth，
# 未带有效 Token 一律 401（vault 导入导出、CRUD、report、settings 等自动全部被保护）。
app.include_router(auth_router)
app.include_router(router, dependencies=[Depends(require_auth)])


@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/rss/trigger", tags=["RSS"])
def trigger_rss_pipeline(background_tasks: BackgroundTasks):
    """供前台点击按钮，立刻手动触发早报流水线（后台异步执行不卡前端）"""
    from rss_pipeline.workflow import run_llm_pipeline
    background_tasks.add_task(run_llm_pipeline)
    return {"message": "RSS 早报流水线已在后台触发，请留意终端或邮箱通知。"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)

