"""业务常量与枚举，全面采用标准英文列名与规范常量。
"""

# 核心表的标准英文列
TABLE_COLUMNS: dict[str, list[str]] = {
    "classes":    ["class_id", "name", "grade", "seq"],
    "students":   ["class_id", "class_name", "name", "student_no", "group_name", "tags"],
    "schedule":   ["class_id", "weekday", "period", "class_name", "subject"],
    "items":      ["item_name", "item_type", "scoring_type", "full_score", "category", "weight", "cycle", "subject"],
    "academic":   ["class_id", "date", "class_name", "student_name", "item_name", "score", "status", "notes"],
    "behavior":   ["class_id", "date", "class_name", "student_name", "item_name", "score", "notes"],
    "todos":      ["date", "title", "category", "status"],
    "attendance": ["class_id", "date", "class_name", "student_name", "status", "notes"],
    "parents":    ["student_name", "relationship", "phone", "notes"],
    "comms":      ["date", "student_name", "target", "method", "content", "result"],
    "duties":     ["duty_name", "student_name", "duty_type", "schedule_time", "notes"],
    "lesson_log": ["class_id", "date", "class_name", "period", "content"],
}

# 有自然唯一性的表：查重键
NATURAL_KEY: dict[str, list[str]] = {
    "classes":    ["name"],
    "students":   ["class_name", "name"],
    "academic":   ["date", "student_id", "item_name"],
    "attendance": ["date", "student_id"],
    "duties":     ["duty_name", "student_id", "schedule_time"],
    "todos":      ["date", "title"],
    "lesson_log": ["date", "class_name", "period"],
    "items":      ["item_name", "subject"],
    "schedule":   ["weekday", "period", "class_name"],
}

# 历史中文别名映射到标准英文列名（向后兼容与容错清洗）
COLUMN_ALIASES: dict[str, dict[str, str]] = {
    "classes":    {"班级": "name", "年级": "grade", "排序": "seq"},
    "students":   {"班级": "class_name", "姓名": "name", "学号": "student_no", "小组": "group_name", "标签": "tags"},
    "schedule":   {"星期": "weekday", "节次": "period", "班级": "class_name", "科目": "subject"},
    "items":      {"项目名": "item_name", "项目类型": "item_type", "计分制": "scoring_type", "满分": "full_score", "分类": "category", "权重": "weight", "周期": "cycle", "科目": "subject"},
    "academic":   {"日期": "date", "班级": "class_name", "学生": "student_name", "项目": "item_name", "结果": "score", "状态": "status", "备注": "notes"},
    "behavior":   {"日期": "date", "班级": "class_name", "学生": "student_name", "项目": "item_name", "分值": "score", "备注": "notes"},
    "todos":      {"日期": "date", "事项": "title", "类别": "category", "状态": "status"},
    "attendance": {"日期": "date", "班级": "class_name", "学生": "student_name", "状态": "status", "备注": "notes"},
    "parents":    {"学生": "student_name", "关系": "relationship", "电话": "phone", "备注": "notes"},
    "comms":      {"日期": "date", "学生": "student_name", "对象": "target", "方式": "method", "内容": "content", "结果": "result"},
    "duties":     {"岗位": "duty_name", "学生": "student_name", "类型": "duty_type", "时间": "schedule_time", "备注": "notes"},
    "lesson_log": {"日期": "date", "班级": "class_name", "节次": "period", "内容": "content"},
}

WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
ATTEND_STATUS = ["缺勤", "迟到", "早退", "请假"]
TODO_KINDS = ["教学", "行政", "家校", "班务"]
COMM_WAYS = ["电话", "微信", "当面", "家访"]
COMM_WHO = ["妈妈", "爸爸", "爷爷", "奶奶", "外公", "外婆", "其他"]
GRADES = ["A", "B", "C", "D"]
SCORE_KINDS = ["打钩", "分数", "等第", "过关", "加减分"]

# 报表分数段（满分占比）
SCORE_BANDS = [
    ("90%–100%", 0.9, 1.0000000001),
    ("80%–<90%", 0.8, 0.9),
    ("70%–<80%", 0.7, 0.8),
    ("60%–<70%", 0.6, 0.7),
    ("<60%", 0.0, 0.6),
]
