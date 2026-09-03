// 全局共享：节次时间表与星期定义（Today 首页与课表页共用）
export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五"];

export interface PeriodItem {
  n: number;
  time: string;
  start: string;
  end: string;
}

export const DEFAULT_PERIODS: PeriodItem[] = [
  { n: 1, time: "08:20-09:00", start: "08:20", end: "09:00" },
  { n: 2, time: "09:10-09:50", start: "09:10", end: "09:50" },
  { n: 3, time: "10:10-10:50", start: "10:10", end: "10:50" },
  { n: 4, time: "11:00-11:40", start: "11:00", end: "11:40" },
  { n: 5, time: "14:00-14:40", start: "14:00", end: "14:40" },
  { n: 6, time: "14:50-15:30", start: "14:50", end: "15:30" },
  { n: 7, time: "15:40-16:20", start: "15:40", end: "16:20" },
  { n: 8, time: "16:30-17:10", start: "16:30", end: "17:10" },
  { n: 9, time: "18:30-19:10", start: "18:30", end: "19:10" },
  { n: 10, time: "19:20-20:00", start: "19:20", end: "20:00" },
  { n: 11, time: "20:10-20:50", start: "20:10", end: "20:50" },
];

export const PERIODS = DEFAULT_PERIODS;

/** HH:mm → 分钟数，便于比较 */
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}
