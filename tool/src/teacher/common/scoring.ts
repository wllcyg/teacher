/**
 * 计分 / 汇总 / 报表纯函数（与 Python scoring.py 完全对应）
 *
 * 全链路支持英文属性与中文向前兼容。所有函数无副作用，仅接收/返回普通对象。
 */

export const DEFAULT_REPORT_THRESHOLDS = { 优: 85, 及: 60, 低: 40 };
export const DISABLED_MARK = '已停用';
export const LEFT_MARK = '（系统）已离班';

// 报表分数段（满分占比）
const SCORE_BANDS: [string, number, number][] = [
  ['90%–100%', 0.9, 1.0000000001],
  ['80%–<90%', 0.8, 0.9],
  ['70%–<80%', 0.7, 0.8],
  ['60%–<70%', 0.6, 0.7],
  ['<60%', 0.0, 0.6],
];

// ---------- 基础工具 ----------

export function textOf(v: any): string {
  if (v == null) return '';
  return String(v).trim();
}

/** 安全从对象中提取多个候选 key 中的首个有效值 */
export function fld(d: any, ...keys: string[]): any {
  if (!d || typeof d !== 'object') return '';
  for (const k of keys) {
    if (k in d && d[k] !== null && d[k] !== undefined && d[k] !== '') {
      return d[k];
    }
  }
  return '';
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 把字符串/数值安全转成 number；非法返回 null */
export function toNum(v: any): number | null {
  if (typeof v === 'boolean') return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = textOf(v);
  if (s && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return parseFloat(s);
  return null;
}

// ---------- 计分制判定 ----------

export function scoreKind(item: any): string {
  const raw = typeof item === 'object' ? fld(item, 'scoring_type', '计分制') : item;
  const s = textOf(raw);
  if (s.includes('分数')) return '分数';
  if (s.includes('等第')) return '等第';
  if (s.includes('过关')) return '过关';
  if (s.includes('加减')) return '加减分';
  return '打钩';
}

// ---------- 满分 / 成绩解析 ----------

export function examFullScore(item: any): number {
  const raw = typeof item === 'object' ? fld(item, 'full_score', '满分') : item;
  const full = toNum(raw);
  return full !== null && full > 0 ? full : 100.0;
}

export function parseExamScore(raw: any, itemOrFull: any): number | null {
  if (typeof raw === 'boolean' || raw == null) return null;
  const score = toNum(raw);
  const full = examFullScore(itemOrFull);
  if (score === null || score < 0 || score > full) return null;
  return score;
}

export function passLine(item: any): number {
  return round1(examFullScore(item) * 0.6);
}

// ---------- 最新有效分 ----------

export function latestValidScores(
  item: any,
  records: any[],
  roster: any[],
): Record<string, any> {
  const name = textOf(
    typeof item === 'object' ? fld(item, 'item_name', '项目名') : item,
  );
  const names = (roster || [])
    .map((s) => textOf(fld(s, 'name', '姓名')))
    .filter(Boolean);
  const full = examFullScore(item);

  const latestRows: Record<string, { row: any; date: string }> = {};
  for (const r of records || []) {
    const who = textOf(fld(r, 'student_name', '学生'));
    const d = textOf(fld(r, 'date', '日期'));
    const itemN = textOf(fld(r, 'item_name', '项目'));
    if (itemN !== name || !names.includes(who)) continue;
    if (!latestRows[who] || d >= latestRows[who].date) {
      latestRows[who] = { row: r, date: d };
    }
  }

  const byStudent: Record<string, any> = {};
  for (const who of names) {
    const picked = latestRows[who];
    if (!picked) continue;
    const score = parseExamScore(fld(picked.row, 'score', '结果'), full);
    if (score === null) continue;
    byStudent[who] = {
      student_name: who, 学生: who,
      score, 分: score,
      date: picked.date, 日期: picked.date,
    };
  }

  const scores = names.filter((w) => w in byStudent).map((w) => byStudent[w]);
  let latest = '';
  for (const row of scores) {
    if (row.date > latest) latest = row.date;
  }
  return {
    名册: names, roster: names,
    成绩: scores, scores,
    按学生: byStudent, by_student: byStudent,
    最新日期: latest, latest_date: latest,
    满分: full, full_score: full,
  };
}

// ---------- 单项目汇总 ----------

export function aggregateItem(
  item: any,
  records: any[],
  roster: any[],
): Record<string, any> {
  const name = textOf(
    typeof item === 'object' ? fld(item, 'item_name', '项目名') : item,
  );
  const kind = scoreKind(item);
  const names = (roster || [])
    .map((s) => textOf(fld(s, 'name', '姓名')))
    .filter(Boolean);
  const rows = (records || []).filter(
    (r) =>
      textOf(fld(r, 'item_name', '项目')) === name &&
      (!names.length || names.includes(textOf(fld(r, 'student_name', '学生')))),
  );

  if (kind === '分数') {
    const line = passLine(item);
    const snapshot = latestValidScores(item, records, roster);
    const nums = snapshot.scores.map((r: any) => r.score as number);
    const low = snapshot.scores
      .filter((r: any) => (r.score as number) < line)
      .map((r: any) => r.student_name as string);
    const s = nums.reduce((a: number, b: number) => a + b, 0);
    return {
      kind: '分数', item_name: name, 项目: name,
      total_count: nums.length, 人数: nums.length,
      average: nums.length ? round1(s / nums.length) : 0, 平均: nums.length ? round1(s / nums.length) : 0,
      max: nums.length ? Math.max(...nums) : 0, 最高: nums.length ? Math.max(...nums) : 0,
      min: nums.length ? Math.min(...nums) : 0, 最低: nums.length ? Math.min(...nums) : 0,
      pass_line: line, 及格线: line,
      pass_rate: nums.length ? round1((nums.length - low.length) / nums.length * 100) : 0,
      及格率: nums.length ? round1((nums.length - low.length) / nums.length * 100) : 0,
      not_passed: low, 未及格: low,
    };
  }

  if (kind === '等第') {
    const dist: Record<string, number> = {};
    for (const r of rows) {
      const g = textOf(fld(r, 'score', '结果')) || '未评';
      dist[g] = (dist[g] || 0) + 1;
    }
    return {
      kind: '等第', item_name: name, 项目: name,
      total_count: rows.length, 人数: rows.length,
      distribution: dist, 分布: dist,
    };
  }

  // 打钩 / 过关
  const done: Record<string, boolean> = {};
  let retest = 0;
  for (const r of rows) {
    const who = textOf(fld(r, 'student_name', '学生'));
    const res = textOf(fld(r, 'score', '结果'));
    const st = textOf(fld(r, 'status', '状态'));
    if (kind === '过关') {
      if (res === '过关') done[who] = true;
    } else {
      done[who] = true;
    }
    if (st === '待补测') retest++;
  }
  const base = names.length ? names : Object.keys(done);
  const missing = base.filter((n) => !(n in done));
  return {
    kind: '完成', item_name: name, 项目: name,
    should_count: base.length, 应到人数: base.length,
    done_count: base.length - missing.length, 完成人数: base.length - missing.length,
    done_rate: base.length ? round1((base.length - missing.length) / base.length * 100) : 0,
    完成率: base.length ? round1((base.length - missing.length) / base.length * 100) : 0,
    missing, 未完成: missing,
    pending_retest: retest, 待补测: retest,
  };
}

// ---------- 周标签工具 ----------

export function weekKey(dateStr: any): string {
  try {
    const s = textOf(dateStr).slice(0, 10);
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    // weekday 0=Sun … 6=Sat；周一为起点
    const dow = d.getDay(); // 0=Sun
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - daysFromMon);
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function weekLabel(weekStart: any): string {
  try {
    const a = new Date(textOf(weekStart).slice(0, 10) + 'T00:00:00');
    if (isNaN(a.getTime())) return '';
    const b = new Date(a);
    b.setDate(b.getDate() + 4);
    return `${a.getMonth() + 1}.${a.getDate()}–${b.getMonth() + 1}.${b.getDate()}`;
  } catch {
    return '';
  }
}

// ---------- 表现加减分 ----------

export function weeklyBehaviorOverview(
  rows: any[],
  roster: any[],
  targetWeek?: string,
): Record<string, any> {
  const today = new Date().toISOString().slice(0, 10);
  const target = targetWeek || weekKey(today);
  const names = (roster || [])
    .map((s) => textOf(fld(s, 'name', '姓名')))
    .filter(Boolean);

  const byStudent: Record<string, Record<string, number>> = {};
  for (const w of names) {
    byStudent[w] = { net: 0, add: 0, sub: 0, 净分: 0, 加分: 0, 扣分: 0 };
  }

  for (const r of rows || []) {
    const who = textOf(fld(r, 'student_name', '学生'));
    if (!(who in byStudent)) continue;
    const wk = weekKey(fld(r, 'date', '日期'));
    if (wk !== target) continue;
    let v = toNum(fld(r, 'score', '分值')) ?? 0;
    v = Math.trunc(v);
    if (v > 0) {
      byStudent[who].add += v;
      byStudent[who].加分 += v;
    } else if (v < 0) {
      byStudent[who].sub += -v;
      byStudent[who].扣分 += -v;
    }
    byStudent[who].net += v;
    byStudent[who].净分 += v;
  }

  type BehaviorEntry = { name: string; 姓名: string; net: number; add: number; sub: number; 净分: number; 加分: number; 扣分: number };
  const arr: BehaviorEntry[] = names.map((w) => ({ name: w, 姓名: w, ...byStudent[w] } as BehaviorEntry));
  arr.sort((a, b) => b.net - a.net || b.add - a.add);
  return { week: target, 周: target, by_student: arr, 按学生: arr };
}

// ---------- 考试分段 / 名次 / 报表 ----------

export function scoreBands(
  scores: number[],
  full = 100,
): Record<string, any>[] {
  full = full || 100;
  return SCORE_BANDS.map(([label, lo, hi]) => {
    const loScore = round1(full * lo);
    const hiScore = round1(full * hi);
    const c = scores.filter(
      (s) => (s >= loScore && s < hiScore) || (hi > 1.0 && s === full),
    ).length;
    return {
      label, count: c, 人数: c,
      rate: scores.length ? round1((c / scores.length) * 100) : 0,
    };
  });
}

export function rankScores(pairs: { name?: string; 姓名?: string; score?: number; 分数?: number }[]): Record<string, number> {
  const sorted = [...pairs].sort((a, b) => {
    const sa = a.score ?? a.分数 ?? 0;
    const sb = b.score ?? b.分数 ?? 0;
    return sb - sa;
  });
  const out: Record<string, number> = {};
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((p, idx) => {
    const sc = p.score ?? p.分数 ?? 0;
    const rank = sc !== lastScore ? idx + 1 : lastRank;
    const n = textOf(p.name ?? p.姓名 ?? '');
    out[n] = rank;
    lastScore = sc;
    lastRank = rank;
  });
  return out;
}

export function reportStats(
  item: any,
  records: any[],
  roster: any[],
  thresholds?: Record<string, number>,
  sharedSnapshot?: any,
): Record<string, any> {
  const thr = { ...DEFAULT_REPORT_THRESHOLDS, ...(thresholds || {}) };
  const full = examFullScore(item);

  const pct = (key: string) => {
    const v = toNum(thr[key]);
    return v !== null ? v : DEFAULT_REPORT_THRESHOLDS[key as keyof typeof DEFAULT_REPORT_THRESHOLDS];
  };

  const line = (value: number) => round1((full * value) / 100);
  const youLine = line(pct('优'));
  const jiLine = line(pct('及'));
  const diLine = line(pct('低'));

  const snapshot = sharedSnapshot || latestValidScores(item, records, roster);
  const nums = snapshot.scores.map((r: any) => r.score as number);
  const recorded: Record<string, boolean> = {};
  for (const r of snapshot.scores) recorded[r.student_name] = true;
  const miss = snapshot.roster.filter((w: string) => !recorded[w]);

  const s = nums.reduce((a: number, b: number) => a + b, 0);
  const youN = nums.filter((n: number) => n >= youLine).length;
  const jiN = nums.filter((n: number) => n >= jiLine).length;
  const diN = nums.filter((n: number) => n < diLine).length;
  const rate = (n: number) => (nums.length ? round1((n / nums.length) * 100) : 0);

  return {
    should_count: snapshot.roster.length, 应录: snapshot.roster.length,
    actual_count: nums.length, 实录: nums.length,
    absent: miss, 缺考: miss,
    average: nums.length ? round1(s / nums.length) : 0, 平均: nums.length ? round1(s / nums.length) : 0,
    max: nums.length ? Math.max(...nums) : 0, 最高: nums.length ? Math.max(...nums) : 0,
    min: nums.length ? Math.min(...nums) : 0, 最低: nums.length ? Math.min(...nums) : 0,
    full_score: full, 满分: full,
    you_line: youLine, 优秀线分: youLine,
    ji_line: jiLine, 及格线分: jiLine,
    di_line: diLine, 低分线分: diLine,
    you_count: youN, 优秀数: youN,
    ji_count: jiN, 及格数: jiN,
    di_count: diN, 低分数: diN,
    you_rate: rate(youN), 优秀率: rate(youN),
    ji_rate: rate(jiN), 及格率: rate(jiN),
    di_rate: rate(diN), 低分率: rate(diN),
    bands: scoreBands(nums, full), 分段: scoreBands(nums, full),
    latest_date: snapshot.latest_date, 最新日期: snapshot.latest_date,
    snapshot, 快照: snapshot,
  };
}

export function prevExam(
  items: any[],
  records: any[],
  roster: any[],
  curName: string,
): string {
  const latest: Record<string, string> = {};
  for (const item of items || []) {
    if (
      scoreKind(item) !== '分数' ||
      textOf(fld(item, 'item_type', '类型')) === '表现'
    )
      continue;
    const snap = latestValidScores(item, records, roster);
    const itemN = textOf(fld(item, 'item_name', '项目名'));
    if (snap.latest_date) latest[itemN] = snap.latest_date;
  }
  const curDate = latest[textOf(curName)] || '9999-99-99';
  let best = '';
  let bestDate = '';
  for (const item of items || []) {
    const n = textOf(fld(item, 'item_name', '项目名'));
    if (n === textOf(curName) || !(n in latest)) continue;
    if (latest[n] < curDate && latest[n] > bestDate) {
      best = n;
      bestDate = latest[n];
    }
  }
  return best;
}

export function deltaScores(
  currentSnapshot: any,
  previousSnapshot: any,
): Record<string, number> {
  const cur = currentSnapshot?.by_student || {};
  const prev = previousSnapshot?.by_student || {};
  const out: Record<string, number> = {};
  for (const who of Object.keys(cur)) {
    if (who in prev) out[who] = cur[who].score - prev[who].score;
  }
  return out;
}

export function deltaOverview(deltas: Record<string, number>): Record<string, any> {
  let up = 0, down = 0, flat = 0;
  let maxUp: any = null, maxDown: any = null;
  for (const [who, v] of Object.entries(deltas || {})) {
    if (v > 0) {
      up++;
      if (!maxUp || v > maxUp.delta) maxUp = { student_name: who, 学生: who, delta: v, Δ: v };
    } else if (v < 0) {
      down++;
      if (!maxDown || v < maxDown.delta) maxDown = { student_name: who, 学生: who, delta: v, Δ: v };
    } else {
      flat++;
    }
  }
  return {
    up, 进步: up, down, 退步: down, flat, 持平: flat,
    max_up: maxUp, 最大进步: maxUp,
    max_down: maxDown, 最大退步: maxDown,
  };
}

export function itemDisabled(item: any): boolean {
  return textOf(fld(item, 'category', '类别')).startsWith(DISABLED_MARK);
}

export function buildMatrix(
  roster: any[],
  records: any[],
  items: any[],
  opts: Record<string, any> = {},
): Record<string, any> {
  const names = (roster || [])
    .map((s) => textOf(fld(s, 'name', '姓名')))
    .filter(Boolean);

  // 筛选出参与矩阵的项目
  let itemList = (items || []).filter(
    (it) => !itemDisabled(it) && scoreKind(it) === '分数',
  );
  if (opts.item_name) {
    itemList = itemList.filter(
      (it) => textOf(fld(it, 'item_name', '项目名')) === opts.item_name,
    );
  }

  const colItems = itemList.map((it) => textOf(fld(it, 'item_name', '项目名')));

  // 每人每项目取最新成绩
  const matrix: Record<string, Record<string, number | null>> = {};
  for (const name of names) {
    matrix[name] = {};
    for (const col of colItems) matrix[name][col] = null;
  }

  for (const it of itemList) {
    const snap = latestValidScores(it, records, roster);
    const iname = textOf(fld(it, 'item_name', '项目名'));
    for (const row of snap.scores) {
      const who = row.student_name as string;
      if (who in matrix) matrix[who][iname] = row.score;
    }
  }

  const rows = names.map((name) => ({
    name, 姓名: name,
    scores: matrix[name],
  }));

  return { items: colItems, roster: names, rows, matrix };
}

export function contactBook(
  roster: any[],
  parents: any[],
  keyword = '',
): any[] {
  const kw = textOf(keyword);
  const byStudent: Record<string, any[]> = {};
  for (const r of parents || []) {
    const sname = textOf(fld(r, 'student_name', '学生'));
    if (!byStudent[sname]) byStudent[sname] = [];
    byStudent[sname].push(r);
  }
  const out = (roster || []).map((s) => {
    const sname = textOf(fld(s, 'name', '姓名'));
    return {
      name: sname, 姓名: sname,
      student_id: fld(s, 'student_id'),
      parents: byStudent[sname] || [],
      家长: byStudent[sname] || [],
    };
  });
  if (!kw) return out;
  return out.filter(
    (row) =>
      kw.includes(row.name) ||
      row.name.includes(kw) ||
      row.parents.some(
        (p: any) =>
          textOf(fld(p, 'relationship', '称谓')).includes(kw) ||
          textOf(fld(p, 'phone', '电话')).includes(kw),
      ),
  );
}

export function latestRosterExam(
  items: any[],
  records: any[],
  roster: any[],
  thresholds?: Record<string, number>,
): any | null {
  let latest: any = null;
  let latestDate = '';
  for (const item of items || []) {
    if (
      scoreKind(item) !== '分数' ||
      textOf(fld(item, 'item_type', '类型')) === '表现'
    )
      continue;
    const stats = reportStats(item, records, roster, thresholds);
    if (
      !stats.actual_count ||
      !stats.latest_date ||
      stats.latest_date <= latestDate
    )
      continue;
    latestDate = stats.latest_date;
    latest = {
      item,
      name: textOf(fld(item, 'item_name', '项目名')),
      stats,
    };
  }
  return latest;
}

export function summaryOverview(o: Record<string, any>): Record<string, any> {
  const items = o.items || [];
  const academic = o.academic || [];
  const roster = o.roster || [];
  const behavior = o.behavior || [];
  const attendance = o.attendance;
  const thresholds = o.thresholds || o['阈值'] || DEFAULT_REPORT_THRESHOLDS;
  const today_str = textOf(fld(o, 'today', '今天'));

  const latestExam = latestRosterExam(items, academic, roster, thresholds);
  const exam = latestExam
    ? {
        name: latestExam.name, 名: latestExam.name,
        average: latestExam.stats.average, 均分: latestExam.stats.average,
        pass_rate: latestExam.stats.ji_rate, 及格率: latestExam.stats.ji_rate,
      }
    : null;

  const complete: any[] = [];
  for (const it of items) {
    if (itemDisabled(it)) continue;
    const k = scoreKind(it);
    if (k !== '打钩' && k !== '过关') continue;
    if (textOf(fld(it, 'item_type', '类型')) === '表现') continue;
    const a = aggregateItem(it, academic, roster);
    if (!a.should_count) continue;
    const iname = textOf(fld(it, 'item_name', '项目名'));
    complete.push({
      item_name: iname, 项目: iname,
      done_rate: a.done_rate, 完成率: a.done_rate, rate: a.done_rate,
    });
  }

  const wk = weekKey(today_str);
  const rosterNames = new Set((roster || []).map((s: any) => textOf(fld(s, 'name', '姓名'))).filter(Boolean));
  let add = 0, sub = 0;
  for (const r of behavior) {
    if (weekKey(fld(r, 'date', '日期')) !== wk) continue;
    if (!rosterNames.has(textOf(fld(r, 'student_name', '学生')))) continue;
    const v = toNum(fld(r, 'score', '分值')) ?? 0;
    if (v > 0) add += v;
    else if (v < 0) sub += -v;
  }

  let abnormal = 0;
  if (attendance != null) {
    for (const r of attendance) {
      const st = textOf(fld(r, 'status', '状态'));
      if (!['', '正常', '全勤', '系统核对'].includes(st)) abnormal++;
    }
  }

  return {
    exam, 考试: exam,
    completion: complete, 完成率: complete,
    behavior: { add, sub, 本周加分: add, 本周减分: sub },
    attendance: attendance != null ? { abnormal, 异常: abnormal } : null,
  };
}

export function parentImportPlan(
  text: string,
  roster: any[],
  existing: any[],
): Record<string, any> {
  const names = (roster || []).map((s: any) => textOf(fld(s, 'name', '姓名')));
  const hasPhone = new Set(
    (existing || []).map((r) => `${textOf(fld(r, 'student_name', '学生'))}|${textOf(fld(r, 'phone', '电话'))}`),
  );
  const existStu = new Set((existing || []).map((r) => textOf(fld(r, 'student_name', '学生'))));
  const matched: any[] = [], outside: any[] = [], bad: any[] = [], dup: any[] = [], got: Record<string, boolean> = {};
  const seen = new Set<string>();

  for (const line of (text || '').split('\n')) {
    const l = line.trim();
    if (!l) continue;
    const ts = l.split(/[\s,，、]+/).filter(Boolean);
    const name = ts[0] || '';
    if (['学生', '姓名', '名字', '电话', '称谓'].includes(name)) continue;
    const phone = ts.length >= 2 && /^\d{5,}$/.test(ts[ts.length - 1]) ? ts[ts.length - 1] : '';
    if (!phone) { bad.push(l); continue; }
    const relation = ts.slice(1, -1).join('');
    const row = { student_name: name, 学生: name, relationship: relation, 称谓: relation, phone, 电话: phone };
    if (!names.includes(name)) { outside.push(row); continue; }
    const key = `${name}|${phone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hasPhone.has(key)) { dup.push(row); continue; }
    matched.push(row);
    got[name] = true;
  }
  const missing = names.filter((n) => !got[n] && !existStu.has(n));
  return { 对上: matched, 名册外: outside, 坏行: bad, 已有: dup, 没登记: missing };
}
