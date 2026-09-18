import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('duties')
export class Duty {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_duties_student_id')
  student_id: string;

  @Column({ default: '' })
  duty_name: string;

  @Column({ default: '' })
  student_name: string;

  @Column({ default: '' })
  duty_type: string;

  @Column({ default: '' })
  schedule_time: string;

  @Column({ default: '' })
  notes: string;
}
