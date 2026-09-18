/**
 * Vault 导入导出 + academic batch-upsert + students/parents CSV 导入
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeacherAuthGuard } from '../guards/teacher-auth.guard';
import { ClassResolverService } from '../common/class-resolver.service';
import { TABLE_COLUMNS } from '../common/enums';
import { parentImportPlan } from '../common/scoring';
import { Academic } from '../entities/academic.entity';
import { Item } from '../entities/item.entity';

function toDict(row: any, cols: string[]): Record<string, any> {
  const d: Record<string, any> = { id: row.id };
  if ('student_id' in row) d.student_id = row.student_id ?? '';
  if ('client_id' in row) d.client_id = row.client_id ?? '';
  for (const c of cols) d[c] = row[c] ?? '';
  return d;
}

@Controller('api')
@UseGuards(TeacherAuthGuard)
export class VaultController {
  constructor(
    private readonly ds: DataSource,
    private readonly resolver: ClassResolverService,
  ) {}

  // ---------- 全量导出 ----------
  @Get('vault/export')
  async export() {
    const out: Record<string, any[]> = {};
    for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
      const meta = this.ds.entityMetadatas.find((m) => m.tableName === table);
      if (!meta) continue;
      const rows = await this.ds.getRepository(meta.target).find();
      out[table] = rows.map((r) => toDict(r, cols));
    }
    return out;
  }

  // ---------- 全量覆盖导入 ----------
  @Post('vault/import')
  async import(@Body() payload: Record<string, any[]>) {
    const stats: Record<string, number> = {};
    for (const [table, colsList] of Object.entries(TABLE_COLUMNS)) {
      const meta = this.ds.entityMetadatas.find((m) => m.tableName === table);
      if (!meta) continue;
      const repo = this.ds.getRepository(meta.target);
      await repo.delete({});
      const rows = payload[table] ?? [];
      for (const row of rows) {
        const inst: Record<string, any> = {};
        for (const col of colsList) {
          inst[col] = row[col] !== undefined ? String(row[col] ?? '') : '';
        }
        if ('student_id' in row) inst.student_id = String(row.student_id ?? '');
        if ('client_id' in row) inst.client_id = String(row.client_id ?? '');
        await repo.save(repo.create(inst));
      }
      stats[table] = rows.length;
    }
    return { ok: true, tables: stats };
  }

  // ---------- academic batch-upsert ----------
  @Post('academic/batch-upsert')
  async batchUpsertAcademic(@Body() payload: Record<string, any>) {
    const cidInput = (payload.class_id || '').trim();
    const cnameInput = (payload.class_name || payload['班级'] || '').trim();
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(cidInput, cnameInput);
    const itemName = (payload.item_name || payload['项目'] || '').trim();
    const examDate = (payload.date || payload['日期'] || '').trim();
    const records: any[] = payload.records ?? [];

    if (!klass || !itemName || !examDate) {
      throw new BadRequestException('class_id/class_name、item_name 和 date 不能为空');
    }

    const itemRepo = this.ds.getRepository(Item);
    let existingItem = await itemRepo.findOne({ where: { item_name: itemName } });
    let itemCreated = false;
    if (!existingItem) {
      existingItem = itemRepo.create({
        item_name: itemName,
        item_type: '学业',
        scoring_type: '分数',
        full_score: String(payload.full_score ?? payload['满分'] ?? 100),
        category: String(payload.category ?? payload['类别'] ?? '单元'),
        subject: String(payload.subject ?? payload['学科'] ?? '地理'),
        cycle: '学期',
        weight: '1',
      });
      await itemRepo.save(existingItem);
      itemCreated = true;
    }

    const acRepo = this.ds.getRepository(Academic);
    let created = 0, updated = 0;

    for (const r of records) {
      const stu = String(r.student_name ?? r['学生'] ?? '').trim();
      const val = String(r.score ?? r['结果'] ?? '').trim();
      const status = String(r.status ?? r['状态'] ?? '完成').trim();
      const note = String(r.notes ?? r['备注'] ?? '').trim();
      const clientId = String(r.client_id ?? '').trim();
      if (!stu) continue;

      const sid = await this.resolver.lookupStudentId(stu, klass);

      const qb = acRepo
        .createQueryBuilder('a')
        .where('(a.class_id = :cid OR a.class_name = :klass)', { cid, klass })
        .andWhere('a.item_name = :itemName', { itemName })
        .andWhere('a.date = :examDate', { examDate });
      const existing = sid
        ? await qb
            .andWhere('(a.student_id = :sid OR a.student_name = :stu)', { sid, stu })
            .getOne()
        : await qb.andWhere('a.student_name = :stu', { stu }).getOne();

      if (existing) {
        existing.score = val;
        existing.status = status;
        existing.notes = note;
        if (cid && !existing.class_id) existing.class_id = cid;
        if (sid && !existing.student_id) existing.student_id = sid;
        if (clientId) existing.client_id = clientId;
        await acRepo.save(existing);
        updated++;
      } else {
        await acRepo.save(
          acRepo.create({
            student_id: sid,
            client_id: clientId,
            class_id: cid,
            class_name: klass,
            item_name: itemName,
            date: examDate,
            student_name: stu,
            score: val,
            status,
            notes: note,
          }),
        );
        created++;
      }
    }

    return {
      ok: true, class_id: cid, class_name: klass,
      item_name: itemName, date: examDate,
      created, updated,
      total_saved: created + updated,
      item_created: itemCreated,
    };
  }

  // ---------- 家长通讯录文本解析（不落库） ----------
  @Post('import/parents')
  async importParents(@Body() payload: Record<string, any>) {
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(
        payload.class_id,
        payload.class_name ?? payload['班级'],
      );
    const roster = await this.resolver.activeRoster(cid || klass);
    const parentMeta = this.ds.entityMetadatas.find((m) => m.tableName === 'parents');
    const existing = parentMeta
      ? await this.ds.getRepository(parentMeta.target).find()
      : [];
    const text = payload.text ?? payload['文本'] ?? '';
    return parentImportPlan(text, roster, existing);
  }

  // ---------- 学生 CSV 批量导入 ----------
  @Post('import/students')
  async importStudents(@Body() payload: Record<string, any>) {
    const csvText = (payload.csv ?? '').trim();
    if (!csvText) throw new BadRequestException('CSV 内容为空');

    const studentMeta = this.ds.entityMetadatas.find((m) => m.tableName === 'students');
    if (!studentMeta) throw new BadRequestException('students 表不存在');
    const repo = this.ds.getRepository(studentMeta.target);

    // 默认班级
    const defaultKlass =
      (payload.class_name ?? payload['班级'] ?? '').trim() ||
      (await repo.findOne({ order: { id: 'ASC' } } as any).then((r: any) => r?.class_name || ''));
    if (!defaultKlass) throw new BadRequestException('请指定班级');

    // 去 BOM，全角逗号转半角
    let cleaned = csvText.replace(/^\uFEFF/, '').replace(/，/g, ',');
    const lines = cleaned.split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (!lines.length) throw new BadRequestException('CSV 无有效数据行');

    const ALIAS: Record<string, string> = {
      班级: 'class_name', class: 'class_name', class_name: 'class_name',
      姓名: 'name', name: 'name',
      学号: 'student_no', number: 'student_no', no: 'student_no', student_no: 'student_no',
      小组: 'group_name', group: 'group_name', group_name: 'group_name',
      标签: 'tags', tag: 'tags', tags: 'tags',
    };

    const parseRow = (line: string) => line.split(',').map((c) => c.trim());
    const headerCells = parseRow(lines[0]);
    const mapped = headerCells.map((h) => ALIAS[h.toLowerCase()] ?? null);
    const hasHeader = mapped.some((m) => m !== null);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const effectiveMapped = hasHeader ? mapped : ['name', ...Array(headerCells.length - 1).fill('student_no')];

    const added: any[] = [], dupSkipped: any[] = [], badSkipped: any[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cells = parseRow(dataLines[i]);
      const rec: Record<string, string> = {
        class_name: defaultKlass, name: '', student_no: '', group_name: '', tags: '',
      };
      effectiveMapped.forEach((col, j) => {
        if (col && j < cells.length) rec[col] = cells[j];
      });
      if (!rec.name) { badSkipped.push({ row: i + 2, reason: '姓名为空' }); continue; }

      const dup = await repo.findOne({
        where: { class_name: rec.class_name, name: rec.name } as any,
      });
      if (dup) { dupSkipped.push({ name: rec.name, class_name: rec.class_name }); continue; }

      const [sid] = await this.resolver.nextStudentIds(1);
      const row = repo.create({ ...rec, student_id: sid });
      const saved = await repo.save(row as any);
      added.push(saved);
    }

    return {
      class_name: defaultKlass, 班级: defaultKlass,
      added, 新增: added,
      skipped_dup: dupSkipped, 已存在跳过: dupSkipped,
      skipped_bad: badSkipped, 无效行: badSkipped,
      stats: {
        total_rows: dataLines.length,
        added_count: added.length,
        dup_count: dupSkipped.length,
        bad_count: badSkipped.length,
      },
    };
  }
}
