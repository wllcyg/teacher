/**
 * 报表接口（与 Python /api/report/* 完全对应）
 */
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DataSource, Or } from 'typeorm';
import { TeacherAuthGuard } from '../guards/teacher-auth.guard';
import { ClassResolverService } from '../common/class-resolver.service';
import { Academic } from '../entities/academic.entity';
import { Behavior } from '../entities/behavior.entity';
import { Attendance } from '../entities/attendance.entity';
import { Item } from '../entities/item.entity';
import {
  aggregateItem,
  buildMatrix,
  contactBook,
  deltaOverview,
  deltaScores,
  fld,
  itemDisabled,
  latestValidScores,
  prevExam,
  rankScores,
  reportStats,
  scoreKind,
  summaryOverview,
  textOf,
  weeklyBehaviorOverview,
} from '../common/scoring';

function toDict(row: any, cols: string[]): Record<string, any> {
  const d: Record<string, any> = { id: row.id };
  if ('student_id' in row) d.student_id = row.student_id ?? '';
  if ('client_id' in row) d.client_id = row.client_id ?? '';
  for (const c of cols) d[c] = row[c] ?? '';
  return d;
}

const ACADEMIC_COLS = ['class_id', 'date', 'class_name', 'student_name', 'item_name', 'score', 'status', 'notes'];
const BEHAVIOR_COLS = ['class_id', 'date', 'class_name', 'student_name', 'item_name', 'score', 'notes'];
const ATTENDANCE_COLS = ['class_id', 'date', 'class_name', 'student_name', 'status', 'notes'];
const ITEM_COLS = ['item_name', 'item_type', 'scoring_type', 'full_score', 'category', 'weight', 'cycle', 'subject'];
const PARENT_COLS = ['student_name', 'relationship', 'phone', 'notes'];

@Controller('api/report')
@UseGuards(TeacherAuthGuard)
export class ReportsController {
  constructor(
    private readonly ds: DataSource,
    private readonly resolver: ClassResolverService,
  ) {}

  // ---------- 通用查询助手 ----------

  private async getItems(): Promise<Record<string, any>[]> {
    const rows = await this.ds.getRepository(Item).find({ order: { id: 'ASC' } });
    return rows.map((r) => toDict(r, ITEM_COLS));
  }

  private async getAcademic(cid: string, klass: string): Promise<Record<string, any>[]> {
    const qb = this.ds.getRepository(Academic).createQueryBuilder('a');
    if (cid || klass) {
      qb.where('a.class_id = :cid OR a.class_name = :klass', { cid, klass });
    }
    return (await qb.getMany()).map((r) => toDict(r, ACADEMIC_COLS));
  }

  private async getBehavior(cid: string, klass: string): Promise<Record<string, any>[]> {
    const qb = this.ds.getRepository(Behavior).createQueryBuilder('b');
    if (cid || klass) {
      qb.where('b.class_id = :cid OR b.class_name = :klass', { cid, klass });
    }
    return (await qb.getMany()).map((r) => toDict(r, BEHAVIOR_COLS));
  }

  private async getAttendance(): Promise<Record<string, any>[]> {
    const rows = await this.ds.getRepository(Attendance).find();
    return rows.map((r) => toDict(r, ATTENDANCE_COLS));
  }

  // ---------- 班级总览 ----------
  @Get('summary')
  async summary(
    @Query('today') today = '',
    @Query('class_id') classId = '',
    @Query('class_name') className = '',
  ) {
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(classId, className);
    const roster = await this.resolver.activeRoster(cid || klass);

    const [items, academic, behavior, attendance] = await Promise.all([
      this.getItems(),
      this.getAcademic(cid, klass),
      this.getBehavior(cid, klass),
      this.getAttendance(),
    ]);

    return {
      class_id: cid,
      class_name: klass,
      班级: klass,
      ...summaryOverview({ items, academic, roster, behavior, attendance, today, 今天: today }),
    };
  }

  // ---------- 单场考试报表 ----------
  @Get('exam/:item_name')
  async examReport(
    @Param('item_name') itemName: string,
    @Query('class_id') classId = '',
    @Query('class_name') className = '',
    @Query('优') you = 85,
    @Query('及') ji = 60,
    @Query('低') di = 40,
  ) {
    const items = await this.getItems();
    const item = items.find((it) => textOf(fld(it, 'item_name', '项目名')) === itemName);
    if (!item) throw new NotFoundException(`项目不存在: ${itemName}`);

    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(classId, className);
    const roster = await this.resolver.activeRoster(cid || klass);
    const records = await this.getAcademic(cid, klass);

    const stats = reportStats(item, records, roster, {
      优: Number(you),
      及: Number(ji),
      低: Number(di),
    });

    const prevName = prevExam(items, records, roster, itemName);
    let previousExam: any = null;
    if (prevName) {
      const prevItem = items.find((it) => textOf(fld(it, 'item_name', '项目名')) === prevName);
      if (prevItem) {
        const prevSnap = latestValidScores(prevItem, records, roster);
        const curSnap = stats.snapshot;
        const deltas = deltaScores(curSnap, prevSnap);
        const curByStudent = stats.snapshot.by_student as Record<string, any>;
        previousExam = {
          item_name: prevName,
          stats: reportStats(prevItem, records, roster),
          deltas: deltaOverview(deltas),
          ranks: rankScores(
            Object.keys(curByStudent).map((w) => ({ name: w, score: curByStudent[w].score })),
          ),
        };
      }
    }
    return {
      class_id: cid, class_name: klass,
      item_name: itemName, stats,
      previous_exam: previousExam,
    };
  }

  // ---------- 成绩矩阵 ----------
  @Get('matrix')
  async matrix(
    @Query('class_id') classId = '',
    @Query('class_name') className = '',
    @Query('item_name') itemName = '',
    @Query('date_from') dateFrom = '',
  ) {
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(classId, className);
    const roster = await this.resolver.activeRoster(cid || klass);
    const items = await this.getItems();

    const qb = this.ds.getRepository(Academic).createQueryBuilder('a');
    if (cid || klass) qb.where('a.class_id = :cid OR a.class_name = :klass', { cid, klass });
    if (itemName) qb.andWhere('a.item_name = :itemName', { itemName });
    if (dateFrom) qb.andWhere('a.date >= :dateFrom', { dateFrom });
    const records = (await qb.getMany()).map((r) => toDict(r, ACADEMIC_COLS));

    return buildMatrix(roster, records, items, {
      ...(itemName ? { item_name: itemName } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
    });
  }

  // ---------- 项目汇总 ----------
  @Get('items-summary')
  async itemsSummary(
    @Query('class_id') classId = '',
    @Query('class_name') className = '',
  ) {
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(classId, className);
    const roster = await this.resolver.activeRoster(cid || klass);
    const [items, academic] = await Promise.all([
      this.getItems(),
      this.getAcademic(cid, klass),
    ]);

    const out = items
      .filter((it) => !itemDisabled(it))
      .map((it) => {
        const agg = aggregateItem(it, academic, roster);
        return {
          ...agg,
          scoring_type: scoreKind(it),
          计分制: scoreKind(it),
          item_type: textOf(fld(it, 'item_type', '类型')),
          subject: textOf(fld(it, 'subject', '学科')),
        };
      });

    return { class_id: cid, class_name: klass, 班级: klass, items_summary: out, 项目汇总: out };
  }

  // ---------- 周表现大盘 ----------
  @Get('behavior-week')
  async behaviorWeek(
    @Query('class_id') classId = '',
    @Query('class_name') className = '',
    @Query('weekStart') weekStart = '',
  ) {
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(classId, className);
    const roster = await this.resolver.activeRoster(cid || klass);
    const records = await this.getBehavior(cid, klass);
    const table = weeklyBehaviorOverview(records, roster, weekStart || undefined);
    return { class_id: cid, class_name: klass, week_table: table, 周表: table };
  }

  // ---------- 家长通讯录 ----------
  @Get('contact-book')
  async contactBook(
    @Query('class_id') classId = '',
    @Query('class_name') className = '',
    @Query('keyword') keyword = '',
  ) {
    const { class_id: cid, class_name: klass } =
      await this.resolver.resolveClassInfo(classId, className);
    const roster = await this.resolver.activeRoster(cid || klass);
    const parents = await this.ds
      .getRepository('parents' as any)
      .find()
      .then((rows: any[]) => rows.map((r) => toDict(r, PARENT_COLS)));
    return contactBook(roster, parents, keyword);
  }
}
