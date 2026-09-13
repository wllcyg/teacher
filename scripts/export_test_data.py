"""
从 Python 后端 SQLite 数据库导出测试数据，严格标记 _env: "test"，确保与生产环境绝对隔离。
"""
import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "../backend/app/data/teacher_workbench.db")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../data")
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "test_data_export.json")

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def export():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = dict_factory
    cursor = conn.cursor()

    export_bundle = {
        "metadata": {
            "exported_at": datetime.now().isoformat(),
            "env": "test",
            "description": "开发与测试环境专属种子数据，已打上 _env='test' 隔离标记，严禁混入生产环境 prod"
        },
        "data": {}
    }

    target_tables = ["students", "schedule", "todos", "items", "academic"]
    for table in target_tables:
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        # 为每行数据注入隔离标识
        tagged_rows = []
        for r in rows:
            row_copy = dict(r)
            row_copy["_env"] = "test"
            row_copy["_source"] = "backend_sqlite_export"
            tagged_rows.append(row_copy)
        export_bundle["data"][table] = tagged_rows
        print(f"导出测试表 {table}: {len(tagged_rows)} 条")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(export_bundle, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 测试数据导出完毕: {OUTPUT_FILE}")

if __name__ == "__main__":
    export()
