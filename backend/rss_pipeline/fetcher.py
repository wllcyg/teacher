import os
import yaml
import time
import httpx
import feedparser
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse
from sqlalchemy.orm import Session
from difflib import SequenceMatcher

from .db import SessionLocal, Source, Item, Event

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")

def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def normalize_url(url: str) -> str:
    """去除URL中的跟踪参数，统一下划线结尾等"""
    parsed = urlparse(url)
    # 去除 query string
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, '', parsed.fragment)).rstrip('/')

def is_similar(a: str, b: str, threshold: float = 0.85) -> bool:
    """基于序列匹配的简单标题相似度计算"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > threshold

def fetch_rss_feed(feed_url: str):
    """带重试和User-Agent伪装的抓取"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
    }
    
    for attempt in range(2):
        try:
            with httpx.Client(timeout=25.0, follow_redirects=True) as client:  # 延长至 25s 防超时
                response = client.get(feed_url, headers=headers)
                response.raise_for_status()
                return feedparser.parse(response.content)
        except Exception as e:
            print(f"Fetch failed for {feed_url}, attempt {attempt+1}: {e}")
            time.sleep(2)
    return None

def sync_sources_to_db(db: Session, config: dict):
    """将 config.yaml 中的来源同步到数据库（如不存在则插入）"""
    db_sources_map = {}
    for source_cfg in config.get("sources", []):
        src = db.query(Source).filter(Source.url == source_cfg["url"]).first()
        if not src:
            src = Source(
                name=source_cfg["name"],
                source_type=source_cfg["type"],
                url=source_cfg["url"],
                weight=source_cfg.get("weight", 1),
                is_primary=source_cfg.get("is_primary", True)
            )
            db.add(src)
            db.commit()
            db.refresh(src)
        db_sources_map[src.url] = src
    return db_sources_map

def run_fetch_and_dedup():
    """主流程：抓取所有源 -> 去重 -> 入库"""
    print("=== 开始执行抓取与去重 ===")
    config = load_config()
    db = SessionLocal()
    
    try:
        # 同步来源
        sources_map = sync_sources_to_db(db, config)
        
        new_items_count = 0
        
        # 性能优化：在所有源抓取开始前，一次性预加载最近 100 条标题，避免 N+1 查询
        recent_items_cache = db.query(Item).order_by(Item.id.desc()).limit(100).all()
        
        for source_cfg in config.get("sources", []):
            url = source_cfg["url"]
            source_obj = sources_map.get(url)
            if not source_obj:
                continue
                
            print(f"Fetching [{source_obj.name}] - {url}")
            feed_data = fetch_rss_feed(url)
            if not feed_data or not feed_data.entries:
                print(f"  -> No data or failed to fetch.")
                continue
                
            for entry in feed_data.entries:
                item_url = getattr(entry, "link", "")
                if not item_url:
                    continue
                    
                canonical_url = normalize_url(item_url)
                
                # 1. 精确 URL 去重（如果数据库里已经有了这个链接，直接跳过）
                exists = db.query(Item).filter(Item.canonical_url == canonical_url).first()
                if exists:
                    continue
                    
                item_title = getattr(entry, "title", "").strip()
                item_summary = getattr(entry, "description", getattr(entry, "summary", ""))
                
                # 简单的时间解析
                pub_date = datetime.now(timezone.utc).replace(tzinfo=None)
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    import calendar
                    # feedparser的published_parsed是UTC的struct_time
                    timestamp = calendar.timegm(entry.published_parsed)
                    pub_date = datetime.fromtimestamp(timestamp, tz=timezone.utc).replace(tzinfo=None)
                
                # 核心改动：丢弃超过 48 小时的历史新闻，只保留最近的
                if (datetime.now(timezone.utc).replace(tzinfo=None) - pub_date).total_seconds() > 48 * 3600:
                    continue
                
                # 2. 标题相似度事件合并去重
                # 寻找最近 48 小时内的已有新闻进行标题比对，决定是否视为同一“事件”
                matched_event = None
                for past_item in recent_items_cache:  # 使用预加载缓存，避免 N+1 查询
                    if is_similar(item_title, past_item.title):
                        # 如果相似，直接复用它的 event_id
                        if past_item.event_id:
                            matched_event = past_item.event_id
                        else:
                            # 对方还没有 event，创建一个新的
                            new_event = Event(title=item_title)
                            db.add(new_event)
                            db.flush()
                            past_item.event_id = new_event.id
                            matched_event = new_event.id
                        break
                
                # 存入原始条目
                new_item = Item(
                    source_id=source_obj.id,
                    url=item_url,
                    canonical_url=canonical_url,
                    title=item_title,
                    summary=item_summary,
                    published_at=pub_date,
                    event_id=matched_event
                )
                db.add(new_item)
                db.commit()
                # 将新条目追加到本地缓存，本次运行内同样生效去重
                recent_items_cache.append(new_item)
                new_items_count += 1
                
        print(f"=== 抓取完成，共新增 {new_items_count} 条去重后的资讯 ===")
        return new_items_count
        
    finally:
        db.close()

if __name__ == "__main__":
    run_fetch_and_dedup()
