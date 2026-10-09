import os
import yaml
import json
from openai import OpenAI
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# 自动寻找并加载项目根目录下的 .env 文件
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

def get_config():
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

class BaseAgent:
    def __init__(self, model_name: str = None):
        self.config = get_config()
        llm_cfg = self.config.get("llm", {})
        api_key_env = llm_cfg.get("api_key_env_var", "LLM_API_KEY")
        
        # 优先读取配置文件中的 api_key，其次取环境变量
        self.api_key = llm_cfg.get("api_key") or os.environ.get(api_key_env)
        
        # 即使这里不报错，在 call_llm 时如果为空 OpenAI SDK 也会报错，但可以给出更好提示
        if not self.api_key:
            print(f"Warning: api_key is not set in config or {api_key_env} environment variable.")
            
        # 优先读取配置文件中的 base_url
        self.base_url = llm_cfg.get("base_url") or os.environ.get("LLM_BASE_URL")
        
        # 为了兼容不同的服务商，这里不固定 base_url 除非用户设置了
        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
            
        self.client = OpenAI(**client_kwargs)
        self.model = model_name or llm_cfg.get("scorer_model", "gemini-1.5-flash")

    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=False
    )
    def _do_call_llm_json(self, system_prompt: str, user_prompt: str) -> dict:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        content = response.choices[0].message.content
        return json.loads(content)

    def call_llm_json(self, system_prompt: str, user_prompt: str) -> dict:
        """调用 LLM 并要求返回 JSON，适用于打分等结构化输出场景"""
        try:
            res = self._do_call_llm_json(system_prompt, user_prompt)
            # 如果重试3次仍失败，tenacity (reraise=False) 会返回最终的异常对象
            if isinstance(res, Exception):
                raise res
            return res
        except Exception as e:
            print(f"[{self.__class__.__name__}] LLM JSON Call Error after 3 retries: {e}")
            return {}

    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=False
    )
    def _do_call_llm_text(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7
        )
        return response.choices[0].message.content

    def call_llm_text(self, system_prompt: str, user_prompt: str) -> str:
        """调用 LLM 返回纯文本，适用于撰写文章、审校"""
        try:
            res = self._do_call_llm_text(system_prompt, user_prompt)
            if isinstance(res, Exception):
                raise res
            return res
        except Exception as e:
            print(f"[{self.__class__.__name__}] LLM Text Call Error after 3 retries: {e}")
            return ""
