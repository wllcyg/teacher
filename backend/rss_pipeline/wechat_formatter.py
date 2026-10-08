import markdown

def generate_wechat_html(md_text: str) -> str:
    """
    将 Markdown 文本转换为适合微信公众号的排版 HTML。
    并在外部包裹一层带有“一键复制”功能的独立网页，方便用户在本地浏览器打开并一键复制排版。
    """
    
    # 1. 转换基础 HTML
    # 增加额外的扩展来支持表格和代码块，即使不用也增强兼容性
    raw_html = markdown.markdown(md_text, extensions=['tables', 'fenced_code', 'nl2br'])

    # 2. 编写好看的微信专属 CSS (浅色清爽极客风)
    # 这部分 CSS 主要是用于在浏览器里展示，当你复制在浏览器里渲染出的内容并粘贴到微信时，微信会自动将渲染样式转为内联(inline)。
    css_style = """
    <style>
        .wechat-container {
            max-width: 600px;
            margin: 0 auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #333333;
            line-height: 1.75;
            font-size: 15px;
            letter-spacing: 0.5px;
            padding: 20px;
            word-wrap: break-word;
        }
        
        .wechat-container h2 {
            font-size: 18px;
            color: #1a1a1a;
            border-left: 4px solid #007bff;
            padding-left: 10px;
            margin-top: 30px;
            margin-bottom: 15px;
            font-weight: bold;
        }

        .wechat-container h3 {
            font-size: 16px;
            color: #007bff;
            margin-top: 25px;
            margin-bottom: 12px;
            font-weight: bold;
        }

        .wechat-container p {
            margin-bottom: 15px;
            text-align: justify;
        }

        .wechat-container strong {
            color: #000;
            font-weight: bold;
        }

        .wechat-container ul, .wechat-container ol {
            padding-left: 20px;
            margin-bottom: 15px;
        }

        .wechat-container li {
            margin-bottom: 8px;
        }

        .wechat-container a {
            color: #007bff;
            text-decoration: none;
        }

        .wechat-container hr {
            border: 0;
            border-top: 1px solid #eaeaea;
            margin: 30px 0;
        }
        
        .wechat-container blockquote {
            border-left: 3px solid #d0d7de;
            color: #656d76;
            padding: 0 1em;
            margin: 15px 0;
            background: #f6f8fa;
            border-radius: 4px;
            padding-top: 10px;
            padding-bottom: 10px;
        }
        
        /* 独立的操作栏样式 (复制时不会带入到微信) */
        .toolbar {
            position: sticky;
            top: 0;
            background: #fff;
            padding: 15px;
            border-bottom: 1px solid #ddd;
            text-align: center;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            margin-bottom: 30px;
        }
        .copy-btn {
            background-color: #07c160;
            color: white;
            border: none;
            padding: 10px 24px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s;
        }
        .copy-btn:hover {
            background-color: #06ad56;
        }
    </style>
    """

    # 3. 构造完整的带复制功能的网页
    full_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 早报公众号排版生成器</title>
    {css_style}
</head>
<body>

    <!-- 顶栏操作区 (不会被复制到微信) -->
    <div class="toolbar" id="no-copy-zone">
        <button class="copy-btn" id="copy-btn" onclick="copyArticle()">✅ 一键复制到公众号</button>
        <div style="font-size: 12px; color: #888; margin-top: 8px;">点击上方按钮后，直接前往微信公众号编辑器使用 Ctrl+V 粘贴即可完美保留排版</div>
    </div>

    <!-- 真正用于展示和被复制的文章内容区域 -->
    <div class="wechat-container" id="article-content">
        {raw_html}
    </div>

    <script>
        function copyArticle() {{
            const article = document.getElementById('article-content');
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(article);
            selection.removeAllRanges();
            selection.addRange(range);
            
            try {{
                document.execCommand('copy');
                const btn = document.getElementById('copy-btn');
                const originalText = btn.innerText;
                btn.innerText = '复制成功！快去微信粘贴吧！';
                btn.style.backgroundColor = '#0052d9';
                
                setTimeout(() => {{
                    btn.innerText = originalText;
                    btn.style.backgroundColor = '#07c160';
                }}, 3000);
            }} catch(e) {{
                alert('复制失败，请手动按 Ctrl+A 全选文章内容后，按 Ctrl+C 复制。');
            }}
            
            // 为了视觉体验，复制完后清除蓝色的选中状态
            selection.removeAllRanges();
        }}
    </script>
</body>
</html>
"""
    return full_html
