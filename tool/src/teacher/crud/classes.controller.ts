/**
 * GET /api/classes   — 轻量班级列表（与 Python /api/classes 响应格式一致）
 * GET /api/health    — 健康检查
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeacherAuthGuard } from '../guards/teacher-auth.guard';
import { ClassEntity } from '../entities/class.entity';
import { ScheduleEntry } from '../entities/schedule.entity';
import { Student } from '../entities/student.entity';

@Controller('api')
@UseGuards(TeacherAuthGuard)
export class ClassesController {
  constructor(private readonly ds: DataSource) {}

  @Get('classes')
  async getClasses() {
    const repo = this.ds.getRepository(ClassEntity);
    const rows = await repo.find({ order: { seq: 'ASC', id: 'ASC' } });

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        class_id: r.class_id,
        name: r.name,
        grade: r.grade || '',
        seq: r.seq || 0,
        sort_order: r.seq || 0,
      }));
    }

    // 兜底：从 schedule / students 表推断班级列表
    const schClasses = await this.ds
      .getRepository(ScheduleEntry)
      .createQueryBuilder('s')
      .select('DISTINCT s.class_name', 'class_name')
      .where("s.class_name != ''")
      .getRawMany();
    const stuClasses = await this.ds
      .getRepository(Student)
      .createQueryBuilder('s')
      .select('DISTINCT s.class_name', 'class_name')
      .where("s.class_name != ''")
      .getRawMany();

    const allNames = [
      ...new Set([
        ...schClasses.map((r) => r.class_name),
        ...stuClasses.map((r) => r.class_name),
      ]),
    ].sort();

    return allNames.map((c, i) => ({
      id: i + 1,
      class_id: `CLS${String(i + 1).padStart(4, '0')}`,
      name: c,
      grade: '',
      seq: i + 1,
      sort_order: i + 1,
    }));
  }
}

@Controller('api')
export class HealthController {
  @Get('health')
  health() {
    return { ok: true };
  }
}
