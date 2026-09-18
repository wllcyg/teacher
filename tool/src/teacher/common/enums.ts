/**
 * 业务常量与枚举（与 Python enums.py 完全对应）
 */

// 每张表的标准英文列（不含 id / student_id / client_id / class_id 这些特殊字段）
export const TABLE_COLUMNS: Record<string, string[]> = {
  classes: ['class_id', 'name', 'grade', 'seq'],
  students: ['class_id', 'class_name', 'name', 'student_no', 'group_name', 'tags'],
  schedule: ['class_id', 'weekday', 'period', 'class_name', 'subject'],
  items: ['item_name', 'item_type', 'scoring_type', 'full_score', 'category', 'weight', 'cycle', 'subject'],
  academic: ['class_id', 'date', 'class_name', 'student_name', 'item_name', 'score', 'status', 'notes'],
  behavior: ['class_id', 'date', 'class_name', 'student_name', 'item_name', 'score', 'notes'],
  todos: ['date', 'title', 'category', 'status'],
  attendance: ['class_id', 'date', 'class_name', 'student_name', 'status', 'notes'],
  parents: ['student_name', 'relationship', 'phone', 'notes'],
  comms: ['date', 'student_name', 'target', 'method', 'content', 'result'],
  duties: ['duty_name', 'student_name', 'duty_type', 'schedule_time', 'notes'],
  lesson_log: ['class_id', 'date', 'class_name', 'period', 'content'],
};

// 自然唯一键（查重用）
export const NATURAL_KEY: Record<string, string[]> = {
  classes: ['name'],
  students: ['class_name', 'name'],
  academic: ['date', 'student_id', 'item_name'],
  attendance: ['date', 'student_id'],
  duties: ['duty_name', 'student_id', 'schedule_time'],
  todos: ['date', 'title'],
  lesson_log: ['date', 'class_name', 'period'],
  items: ['item_name', 'subject'],
  schedule: ['weekday', 'period', 'class_name'],
};

// 历史中文别名 → 标准英文列名（向后兼容）
export const COLUMN_ALIASES: Record<string, Record<string, string>> = {
  classes: { 班级: 'name', 年级: 'grade', 排序: 'seq' },
  students: { 班级: 'class_name', 姓名: 'name', 学号: 'student_no', 小组: 'group_name', 标签: 'tags' },
  schedule: { 星期: 'weekday', 节次: 'period', 班级: 'class_name', 科目: 'subject' },
  items: { 项目名: 'item_name', 项目类型: 'item_type', 计分制: 'scoring_type', 满分: 'full_score', 分类: 'category', 权重: 'weight', 周期: 'cycle', 科目: 'subject' },
  academic: { 日期: 'date', 班级: 'class_name', 学生: 'student_name', 项目: 'item_name', 结果: 'score', 状态: 'status', 备注: 'notes' },
  behavior: { 日期: 'date', 班级: 'class_name', 学生: 'student_name', 项目: 'item_name', 分值: 'score', 备注: 'notes' },
  todos: { 日期: 'date', 事项: 'title', 类别: 'category', 状态: 'status' },
  attendance: { 日期: 'date', 班级: 'class_name', 学生: 'student_name', 状态: 'status', 备注: 'notes' },
  parents: { 学生: 'student_name', 关系: 'relationship', 电话: 'phone', 备注: 'notes' },
  comms: { 日期: 'date', 学生: 'student_name', 对象: 'target', 方式: 'method', 内容: 'content', 结果: 'result' },
  duties: { 岗位: 'duty_name', 学生: 'student_name', 类型: 'duty_type', 时间: 'schedule_time', 备注: 'notes' },
  lesson_log: { 日期: 'date', 班级: 'class_name', 节次: 'period', 内容: 'content' },
};

// 流水表（按 id DESC），其余按 id ASC
export const DESC_ORDER_TABLES = new Set([
  'academic', 'behavior', 'todos', 'attendance', 'parents', 'comms', 'duties', 'lesson_log',
]);

// 学生相关子表（用于级联更新）
export const STUDENT_RELATED_TABLES = ['academic', 'behavior', 'attendance', 'parents', 'comms', 'duties'];

export const LEFT_MARK = '（系统）已离班';
export const DISABLED_MARK = '已停用';
