import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PERIODS, type PeriodItem } from "../periods";

interface AppState {
  班级: string;
  今天: string; // YYYY-MM-DD
  称呼: string; // 首页问候称呼，例如「康康老师」
  学期: string;
  periods: PeriodItem[];
  set班级: (v: string) => void;
  set今天: (v: string) => void;
  set称呼: (v: string) => void;
  set学期: (v: string) => void;
  setPeriods: (v: PeriodItem[]) => void;
  resetPeriods: () => void;
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      班级: "",
      今天: todayStr(),
      称呼: "崔老师",
      学期: "",
      periods: DEFAULT_PERIODS,
      set班级: (v) => set({ 班级: v }),
      set今天: (v) => set({ 今天: v }),
      set称呼: (v) => set({ 称呼: v }),
      set学期: (v) => set({ 学期: v }),
      setPeriods: (v) => set({ periods: v }),
      resetPeriods: () => set({ periods: DEFAULT_PERIODS }),
    }),
    {
      name: "tw-app-store",
      partialize: (s) => ({ 称呼: s.称呼, 学期: s.学期, periods: s.periods }),
    }
  )
);
