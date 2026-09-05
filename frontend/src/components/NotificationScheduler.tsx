import React, { useEffect, useRef } from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { listTable, getDailyGreeting } from "../api";
import { useAppStore } from "../store/app";
import { usePeriods } from "../hooks";
import { hhmmToMinutes } from "../periods";
import {
  getNotificationPermission,
  getStoredNotificationSettings,
  sendNotification,
} from "../utils/notifications";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export const NotificationScheduler: React.FC = () => {
  const 今天 = useAppStore((s) => s.今天);
  const 称呼 = useAppStore((s) => s.称呼) || "老师";
  const periods = usePeriods();
  const weekLabel = WEEKDAY_NAMES[dayjs(今天).day()];

  // 课表数据
  const scheduleQuery = useQuery({
    queryKey: ["schedule"],
    queryFn: () => listTable("schedule"),
    staleTime: 5 * 60 * 1000,
  });

  // 待办数据
  const todosQuery = useQuery({
    queryKey: ["todos"],
    queryFn: () => listTable("todos"),
    staleTime: 5 * 60 * 1000,
  });

  // 每日寄语
  const greetingQuery = useQuery({
    queryKey: ["daily-greeting", 今天],
    queryFn: () => getDailyGreeting(false, 今天),
    staleTime: 60 * 60 * 1000,
  });

  const isCheckingRef = useRef(false);

  useEffect(() => {
    const checkAndNotify = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        // 1. 检查权限
        if (getNotificationPermission() !== "granted") return;

        const settings = getStoredNotificationSettings();
        const now = dayjs();
        const todayStr = now.format("YYYY-MM-DD");
        const nowMinutes = now.hour() * 60 + now.minute();

        // 2. 课前提醒检测
        if (settings.lessonRemindEnabled && scheduleQuery.data && periods.length > 0) {
          const todayLessons = (scheduleQuery.data ?? [])
            .filter((r: any) => r.星期 === weekLabel)
            .map((r: any) => ({
              ...r,
              节次号: parseInt(String(r.节次).replace(/第|节/g, ""), 10) || 0,
            }));

          for (const l of todayLessons) {
            const p = periods.find((x: any) => x.n === l.节次号);
            if (!p) continue;

            const startMinutes = hhmmToMinutes(p.start);
            const diff = startMinutes - nowMinutes;

            // 在提前提醒阈值窗口内（如提前 1 ~ 5 分钟内，尚未开始上课）
            if (diff > 0 && diff <= settings.lessonRemindMinutes) {
              const notifKey = `notified_lesson_${todayStr}_${l.节次号}_${l.班级}`;
              if (!localStorage.getItem(notifKey)) {
                localStorage.setItem(notifKey, String(Date.now()));
                await sendNotification(`【上课提醒】还有 ${diff} 分钟上课`, {
                  body: `第 ${l.节次号} 节：${l.班级} · ${l.学科 || "课堂"}（${p.start} 开始）`,
                  tag: notifKey,
                  data: { url: "/today" },
                });
              }
            }

            // 下课后提醒（下课后 0 ~ 10 分钟内提醒一次记录教学进度）
            if (settings.lessonEndRemindEnabled) {
              const endMinutes = hhmmToMinutes(p.end);
              const diffAfter = nowMinutes - endMinutes;
              if (diffAfter >= 0 && diffAfter <= 10) {
                const notifEndKey = `notified_lesson_end_${todayStr}_${l.节次号}_${l.班级}`;
                if (!localStorage.getItem(notifEndKey)) {
                  localStorage.setItem(notifEndKey, String(Date.now()));
                  await sendNotification(`【下课啦】第 ${l.节次号} 节课已结束 🔔`, {
                    body: `${l.班级} · ${l.学科 || "课堂"} 已下课，顺手记一笔教学进度吧！`,
                    tag: notifEndKey,
                    data: {
                      url: `/today?action=record_lesson&period=${l.节次号}&klass=${encodeURIComponent(l.班级)}`,
                    },
                  });
                }
              }
            }
          }
        }

        // 3. 晨间寄语问候提醒（早晨 07:00 ~ 09:00 初次唤起时提醒一次）
        if (settings.morningGreetingEnabled && now.hour() >= 7 && now.hour() < 9) {
          const morningKey = `notified_morning_${todayStr}`;
          if (!localStorage.getItem(morningKey)) {
            const quote = greetingQuery.data?.quote || "晨光微露，心向阳光。愿今天充满灵感与温度。";
            localStorage.setItem(morningKey, String(Date.now()));
            await sendNotification(`${称呼}，早安！☀️`, {
              body: quote,
              tag: morningKey,
              data: { url: "/today" },
            });
          }
        }

        // 4. 下午未办结教学待办轻提醒（下午 16:30 ~ 18:00 离校前轻提醒一次）
        if (settings.todoRemindEnabled && now.hour() >= 16 && now.hour() < 18 && todosQuery.data) {
          const todoKey = `notified_todo_${todayStr}`;
          if (!localStorage.getItem(todoKey)) {
            const pendingTodos = (todosQuery.data ?? []).filter(
              (t: any) => t.状态 !== "已办" && t.日期 <= todayStr
            );
            if (pendingTodos.length > 0) {
              localStorage.setItem(todoKey, String(Date.now()));
              await sendNotification(`【教学待办提醒】今日尚有 ${pendingTodos.length} 项事务待办结`, {
                body: `最重要待办：「${pendingTodos[0].事项}」，点击前往待办清单查看。`,
                tag: todoKey,
                data: { url: "/todos" },
              });
            }
          }
        }
      } catch (err) {
        console.warn("[NotificationScheduler] 执行检查异常:", err);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // 挂载时检查一次
    checkAndNotify();

    // 每 45 秒在后台巡检一次
    const timerId = setInterval(checkAndNotify, 45 * 1000);

    // 页面切回前台时主动检查一次
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAndNotify();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scheduleQuery.data, todosQuery.data, greetingQuery.data, periods, weekLabel, 称呼, 今天]);

  return null;
};
