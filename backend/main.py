import os
import uvicorn

if __name__ == "__main__":
    # 本地开发后端使用 9003 端口（避开 SkyGuard 占用的 9001/9002；8001 保留给生产 Docker）
    uvicorn.run("app.main:app", host="127.0.0.1", port=9003, reload=True)
