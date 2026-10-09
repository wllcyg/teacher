import httpx
from bs4 import BeautifulSoup
import re
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=False
)
def _do_fetch_article_text(url: str, max_length: int) -> str:
    print(f"[Extractor] 正在深度抓取原文 (超时设为45s): {url}")
    # 使用浏览器常见的 UA 防止被墙
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    with httpx.Client(timeout=45.0, follow_redirects=True) as client:
        resp = client.get(url, headers=headers)
        resp.raise_for_status()
        
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        
        # 剔除无用的脚本和样式
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
        
        # 获取纯文本，按换行符分割并去掉多余空行
        text = soup.get_text(separator="\n")
        
        # 清洗空行和多余空格
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        cleaned_text = "\n".join(lines)
        
        # 去除长串的乱码、过多的下划线等（简单的噪音过滤）
        cleaned_text = re.sub(r'[\r\n]{3,}', '\n\n', cleaned_text)
        
        # 如果内容太长，截取前面的部分（通常核心重点都在前部分）
        if len(cleaned_text) > max_length:
            cleaned_text = cleaned_text[:max_length] + "\n...[内容截断]"
            
        return cleaned_text

def fetch_article_text(url: str, max_length: int = 4000) -> str:
    """
    抓取指定网页的正文内容。
    提取文本并清理多余空白符，最多截取 max_length 长度，防止大模型 token 超限。
    """
    try:
        res = _do_fetch_article_text(url, max_length)
        if isinstance(res, Exception):
            raise res
        print(f"[Extractor] 成功提取原文，长度: {len(res)} 字符")
        return res
    except Exception as e:
        print(f"[Extractor] 抓取原文失败 (已重试3次) {url}: {e}")
        return "原文抓取失败，请仅参考标题与摘要进行总结。"
