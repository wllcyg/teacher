import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lesson_log')
@Index('ix_lesson_log_class_date', ['class_name', 'date'])
@Index('ix_lesson_log_cid_date', ['class_id', 'date'])
export class LessonLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_lesson_log_class_id')
  class_id: string;

  @Column({ default: '' })
  date: string;

  @Column({ default: '' })
  class_name: string;

  @Column({ default: '' })
  period: string;

  @Column({ default: '' })
  content: string;
}
