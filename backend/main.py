import os
import uvicorn

if __name__ == "__main__":
    # 本地开发后端默认使用 8002 端口（8001 端口保留给生产环境 Docker 容器及 Cloudflare 隧道）
    port = int(os.environ.get("PORT", 8002))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
