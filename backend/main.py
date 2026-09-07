import os
import uvicorn

if __name__ == "__main__":
    # 本地开发后端写死 9001 端口（8001 端口保留给生产环境 Docker 容器及 Cloudflare 隧道）
    uvicorn.run("app.main:app", host="127.0.0.1", port=9001, reload=True)
