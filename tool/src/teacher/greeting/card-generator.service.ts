/**
 * 每日晨间寄语海报生成器（@napi-rs/canvas 实现，与 Python card_generator.py 功能对应）
 *
 * 尺寸：1080 × 1440 px PNG
 * 4 套主题，按星期自动轮换
 * 本地文件缓存，最多 200 个文件（LRU 淘汰）
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

// ---------- 主题配置 ----------
export const THEMES: Record<string, Record<string, any>> = {
  warm: {
    id: 'warm', name: '晨曦暖金',
    bgTop: '#FFFDF9', bgBottom: '#FAF4E6',
    frame1: '#E5DDD0', frame2: '#F0E9DF',
    text: '#1C1917', sub: '#78716C', mark: '#A8A29E',
    divider: '#D6D3D1',
    sealBg: '#B91C1C', sealOutline: '#991B1B', sealInner: '#FCA5A5', sealText: '#FEF2F2',
    author: '#57534E',
  },
  bamboo: {
    id: 'bamboo', name: '竹青草木',
    bgTop: '#F8FCF9', bgBottom: '#EBF7EF',
    frame1: '#CFE5D8', frame2: '#DFEFE5',
    text: '#143823', sub: '#3D6B51', mark: '#8EB59B',
    divider: '#A3CFBB',
    sealBg: '#B91C1C', sealOutline: '#991B1B', sealInner: '#FCA5A5', sealText: '#FEF2F2',
    author: '#2D5A40',
  },
  ink: {
    id: 'ink', name: '水墨素笺',
    bgTop: '#FEFDFB', bgBottom: '#F4F3EF',
    frame1: '#DDD8D0', frame2: '#EAE6DF',
    text: '#1E1B18', sub: '#5C5751', mark: '#A8A29A',
    divider: '#C8C2BA',
    sealBg: '#991B1B', sealOutline: '#7F1D1D', sealInner: '#FCA5A5', sealText: '#FEF2F2',
    author: '#47423C',
  },
  indigo: {
    id: 'indigo', name: '暮色静蓝',
    bgTop: '#1E293B', bgBottom: '#0F172A',
    frame1: '#334155', frame2: '#1E293B',
    text: '#F8FAFC', sub: '#94A3B8', mark: '#475569',
    divider: '#475569',
    sealBg: '#C2410C', sealOutline: '#9A3412', sealInner: '#FDBA74', sealText: '#FFF7ED',
    author: '#CBD5E1',
  },
};

/** 按星期自动轮换主题 */
export function resolveThemeByDate(dateStr = ''): string {
  try {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const dow = d.getDay(); // 0=Sun … 6=Sat
    return [/* Sun */
      'indigo', /* Mon */ 'warm', /* Tue */ 'bamboo',
      /* Wed */ 'ink', /* Thu */ 'warm', /* Fri */ 'bamboo', /* Sat */ 'indigo',
    ][dow] ?? 'warm';
  } catch {
    return 'warm';
  }
}

/** 智能断句（对应 Python _smart_wrap_text） */
function smartWrapText(text: string, maxChars = 15): string[] {
  const delimiters = new Set(['，', '。', '；', '！', '？', '、', ',']);
  const parts: string[] = [];
  let cur = '';
  for (const ch of text.trim()) {
    cur += ch;
    if (delimiters.has(ch)) { parts.push(cur); cur = ''; }
  }
  if (cur) parts.push(cur);

  const lines: string[] = [];
  let buf = '';
  for (const p of parts) {
    if (buf.length + p.length <= maxChars) { buf += p; }
    else { if (buf) lines.push(buf); buf = p; }
  }
  if (buf) lines.push(buf);

  const result: string[] = [];
  for (let l of lines) {
    while (l.length > maxChars) { result.push(l.slice(0, maxChars)); l = l.slice(maxChars); }
    if (l) result.push(l);
  }
  return result.length ? result : [text];
}

const MAX_CACHE_FILES = 200;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

@Injectable()
export class CardGeneratorService {
  private cacheDir: string;

  constructor() {
    const dataDir = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.resolve(process.cwd(), 'data');
    this.cacheDir = path.join(dataDir, 'cards');
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  private enforceCacheLimit() {
    try {
      const files = fs
        .readdirSync(this.cacheDir)
        .filter((f) => f.startsWith('daily_card_'))
        .map((f) => ({ f, mtime: fs.statSync(path.join(this.cacheDir, f)).mtimeMs }));
      if (files.length <= MAX_CACHE_FILES) return;
      files.sort((a, b) => a.mtime - b.mtime);
      for (const { f } of files.slice(0, files.length - MAX_CACHE_FILES)) {
        fs.unlinkSync(path.join(this.cacheDir, f));
      }
    } catch {}
  }

  private cachePath(dateStr: string, theme: string): string {
    const digest = crypto
      .createHash('md5')
      .update(`${dateStr}|${theme}`)
      .digest('hex');
    return path.join(this.cacheDir, `daily_card_${digest}.png`);
  }

  async getOrGenerate(opts: {
    quote: string;
    dateStr: string;
    teacherName?: string;
    theme?: string;
    force?: boolean;
  }): Promise<Buffer> {
    const { quote, dateStr, teacherName = '崔老师', force = false } = opts;
    const theme = opts.theme && opts.theme !== 'auto'
      ? (opts.theme in THEMES ? opts.theme : 'warm')
      : resolveThemeByDate(dateStr);

    const target = this.cachePath(dateStr, theme);
    if (!force && fs.existsSync(target) && fs.statSync(target).size > 1000) {
      return fs.readFileSync(target);
    }

    const buf = await this.renderCard({ quote, dateStr, teacherName, theme });
    fs.writeFileSync(target, buf);
    this.enforceCacheLimit();
    return buf;
  }

  async renderCard(opts: {
    quote: string;
    dateStr: string;
    teacherName: string;
    theme: string;
  }): Promise<Buffer> {
    // 动态 import，避免在没有 canvas 环境时启动失败
    const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
    const W = 1080, H = 1440;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const t = THEMES[opts.theme] ?? THEMES.warm;

    // 1. 背景渐变
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, t.bgTop);
    grad.addColorStop(1, t.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2. 双层边框
    const margin = 56;
    ctx.strokeStyle = t.frame1;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, margin, W - 2 * margin, H - 2 * margin);
    ctx.strokeStyle = t.frame2;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin + 8, margin + 8, W - 2 * (margin + 8), H - 2 * (margin + 8));

    // 3. 日期
    const d = opts.dateStr ? new Date(opts.dateStr + 'T00:00:00') : new Date();
    const dow = isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
    const dateDisplay = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}  ${WEEKDAYS[dow]}`;
    ctx.fillStyle = t.sub;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dateDisplay, W / 2, 166);
    ctx.strokeStyle = t.divider;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 36, 197);
    ctx.lineTo(W / 2 + 36, 197);
    ctx.stroke();

    // 4. 正文
    const cleanQuote = opts.quote.trim().replace(/^["""]|["""]$/g, '');
    let bodySize: number, lineH: number, maxC: number;
    if (cleanQuote.length <= 24) { bodySize = 52; lineH = 92; maxC = 13; }
    else if (cleanQuote.length <= 40) { bodySize = 46; lineH = 84; maxC = 15; }
    else { bodySize = 40; lineH = 76; maxC = 18; }

    const lines = smartWrapText(cleanQuote, maxC);
    const totalTextH = lines.length * lineH;
    const startY = 690 - totalTextH / 2;

    // 左艺术引号
    ctx.fillStyle = t.mark;
    ctx.font = `90px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('\u201C', W / 2 - 250, startY - 65 + 72);

    ctx.fillStyle = t.text;
    ctx.font = `${bodySize}px sans-serif`;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, startY + i * lineH + bodySize * 0.75);
    }

    ctx.fillStyle = t.mark;
    ctx.font = `90px sans-serif`;
    ctx.fillText('\u201D', W / 2 + 250, startY + totalTextH + 15 + 72);

    // 5. 署名与印章
    const sigY = H - margin - 90;
    const sealSize = 54;
    const sealX = W - margin - 50 - sealSize;
    const sealY = sigY - sealSize / 2 - 2;

    let sealChar = '师';
    for (const ch of opts.teacherName) {
      if (!['老', '师', '教', '授', '导', '校'].includes(ch)) { sealChar = ch; break; }
    }

    // 印章背景（圆角矩形）
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(sealX + r, sealY);
    ctx.lineTo(sealX + sealSize - r, sealY);
    ctx.arcTo(sealX + sealSize, sealY, sealX + sealSize, sealY + r, r);
    ctx.lineTo(sealX + sealSize, sealY + sealSize - r);
    ctx.arcTo(sealX + sealSize, sealY + sealSize, sealX + sealSize - r, sealY + sealSize, r);
    ctx.lineTo(sealX + r, sealY + sealSize);
    ctx.arcTo(sealX, sealY + sealSize, sealX, sealY + sealSize - r, r);
    ctx.lineTo(sealX, sealY + r);
    ctx.arcTo(sealX, sealY, sealX + r, sealY, r);
    ctx.closePath();
    ctx.fillStyle = t.sealBg;
    ctx.fill();
    ctx.strokeStyle = t.sealOutline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 印章文字
    ctx.fillStyle = t.sealText;
    ctx.font = `bold 28px sans-serif`;
    ctx.fillText(sealChar, sealX + sealSize / 2, sealY + sealSize / 2 + 10);

    // 署名
    ctx.fillStyle = t.author;
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${opts.teacherName} · 晨间寄语`, sealX - 16, sigY + 11);

    return canvas.toBuffer('image/png');
  }
}
