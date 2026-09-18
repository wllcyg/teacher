/**
 * 系统设置接口（对应 Python /api/settings）
 *
 * GET  /api/settings  — 读取白名单配置项
 * POST /api/settings  — 写入白名单配置项（禁止写 AI Key，防 SSRF）
 */
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeacherAuthGuard } from '../guards/teacher-auth.guard';
import { AppSetting } from '../entities/app-setting.entity';

// 仅允许读写这些业务配置键，彻底封死通过该接口改 ai_base_url 发起 SSRF 的可能
const ALLOWED_SETTING_KEYS = new Set(['称呼', '学期', 'periods', 'notification_schedule', 'greeting_theme']);

@Controller('api/settings')
@UseGuards(TeacherAuthGuard)
export class SettingsController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  async getSettings() {
    const rows = await this.ds
      .getRepository(AppSetting)
      .createQueryBuilder('s')
      .where('s.key IN (:...keys)', { keys: [...ALLOWED_SETTING_KEYS] })
      .getMany();

    const res: Record<string, any> = {};
    for (const r of rows) {
      try { res[r.key] = JSON.parse(r.value); }
      catch { res[r.key] = r.value; }
    }

    // 默认值保障
    if (!res['称呼']) res['称呼'] = '崔老师';
    if (res['学期'] === undefined) res['学期'] = '';
    return res;
  }

  @Post()
  async updateSettings(@Body() payload: Record<string, any>) {
    const repo = this.ds.getRepository(AppSetting);
    for (const [k, v] of Object.entries(payload)) {
      if (!ALLOWED_SETTING_KEYS.has(k)) continue;
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      let row = await repo.findOne({ where: { key: k } });
      if (!row) {
        row = repo.create({ key: k, value: val });
      } else {
        row.value = val;
      }
      await repo.save(row);
    }
    return { ok: true };
  }
}
