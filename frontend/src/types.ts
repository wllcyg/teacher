// 数据行：{ id: number } + 动态英文字段
export type Row = { id: number; student_id?: string; client_id?: string; [key: string]: any };

// 服务端标准分页响应结构
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type TableName =
  | "classes"
  | "students"
  | "schedule"
  | "items"
  | "academic"
  | "behavior"
  | "todos"
  | "attendance"
  | "parents"
  | "comms"
  | "duties"
  | "lesson_log";

export interface ClassItem {
  id: number;
  class_id: string;
  name: string;
  grade?: string;
  sort_order?: number;
}

export interface TableMeta {
  columns: string[];
  natural_key?: string[];
}

export interface StudentRow {
  id: number;
  class_id?: string;
  class_name: string;
  name: string;
  student_no?: string;
  group_name?: string;
  tags?: string;
  student_id?: string;
}

export interface LessonLogRow {
  id: number;
  date: string;
  class_id?: string;
  class_name: string;
  period: string;
  content: string;
}

export interface AcademicRow {
  id: number;
  date: string;
  class_id?: string;
  class_name: string;
  student_name: string;
  item_name: string;
  score?: string;
  status?: string;
  notes?: string;
  student_id?: string;
  client_id?: string;
}

export interface BehaviorRow {
  id: number;
  date: string;
  class_id?: string;
  class_name: string;
  student_name: string;
  item_name: string;
  score?: string;
  notes?: string;
  student_id?: string;
  client_id?: string;
}

export interface AttendanceRow {
  id: number;
  date: string;
  class_id?: string;
  class_name: string;
  student_name: string;
  status: string;
  notes?: string;
  student_id?: string;
}

export interface CommsRow {
  id: number;
  date: string;
  student_name: string;
  target?: string;
  method?: string;
  content?: string;
  result?: string;
  student_id?: string;
}

export interface ParentRow {
  id: number;
  student_name: string;
  relationship?: string;
  phone?: string;
  notes?: string;
  student_id?: string;
}

export interface DutyRow {
  id: number;
  duty_name: string;
  student_name: string;
  duty_type?: string;
  schedule_time?: string;
  notes?: string;
  student_id?: string;
}

export interface ScheduleRow {
  id: number;
  weekday: string;
  period: string;
  class_id?: string;
  class_name: string;
  subject: string;
}

export interface ItemRow {
  id: number;
  item_name: string;
  item_type?: string;
  scoring_type?: string;
  full_score?: string;
  category?: string;
  weight?: string;
  cycle?: string;
  subject?: string;
}

export interface TodoRow {
  id: number;
  date?: string;
  title: string;
  category?: string;
  status?: string;
}

// 报表相关类型
export interface SummaryOverview {
  class_name?: string;
  exam?: { name: string; avg: number; pass_rate: number } | null;
  completion?: { item: string; rate: number }[];
  behavior?: { week_pos: number; week_neg: number };
  attendance?: { abnormal: number } | null;
  // 兼容老格式字段以平滑迁移
  班级?: string;
  考试?: { 名: string; 均分: number; 及格率: number } | null;
  完成率?: { 项目: string; 完成率: number }[];
  表现?: { 本周加分: number; 本周减分: number };
  考勤?: { 异常: number } | null;
  [key: string]: any;
}

