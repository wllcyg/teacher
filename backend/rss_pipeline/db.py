import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker

# 数据库文件放在原项目 backend/data/ 下
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "rss_agent.db")
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Source(Base):
    """RSS来源配置镜像"""
    __tablename__ = "sources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # rss / github_release / api
    url = Column(String, nullable=False)
    weight = Column(Integer, default=1)
    is_primary = Column(Boolean, default=True)

class Event(Base):
    """去重合并后的事件"""
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    first_seen_at = Column(DateTime, default=datetime.utcnow)

class Item(Base):
    """抓取到的原始条目"""
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"))
    url = Column(String, nullable=False, unique=True)
    canonical_url = Column(String, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)

class Score(Base):
    """筛选结果打分"""
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    run_id = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    tags = Column(String, nullable=True)
    reason = Column(String, nullable=True)

class Draft(Base):
    """初稿及发布状态"""
    __tablename__ = "drafts"
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String, nullable=False)
    markdown = Column(Text, nullable=True)
    html = Column(Text, nullable=True)
    status = Column(String, default="pending")
    wechat_media_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RunRecord(Base):
    """每次运行记录"""
    __tablename__ = "runs"
    id = Column(String, primary_key=True) # 可以用 YYYYMMDD 格式或 UUID
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String, nullable=False) # running, success, failed
    stage = Column(String, nullable=True)
    error_msg = Column(Text, nullable=True)
    token_usage = Column(Integer, default=0)

def init_db():
    """初始化数据库表"""
    # 确保 data 目录存在
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    print(f"Initializing RSS Agent database at: {DB_PATH}")
    init_db()
    print("Database tables created successfully.")
