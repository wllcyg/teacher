import datetime
import uuid
import os
import markdown # 用于转 html
from datetime import timezone
from sqlalchemy.orm import Session
from .db import SessionLocal, Item, Source, Score, Draft, RunRecord
from .agent_scorer import ScorerAgent
from .agent_writer import WriterAgent
from .agent_reviewer import ReviewerAgent
from .fetcher import run_fetch_and_dedup
from .fetcher import load_config

def run_llm_pipeline(run_id: str = None):
    if not run_id:
        run_id = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S") + "-" + str(uuid.uuid4())[:8]

    print(f"=== Starting LLM Pipeline (Run ID: {run_id}) ===")
    
    session: Session = SessionLocal()
    
    try:
        # 0. 先记录运行状态（放到最前面，防止后面的抓取崩溃导致记录丢失）
        record = RunRecord(id=run_id, status="running", stage="llm_pipeline")
        session.add(record)
        session.commit()
        
        # 1. 步骤一：触发 RSS 抓取与去重
        print("[Workflow] 步骤 1/4: 触发 RSS 抓取与去重...")
        new_count = run_fetch_and_dedup()
        print(f"[Workflow] RSS 抓取完成，新增 {new_count} 条资讯。")

        # 2. 查询最近 48 小时的未评分资讯 (这里简单起见取全部最近抓取的)
        forty_eight_hours_ago = datetime.datetime.now(timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=48)
        
        # 关联查询以获取 source_name 和 weight
        items_query = session.query(Item, Source).join(Source, Item.source_id == Source.id)\
            .filter(Item.fetched_at >= forty_eight_hours_ago)\
            .all()
            
        if not items_query:
            print("No new items found in the last 48 hours.")
            record.status = "success"
            record.stage = "completed_no_data"
            session.commit()
            return
            
        # 构建候选字典
        candidates = []
        item_obj_map = {}
        for item, source in items_query:
            data = {
                "id": item.id,
                "title": item.title,
                "url": item.url,
                "summary": item.summary,
                "source_name": source.name,
                "source_weight": source.weight
            }
            candidates.append(data)
            item_obj_map[item.id] = data

        print(f"Found {len(candidates)} candidate items.")

        # 3. 步骤一：ScorerAgent 筛选与打分
        scorer = ScorerAgent()
        # 让它选出 Top 5
        scored_results = scorer.score_items(candidates, top_k=5)
        
        if not scored_results:
            raise Exception("ScorerAgent returned no results.")

        # 将选中结果存入 Score 表，并拼装 Writer 所需数据
        writer_input = []
        for res in scored_results:
            item_id = res.get("id")
            if item_id in item_obj_map:
                # 记录 Score
                db_score = Score(
                    item_id=item_id,
                    run_id=run_id,
                    score=float(res.get("score", 0)),
                    reason=res.get("reason", ""),
                    tags=",".join(res.get("tags", []))
                )
                session.add(db_score)
                
                # 组装给 Writer 的数据
                full_item = item_obj_map[item_id]
                full_item["reason"] = res.get("reason", "")
                full_item["tags"] = res.get("tags", [])
                
                # 深度提取原文正文
                from .article_extractor import fetch_article_text
                full_content = fetch_article_text(full_item["url"])
                full_item["full_content"] = full_content
                
                writer_input.append(full_item)
                
        session.commit()
        print(f"Scored {len(writer_input)} top items and saved to DB.")

        # 4. 步骤二：WriterAgent 撰写初稿
        writer = WriterAgent()
        draft_md = writer.draft_newsletter(writer_input)
        if not draft_md:
            raise Exception("WriterAgent failed to generate draft.")

        # 5. 步骤三：ReviewerAgent 审校润色
        reviewer = ReviewerAgent()
        final_md = reviewer.review_draft(draft_md)
        
        # 转换带有微信样式的 HTML 并生成本地浏览器预览版
        config = load_config()
        theme_title = config.get("theme", {}).get("title", "🤖 AI 极客早报")
        
        from .wechat_formatter import generate_wechat_html
        final_html = generate_wechat_html(final_md)
        
        # 将最新的网页持久化到输出目录
        # 支持通过环境变量 OUTPUT_DIR 自定义输出目录，容器部署时不依赖 __file__ 相对路径
        default_output_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_dir = os.environ.get("OUTPUT_DIR", default_output_dir)
        output_html_path = os.path.join(output_dir, "latest_newsletter.html")
        with open(output_html_path, "w", encoding="utf-8") as f:
            f.write(final_html)

        # 自动推送到手机 QQ 邮箱
        from .notifier import send_newsletter_email
        send_newsletter_email(final_html, theme_title=theme_title)

        # 存入 Draft 表
        draft_record = Draft(
            run_id=run_id,
            markdown=final_md,
            html=final_html,
            status="pending"
        )
        session.add(draft_record)

        # 更新运行记录
        record.status = "success"
        record.stage = "completed"
        record.finished_at = datetime.datetime.now(timezone.utc).replace(tzinfo=None)
        session.commit()
        
        print("=== LLM Pipeline Completed Successfully ===")
        print(f"Draft saved to DB. Run ID: {run_id}")

    except Exception as e:
        session.rollback()
        print(f"Pipeline Error: {e}")
        
        # 尝试更新错误状态
        try:
            record = session.query(RunRecord).filter_by(id=run_id).first()
            if record:
                record.status = "failed"
                record.error_msg = str(e)
                record.finished_at = datetime.datetime.now(timezone.utc).replace(tzinfo=None)
                session.commit()
        except:
            pass

    finally:
        session.close()

if __name__ == "__main__":
    run_llm_pipeline()
