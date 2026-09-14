/**
 * 智慧校园节次作息时间表核心工具库
 * 负责全系统节次定义、当前课时实时推算及时间换算
 */

import { callCloudFunction } from './db';

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];

export const DEFAULT_PERIODS = [
  // 上午时段 (1-4节)
  { n: 1, label: '第 1 节', time: '08:20-09:00', start: '08:20', end: '09:00', section: 'morning' },
  { n: 2, label: '第 2 节', time: '09:10-09:50', start: '09:10', end: '09:50', section: 'morning' },
  { n: 3, label: '第 3 节', time: '10:10-10:50', start: '10:10', end: '10:50', section: 'morning' },
  { n: 4, label: '第 4 节', time: '11:00-11:40', start: '11:00', end: '11:40', section: 'morning' },
  // 下午时段 (5-8节)
  { n: 5, label: '第 5 节', time: '14:00-14:40', start: '14:00', end: '14:40', section: 'afternoon' },
  { n: 6, label: '第 6 节', time: '14:50-15:30', start: '14:50', end: '15:30', section: 'afternoon' },
  { n: 7, label: '第 7 节', time: '15:40-16:20', start: '15:40', end: '16:20', section: 'afternoon' },
  { n: 8, label: '第 8 节', time: '16:30-17:10', start: '16:30', end: '17:10', section: 'afternoon' },
  // 晚自习时段 (9-11节)
  { n: 9, label: '第 9 节', time: '18:30-19:10', start: '18:30', end: '19:10', section: 'evening' },
  { n: 10, label: '第 10 节', time: '19:20-20:00', start: '19:20', end: '20:00', section: 'evening' },
  { n: 11, label: '第 11 节', time: '20:10-20:50', start: '20:10', end: '20:50', section: 'evening' },
];

const PERIODS_STORAGE_KEY = 'SCHOOL_PERIODS_CONFIG';

/**
 * 将 "HH:mm" 格式时间字符串转换为从 00:00 起始的分钟数
 * @param {string} v "08:20"
 * @returns {number} 500
 */
export function hhmmToMinutes(v) {
  if (!v || typeof v !== 'string') return 0;
  const parts = v.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * 计算两个 "HH:mm" 时间之间的分钟差
 */
export function getDurationMinutes(start, end) {
  const diff = hhmmToMinutes(end) - hhmmToMinutes(start);
  return diff > 0 ? diff : 0;
}

/**
 * 将从 00:00 起始的分钟数转换为 "HH:mm" 格式时间字符串
 * @param {number} m 500
 * @returns {string} "08:20"
 */
export function minutesToHhmm(m) {
  const safeM = Math.max(0, Math.min(1439, Math.floor(m)));
  const h = Math.floor(safeM / 60);
  const min = safeM % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * 将节次列表按开始时间升序排列，并重新规范化排序序号与时长
 * @param {Array} list 
 * @returns {Array}
 */
export function normalizePeriods(list) {
  if (!Array.isArray(list)) return [];
  const sorted = [...list].sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start));
  return sorted.map((item, idx) => {
    const n = idx + 1;
    const start = item.start_time || item.start || '08:00';
    const end = item.end_time || item.end || '08:40';
    return {
      id: item.id || `period_${Date.now()}_${idx}`,
      n,
      label: `第 ${n} 节`,
      start,
      end,
      time: `${start}-${end}`,
      duration: getDurationMinutes(start, end)
    };
  });
}

/**
 * 获取当前持久化存储的作息时间表（优先本地缓存，兜底默认）
 * @returns {Array} 节次配置列表
 */
export function getPeriodsConfig() {
  try {
    const cached = wx.getStorageSync(PERIODS_STORAGE_KEY);
    if (Array.isArray(cached) && cached.length > 0) {
      return normalizePeriods(cached);
    }
  } catch (err) {
    console.warn('[periods] 读取作息缓存失败:', err);
  }
  return normalizePeriods(DEFAULT_PERIODS);
}

/**
 * 保存作息时间配置到本地持久缓存
 * @param {Array} periods 
 */
export function savePeriodsConfig(periods) {
  try {
    wx.setStorageSync(PERIODS_STORAGE_KEY, periods);
  } catch (err) {
    console.error('[periods] 写入作息缓存失败:', err);
  }
}

/**
 * 恢复为官方默认作息时间（本地）
 */
export function resetPeriodsConfig() {
  try {
    wx.removeStorageSync(PERIODS_STORAGE_KEY);
  } catch (err) {
    console.error('[periods] 清除作息缓存失败:', err);
  }
  return normalizePeriods(DEFAULT_PERIODS);
}

/**
 * 从云端数据库拉取当前教师的作息配置（若云端尚无则会自动初始化播种11节课）
 * 成功后同步写入本地缓存
 */
export async function fetchPeriodsFromCloud() {
  try {
    const res = await callCloudFunction('teacher-service', {
      action: 'getMyPeriods'
    });
    if (res.result && res.result.code === 0 && Array.isArray(res.result.data)) {
      const normalized = normalizePeriods(res.result.data);
      savePeriodsConfig(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('[periods] 从云端拉取作息失败，回退本地缓存:', err);
  }
  return getPeriodsConfig();
}

/**
 * 将最新作息时间表同步保存至云端数据库
 */
export async function savePeriodsToCloud(periods) {
  const normalized = normalizePeriods(periods);
  // 先更新本地缓存保障即时响应
  savePeriodsConfig(normalized);

  try {
    const res = await callCloudFunction('teacher-service', {
      action: 'saveMyPeriods',
      periods: normalized
    });
    if (res.result && res.result.code === 0 && Array.isArray(res.result.data)) {
      const synced = normalizePeriods(res.result.data);
      savePeriodsConfig(synced);
      return synced;
    }
  } catch (err) {
    console.error('[periods] 同步保存作息至云端失败:', err);
    throw err;
  }
  return normalized;
}

/**
 * 在云端重置为标准默认作息并同步本地
 */
export async function resetPeriodsToCloud() {
  try {
    const res = await callCloudFunction('teacher-service', {
      action: 'resetMyPeriods'
    });
    if (res.result && res.result.code === 0 && Array.isArray(res.result.data)) {
      const synced = normalizePeriods(res.result.data);
      savePeriodsConfig(synced);
      return synced;
    }
  } catch (err) {
    console.error('[periods] 云端重置作息失败，执行本地重置:', err);
  }
  return resetPeriodsConfig();
}

/**
 * 实时推算当前时间处于第几节课，若不在课内则返回 null
 * @param {Array} periods 可选，默认使用当前生效配置
 * @param {string} nowHhmm 可选，默认使用系统当前时分 "14:25"
 * @returns {object|null}
 */
export function getCurrentPeriod(periods = null, nowHhmm = null) {
  const periodList = periods || getPeriodsConfig();
  let nowMin = 0;

  if (nowHhmm) {
    nowMin = hhmmToMinutes(nowHhmm);
  } else {
    const now = new Date();
    nowMin = now.getHours() * 60 + now.getMinutes();
  }

  for (const p of periodList) {
    const s = hhmmToMinutes(p.start);
    const e = hhmmToMinutes(p.end);
    if (nowMin >= s && nowMin <= e) {
      return p;
    }
  }
  return null;
}
