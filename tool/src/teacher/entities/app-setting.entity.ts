import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column({ default: '' })
  value: string;
}
