/**
 * 每日晨间寄语接口（对应 Python /api/daily-greeting + /api/ai/greeting）
 *
 * GET /api/daily-greeting      — 返回寄语文字（AI 生成或内置语录）
 * GET /api/ai/greeting         — 同上（别名）
 * GET /api/daily-greeting/card — 返回 PNG 海报（公开免认证）
 */
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { DataSource } from 'typeorm';
import { TeacherAuthGuard } from '../guards/teacher-auth.guard';
import { AppSetting } from '../entities/app-setting.entity';
import { CardGeneratorService, resolveThemeByDate, THEMES } from './card-generator.service';

const EDUCATIONAL_QUOTES = [
  '晨光微露，心向阳光，愿每个孩子都如春芽般，在爱与期待中悄然生长。',
  '教育的本质意味着，一棵树摇动另一棵树，一朵云推动另一朵云，一个灵魂唤醒另一个灵魂。',
  '学贵得师，亦贵得友。愿您今天的课堂充满思考的火花与纯真的笑脸。',
  '爱是教育的灵魂，没有爱就没有教育。用心灌溉，静待每一朵花开。',
  '捧着一颗心来，不带半根草去。老师的每一分付出，都在孩子心中生根发芽。',
  '教育不是注满一桶水，而是点燃一把火。愿今天的教学充满灵感与温度。',
  '晨光里，你的一句叮咛，正悄悄点亮孩子眼中的星。',
  '知之者不如好之者，好之者不如乐之者。愿您的启发带给学生探索世界的渴望。',
  '温和而坚定，严格且包容。用心陪伴每一个独特的生命拔节成长。',
];

const DEFAULT_AI_BASE_URL = process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_AI_KEY = process.env.AI_API_KEY || process.env.DASHSCOPE_API_KEY || '';
const DEFAULT_AI_MODEL = process.env.AI_MODEL || 'qwen-flash';

function safeDateStr(dateStr: string): string {
  if (dateStr) {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d.getTime())) return dateStr;
    } catch {}
  }
  return new Date().toISOString().slice(0, 10);
}

/** SSRF 防护：AI 域名白名单 */
function allowedAiHosts(): Set<string> {
  const hosts = new Set<string>();
  try { hosts.add(new URL(DEFAULT_AI_BASE_URL).hostname.toLowerCase()); } catch {}
  for (const h of (process.env.AI_ALLOWED_HOSTS || '').split(',')) {
    const t = h.trim().toLowerCase();
    if (t) hosts.add(t);
  }
  return hosts;
}
const ALLOWED_AI_HOSTS = allowedAiHosts();

function isAllowedAiUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (!host) return false;
    return [...ALLOWED_AI_HOSTS].some((h) => host === h || host.endsWith('.' + h));
  } catch { return false; }
}

function httpsGet(reqUrl: string, opts: { headers: Record<string, string>; body: string; timeout?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const bodyBuf = Buffer.from(opts.body, 'utf8');
    const req = lib.request(
      {
        ...parsed,
        method: 'POST',
        headers: { ...opts.headers, 'Content-Length': bodyBuf.length },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    req.on('error', reject);
    if (opts.timeout) req.setTimeout(opts.timeout, () => req.destroy(new Error('timeout')));
    req.write(bodyBuf);
    req.end();
  });
}

async function callDailyGreeting(settingRow: Record<string, string>, teacherName: string): Promise<string> {
  const apiKey = (settingRow.ai_api_key ?? DEFAULT_AI_KEY).trim();
  const baseUrl = (settingRow.ai_base_url ?? DEFAULT_AI_BASE_URL).trim().replace(/\/$/, '');
  const model = (settingRow.ai_model ?? DEFAULT_AI_MODEL).trim();

  if (apiKey && baseUrl && isAllowedAiUrl(baseUrl)) {
    try {
      const body = JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `你是一位富有温度与教育智慧的资深教育导师。请为中学教师${teacherName}写一句清晨寄语或每日勉励。要求：富有教育情怀与诗意，亲切温暖，给人力量与信心；不要任何开场白、前缀或标号，直接输出正文，字数在40字以内。`,
          },
          { role: 'user', content: '请写一句今日晨间寄语。' },
        ],
        temperature: 0.85,
      });
      const resp = await httpsGet(`${baseUrl}/chat/completions`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body,
        timeout: 8000,
      });
      const json = JSON.parse(resp);
      let text: string = json?.choices?.[0]?.message?.content?.trim() ?? '';
      text = text.replace(/^["""]|["""]$/g, '');
      if (text) return text;
    } catch (e) {
      console.error('Daily greeting AI error:', e);
    }
  } else if (apiKey && baseUrl) {
    console.warn(`Blocked disallowed AI base_url (possible SSRF): ${baseUrl}`);
  }

  return EDUCATIONAL_QUOTES[Math.floor(Math.random() * EDUCATIONAL_QUOTES.length)];
}

@Controller('api')
export class GreetingController {
  constructor(
    private readonly ds: DataSource,
    private readonly cardGen: CardGeneratorService,
  ) {}

  private async getSettings(): Promise<Record<string, string>> {
    const rows = await this.ds.getRepository(AppSetting).find();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  private async getSetting(key: string): Promise<string> {
    const row = await this.ds.getRepository(AppSetting).findOne({ where: { key } });
    return row?.value ?? '';
  }

  @Get(['daily-greeting', 'ai/greeting'])
  @UseGuards(TeacherAuthGuard)
  async getDailyGreeting(
    @Query('date') dateQ = '',
    @Query('force') forceQ = '',
    @Query('theme') themeQ = 'auto',
  ) {
    const todayStr = safeDateStr(dateQ);
    const theme = themeQ !== 'auto' && themeQ in THEMES ? themeQ : resolveThemeByDate(todayStr);
    const force = forceQ === 'true' || forceQ === '1';
    const cardUrl = `/api/daily-greeting/card?date=${todayStr}&theme=${theme}`;
    const cacheKey = `daily_greeting_${todayStr}`;
    const settingRepo = this.ds.getRepository(AppSetting);

    if (!force) {
      const cached = await settingRepo.findOne({ where: { key: cacheKey } });
      if (cached?.value) {
        try {
          const data = JSON.parse(cached.value);
          return { ...data, cached: true, card_url: cardUrl, theme };
        } catch {
          return { quote: cached.value, date: todayStr, cached: true, card_url: cardUrl, theme };
        }
      }
    }

    const settings = await this.getSettings();
    const teacherName = settings['称呼'] || '崔老师';
    const quote = await callDailyGreeting(settings, teacherName);

    // 预生成海报（异步，失败不影响返回）
    this.cardGen
      .getOrGenerate({ quote, dateStr: todayStr, teacherName, theme, force })
      .catch((e) => console.error('Pre-generating card failed:', e));

    const result = { quote, date: todayStr, cached: false, card_url: cardUrl, theme };
    const val = JSON.stringify(result);
    let cacheRow = await settingRepo.findOne({ where: { key: cacheKey } });
    if (!cacheRow) {
      cacheRow = settingRepo.create({ key: cacheKey, value: val });
    } else {
      cacheRow.value = val;
    }
    await settingRepo.save(cacheRow);
    return result;
  }

  /** 公开免认证：返回 PNG 海报 */
  @Get('daily-greeting/card')
  async getDailyGreetingCard(
    @Query('date') dateQ = '',
    @Query('force') forceQ = '',
    @Query('theme') themeQ = 'auto',
    @Res() res: Response,
  ) {
    const todayStr = safeDateStr(dateQ);
    const theme = themeQ !== 'auto' && themeQ in THEMES ? themeQ : resolveThemeByDate(todayStr);
    const force = forceQ === 'true' || forceQ === '1';

    // 获取寄语文字（尝试缓存，无缓存则生成）
    const settingRepo = this.ds.getRepository(AppSetting);
    const cacheKey = `daily_greeting_${todayStr}`;
    let quote = '晨光微露，心向阳光。';
    const cached = await settingRepo.findOne({ where: { key: cacheKey } });
    if (cached?.value) {
      try { quote = JSON.parse(cached.value).quote ?? quote; } catch { quote = cached.value; }
    } else {
      const settings = await this.getSettings();
      const teacherName = settings['称呼'] || '崔老师';
      quote = await callDailyGreeting(settings, teacherName);
      const result = { quote, date: todayStr, cached: false, card_url: '', theme };
      let cacheRow = settingRepo.create({ key: cacheKey, value: JSON.stringify(result) });
      await settingRepo.save(cacheRow);
    }

    const teacherName = (await settingRepo.findOne({ where: { key: '称呼' } }))?.value ?? '崔老师';
    const buf = await this.cardGen.getOrGenerate({ quote, dateStr: todayStr, teacherName, theme, force });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="daily_quote_${todayStr}_${theme}.png"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(buf);
  }
}
