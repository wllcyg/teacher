import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { Academic } from '../entities/academic.entity';
import { AppSetting } from '../entities/app-setting.entity';
import { Attendance } from '../entities/attendance.entity';
import { Behavior } from '../entities/behavior.entity';
import { ClassEntity } from '../entities/class.entity';
import { Comm } from '../entities/comm.entity';
import { Duty } from '../entities/duty.entity';
import { Item } from '../entities/item.entity';
import { LessonLog } from '../entities/lesson-log.entity';
import { Parent } from '../entities/parent.entity';
import { ScheduleEntry } from '../entities/schedule.entity';
import { Student } from '../entities/student.entity';
import { Todo } from '../entities/todo.entity';

export const TEACHER_ENTITIES = [
  ClassEntity,
  Student,
  ScheduleEntry,
  Item,
  Academic,
  Behavior,
  Todo,
  Attendance,
  Parent,
  Comm,
  Duty,
  LessonLog,
  AppSetting,
];

// 数据库文件路径：优先读 DATA_DIR 环境变量，回落到项目根 data/ 目录
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../../..', 'data');

const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^sqlite:\/\/\//, '')
  : path.join(dataDir, 'teacher.sqlite');

@Module({
  imports: [
    TypeOrmModule.forRoot({
      name: 'teacher',
      type: 'better-sqlite3',
      database: dbPath,
      entities: TEACHER_ENTITIES,
      // 开发期自动同步表结构；生产建议关闭改用 migrations
      synchronize: true,
      // WAL 模式：提升并发读性能
      prepareDatabase: (db) => {
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
      },
    }),
    TypeOrmModule.forFeature(TEACHER_ENTITIES, 'teacher'),
  ],
  exports: [TypeOrmModule],
})
export class TeacherDatabaseModule {}
