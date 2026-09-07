import type { Dayjs } from "dayjs";
import type { Row } from "../../types";

export interface UndoAction {
  table: "behavior" | "academic";
  id: number;
  studentName: string;
  desc: string;
}

export interface StudentGroup {
  groupName: string;
  students: Row[];
}

export type ScoreKind = "加减分" | "过关" | "打钩" | "等第" | "分数";
export type ViewMode = "group" | "flat";
