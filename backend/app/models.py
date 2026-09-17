"""11 张业务表的 SQLAlchemy Model（全面采用标准英文属性与复合索引）。
"""

from sqlalchemy import Column, Index, Integer, String
from .database import Base


class ClassEntity(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(String, unique=True, index=True, default="")
    name = Column(String, unique=True, index=True, default="")
    grade = Column(String, default="")
    seq = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_classes_sort", "seq", "name"),
    )


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, unique=True, index=True, default="")
    class_id = Column(String, index=True, default="")
    class_name = Column(String, default="")
    name = Column(String, default="")
    student_no = Column(String, default="")
    group_name = Column(String, default="")
    tags = Column(String, default="")

    __table_args__ = (
        Index("ix_students_class_sno", "class_name", "student_no"),
        Index("ix_students_cid_sno", "class_id", "student_no"),
    )


class Schedule(Base):
    __tablename__ = "schedule"
    id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(String, index=True, default="")
    weekday = Column(String, default="")
    period = Column(String, default="")
    class_name = Column(String, default="")
    subject = Column(String, default="")

    __table_args__ = (
        Index("ix_schedule_slot", "weekday", "period", "class_name"),
    )


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_name = Column(String, default="")
    item_type = Column(String, default="")
    scoring_type = Column(String, default="")
    full_score = Column(String, default="")
    category = Column(String, default="")
    weight = Column(String, default="")
    cycle = Column(String, default="")
    subject = Column(String, default="")

    __table_args__ = (
        Index("ix_items_name_subject", "item_name", "subject"),
    )


class Academic(Base):
    __tablename__ = "academic"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, index=True, default="")
    client_id = Column(String, index=True, default="")
    class_id = Column(String, index=True, default="")
    date = Column(String, default="")
    class_name = Column(String, default="")
    student_name = Column(String, default="")
    item_name = Column(String, default="")
    score = Column(String, default="")
    status = Column(String, default="")
    notes = Column(String, default="")

    __table_args__ = (
        Index("ix_academic_query", "class_name", "date", "item_name"),
        Index("ix_academic_stu_date", "student_id", "date"),
        Index("ix_academic_cid_date", "class_id", "date"),
    )


class Behavior(Base):
    __tablename__ = "behavior"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, index=True, default="")
    client_id = Column(String, index=True, default="")
    class_id = Column(String, index=True, default="")
    date = Column(String, default="")
    class_name = Column(String, default="")
    student_name = Column(String, default="")
    item_name = Column(String, default="")
    score = Column(String, default="")
    notes = Column(String, default="")

    __table_args__ = (
        Index("ix_behavior_query", "class_name", "date"),
        Index("ix_behavior_stu_date", "student_id", "date"),
        Index("ix_behavior_cid_date", "class_id", "date"),
    )


class Todo(Base):
    __tablename__ = "todos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, default="")
    title = Column(String, default="")
    category = Column(String, default="")
    status = Column(String, default="")

    __table_args__ = (
        Index("ix_todos_status_date", "status", "date"),
    )


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, index=True, default="")
    class_id = Column(String, index=True, default="")
    date = Column(String, default="")
    class_name = Column(String, default="")
    student_name = Column(String, default="")
    status = Column(String, default="")
    notes = Column(String, default="")

    __table_args__ = (
        Index("ix_attendance_query", "class_name", "date"),
        Index("ix_attendance_stu_date", "student_id", "date"),
        Index("ix_attendance_cid_date", "class_id", "date"),
    )


class Parent(Base):
    __tablename__ = "parents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, index=True, default="")
    student_name = Column(String, default="")
    relationship = Column(String, default="")
    phone = Column(String, default="")
    notes = Column(String, default="")

    __table_args__ = (
        Index("ix_parents_phone", "phone"),
    )


class Comm(Base):
    __tablename__ = "comms"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, index=True, default="")
    date = Column(String, default="")
    student_name = Column(String, default="")
    target = Column(String, default="")
    method = Column(String, default="")
    content = Column(String, default="")
    result = Column(String, default="")

    __table_args__ = (
        Index("ix_comms_date", "date"),
    )


class Duty(Base):
    __tablename__ = "duties"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, index=True, default="")
    duty_name = Column(String, default="")
    student_name = Column(String, default="")
    duty_type = Column(String, default="")
    schedule_time = Column(String, default="")
    notes = Column(String, default="")


class LessonLog(Base):
    __tablename__ = "lesson_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(String, index=True, default="")
    date = Column(String, default="")
    class_name = Column(String, default="")
    period = Column(String, default="")
    content = Column(String, default="")

    __table_args__ = (
        Index("ix_lesson_log_class_date", "class_name", "date"),
        Index("ix_lesson_log_cid_date", "class_id", "date"),
    )


class AppSetting(Base):
    __tablename__ = "app_settings"
    key = Column(String, primary_key=True)
    value = Column(String, default="")


MODELS = {
    "classes": ClassEntity,
    "students": Student,
    "schedule": Schedule,
    "items": Item,
    "academic": Academic,
    "behavior": Behavior,
    "todos": Todo,
    "attendance": Attendance,
    "parents": Parent,
    "comms": Comm,
    "duties": Duty,
    "lesson_log": LessonLog,
}

