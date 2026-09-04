#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 脚本功能：安全将生产环境数据库 (backend_data) 克隆到本地开发环境 (backend/app/data)
# -----------------------------------------------------------------------------
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROD_DB="$PROJECT_ROOT/backend_data/teacher_workbench.db"
DEV_DIR="$PROJECT_ROOT/backend/app/data"
DEV_DB="$DEV_DIR/teacher_workbench.db"

if [ ! -f "$PROD_DB" ]; then
  echo "❌ 错误: 未找到生产数据库文件: $PROD_DB"
  exit 1
fi

mkdir -p "$DEV_DIR"

echo "📦 正在使用 SQLite 在线备份机制克隆生产数据库..."
# 使用 sqlite3 在线 backup 命令，即便生产容器正在运行/读写，也不会损坏文件或造成锁死
sqlite3 "$PROD_DB" ".backup '$DEV_DB'"

echo "✅ 复制完成！"
echo "生产数据库路径: $PROD_DB"
echo "开发数据库路径: $DEV_DB"
echo ""
echo "📊 数据统计校验："
sqlite3 "$DEV_DB" "SELECT '  - 学生人数: ' || count(*) FROM students; SELECT '  - 学情记录数: ' || count(*) FROM academic; SELECT '  - 节次时间配置数: ' || count(*) FROM schedule; SELECT '  - 班级通信录数: ' || count(*) FROM comms;"
