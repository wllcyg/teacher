import json
from .agent_base import BaseAgent

class ScorerAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        # 使用配置文件中指定的 scorer_model，如果子类不传参则使用基类默认的

    def local_pre_filter(self, items: list, top_k: int = 50) -> list:
        """
        本地预筛选，降低发送给 LLM 的 token 数量。
        items 包含字段: id, title, source_name, source_weight, summary 等
        """
        # 从 config.yaml 动态读取关键词主题，默认回退到原来的 AI 极客主题
        keywords = self.config.get("theme", {}).get("keywords", [
            "AI", "LLM", "GPT", "OpenAI", "DeepMind", "React", "Vue", "Frontend", "Web", "Next.js", "Vite", "开源", "模型", "模型发布"
        ])
        
        scored_items = []
        for item in items:
            score = item.get("source_weight", 1) * 2 # 来源权重基数
            title = (item.get("title") or "").lower()
            summary = (item.get("summary") or "").lower()
            
            # 关键词加分
            for kw in keywords:
                if kw.lower() in title:
                    score += 5
                if kw.lower() in summary:
                    score += 2
            
            scored_items.append({"item": item, "score": score})
            
        # 按分数倒序，取 top_k
        scored_items.sort(key=lambda x: x["score"], reverse=True)
        return [x["item"] for x in scored_items[:top_k]]

    def score_items(self, items: list, top_k: int = 5) -> list:
        """
        利用 LLM 对预筛选后的资讯进行最终打分和提取
        返回一个包含选中的资讯 ID、得分和入选理由的列表
        """
        pre_filtered = self.local_pre_filter(items, top_k=30)
        
        # 构建精简版数据给 LLM，防止 token 超限
        llm_input_data = []
        for item in pre_filtered:
            llm_input_data.append({
                "id": item["id"],
                "title": item["title"],
                "source": item.get("source_name", "Unknown"),
                "summary": item.get("summary", "")[:200] # 截取摘要防超长
            })

        default_prompt = """你是一个资深前端与AI全栈技术专家。你的任务是从一组技术资讯中，挑选出最有价值、最硬核、最适合作为今天技术早报头条的资讯。
请挑选出最具价值的前 {top_k} 条资讯。
评估标准：
1. 行业影响力（如重大开源模型发布、重磅前端框架更新）。
2. 对前端开发/全栈开发者的实用价值。
3. 创新性与前瞻性。

必须返回 JSON 格式，格式要求如下：
{{
  "selected_items": [
    {{
      "id": 123,
      "score": 95, // 0-100 分
      "reason": "简短的入选理由（一句话）",
      "tags": ["AI", "LLM"] // 1-2个标签
    }}
  ]
}}
"""
        system_prompt = self.config.get("prompts", {}).get("scorer_prompt", default_prompt).format(top_k=top_k)

        user_prompt = "候选资讯列表（JSON）：\n" + json.dumps(llm_input_data, ensure_ascii=False)

        print(f"[ScorerAgent] Sending {len(llm_input_data)} items to LLM for final scoring...")
        result = self.call_llm_json(system_prompt, user_prompt)
        
        return result.get("selected_items", [])
