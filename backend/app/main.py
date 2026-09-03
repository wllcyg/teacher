"""FastAPI 应用入口。

启动时建表 + 灌示例数据，挂载通用 CRUD 与报表接口，并暴露静态前端（如已构建）。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  确保模型注册到 Base.metadata
from .database import Base, SessionLocal, engine
from .routers import router
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时建表 + 灌示例数据
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="教师工作台 API",
    description="崔老师教师工作台（FastAPI + SQLite）后端",
    version="1.0.0",
    lifespan=lifespan,
)

# 前端开发时走 Vite 代理，这里放开 CORS 便于直接联调
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

