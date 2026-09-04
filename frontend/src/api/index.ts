import { api } from "./client";
import type { Row, TableName, TableMeta, SummaryOverview } from "../types";

// ---------- 通用 CRUD ----------
export async function listTable(table: TableName, filters?: Record<string, string>): Promise<Row[]> {
  const { data } = await api.get(`/tables/${table}`, { params: filters });
  return data;
}

export async function getRow(table: TableName, id: number): Promise<Row> {
  const { data } = await api.get(`/tables/${table}/${id}`);
  return data;
}

export async function createRow(table: TableName, payload: Record<string, any>): Promise<Row> {
  const { id, ...rest } = payload;
  const { data } = await api.post(`/tables/${table}`, rest);
  return data;
}

export async function updateRow(table: TableName, id: number, payload: Record<string, any>): Promise<Row> {
  const { id: _id, ...rest } = payload;
  const { data } = await api.put(`/tables/${table}/${id}`, rest);
  return data;
}

export async function deleteRow(table: TableName, id: number): Promise<void> {
  await api.delete(`/tables/${table}/${id}`);
}

export async function batchDeleteRows(table: TableName, ids: number[]): Promise<{ ok: boolean; deleted: number }> {
  const { data } = await api.post(`/tables/${table}/batch-delete`, { ids });
  return data;
}

export async function batchCreateRows(
  table: TableName,
  rows: Record<string, any>[]
): Promise<{ ok: boolean; created: number }> {
  const { data } = await api.post(`/tables/${table}/batch-create`, { rows });
  return data;
}

export async function batchUpdateRows(
  table: TableName,
  ids: number[],
  updates: Record<string, any>
): Promise<{ ok: boolean; updated: number }> {
  const { data } = await api.post(`/tables/${table}/batch-update`, { ids, updates });
  return data;
}

export async function getTables(): Promise<Record<string, TableMeta>> {
  const { data } = await api.get("/tables");
  return data;
}

// ---------- 报表 ----------
export async function getSummary(班级?: string, 今天?: string): Promise<SummaryOverview> {
  const { data } = await api.get("/report/summary", { params: { 班级, 今天 } });
  return data;
}

export async function getExamReport(
  项目: string,
  班级?: string,
  thresholds?: { 优?: number; 及?: number; 低?: number }
): Promise<any> {
  const { data } = await api.get(`/report/exam/${encodeURIComponent(项目)}`, {
    params: { 班级, ...thresholds },
  });
  return data;
}

export async function getMatrix(班级?: string, 项目?: string, 起?: string): Promise<any> {
  const { data } = await api.get("/report/matrix", { params: { 班级, 项目, 起 } });
  return data;
}

export async function getBehaviorWeek(班级?: string, weekStart?: string, 按小计?: boolean): Promise<any> {
  const { data } = await api.get("/report/behavior-week", { params: { 班级, weekStart, 按小计 } });
  return data;
}

export async function getItemsSummary(班级?: string): Promise<any> {
  const { data } = await api.get("/report/items-summary", { params: { 班级 } });
  return data;
}

export async function getContactBook(班级?: string, keyword?: string): Promise<any> {
  const { data } = await api.get("/report/contact-book", { params: { 班级, keyword } });
  return data;
}

export async function importParents(文本: string, 班级?: string): Promise<any> {
  const { data } = await api.post("/import/parents", { 文本, 班级 });
  return data;
}

export async function importStudents(csv: string, 班级?: string): Promise<any> {
  const { data } = await api.post("/import/students", { csv, 班级 });
  return data;
}

export async function batchUpsertAcademic(payload: {
  班级: string;
  项目: string;
  日期: string;
  满分?: number;
  学科?: string;
  类别?: string;
  records: { 学生: string; 结果: string; 状态?: string; 备注?: string }[];
}): Promise<any> {
  const { data } = await api.post("/academic/batch-upsert", payload);
  return data;
}

export async function vaultExport(): Promise<Record<string, Row[]>> {
  const { data } = await api.get("/vault/export");
  return data;
}

export async function vaultImport(payload: Record<string, Row[]>): Promise<any> {
  const { data } = await api.post("/vault/import", payload);
  return data;
}

// ---------- 系统全局配置（称呼、学期、作息） ----------
export interface SystemSettings {
  称呼?: string;
  学期?: string;
  periods?: any[];
  [key: string]: any;
}

export async function getSettings(): Promise<SystemSettings> {
  const { data } = await api.get("/settings");
  return data;
}

export async function updateSettings(payload: SystemSettings): Promise<{ ok: boolean }> {
  const { data } = await api.post("/settings", payload);
  return data;
}
