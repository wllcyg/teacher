"""10 张表的 SQLAlchemy Model。

设计说明：原应用把所有业务值都当字符串处理（textOf / wrap / plain），
这里为保持 1:1 忠实、避免类型转换 bug，业务列一律用 String；
数值判断（分值、满分、成绩）在 scoring 层按需转 int/float。
"""

from sqlalchemy import Column, Integer, String

from .database import Base


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, autoincrement=True)
    班级 = Column(String, default="")
    姓名 = Column(String, default="")
    学号 = Column(String, default="")
    小组 = Column(String, default="")
    标签 = Column(String, default="")


class Schedule(Base):
    __tablename__ = "schedule"
    id = Column(Integer, primary_key=True, autoincrement=True)
    星期 = Column(String, default="")
    节次 = Column(String, default="")
    班级 = Column(String, default="")
    科目 = Column(String, default="")


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    项目名 = Column(String, default="")
    类型 = Column(String, default="")
    计分制 = Column(String, default="")
    满分 = Column(String, default="")
    类别 = Column(String, default="")
    权重 = Column(String, default="")
    周期 = Column(String, default="")
    学科 = Column(String, default="")


class Academic(Base):
    __tablename__ = "academic"
    id = Column(Integer, primary_key=True, autoincrement=True)
    日期 = Column(String, default="")
    班级 = Column(String, default="")
    学生 = Column(String, default="")
    项目 = Column(String, default="")
    结果 = Column(String, default="")
    状态 = Column(String, default="")
    备注 = Column(String, default="")


class Behavior(Base):
    __tablename__ = "behavior"
    id = Column(Integer, primary_key=True, autoincrement=True)
    日期 = Column(String, default="")
    班级 = Column(String, default="")
    学生 = Column(String, default="")
    项目 = Column(String, default="")
    分值 = Column(String, default="")
    备注 = Column(String, default="")


class Todo(Base):
    __tablename__ = "todos"
    id = Column(Integer, primary_key=True, autoincrement=True)
    日期 = Column(String, default="")
    事项 = Column(String, default="")
    类别 = Column(String, default="")
    状态 = Column(String, default="")


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, autoincrement=True)
    日期 = Column(String, default="")
    学生 = Column(String, default="")
    状态 = Column(String, default="")
    备注 = Column(String, default="")


class Parent(Base):
    __tablename__ = "parents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    学生 = Column(String, default="")
    称谓 = Column(String, default="")
    电话 = Column(String, default="")
    备注 = Column(String, default="")


class Comm(Base):
    __tablename__ = "comms"
    id = Column(Integer, primary_key=True, autoincrement=True)
    日期 = Column(String, default="")
    学生 = Column(String, default="")
    对象 = Column(String, default="")
    方式 = Column(String, default="")
    内容 = Column(String, default="")
    结果 = Column(String, default="")


class Duty(Base):
    __tablename__ = "duties"
    id = Column(Integer, primary_key=True, autoincrement=True)
    岗位 = Column(String, default="")
    学生 = Column(String, default="")
    类型 = Column(String, default="")
    时间 = Column(String, default="")
    备注 = Column(String, default="")


# 表名 -> Model 类，供通用 CRUD 与报表层按表名取用
MODELS: dict[str, type] = {
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
}
