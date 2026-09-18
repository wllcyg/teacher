import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('schedule')
@Index('ix_schedule_slot', ['weekday', 'period', 'class_name'])
export class ScheduleEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_schedule_class_id')
  class_id: string;

  @Column({ default: '' })
  weekday: string;

  @Column({ default: '' })
  period: string;

  @Column({ default: '' })
  class_name: string;

  @Column({ default: '' })
  subject: string;
}
