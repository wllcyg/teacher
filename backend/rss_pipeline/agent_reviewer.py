from .agent_base import BaseAgent

class ReviewerAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        # Reviewer 可以使用快一些的模型如 flash
        self.model = self.config.get("llm", {}).get("scorer_model", "gemini-1.5-flash")

    def review_draft(self, draft_markdown: str) -> str:
        """
        审校早报草稿，检查格式并润色
        """
        system_prompt = """你是一个严谨的技术主编。请审核下方提供的微信公众号早报 Markdown 草稿。
你的任务是：
1. 检查语句是否通顺，是否存在明显的机翻痕迹，如果是请将其润色为自然流畅的中文技术表达。
2. 检查 Markdown 格式是否整洁（例如加粗、列表缩进是否一致）。
3. 确保风格符合“专业极客风”，移除任何过度夸张或幼稚的表达。
4. 如果文章完美，可以原样返回。如果有问题，请直接返回修改后的完整 Markdown 文本。
不需要解释你的修改，只输出最终的 Markdown 即可（不要用 ```markdown 代码块包裹，直接输出文本）。
"""
        
        print("[ReviewerAgent] Reviewing draft...")
        revised_draft = self.call_llm_text(system_prompt, f"草稿如下：\n\n{draft_markdown}")
        
        # 清理可能被 LLM 包裹的 markdown 标记
        if revised_draft.startswith("```markdown"):
            revised_draft = revised_draft[11:]
        elif revised_draft.startswith("```"):
            revised_draft = revised_draft[3:]
            
        if revised_draft.endswith("```"):
            revised_draft = revised_draft[:-3]
            
        return revised_draft.strip()
