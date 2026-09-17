import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTable, listAllTable, getClasses } from "./api";
import { useAppStore } from "./store/app";
import { DEFAULT_PERIODS, type PeriodItem } from "./periods";
import type { Row, ClassItem } from "./types";

export const LEFT_MARK = "（系统）已离班";

export function usePeriods(): PeriodItem[] {
  const periods = useAppStore((s) => s.periods);
  return periods && periods.length > 0 ? periods : DEFAULT_PERIODS;
}

export function useStudents() {
  return useQuery({ queryKey: ["students-all"], queryFn: () => listAllTable("students") });
}

export function useClassItems(): ClassItem[] {
  const { data } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
    staleTime: 10 * 60 * 1000,
  });
  return data ?? [];
}

export function useClasses(): string[] {
  const items = useClassItems();
  return useMemo(() => items.map((c) => c.name), [items]);
}

/** 评价/考试项目字典强缓存（10分钟超长保鲜，避免多页面反复打接口） */
export function useItems(): Row[] {
  const { data } = useQuery({
    queryKey: ["items-all"],
    queryFn: () => listAllTable("items"),
    staleTime: 10 * 60 * 1000,
  });
  return data ?? [];
}

/** 当前班在册学生（不含已离班），按学号数值序。
 * 兼容 klass 为 class_id（如 CLS0001）或 class_name（如 八3班）
 */
export function activeRoster(allStudents: Row[] | undefined, klass: string): Row[] {
  if (!allStudents || !klass) return [];
  return allStudents
    .filter((s) => {
      const matchClass = (s.class_id && s.class_id === klass) || (s.class_name || s.班级) === klass;
      return matchClass && !(s.tags || s.标签 || "").startsWith(LEFT_MARK);
    })
    .sort((a, b) => (parseInt(a.student_no || a.学号, 10) || 0) - (parseInt(b.student_no || b.学号, 10) || 0));
}

/** 当前班级：同时提供 class_id 与 class_name / 班级，双向响应式同步 */
export function useCurrentClass(): {
  班级: string;
  class_name: string;
  class_id: string;
  classId: string;
  currentClass?: ClassItem;
  set班级: (nameOrId: string) => void;
  setClass: (nameOrId: string) => void;
  classes: string[]; // 纯中文名称列表，无缝兼容所有原生 Select 下拉框
  classItems: ClassItem[]; // 完整班级对象列表
} {
  const classItems = useClassItems();
  const classes = useClasses();
  const 班级 = useAppStore((s) => s.班级);
  const classId = useAppStore((s) => s.class_id);
  const set班级Store = useAppStore((s) => s.set班级);
  const setClassIdStore = useAppStore((s) => s.setClassId);

  const currentClass = useMemo(() => {
    if (!classItems || classItems.length === 0) return undefined;
    if (classId) {
      const found = classItems.find((c) => c.class_id === classId);
      if (found) return found;
    }
    if (班级) {
      const found = classItems.find((c) => c.name === 班级);
      if (found) return found;
    }
    return classItems[0];
  }, [classItems, classId, 班级]);

  const effectiveName = currentClass?.name || "";
  const effectiveId = currentClass?.class_id || "";

  useEffect(() => {
    if (effectiveName && effectiveName !== 班级) set班级Store(effectiveName);
    if (effectiveId && effectiveId !== classId) setClassIdStore(effectiveId);
  }, [effectiveName, effectiveId, 班级, classId, set班级Store, setClassIdStore]);

  const setClass = (nameOrId: string) => {
    const found = classItems.find((c) => c.class_id === nameOrId || c.name === nameOrId);
    if (found) {
      set班级Store(found.name);
      setClassIdStore(found.class_id);
    } else {
      set班级Store(nameOrId);
    }
  };

  return {
    班级: effectiveName,
    class_name: effectiveName,
    class_id: effectiveId,
    classId: effectiveId,
    currentClass,
    set班级: setClass,
    setClass,
    classes,
    classItems,
  };
}

export function useTable<T extends Row = Row>(table: Parameters<typeof listTable>[0], filters?: Record<string, string>) {
  return useQuery({
    queryKey: [table, filters],
    queryFn: () => listTable(table, filters),
  });
}

/**
 * 统一判定是否为手机或 iPad / 平板设备：
 * 1. 触屏能力检测（iPadOS Safari、各类触屏平板、Chrome 开发者工具模拟触屏）；
 * 2. 苹果 iPad 专属特征：iPadOS 上 Safari 伪装成 Macintosh，但 navigator.maxTouchPoints > 1；
 * 3. 移动端 UA 匹配（iPhone, iPad, Android, Tablet）；
 * 4. 屏幕物理尺寸判定（窗口宽度 <= 1024px 为典型 iPad/手机范围）。
 * 只有在无触屏能力且屏幕宽度大屏幕桌面端（如 1200px+）时，才判定为 PC。
 */
export function useIsMobileOrTablet(): boolean {
  const getIsMobileOrTablet = () => {
    if (typeof window === "undefined") return false;
    const isTouch = Boolean(
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
    );
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIPad = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|Tablet|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isSmallOrMediumScreen = window.innerWidth <= 1024;
    return isIPad || isMobileUA || (isTouch && window.innerWidth <= 1180) || isSmallOrMediumScreen;
  };

  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(getIsMobileOrTablet);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // resize 防抖 100ms，避免拖动窗口时整棵组件树在移动端/桌面端布局间频繁切换重渲染
    const handleResize = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setIsMobileOrTablet(getIsMobileOrTablet());
      }, 100);
    };

    // orientationchange 触发瞬间部分移动浏览器 innerWidth 尚未更新为旋转后的值，
    // 延迟 100ms 再读取尺寸，避免拿到旋转前的过期数据
    const handleOrientationChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setIsMobileOrTablet(getIsMobileOrTablet());
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  return isMobileOrTablet;
}
