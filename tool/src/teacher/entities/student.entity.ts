import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('students')
@Index('ix_students_class_sno', ['class_name', 'student_no'])
@Index('ix_students_cid_sno', ['class_id', 'student_no'])
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '', unique: true })
  @Index('ix_students_student_id')
  student_id: string;

  @Column({ default: '' })
  @Index('ix_students_class_id')
  class_id: string;

  @Column({ default: '' })
  class_name: string;

  @Column({ default: '' })
  name: string;

  @Column({ default: '' })
  student_no: string;

  @Column({ default: '' })
  group_name: string;

  /** 已离班学生 tags 以 `（系统）已离班` 开头 */
  @Column({ default: '' })
  tags: string;
}
