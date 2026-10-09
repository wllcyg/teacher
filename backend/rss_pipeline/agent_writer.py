import json
from .agent_base import BaseAgent

class WriterAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        # 默认使用配置中的 writer_model
        self.model = self.config.get("llm", {}).get("writer_model", "gemini-1.5-pro")

    def draft_newsletter(self, selected_items: list) -> str:
        """
        基于选中的资讯生成早报 Markdown 草稿。
        selected_items: 包含资讯完整信息和打分理由的字典列表。
        """
        default_prompt = """你是一个拥有深厚经验的技术自媒体主理人，也是一名前端与AI全栈工程师。
你的任务是根据提供的今日最佳技术资讯，撰写一篇面向开发者的微信公众号早报文章。

【写作规范】
1. 语言风格：专业、简洁、极客风，直接指出该技术对开发者的实际意义，不要废话。必须全程使用中文。
2. 结构排版：
   - 文章开头：一句吸引人的技术金句或全篇核心看点总结。
   - 正文：分为几个主要模块（例如：🔥 AI 前沿、🚀 开源框架动向、🛠️ 开发者工具）。
   - 每个资讯条目：
     - **标题** (加入适当 emoji，并包含原文链接)
     - **深度看点**：基于提供的原文正文(full_content)或摘要，提炼出最核心的 2-3 个技术细节，而不是简单的表面翻译。
     - **极客点评**：你作为资深工程师，结合原文内容给出的技术见解、适用场景或避坑指南。
   - 结尾：鼓励读者在评论区交流或点击关注。
3. 格式：严格输出 Markdown 格式。

【提示】
文章不需要包含过多的营销口号，要注重“干货”。如果提供了原文内容(full_content)，请务必深挖其中的干货细节。
"""
        system_prompt = self.config.get("prompts", {}).get("writer_prompt", default_prompt)

        # 构建给 LLM 的输入数据
        input_data = []
        for item in selected_items:
            input_data.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "summary": item.get("summary", ""),
                "full_content": item.get("full_content", "无正文"),
                "source": item.get("source_name", ""),
                "selected_reason": item.get("reason", ""), # 之前 scorer 的理由
                "tags": item.get("tags", [])
            })

        user_prompt = "今日筛选出的核心资讯：\n" + json.dumps(input_data, ensure_ascii=False)

        print(f"[WriterAgent] Drafting newsletter from {len(selected_items)} items...")
        return self.call_llm_text(system_prompt, user_prompt)
