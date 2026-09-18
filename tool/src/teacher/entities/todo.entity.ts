import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('todos')
@Index('ix_todos_status_date', ['status', 'date'])
export class Todo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  date: string;

  @Column({ default: '' })
  title: string;

  @Column({ default: '' })
  category: string;

  @Column({ default: '' })
  status: string;
}
