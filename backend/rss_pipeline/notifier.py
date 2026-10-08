import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# 从环境变量中读取邮箱配置，防止代码硬编码泄露
SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 465
EMAIL_USER = os.getenv("BACKUP_EMAIL_USER", "")
EMAIL_PASS = os.getenv("BACKUP_EMAIL_PASS", "")

def send_newsletter_email(html_content: str):
    """
    将生成的 HTML 早报推送到用户的 QQ 邮箱。
    """
    print("[Notifier] 正在将生成的早报推送到 QQ 邮箱...")
    try:
        msg = MIMEMultipart()
        msg["From"] = formataddr((str(Header("🤖 AI 极客早报", "utf-8")), EMAIL_USER))
        msg["To"] = EMAIL_USER
        
        date_str = datetime.now().strftime("%Y年%m月%d日")
        msg["Subject"] = Header(f"【您的早报已就绪】AI 极客早报 - {date_str}", "utf-8")
        
        # 附加生成的 HTML 正文
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        
        # 连接 QQ 邮箱 SMTP 服务器并发送
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=15) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)
            
        print("[Notifier] 推送成功！请查看您的手机 QQ 邮箱。")
        
    except Exception as e:
        print(f"[Notifier] 邮件推送失败: {e}")
