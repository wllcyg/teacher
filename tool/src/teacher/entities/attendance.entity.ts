import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attendance')
@Index('ix_attendance_query', ['class_name', 'date'])
@Index('ix_attendance_stu_date', ['student_id', 'date'])
@Index('ix_attendance_cid_date', ['class_id', 'date'])
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_attendance_student_id')
  student_id: string;

  @Column({ default: '' })
  @Index('ix_attendance_class_id')
  class_id: string;

  @Column({ default: '' })
  date: string;

  @Column({ default: '' })
  class_name: string;

  @Column({ default: '' })
  student_name: string;

  /** 缺勤 / 迟到 / 早退 / 请假 */
  @Column({ default: '' })
  status: string;

  @Column({ default: '' })
  notes: string;
}
