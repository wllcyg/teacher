#!/usr/bin/env python3
"""
教师工作台 - 数据库自动热备份并推送到 QQ 邮箱
"""
import os
import smtplib
import sqlite3
import gzip
import shutil
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

# ================= 配置区 =================
SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 465  # SSL 加密端口
EMAIL_USER = os.getenv("BACKUP_EMAIL_USER", "904039807@qq.com")
EMAIL_PASS = os.getenv("BACKUP_EMAIL_PASS", "gmbyzyprtsrzbbej")
TO_EMAIL = os.getenv("BACKUP_TO_EMAIL", "904039807@qq.com")

# 默认数据库路径（支持环境变量覆盖）
DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend_data", "teacher_workbench.db")
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH)
# ==========================================


def find_sqlite_db():
    """多路径探测 SQLite 数据库位置"""
    if os.path.exists(DB_PATH):
        return DB_PATH
    
    # 常见可能路径探测
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "app.db"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "teacher.db"),
        "/app/backend_data/teacher.db",
        "/data/teacher.db",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return DB_PATH


def backup_and_send():
    real_db_path = find_sqlite_db()
    if not os.path.exists(real_db_path):
        print(f"[错误] 未找到数据库文件: {real_db_path}")
        return False

    db_size_mb = os.path.getsize(real_db_path) / (1024 * 1024)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    temp_dir = "/tmp" if os.name != "nt" else os.environ.get("TEMP", ".")
    
    raw_backup = os.path.join(temp_dir, f"teacher_backup_{timestamp}.db")
    gz_backup = f"{raw_backup}.gz"

    print(f"[{date_str}] 开始备份数据库: {real_db_path} (大小: {db_size_mb:.2f} MB)")

    try:
        # 1. SQLite 在线热备份（保证数据一致性，防止运行时损坏）
        src = sqlite3.connect(real_db_path)
        dst = sqlite3.connect(raw_backup)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()

        # 2. Gzip 压缩（通常压缩率在 70%~90%，几MB压缩后只有几百KB）
        with open(raw_backup, "rb") as f_in:
            with gzip.open(gz_backup, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        gz_size_kb = os.path.getsize(gz_backup) / 1024
        print(f"压缩完成，压缩后大小: {gz_size_kb:.2f} KB")

        # 3. 构造邮件
        from email.utils import formataddr
        from email.header import Header
        msg = MIMEMultipart()
        msg["From"] = formataddr((str(Header("教师工作台", "utf-8")), EMAIL_USER))
        msg["To"] = TO_EMAIL
        msg["Subject"] = Header(f"【数据备份】教师工作台 SQLite 备份 ({datetime.now().strftime('%Y-%m-%d')})", "utf-8")

        body = f"""您好！

这是教师工作台的定时自动数据备份邮件。

- 备份时间: {date_str}
- 原数据库大小: {db_size_mb:.2f} MB
- 压缩包大小: {gz_size_kb:.2f} KB
- 备份文件名: teacher_{timestamp}.db.gz

附件为 Gzip 压缩后的 SQLite 镜像，如需还原解压后即为标准 .db 数据库文件。
"""
        msg.attach(MIMEText(body, "plain", "utf-8"))

        # 添加附件
        with open(gz_backup, "rb") as f:
            part = MIMEBase("application", "gzip")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="teacher_{timestamp}.db.gz"'
            )
            msg.attach(part)

        # 4. 发送邮件（QQ 邮箱使用 SSL 端口 465）
        print("正在连接 QQ 邮箱服务器发送邮件...")
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=30) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)

        print(f"[SUCCESS] 备份成功！邮件已送达至: {TO_EMAIL}")
        return True

    except Exception as e:
        print(f"[FAILED] 备份或发送失败: {e}")
        return False

    finally:
        # 清理临时文件
        for temp_file in [raw_backup, gz_backup]:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass


if __name__ == "__main__":
    backup_and_send()
