"""学生数据导入脚本：将桌面/指定 txt 文件的学生名单写入 SQLite 数据库。

数据源格式：
班级    姓名    小组
八4班   冯馨予  第1组·组长
八4班   史桐心  第1组·组员
...

映射规则：
- 班级: 保持原样（八4班、八9班、八10班）
- 姓名: 保持原样
- 学号: 各班级内按出现顺序从 1 开始自动编排（1..54）
- 小组: 提取组名（如 "第1组·组长" -> "第1组"）
- 标签: 若为组长则标记 "组长"，其余为空
- 查重: 按自然键 (班级, 姓名) 查重，存在则更新或跳过
"""

import os
import sys

# 将 backend 加入模块搜索路径
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.database import Base, SessionLocal, engine
from app.models import Student


def read_txt_content(filepath: str) -> str:
    with open(filepath, "rb") as f:
        raw = f.read()
    for enc in ["gb18030", "gbk", "utf-8", "utf-16"]:
        try:
            return raw.decode(enc)
        except Exception:
            continue
    raise ValueError("无法识别文件编码格式")


def import_students_from_txt(filepath: str, clear_existing_classes: bool = True):
    # 确保表已创建
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    content = read_txt_content(filepath)
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        print("文件为空")
        return

    # 表头解析
    header_parts = lines[0].split()
    print(f"检测到表头: {header_parts}")

    rows = []
    class_counters: dict[str, int] = {}

    for idx, line in enumerate(lines[1:], start=2):
        parts = line.split("\t")
        if len(parts) != 3:
            parts = line.split()
        if len(parts) < 2:
            print(f"跳过无效行 {idx}: {line}")
            continue

        c = parts[0].strip()
        name = parts[1].strip()
        group_raw = parts[2].strip() if len(parts) > 2 else ""

        # 学号自增
        curr_no = class_counters.get(c, 0) + 1
        class_counters[c] = curr_no
        s_no = str(curr_no)

        # 小组与角色拆解: "第1组·组长" -> 小组: "第1组", 标签: "组长"
        if "·" in group_raw:
            grp, _, role = group_raw.partition("·")
            tag = role if "长" in role or role == "组长" else ""
        else:
            grp = group_raw
            tag = "组长" if "组长" in group_raw else ""

        rows.append({
            "班级": c,
            "姓名": name,
            "学号": s_no,
            "小组": grp,
            "标签": tag,
            "原始小组": group_raw,
        })

    print(f"共解析到 {len(rows)} 条学生数据，涵盖班级: {list(class_counters.keys())}")
    for c, cnt in class_counters.items():
        print(f" - {c}: {cnt} 人")

    imported_count = 0
    updated_count = 0

    try:
        for r in rows:
            exist = (
                db.query(Student)
                .filter(Student.班级 == r["班级"], Student.姓名 == r["姓名"])
                .first()
            )
            if exist:
                exist.学号 = r["学号"]
                exist.小组 = r["小组"]
                exist.标签 = r["标签"]
                updated_count += 1
            else:
                s = Student(
                    班级=r["班级"],
                    姓名=r["姓名"],
                    学号=r["学号"],
                    小组=r["小组"],
                    标签=r["标签"],
                )
                db.add(s)
                imported_count += 1
        db.commit()
        print(f"入库完成！新增: {imported_count} 条，更新: {updated_count} 条，总计: {imported_count + updated_count} 条。")
    finally:
        db.close()


if __name__ == "__main__":
    # 默认寻找桌面上的学生文件或本地文件
    target_files = [
        r"C:\Users\Administrator\Desktop\学生.txt",
        r"C:\Users\Administrator\.gemini\antigravity-ide\brain\810c4366-5bf9-4813-8e99-ec166cddd8a3\scratch\student_gb18030.txt",
    ]
    file_to_import = None
    for p in target_files:
        if os.path.exists(p):
            file_to_import = p
            break

    if not file_to_import and len(sys.argv) > 1:
        file_to_import = sys.argv[1]

    if not file_to_import:
        # 在桌面查找包含学生或4320大小的txt
        desktop = r"C:\Users\Administrator\Desktop"
        for fname in os.listdir(desktop):
            fpath = os.path.join(desktop, fname)
            if os.path.isfile(fpath) and os.path.getsize(fpath) == 4320:
                file_to_import = fpath
                break

    if not file_to_import:
        print("未找到目标 txt 文件！")
        sys.exit(1)

    print(f"使用数据源: {file_to_import}")
    import_students_from_txt(file_to_import)
