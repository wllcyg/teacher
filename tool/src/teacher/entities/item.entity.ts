import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('items')
@Index('ix_items_name_subject', ['item_name', 'subject'])
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: '' })
  item_name: string;

  /** 学业 / 表现 */
  @Column({ default: '' })
  item_type: string;

  /** 打钩 / 分数 / 等第 / 过关 / 加减分 */
  @Column({ default: '' })
  scoring_type: string;

  @Column({ default: '' })
  full_score: string;

  @Column({ default: '' })
  category: string;

  @Column({ default: '' })
  weight: string;

  @Column({ default: '' })
  cycle: string;

  @Column({ default: '' })
  subject: string;
}
