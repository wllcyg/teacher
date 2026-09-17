"""数据库自动平滑迁移脚本：
1. 确保所有业务表包含 student_id、client_id；
2. 为历史学生分配规范的唯一业务编号（STU0001、STU0002...）；
3. 纯英文架构根治：自动将 11 张表的物理中文列名就地重命名为规范英文字段名；
4. 全程原生 SQLite ALTER TABLE 事务执行，幂等安全，零数据丢失。
"""
import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger("migration")

RELATED_TABLES = ["academic", "behavior", "attendance", "parents", "comms", "duties"]

TABLE_COLUMN_RENAMES = {
    "students": {
        "班级": "class_name",
        "姓名": "name",
        "学号": "student_no",
        "小组": "group_name",
        "标签": "tags",
    },
    "lesson_log": {
        "日期": "date",
        "班级": "class_name",
        "节次": "period",
        "内容": "content",
    },
    "academic": {
        "日期": "date",
        "班级": "class_name",
        "学生": "student_name",
        "项目": "item_name",
        "结果": "score",
        "状态": "status",
        "备注": "notes",
    },
    "behavior": {
        "日期": "date",
        "班级": "class_name",
        "学生": "student_name",
        "项目": "item_name",
        "分值": "score",
        "备注": "notes",
    },
    "attendance": {
        "日期": "date",
        "班级": "class_name",
        "学生": "student_name",
        "状态": "status",
        "备注": "notes",
    },
    "comms": {
        "日期": "date",
        "学生": "student_name",
        "对象": "target",
        "方式": "method",
        "内容": "content",
        "结果": "result",
    },
    "parents": {
        "学生": "student_name",
        "称谓": "relationship",
        "电话": "phone",
        "备注": "notes",
    },
    "duties": {
        "岗位": "duty_name",
        "学生": "student_name",
        "类型": "duty_type",
        "时间": "schedule_time",
        "备注": "notes",
    },
    "schedule": {
        "星期": "weekday",
        "节次": "period",
        "班级": "class_name",
        "科目": "subject",
    },
    "items": {
        "项目名": "item_name",
        "类型": "item_type",
        "计分制": "scoring_type",
        "满分": "full_score",
        "类别": "category",
        "权重": "weight",
        "周期": "cycle",
        "学科": "subject",
    },
    "todos": {
        "日期": "date",
        "事项": "title",
        "类别": "category",
        "状态": "status",
    },
}

def init_student_ids_and_schema(engine: Engine):
    """在后端启动时自动运行的增量迁移，包含三层ID健全及列名全英文化"""
    with engine.connect() as conn:
        # ---- 阶段 1：保证 student_id 与 client_id 存在并回填 ----
        cursor = conn.execute(text("PRAGMA table_info(students);"))
        student_cols = [row[1] for row in cursor.fetchall()]
        if not student_cols:
            return  # 表尚未创建，稍后 Base.metadata.create_all 会创建

        # 姓名列兼容判断（可能是'姓名'或已更名为'name'）
        name_col = "name" if "name" in student_cols else ("姓名" if "姓名" in student_cols else None)

        if "student_id" not in student_cols:
            logger.info("Migrating: Adding student_id to students table...")
            conn.execute(text("ALTER TABLE students ADD COLUMN student_id VARCHAR;"))
            conn.commit()

        if name_col:
            stus = conn.execute(text(f"SELECT id, {name_col} FROM students WHERE student_id IS NULL OR student_id = '';")).fetchall()
            if stus:
                logger.info(f"Migrating: Populating student_id for {len(stus)} students...")
                for s in stus:
                    sid_str = f"STU{s[0]:04d}"
                    conn.execute(
                        text("UPDATE students SET student_id = :sid WHERE id = :id;"),
                        {"sid": sid_str, "id": s[0]}
                    )
                conn.commit()

        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_students_student_id ON students(student_id);"))
        conn.commit()

        # 子表 student_id 与关联绑定
        for t in RELATED_TABLES:
            t_cursor = conn.execute(text(f"PRAGMA table_info({t});"))
            t_cols = [row[1] for row in t_cursor.fetchall()]
            if not t_cols:
                continue

            if "student_id" not in t_cols:
                logger.info(f"Migrating: Adding student_id to {t} table...")
                conn.execute(text(f"ALTER TABLE {t} ADD COLUMN student_id VARCHAR;"))
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{t}_student_id ON {t}(student_id);"))
                conn.commit()

            # 学生列名兼容
            t_student_col = "student_name" if "student_name" in t_cols else ("学生" if "学生" in t_cols else None)
            if t_student_col and name_col:
                conn.execute(text(f"""
                    UPDATE {t}
                    SET student_id = (
                        SELECT student_id FROM students WHERE students.{name_col} = {t}.{t_student_col} LIMIT 1
                    )
                    WHERE (student_id IS NULL OR student_id = '') AND {t_student_col} != '' AND {t_student_col} IS NOT NULL;
                """))
                conn.commit()

        # client_id 检查
        for t in ["academic", "behavior"]:
            t_cursor = conn.execute(text(f"PRAGMA table_info({t});"))
            t_cols = [row[1] for row in t_cursor.fetchall()]
            if t_cols and "client_id" not in t_cols:
                conn.execute(text(f"ALTER TABLE {t} ADD COLUMN client_id VARCHAR;"))
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{t}_client_id ON {t}(client_id);"))
                conn.commit()

        # ---- 阶段 2：就地执行物理列名更名为纯英文 ----
        for table, col_map in TABLE_COLUMN_RENAMES.items():
            t_cursor = conn.execute(text(f"PRAGMA table_info({table});"))
            current_cols = set([row[1] for row in t_cursor.fetchall()])
            if not current_cols:
                continue

            for cn_col, en_col in col_map.items():
                if cn_col in current_cols and en_col not in current_cols:
                    logger.info(f"Renaming column: {table}.{cn_col} -> {table}.{en_col}")
                    conn.execute(text(f"ALTER TABLE {table} RENAME COLUMN \"{cn_col}\" TO \"{en_col}\";"))
                    conn.commit()

        # 确保 attendance 表具有 class_name 列并从学生表补齐数据
        att_cursor = conn.execute(text("PRAGMA table_info(attendance);"))
        att_cols = [row[1] for row in att_cursor.fetchall()]
        if att_cols and "class_name" not in att_cols:
            logger.info("Migrating: Adding class_name to attendance table...")
            conn.execute(text("ALTER TABLE attendance ADD COLUMN class_name VARCHAR DEFAULT '';"))
            conn.commit()

        if att_cols:
            s_cur = conn.execute(text("PRAGMA table_info(students);"))
            s_cols = [r[1] for r in s_cur.fetchall()]
            stu_cname = "class_name" if "class_name" in s_cols else ("班级" if "班级" in s_cols else None)
            stu_name = "name" if "name" in s_cols else ("姓名" if "姓名" in s_cols else None)
            if stu_cname:
                conn.execute(text(f"""
                    UPDATE attendance
                    SET class_name = COALESCE((
                        SELECT {stu_cname} FROM students
                        WHERE (students.student_id = attendance.student_id AND attendance.student_id IS NOT NULL AND attendance.student_id != '')
                           OR (students.{stu_name} = attendance.student_name AND attendance.student_name IS NOT NULL AND attendance.student_name != '')
                        LIMIT 1
                    ), '')
                    WHERE class_name IS NULL OR class_name = '';
                """))
                conn.commit()

        # ---- 阶段 3：建立标准英文索引 ----
        indexes = [
            ("ix_students_class_sno", "students", ["class_name", "student_no"]),
            ("ix_academic_query", "academic", ["class_name", "date", "item_name"]),
            ("ix_academic_stu_date", "academic", ["student_id", "date"]),
            ("ix_behavior_query", "behavior", ["class_name", "date"]),
            ("ix_behavior_stu_date", "behavior", ["student_id", "date"]),
            ("ix_attendance_query", "attendance", ["class_name", "date"]),
            ("ix_attendance_stu_date", "attendance", ["student_id", "date"]),
            ("ix_schedule_slot", "schedule", ["weekday", "period", "class_name"]),
            ("ix_items_name_subject", "items", ["item_name", "subject"]),
            ("ix_todos_status_date", "todos", ["status", "date"]),
            ("ix_lesson_log_class_date", "lesson_log", ["class_name", "date"]),
        ]
        for idx_name, tbl, cols in indexes:
            col_list_str = ", ".join([f'"{c}"' for c in cols])
            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl}({col_list_str});"))
                conn.commit()
            except Exception as e:
                logger.warning(f"Index create skipped {idx_name}: {e}")

        # ---- 阶段 4：班级实体化与 class_id 自动分配及就地回填 ----
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id VARCHAR UNIQUE,
                name VARCHAR UNIQUE,
                grade VARCHAR DEFAULT '',
                seq INTEGER DEFAULT 0
            );
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_classes_sort ON classes(seq, name);"))
        conn.commit()

        # 扫描现有 students 和 schedule 表提取全部班级
        existing_classes_cur = conn.execute(text("SELECT name FROM classes;")).fetchall()
        existing_class_names = set(r[0] for r in existing_classes_cur)

        scanned_classes = set()
        s_cur = conn.execute(text("PRAGMA table_info(students);"))
        s_cols = [r[1] for r in s_cur.fetchall()]
        if "class_name" in s_cols:
            for r in conn.execute(text("SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL AND class_name != '';")).fetchall():
                scanned_classes.add(r[0])

        sch_cur = conn.execute(text("PRAGMA table_info(schedule);"))
        sch_cols = [r[1] for r in sch_cur.fetchall()]
        if "class_name" in sch_cols:
            for r in conn.execute(text("SELECT DISTINCT class_name FROM schedule WHERE class_name IS NOT NULL AND class_name != '';")).fetchall():
                scanned_classes.add(r[0])

        # 排序（按年级/数字序）
        def _class_sort_key(cname: str):
            digits = "".join(filter(str.isdigit, cname))
            d_val = int(digits) if digits else 999
            return (d_val, cname)

        sorted_classes = sorted(list(scanned_classes), key=_class_sort_key)

        max_cid_num = 0
        all_cids = conn.execute(text("SELECT class_id FROM classes WHERE class_id LIKE 'CLS%';")).fetchall()
        for r in all_cids:
            try:
                num = int(r[0][3:])
                if num > max_cid_num:
                    max_cid_num = num
            except Exception:
                pass

        for idx, cname in enumerate(sorted_classes, start=1):
            if cname not in existing_class_names:
                max_cid_num += 1
                cid_str = f"CLS{max_cid_num:04d}"
                grade_str = "八年级" if "八" in cname else ("七年级" if "七" in cname else ("九年级" if "九" in cname else ""))
                logger.info(f"Migrating: Creating class {cid_str} ({cname})...")
                conn.execute(
                    text("INSERT INTO classes (class_id, name, grade, seq) VALUES (:cid, :name, :grade, :seq);"),
                    {"cid": cid_str, "name": cname, "grade": grade_str, "seq": idx},
                )
                conn.commit()
                existing_class_names.add(cname)

        # 为各业务表添加 class_id 列并就地关联回填
        CLASS_RELATED_TABLES = ["students", "schedule", "academic", "behavior", "attendance", "lesson_log"]
        for tbl in CLASS_RELATED_TABLES:
            t_cur = conn.execute(text(f"PRAGMA table_info({tbl});"))
            t_cols = [r[1] for r in t_cur.fetchall()]
            if not t_cols:
                continue

            if "class_id" not in t_cols:
                logger.info(f"Migrating: Adding class_id to {tbl} table...")
                conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN class_id VARCHAR DEFAULT '';"))
                conn.commit()

            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{tbl}_class_id ON {tbl}(class_id);"))
                conn.commit()
            except Exception as e:
                logger.warning(f"Index create skipped ix_{tbl}_class_id: {e}")

            # 依据 class_name 回填 class_id
            if "class_name" in t_cols:
                conn.execute(text(f"""
                    UPDATE {tbl}
                    SET class_id = (
                        SELECT class_id FROM classes WHERE classes.name = {tbl}.class_name LIMIT 1
                    )
                    WHERE (class_id IS NULL OR class_id = '') AND class_name IS NOT NULL AND class_name != '';
                """))
                conn.commit()
