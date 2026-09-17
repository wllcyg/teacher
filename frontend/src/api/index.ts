import { api } from "./client";
import type { Row, TableName, TableMeta, SummaryOverview, PagedResult, ClassItem } from "../types";

// ---------- 登录 ----------
export async function login(password: string): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const { data } = await api.post("/auth/login", { password });
  return data;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  [key: string]: any;
}

// ---------- 通用 CRUD（服务端真分页） ----------
export async function listTable(table: TableName, params?: ListParams): Promise<PagedResult<Row>> {
  const { data } = await api.get(`/tables/${table}`, { params });
  return data;
}

// 便捷方法：针对作息设置等需要全量数据的轻量场景
export async function listAllTable(table: TableName, filters?: Record<string, any>): Promise<Row[]> {
  const { data } = await api.get(`/tables/${table}`, { params: { ...filters, page: 1, page_size: 1000 } });
  return data?.items || [];
}

export async function getRow(table: TableName, id: number): Promise<Row> {
  const { data } = await api.get(`/tables/${table}/${id}`);
  return data;
}

export async function createRow(table: TableName, payload: Record<string, any>): Promise<Row> {
  const { data } = await api.post(`/tables/${table}`, payload);
  return data;
}

export async function updateRow(table: TableName, id: number, payload: Record<string, any>): Promise<Row> {
  const { data } = await api.put(`/tables/${table}/${id}`, payload);
  return data;
}

export async function deleteRow(table: TableName, id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/tables/${table}/${id}`);
  return data;
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

export async function getClasses(): Promise<ClassItem[]> {
  const { data } = await api.get<ClassItem[]>("/classes");
  return data;
}

export async function getTables(): Promise<Record<string, TableMeta>> {
  const { data } = await api.get("/tables");
  return data;
}

function toClassParams(classIdent?: string): { class_id?: string; class_name?: string } {
  if (!classIdent) return {};
  if (classIdent.startsWith("CLS")) return { class_id: classIdent };
  return { class_name: classIdent };
}

// ---------- 报表 ----------
export async function getSummary(classIdent?: string, today?: string): Promise<SummaryOverview> {
  const { data } = await api.get("/report/summary", { params: { ...toClassParams(classIdent), today } });
  return data;
}

export async function getExamReport(
  item_name: string,
  classIdent?: string,
  thresholds?: { you?: number; ji?: number; di?: number; 优?: number; 及?: number; 低?: number }
): Promise<any> {
  const { data } = await api.get(`/report/exam/${encodeURIComponent(item_name)}`, {
    params: { ...toClassParams(classIdent), ...thresholds },
  });
  return data;
}

export async function getMatrix(classIdent?: string, item_name?: string, date_from?: string): Promise<any> {
  const { data } = await api.get("/report/matrix", { params: { ...toClassParams(classIdent), item_name, date_from } });
  return data;
}

export async function getBehaviorWeek(classIdent?: string, weekStart?: string, subtotal?: boolean): Promise<any> {
  const { data } = await api.get("/report/behavior-week", { params: { ...toClassParams(classIdent), weekStart, subtotal } });
  return data;
}

export async function getItemsSummary(classIdent?: string): Promise<any> {
  const { data } = await api.get("/report/items-summary", { params: { ...toClassParams(classIdent) } });
  return data;
}

export async function getContactBook(classIdent?: string, keyword?: string): Promise<any> {
  const { data } = await api.get("/report/contact-book", { params: { ...toClassParams(classIdent), keyword } });
  return data;
}

export async function importParents(text: string, classIdent?: string): Promise<any> {
  const { data } = await api.post("/import/parents", { text, ...toClassParams(classIdent) });
  return data;
}

export async function importStudents(csv: string, classIdent?: string): Promise<any> {
  const { data } = await api.post("/import/students", { csv, ...toClassParams(classIdent) });
  return data;
}

export async function batchUpsertAcademic(payload: {
  class_id?: string;
  class_name?: string;
  item_name: string;
  date: string;
  full_score?: number;
  subject?: string;
  category?: string;
  records: { student_name?: string; 学生?: string; score?: string; 结果?: string; status?: string; notes?: string; [key: string]: any }[];
  [key: string]: any;
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

// ---------- 每日寄语 ----------
export interface DailyGreeting {
  quote: string;
  date: string;
  cached?: boolean;
  card_url?: string;
  theme?: string;
}

export async function getDailyGreeting(force: boolean = false, date?: string, theme?: string): Promise<DailyGreeting> {
  const { data } = await api.get("/daily-greeting", { params: { force, date, theme } });
  return data;
}

export function getGreetingCardUrl(date?: string, theme?: string, force: boolean = false): string {
  const base = api.defaults.baseURL || "/api";
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (theme && theme !== "auto") params.set("theme", theme);
  if (force) params.set("_t", String(Date.now()));
  const qs = params.toString();
  return `${base.replace(/\/$/, "")}/daily-greeting/card${qs ? `?${qs}` : ""}`;
}

