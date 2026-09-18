import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('parents')
export class Parent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  @Index('ix_parents_student_id')
  student_id: string;

  @Column({ default: '' })
  student_name: string;

  @Column({ default: '' })
  relationship: string;

  @Column({ default: '' })
  @Index('ix_parents_phone')
  phone: string;

  @Column({ default: '' })
  notes: string;
}
