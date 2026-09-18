import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('academic')
@Index('ix_academic_query', ['class_name', 'date', 'item_name'])
@Index('ix_academic_stu_date', ['student_id', 'date'])
@Index('ix_academic_cid_date', ['class_id', 'date'])
export class Academic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_academic_student_id')
  student_id: string;

  /** 幂等防重 client-generated UUID */
  @Column({ default: '' })
  @Index('ix_academic_client_id')
  client_id: string;

  @Column({ default: '' })
  @Index('ix_academic_class_id')
  class_id: string;

  @Column({ default: '' })
  date: string;

  @Column({ default: '' })
  class_name: string;

  @Column({ default: '' })
  student_name: string;

  @Column({ default: '' })
  item_name: string;

  @Column({ default: '' })
  score: string;

  /** 完成 / 待补测 */
  @Column({ default: '' })
  status: string;

  @Column({ default: '' })
  notes: string;
}
