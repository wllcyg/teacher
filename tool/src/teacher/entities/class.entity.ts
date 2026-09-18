import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('classes')
@Index('ix_classes_sort', ['seq', 'name'])
export class ClassEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '', unique: true })
  @Index('ix_classes_class_id')
  class_id: string;

  @Column({ default: '', unique: true })
  @Index('ix_classes_name')
  name: string;

  @Column({ default: '' })
  grade: string;

  @Column({ default: 0 })
  seq: number;
}
