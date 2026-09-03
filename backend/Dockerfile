# 使用官方轻量级 Python 3.11 镜像
FROM python:3.11-slim

# 工作目录
WORKDIR /app

# 设置容器环境变量：
# 1. 禁用 Python 字节码缓存 (.pyc)
# 2. 强制标准输出无缓冲，方便 docker logs 实时查看日志
# 3. 指定数据持久化目录为 /app/data
# 4. 配置时区为上海，保证考勤与课程时间准确
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    TZ=Asia/Shanghai

# 安装时区支持与基础工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖说明并使用国内清华源高速安装
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 复制后端源码
COPY . .

# 预先创建数据持久化挂载目录
RUN mkdir -p /app/data

# 暴露 FastAPI 服务端口
EXPOSE 8001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8001/api/health || exit 1

# 启动命令：必须监听 0.0.0.0 才能在容器外部被访问
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
