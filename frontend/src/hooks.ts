import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTable } from "./api";
import { useAppStore } from "./store/app";
import { DEFAULT_PERIODS, type PeriodItem } from "./periods";
import type { Row } from "./types";

export const LEFT_MARK = "（系统）已离班";

export function usePeriods(): PeriodItem[] {
  const periods = useAppStore((s) => s.periods);
  return periods && periods.length > 0 ? periods : DEFAULT_PERIODS;
}

export function useStudents() {
  return useQuery({ queryKey: ["students"], queryFn: () => listTable("students") });
}

export function useClasses(): string[] {
  const { data } = useStudents();
  if (!data) return [];
  const set = new Set<string>();
  for (const s of data) if (s.班级) set.add(s.班级);
  return Array.from(set);
}

/** 当前班在册学生（不含已离班），按学号数值序 */
export function activeRoster(allStudents: Row[] | undefined, klass: string): Row[] {
  if (!allStudents) return [];
  return allStudents
    .filter((s) => s.班级 === klass && !s.标签.startsWith(LEFT_MARK))
    .sort((a, b) => (parseInt(a.学号, 10) || 0) - (parseInt(b.学号, 10) || 0));
}

/** 当前班级：优先取 store 里选的，否则取第一个班；并把首个班回填进 store */
export function useCurrentClass(): { 班级: string; set班级: (v: string) => void; classes: string[] } {
  const classes = useClasses();
  const 班级 = useAppStore((s) => s.班级);
  const set班级 = useAppStore((s) => s.set班级);
  const effective = 班级 && classes.includes(班级) ? 班级 : classes[0] || "";
  useEffect(() => {
    if (effective && effective !== 班级) set班级(effective);
  }, [effective, 班级, set班级]);
  return { 班级: effective, set班级, classes };
}

export function useTable<T extends Row = Row>(table: Parameters<typeof listTable>[0], filters?: Record<string, string>) {
  return useQuery({
    queryKey: [table, filters],
    queryFn: () => listTable(table, filters),
  });
}
