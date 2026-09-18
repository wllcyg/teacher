import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('behavior')
@Index('ix_behavior_query', ['class_name', 'date'])
@Index('ix_behavior_stu_date', ['student_id', 'date'])
@Index('ix_behavior_cid_date', ['class_id', 'date'])
export class Behavior {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_behavior_student_id')
  student_id: string;

  @Column({ default: '' })
  @Index('ix_behavior_client_id')
  client_id: string;

  @Column({ default: '' })
  @Index('ix_behavior_class_id')
  class_id: string;

  @Column({ default: '' })
  date: string;

  @Column({ default: '' })
  class_name: string;

  @Column({ default: '' })
  student_name: string;

  @Column({ default: '' })
  item_name: string;

  /** 加减分数值（字符串存储，如 "3" / "-2"） */
  @Column({ default: '' })
  score: string;

  @Column({ default: '' })
  notes: string;
}
