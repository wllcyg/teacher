// 数据行：{ id: number } + 动态中文列名（值都是字符串）
export type Row = { id: number; [key: string]: any };

export type TableName =
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

export interface TableMeta {
  columns: string[];
  natural_key?: string[];
}

// 报表相关类型
export interface SummaryOverview {
  班级: string;
  考试: { 名: string; 均分: number; 及格率: number } | null;
  完成率: { 项目: string; 完成率: number }[];
  表现: { 本周加分: number; 本周减分: number };
  考勤: { 异常: number } | null;
}
