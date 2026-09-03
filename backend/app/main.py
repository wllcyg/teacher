"""FastAPI 应用入口。

启动时建表 + 灌示例数据，挂载通用 CRUD 与报表接口，并暴露静态前端（如已构建）。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  确保模型注册到 Base.metadata
from .database import Base, engine
from .routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时确保表结构已建立
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="教师工作台 API",
    description="崔老师教师工作台（FastAPI + SQLite）后端",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置全量 CORS 跨域支持（支持跨源访问、携带凭证、任意请求头与方法）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)

