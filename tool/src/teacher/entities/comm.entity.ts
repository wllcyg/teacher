import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('comms')
export class Comm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_comms_student_id')
  student_id: string;

  @Column({ default: '' })
  @Index('ix_comms_date')
  date: string;

  @Column({ default: '' })
  student_name: string;

  @Column({ default: '' })
  target: string;

  @Column({ default: '' })
  method: string;

  @Column({ default: '' })
  content: string;

  @Column({ default: '' })
  result: string;
}
