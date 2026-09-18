/**
 * 通用 CRUD 基础服务
 *
 * 对应 Python routers.py 中 _register_crud() 生成的 8 个端点逻辑：
 * 列表（含分页+过滤）、详情、新建、更新、删除、批量新增、批量删除、批量更新
 */
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  COLUMN_ALIASES,
  DESC_ORDER_TABLES,
  NATURAL_KEY,
  TABLE_COLUMNS,
} from './enums';

export interface ListQuery {
  page?: number;
  page_size?: number;
  q?: string;
  [key: string]: any;
}

export interface PageResult<T = Record<string, any>> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

@Injectable()
export class CrudService {
  constructor(private readonly dataSource: DataSource) {}

  // ---------- 内部工具 ----------

  private getRepo(table: string) {
    const meta = this.dataSource.entityMetadatas.find(
      (m) => m.tableName === table,
    );
    if (!meta) throw new NotFoundException(`未知表: ${table}`);
    return this.dataSource.getRepository(meta.target);
  }

  private cols(table: string): string[] {
    return TABLE_COLUMNS[table] ?? [];
  }

  private toDict(row: any, table: string): Record<string, any> {
    const d: Record<string, any> = { id: row.id };
    if ('student_id' in row) d.student_id = row.student_id ?? '';
    if ('client_id' in row) d.client_id = row.client_id ?? '';
    for (const c of this.cols(table)) {
      d[c] = row[c] ?? '';
    }
    return d;
  }

  /** 中文别名 → 英文规范键 */
  cleanPayload(table: string, payload: Record<string, any>): Record<string, any> {
    const aliases = COLUMN_ALIASES[table] ?? {};
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      const normKey = aliases[k];
      if (normKey) {
        if (!(normKey in cleaned) || !cleaned[normKey]) cleaned[normKey] = v;
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned;
  }

  /** 按自然键查重，返回已存在的行或 null */
  async findNaturalDup(
    table: string,
    payload: Record<string, any>,
  ): Promise<any | null> {
    const keys = NATURAL_KEY[table];
    if (!keys?.length) return null;
    const repo = this.getRepo(table);
    const where: Record<string, any> = {};
    for (const k of keys) {
      where[k] = payload[k] ?? '';
    }
    return repo.findOne({ where }) ?? null;
  }

  // ---------- 公开 API ----------

  async list(table: string, query: ListQuery): Promise<PageResult> {
    const repo = this.getRepo(table);
    const cols = this.cols(table);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(query.page_size) || 20));

    const qb = repo.createQueryBuilder('t');

    // 等值 / 范围 / 模糊 / 不等 过滤
    let paramIdx = 0;
    const addFilter = (col: string, val: string, op: string) => {
      const p = `p${paramIdx++}`;
      if (op === 'eq') qb.andWhere(`t.${col} = :${p}`, { [p]: val });
      else if (op === 'gte') qb.andWhere(`t.${col} >= :${p}`, { [p]: val });
      else if (op === 'lte') qb.andWhere(`t.${col} <= :${p}`, { [p]: val });
      else if (op === 'like') qb.andWhere(`t.${col} LIKE :${p}`, { [p]: `%${val}%` });
      else if (op === 'ne') qb.andWhere(`t.${col} != :${p}`, { [p]: val });
    };

    const searchCols = [...cols];
    if ('student_id' in repo.metadata.propertiesMap) searchCols.push('student_id');
    if ('class_id' in repo.metadata.propertiesMap) searchCols.push('class_id');

    for (const col of [...cols, 'student_id', 'client_id', 'class_id']) {
      const val = query[col];
      if (val !== undefined && val !== '') addFilter(col, String(val), 'eq');
      const gte = query[`${col}_gte`];
      if (gte !== undefined && gte !== '') addFilter(col, String(gte), 'gte');
      const lte = query[`${col}_lte`];
      if (lte !== undefined && lte !== '') addFilter(col, String(lte), 'lte');
      const like = query[`${col}_like`];
      if (like !== undefined && like !== '') addFilter(col, String(like), 'like');
      const ne = query[`${col}_ne`];
      if (ne !== undefined && ne !== '') addFilter(col, String(ne), 'ne');
    }

    if (query.q) {
      const kw = String(query.q);
      const orConds = searchCols.map((_, i) => `t.${searchCols[i]} LIKE :kw${i}`);
      const kwParams: Record<string, string> = {};
      searchCols.forEach((_, i) => (kwParams[`kw${i}`] = `%${kw}%`));
      qb.andWhere(`(${orConds.join(' OR ')})`, kwParams);
    }

    const isDesc = DESC_ORDER_TABLES.has(table);
    qb.orderBy('t.id', isDesc ? 'DESC' : 'ASC');

    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();

    return {
      items: rows.map((r) => this.toDict(r, table)),
      total,
      page,
      page_size: pageSize,
    };
  }

  async getById(table: string, id: number): Promise<Record<string, any>> {
    const repo = this.getRepo(table);
    const row = await repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`${table}[${id}] 不存在`);
    return this.toDict(row, table);
  }

  async create(
    table: string,
    payload: Record<string, any>,
  ): Promise<Record<string, any>> {
    const cleaned = this.cleanPayload(table, payload);
    const repo = this.getRepo(table);

    // 幂等防重：client_id 已存在时直接返回已有行
    if (cleaned.client_id) {
      const existing = await repo.findOne({
        where: { client_id: cleaned.client_id } as any,
      });
      if (existing) return this.toDict(existing, table);
    }

    // 自然键查重
    const dup = await this.findNaturalDup(table, cleaned);
    if (dup) return this.toDict(dup, table);

    const row = repo.create(this.buildRow(table, cleaned));
    const saved = await repo.save(row as any);
    return this.toDict(saved, table);
  }

  async update(
    table: string,
    id: number,
    payload: Record<string, any>,
  ): Promise<Record<string, any>> {
    const cleaned = this.cleanPayload(table, payload);
    const repo = this.getRepo(table);
    const row = await repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`${table}[${id}] 不存在`);
    this.applyRow(row, table, cleaned);
    const saved = await repo.save(row as any);
    return this.toDict(saved, table);
  }

  async delete(table: string, id: number): Promise<{ ok: boolean }> {
    const repo = this.getRepo(table);
    const row = await repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`${table}[${id}] 不存在`);
    await repo.remove(row as any);
    return { ok: true };
  }

  async batchCreate(
    table: string,
    rows: Record<string, any>[],
  ): Promise<{ created: number; skipped: number; items: Record<string, any>[] }> {
    let created = 0;
    let skipped = 0;
    const items: Record<string, any>[] = [];
    for (const payload of rows) {
      const cleaned = this.cleanPayload(table, payload);
      const repo = this.getRepo(table);
      if (cleaned.client_id) {
        const existing = await repo.findOne({
          where: { client_id: cleaned.client_id } as any,
        });
        if (existing) { skipped++; items.push(this.toDict(existing, table)); continue; }
      }
      const dup = await this.findNaturalDup(table, cleaned);
      if (dup) { skipped++; items.push(this.toDict(dup, table)); continue; }
      const row = repo.create(this.buildRow(table, cleaned));
      const saved = await repo.save(row as any);
      created++;
      items.push(this.toDict(saved, table));
    }
    return { created, skipped, items };
  }

  async batchDelete(
    table: string,
    ids: number[],
  ): Promise<{ deleted: number }> {
    const repo = this.getRepo(table);
    const rows = await repo.findByIds(ids);
    await repo.remove(rows as any[]);
    return { deleted: rows.length };
  }

  async batchUpdate(
    table: string,
    ids: number[],
    updates: Record<string, any>,
  ): Promise<{ updated: number }> {
    const repo = this.getRepo(table);
    const rows = await repo.findByIds(ids);
    const cleaned = this.cleanPayload(table, updates);
    for (const row of rows) {
      this.applyRow(row, table, cleaned);
    }
    await repo.save(rows as any[]);
    return { updated: rows.length };
  }

  // ---------- 私有工具 ----------

  private buildRow(table: string, payload: Record<string, any>): Record<string, any> {
    const row: Record<string, any> = {};
    for (const col of this.cols(table)) {
      row[col] = payload[col] !== undefined ? String(payload[col] ?? '') : '';
    }
    if ('student_id' in payload) row.student_id = String(payload.student_id ?? '');
    if ('client_id' in payload) row.client_id = String(payload.client_id ?? '');
    return row;
  }

  private applyRow(row: any, table: string, payload: Record<string, any>) {
    for (const col of this.cols(table)) {
      if (col in payload) row[col] = String(payload[col] ?? '');
    }
    if ('student_id' in payload) row.student_id = String(payload.student_id ?? '');
    if ('client_id' in payload) row.client_id = String(payload.client_id ?? '');
  }
}
