/**
 * 班级 class_id / class_name 双向解析工具（对应 Python _resolve_class_info）
 * 以及学生 student_id 反查、active_roster 等通用查询。
 */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { Student } from '../entities/student.entity';
import { LEFT_MARK } from './enums';

@Injectable()
export class ClassResolverService {
  constructor(private readonly ds: DataSource) {}

  private get classRepo() {
    return this.ds.getRepository(ClassEntity);
  }

  private get studentRepo() {
    return this.ds.getRepository(Student);
  }

  /**
   * 根据 class_id 或 class_name 解析出 (class_id, class_name)。
   * 若均为空，默认返回首个班级。
   */
  async resolveClassInfo(
    classId?: string,
    className?: string,
  ): Promise<{ class_id: string; class_name: string }> {
    const cid = (classId || '').trim();
    const cname = (className || '').trim();

    if (cid) {
      let ce = await this.classRepo.findOne({ where: { class_id: cid } });
      if (ce) return { class_id: ce.class_id, class_name: ce.name };
      ce = await this.classRepo.findOne({ where: { name: cid } });
      if (ce) return { class_id: ce.class_id, class_name: ce.name };
    }

    if (cname) {
      let ce = await this.classRepo.findOne({ where: { name: cname } });
      if (ce) return { class_id: ce.class_id, class_name: ce.name };
      ce = await this.classRepo.findOne({ where: { class_id: cname } });
      if (ce) return { class_id: ce.class_id, class_name: ce.name };
    }

    // 兜底取第一班
    const first = await this.classRepo.findOne({
      order: { seq: 'ASC', id: 'ASC' },
    });
    return first
      ? { class_id: first.class_id, class_name: first.name }
      : { class_id: '', class_name: '' };
  }

  /**
   * 当前班在册学生（排除已离班标签），按学号数值排序
   */
  async activeRoster(klass: string): Promise<Record<string, any>[]> {
    if (!klass) return [];
    const rows = await this.studentRepo
      .createQueryBuilder('s')
      .where('s.class_id = :k OR s.class_name = :k', { k: klass })
      .getMany();

    const active = rows.filter((s) => !s.tags?.startsWith(LEFT_MARK));
    active.sort((a, b) => toNum(a.student_no) - toNum(b.student_no));
    return active.map((s) => ({
      id: s.id,
      student_id: s.student_id,
      class_id: s.class_id,
      class_name: s.class_name,
      name: s.name,
      student_no: s.student_no,
      group_name: s.group_name,
      tags: s.tags,
    }));
  }

  /**
   * 根据姓名（+可选班级）查询 student_id
   */
  async lookupStudentId(studentName: string, klass?: string): Promise<string> {
    if (!studentName) return '';
    const qb = this.studentRepo
      .createQueryBuilder('s')
      .where('s.name = :name', { name: studentName });
    if (klass) {
      const inClass = await qb
        .clone()
        .andWhere('s.class_name = :klass', { klass })
        .getOne();
      if (inClass?.student_id) return inClass.student_id;
    }
    const s = await qb.getOne();
    return s?.student_id || '';
  }

  /**
   * 生成 n 个连续唯一的学生业务编号（STU0001, STU0002...）
   */
  async nextStudentIds(count = 1): Promise<string[]> {
    const rows = await this.studentRepo
      .createQueryBuilder('s')
      .select('s.student_id')
      .where("s.student_id LIKE 'STU%'")
      .getMany();

    let maxNum = 0;
    for (const r of rows) {
      if (r.student_id?.startsWith('STU')) {
        const n = parseInt(r.student_id.slice(3), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    if (maxNum === 0) {
      const last = await this.studentRepo.findOne({ order: { id: 'DESC' } });
      maxNum = last?.id ?? 0;
    }
    return Array.from({ length: count }, (_, i) =>
      `STU${String(maxNum + 1 + i).padStart(4, '0')}`,
    );
  }
}

function toNum(v: string | null | undefined): number {
  const n = parseFloat(v || '');
  return isNaN(n) ? Infinity : n;
}
