"""数据库连接：SQLite 单文件 + SQLAlchemy 2.0。

单用户应用，SQLite 完全够用。数据落在一个 .db 文件里，零部署。
"""
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "teacher_workbench.db")

SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")

# check_same_thread=False 是 SQLite + FastAPI（线程池）配合的必需项
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """优化 SQLite 并发读写性能与可靠性：
    1. 启用 WAL (Write-Ahead Logging) 模式，读写互不阻塞；
    2. 设置 synchronous=NORMAL，大幅提升批量写入速度；
    3. 设置 busy_timeout=5000ms，高并发时自动重试等待，防止抛出 database is locked。
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖：每个请求一个 session。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
