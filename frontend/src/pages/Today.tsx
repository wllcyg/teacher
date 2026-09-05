import { useMemo, useState, useEffect } from "react";
import { Card, Row, Col, Tag, Empty, Spin, Statistic, Segmented, Button, message, Modal } from "antd";
import {
  EditOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  RedoOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  PictureOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { getSummary, getExamReport, listTable, updateRow, getDailyGreeting, getGreetingCardUrl } from "../api";
import { useAppStore } from "../store/app";
import { useCurrentClass, usePeriods } from "../hooks";
import { hhmmToMinutes } from "../periods";
import { triggerHaptic } from "../utils/haptics";
import { LessonLogDrawer, type LessonContext } from "../components/LessonLogDrawer";
import { AdaptiveModal } from "../components/AdaptiveModal";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const CARD_THEMES = [
  { id: "warm", name: "晨曦暖金", dot: "#D97706" },
  { id: "bamboo", name: "竹青草木", dot: "#16A34A" },
  { id: "ink", name: "水墨素笺", dot: "#64748B" },
  { id: "indigo", name: "暮色静蓝", dot: "#38BDF8" },
];

export default function Today() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const 称呼 = useAppStore((s) => s.称呼);
  const 今天 = useAppStore((s) => s.今天);
  const { 班级, set班级, classes } = useCurrentClass();
  const periods = usePeriods();

  const handleGoQuickNote = (targetKlass?: string) => {
    const k = targetKlass || currentLesson?.班级 || nextLesson?.班级 || 班级;
    if (k) {
      set班级(k);
    }
    navigate("/quicknote");
  };

  const handleCompleteTodo = async (t: any) => {
    try {
      await updateRow("todos", t.id, { 状态: "已办" });
      message.success(`已办结：「${t.事项}」`);
      qc.invalidateQueries({ queryKey: ["todos"] });
    } catch (e: any) {
      message.error("操作失败：" + (e?.message ?? ""));
    }
  };

  const weekLabel = WEEKDAY_NAMES[dayjs(今天).day()];

  // ---- 每日寄语 ----
  const [copiedGreeting, setCopiedGreeting] = useState(false);
  const [refreshingGreeting, setRefreshingGreeting] = useState(false);

  const greetingQuery = useQuery({
    queryKey: ["daily-greeting", 今天],
    queryFn: () => getDailyGreeting(false, 今天),
    staleTime: 60 * 60 * 1000,
  });

  const handleRefreshGreeting = async () => {
    triggerHaptic("light");
    setRefreshingGreeting(true);
    try {
      const data = await getDailyGreeting(true, 今天, selectedTheme !== "auto" ? selectedTheme : undefined);
      qc.setQueryData(["daily-greeting", 今天], data);
      setCardTimestamp(Date.now());
      message.success("已为您更新今日寄语");
    } catch {
      message.error("刷新寄语失败");
    } finally {
      setRefreshingGreeting(false);
    }
  };

  const handleCopyGreeting = (text: string) => {
    triggerHaptic("light");
    navigator.clipboard.writeText(text);
    setCopiedGreeting(true);
    message.success("寄语已复制到剪贴板");
    setTimeout(() => setCopiedGreeting(false), 2000);
  };

  // ---- 寄语分享海报弹窗 ----
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [copyingCard, setCopyingCard] = useState(false);
  const [cardTimestamp, setCardTimestamp] = useState(Date.now());
  const [selectedTheme, setSelectedTheme] = useState<string>("auto");

  const activeTheme = selectedTheme === "auto" ? (greetingQuery.data?.theme || "warm") : selectedTheme;
  const cardImageUrl = getGreetingCardUrl(今天, activeTheme) + `&_t=${cardTimestamp}`;

  const handleDownloadCard = async () => {
    triggerHaptic("light");
    setDownloadingCard(true);
    try {
      const resp = await fetch(cardImageUrl);
      const blob = await resp.blob();
      const file = new File([blob], `晨间寄语_${今天}_${activeTheme}.png`, { type: "image/png" });

      // 优先调用系统级 Web Share API（iOS PWA / Safari / Android Chrome 直接唤起原生「存储图像」相册面板）
      if (typeof navigator !== "undefined" && (navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "今日晨间寄语",
        });
        return;
      }

      // 电脑端或不支持设备走常规下载
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `晨间寄语_${今天}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success("海报已保存到下载目录");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        message.info("在手机端长按图片，点击「存储图像」即可直接存入系统相册");
      }
    } finally {
      setDownloadingCard(false);
    }
  };

  const handleCopyCardImage = async () => {
    triggerHaptic("light");
    setCopyingCard(true);
    try {
      const clip = (navigator as any).clipboard;
      if (clip && clip.write && typeof (window as any).ClipboardItem !== "undefined") {
        const resp = await fetch(cardImageUrl);
        const blob = await resp.blob();
        await clip.write([
          new (window as any).ClipboardItem({ "image/png": blob }),
        ]);
        message.success("海报图片已复制到剪贴板，可直接粘贴发送");
      } else if (clip && clip.writeText) {
        await clip.writeText(greetingQuery.data?.quote || "");
        message.info("已为您复制寄语文字，在移动端长按图片即可直接保存");
      }
    } catch {
      if ((navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(greetingQuery.data?.quote || "");
      }
      message.info("已为您复制寄语文字，在移动端长按图片即可直接保存到相册");
    } finally {
      setCopyingCard(false);
    }
  };

  // ---- 数据 ----
  const summary = useQuery({
    queryKey: ["summary", 班级, 今天],
    queryFn: () => getSummary(班级, 今天),
    enabled: !!班级,
  });

  const todos = useQuery({ queryKey: ["todos"], queryFn: () => listTable("todos") });

  // 课表：全班级（教师视角），按今天星期几过滤
  const schedule = useQuery({ queryKey: ["schedule"], queryFn: () => listTable("schedule") });
  const todayLessons = useMemo(() => {
    return (schedule.data ?? [])
      .filter((r: any) => r.星期 === weekLabel)
      .map((r: any) => ({ ...r, 节次号: parseInt(String(r.节次).replace(/第|节/g, ""), 10) || 0 }))
      .sort((a: any, b: any) => a.节次号 - b.节次号);
  }, [schedule.data, weekLabel]);

  // 当前正在上的课：start <= now < end
  const nowMinutes = dayjs().hour() * 60 + dayjs().minute();
  const currentLesson = useMemo(() => {
    return (
      todayLessons.find((l: any) => {
        const p = periods.find((x) => x.n === l.节次号);
        if (!p) return false;
        return hhmmToMinutes(p.start) <= nowMinutes && nowMinutes < hhmmToMinutes(p.end);
      }) ?? null
    );
  }, [todayLessons, nowMinutes, periods]);
  const currentPeriod = currentLesson ? periods.find((p) => p.n === currentLesson.节次号) : null;

  // 下一节：当前课之后最近的一节
  const nextLesson = useMemo(() => {
    return (
      todayLessons.find((l: any) => {
        const p = periods.find((x) => x.n === l.节次号);
        if (!p) return false;
        // 如果有正在上的课，下一节必须在当前课之后开始
        if (currentLesson) {
          return hhmmToMinutes(p.start) > nowMinutes;
        }
        // 没有正在上的课，找第一个还没结束的
        return hhmmToMinutes(p.end) > nowMinutes;
      }) ?? null
    );
  }, [todayLessons, nowMinutes, periods, currentLesson]);
  const nextPeriod = nextLesson ? periods.find((p) => p.n === nextLesson.节次号) : null;

  // 当前课剩余分钟
  const remainMinutes = useMemo(() => {
    if (!currentPeriod) return 0;
    return hhmmToMinutes(currentPeriod.end) - nowMinutes;
  }, [currentPeriod, nowMinutes]);

  // 当前课进度百分比
  const progressPct = useMemo(() => {
    if (!currentPeriod) return 0;
    const total = hhmmToMinutes(currentPeriod.end) - hhmmToMinutes(currentPeriod.start);
    const elapsed = nowMinutes - hhmmToMinutes(currentPeriod.start);
    return Math.round((elapsed / total) * 100);
  }, [currentPeriod, nowMinutes]);

  // 刚上完的上一节课（已结束的课中离当前时间最近的一节）
  const lastLesson = useMemo(() => {
    const finished = todayLessons.filter((l: any) => {
      const p = periods.find((x) => x.n === l.节次号);
      return p && hhmmToMinutes(p.end) <= nowMinutes;
    });
    return finished.length > 0 ? finished[finished.length - 1] : null;
  }, [todayLessons, nowMinutes, periods]);

  // 今日课堂记录列表（用于标识哪些课程已记）
  const lessonLogs = useQuery({
    queryKey: ["lesson_log", { 日期: 今天 }],
    queryFn: () => listTable("lesson_log", { 日期: 今天 }),
  });

  const isLessonRecorded = (periodNum: number, klass: string) => {
    const pStr = `第${periodNum}节`;
    return (lessonLogs.data ?? []).some(
      (r: any) => (r.节次 === pStr || r.节次 === String(periodNum)) && r.班级 === klass
    );
  };

  // 今日已记录的课堂笔记（按节次从小到大排序）
  const todayLogs = useMemo(() => {
    return (lessonLogs.data ?? []).slice().sort((a: any, b: any) => {
      const pA = parseInt(String(a.节次).replace(/第|节/g, ""), 10) || 0;
      const pB = parseInt(String(b.节次).replace(/第|节/g, ""), 10) || 0;
      return pA - pB;
    });
  }, [lessonLogs.data]);

  // 课后课堂记录抽屉状态
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logContext, setLogContext] = useState<LessonContext | null>(null);

  const handleOpenLessonLog = (lesson: any) => {
    triggerHaptic("light");
    setLogContext({
      日期: 今天,
      班级: lesson.班级,
      节次: lesson.节次号,
      科目: lesson.科目,
    });
    setLogDrawerOpen(true);
  };

  // 监听通知点击附带的 URL query 参数自动拉起抽屉
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "record_lesson") {
      const periodParam = searchParams.get("period");
      const klassParam = searchParams.get("klass");
      const target = todayLessons.find(
        (l: any) =>
          String(l.节次号) === String(periodParam) &&
          (!klassParam || l.班级 === klassParam)
      ) || (periodParam ? { 节次号: periodParam, 班级: klassParam || 班级, 科目: "" } : null);

      if (target) {
        handleOpenLessonLog(target);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("action");
            next.delete("period");
            next.delete("klass");
            return next;
          },
          { replace: true }
        );
      }
    }
  }, [searchParams, todayLessons]);

  // 等着补测：最近一场考试的缺考名单
  const examName = summary.data?.考试?.名;
  const examReport = useQuery({
    queryKey: ["exam-report", examName, 班级],
    queryFn: () => getExamReport(examName!, 班级),
    enabled: !!examName && !!班级,
  });
  const absentees: string[] = useMemo(() => {
    const list = examReport.data?.统计?.缺考 ?? [];
    return list.map((x: any) => (typeof x === "string" ? x : x?.姓名 ?? String(x)));
  }, [examReport.data]);

  // 待办：今天的未办 + 逾期的未办
  const todayTodos = useMemo(
    () => (todos.data ?? []).filter((t: any) => t.日期 === 今天 && t.状态 !== "已办"),
    [todos.data, 今天]
  );
  const overdueTodos = useMemo(
    () => (todos.data ?? []).filter((t: any) => t.日期 < 今天 && t.状态 !== "已办"),
    [todos.data, 今天]
  );

  const s = summary.data;

  return (
    <div style={{ padding: "16px 20px 32px" }}>
      {/* 顶部问候栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0F172A" }}>
          {greeting()}，{称呼}
        </h2>
        <span style={{ color: "#94A3B8" }}>
          {dayjs(今天).format("YYYY年M月D日")} {weekLabel}
        </span>
      </div>

      {/* 🌟 今日寄语卡片 */}
      <div
        style={{
          marginTop: 12,
          padding: "12px 16px",
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(238, 242, 255, 0.85) 50%, rgba(245, 243, 255, 0.95) 100%)",
          border: "1px solid #e0e7ff",
          boxShadow: "0 1px 3px rgba(99, 102, 241, 0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(99, 102, 241, 0.25)",
            }}
          >
            ✨
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 0.5 }}>
                晨间寄语
              </span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>· 每日一句</span>
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: "#1e293b",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {greetingQuery.isLoading ? (
                <span style={{ color: "#94a3b8" }}>正在准备今日寄语...</span>
              ) : (
                `“${greetingQuery.data?.quote || "晨光微露，心向阳光，愿您和孩子们度过充实美好的一天。"}”`
              )}
            </div>
          </div>
        </div>

        {/* 右侧微操作按钮 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: "auto" }}>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined spin={refreshingGreeting || greetingQuery.isFetching} />}
            onClick={handleRefreshGreeting}
            disabled={refreshingGreeting || greetingQuery.isLoading}
            style={{ fontSize: 12, color: "#6366f1", borderRadius: 8 }}
          >
            换一句
          </Button>
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={() => handleCopyGreeting(greetingQuery.data?.quote || "晨光微露，心向阳光，愿您和孩子们度过充实美好的一天。")}
            style={{ fontSize: 12, color: copiedGreeting ? "#16a34a" : "#64748b", borderRadius: 8 }}
          >
            {copiedGreeting ? "已复制" : "复制"}
          </Button>
          <Button
            size="small"
            type="text"
            icon={<PictureOutlined />}
            onClick={() => {
              triggerHaptic("light");
              setCardModalOpen(true);
            }}
            style={{ fontSize: 12, color: "#8b5cf6", borderRadius: 8 }}
          >
            海报
          </Button>
        </div>
      </div>

      {/* 📱 晨间寄语超清海报弹窗（手机端自动下沉为抽屉，iPad/PC保持居中） */}
      <AdaptiveModal
        open={cardModalOpen}
        onCancel={() => setCardModalOpen(false)}
        footer={null}
        width={380}
        styles={{
          body: { padding: "12px 14px 14px", overflow: "hidden" },
          content: { borderRadius: 16, overflow: "hidden" },
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>
            今日晨间寄语海报
          </h3>
          <div
            style={{
              fontSize: 11,
              color: "#6366f1",
              marginTop: 3,
              fontWeight: 500,
            }}
          >
            💡 手机端长按图片可直接存入相册
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: 12,
            padding: 6,
            border: "1px solid #f1f5f9",
            marginBottom: 10,
          }}
        >
          <img
            src={cardImageUrl}
            alt="今日晨间寄语海报"
            style={{
              maxWidth: "100%",
              maxHeight: "44vh",
              aspectRatio: "3 / 4",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              display: "block",
              margin: "0 auto",
              WebkitTouchCallout: "default",
              userSelect: "auto",
            }}
          />
        </div>

        {/* 🎨 主题风格切换（位于海报下方，单行 4 等分网格） */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {CARD_THEMES.map((t) => {
            const isSelected = activeTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setSelectedTheme(t.id);
                  setCardTimestamp(Date.now());
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  padding: "5px 2px",
                  borderRadius: 14,
                  border: isSelected ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                  background: isSelected ? "#eef2ff" : "#ffffff",
                  color: isSelected ? "#4338ca" : "#64748b",
                  fontSize: 11,
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 1px 4px rgba(99,102,241,0.15)" : "none",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: t.dot,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span>{t.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<ShareAltOutlined />}
            onClick={handleDownloadCard}
            loading={downloadingCard}
            style={{
              flex: 1,
              borderRadius: 10,
              height: 38,
              fontSize: 13,
              fontWeight: 500,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            }}
          >
            分享
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyCardImage}
            loading={copyingCard}
            style={{ flex: 1, borderRadius: 10, height: 38, fontSize: 13 }}
          >
            复制图片
          </Button>
        </div>
      </AdaptiveModal>

      {/* 班级切换 */}
      {classes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Segmented
            options={classes}
            value={班级}
            onChange={(val) => set班级(val as string)}
            size="middle"
          />
        </div>
      )}

      <Spin spinning={summary.isLoading}>
        {/* 主视觉：当前课 + 下一节 */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 0 }}>
          {/* 正在上课 */}
          {currentLesson && currentPeriod ? (
            <Card
              size="small"
              style={{
                background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                border: "1px solid #C7D2FE",
                borderBottom: nextLesson ? "none" : undefined,
                borderRadius: nextLesson ? "16px 16px 0 0" : 16,
                overflow: "hidden",
              }}
              styles={{ body: { padding: "16px 18px" } }}
            >
              {/* 顶部：状态徽标与时间进度 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#4F46E5",
                      animation: "pulse 2s ease-in-out infinite",
                      boxShadow: "0 0 0 3px rgba(79,70,229,0.2)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#4F46E5", fontWeight: 600, whiteSpace: "nowrap" }}>正在上课</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#4338CA",
                      background: "rgba(255, 255, 255, 0.85)",
                      border: "1px solid #C7D2FE",
                      borderRadius: 20,
                      padding: "2px 10px",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    还剩 {remainMinutes} 分钟
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366F1", fontSize: 12, whiteSpace: "nowrap" }}>
                  <ClockCircleOutlined /> {currentPeriod.time}
                  <span style={{ color: "#818CF8", fontWeight: 600 }}>{progressPct}%</span>
                </div>
              </div>

              {/* 课程主标题：整行通栏展示，彻底消除折行尴尬 */}
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1E1B4B", margin: "6px 0 10px", letterSpacing: "0.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                第{currentLesson.节次号}节 {currentLesson.班级}·{currentLesson.科目}
              </div>

              {/* 进度条 */}
              <div style={{ height: 4, borderRadius: 2, background: "rgba(99,102,241,0.15)", overflow: "hidden", marginBottom: 14 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    borderRadius: 2,
                    background: "linear-gradient(90deg, #6366F1, #818CF8)",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>

              {/* 底部按钮栏：双按钮等宽平铺，大拇指极佳热区 */}
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  icon={<BookOutlined />}
                  size="middle"
                  onClick={() => handleOpenLessonLog(currentLesson)}
                  style={{
                    flex: 1,
                    height: 38,
                    borderColor: isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? "#10B981" : "#818CF8",
                    color: isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? "#059669" : "#4F46E5",
                    background: isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? "#ECFDF5" : "#FFFFFF",
                    borderRadius: 8,
                    fontWeight: 500,
                  }}
                >
                  {isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? "已记课堂" : "记课堂"}
                </Button>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  size="middle"
                  onClick={() => handleGoQuickNote(currentLesson.班级)}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 8,
                    background: "#4F46E5",
                    fontWeight: 500,
                  }}
                >
                  记一笔
                </Button>
              </div>
            </Card>
          ) : null}

          {/* 下一节 / 无课状态 */}
          <Card
            size="small"
            style={{
              borderRadius: currentLesson ? "0 0 16px 16px" : 16,
              borderTop: currentLesson ? "1px dashed #E2E8F0" : undefined,
              border: "1px solid #E2E8F0",
              background: currentLesson ? "#F8FAFC" : "#FFFFFF",
            }}
            styles={{ body: { padding: currentLesson ? "12px 18px" : "16px 18px" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                {nextLesson && nextPeriod ? (
                  <>
                    <div style={{ color: "#94A3B8", fontSize: 12, marginBottom: 2, whiteSpace: "nowrap" }}>
                      {currentLesson ? "接下来" : "下一节"}
                    </div>
                    <div style={{ fontSize: currentLesson ? 15 : 18, fontWeight: currentLesson ? 600 : 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                      第{nextLesson.节次号}节 {nextLesson.班级}·{nextLesson.科目}
                    </div>
                    <div style={{ color: "#94A3B8", marginTop: 2, display: "flex", alignItems: "center", gap: 6, fontSize: 12, whiteSpace: "nowrap" }}>
                      <ClockCircleOutlined /> {nextPeriod.time}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                    {todayLessons.length === 0 ? "今天没有排课" : currentLesson ? "这是今天最后一节课了" : "今天的课上完了"}
                  </div>
                )}
              </div>

              {!currentLesson && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {lastLesson && (
                    <Button
                      icon={<BookOutlined />}
                      size="middle"
                      onClick={() => handleOpenLessonLog(lastLesson)}
                      style={{
                        height: 36,
                        borderColor: isLessonRecorded(lastLesson.节次号, lastLesson.班级) ? "#10B981" : "#CBD5E1",
                        color: isLessonRecorded(lastLesson.节次号, lastLesson.班级) ? "#059669" : "#334155",
                        background: isLessonRecorded(lastLesson.节次号, lastLesson.班级) ? "#ECFDF5" : "#FFFFFF",
                        borderRadius: 8,
                        fontWeight: 500,
                      }}
                    >
                      {isLessonRecorded(lastLesson.节次号, lastLesson.班级)
                        ? `已记第${lastLesson.节次号}节`
                        : `补记第${lastLesson.节次号}节`}
                    </Button>
                  )}
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    size="middle"
                    onClick={() => handleGoQuickNote(nextLesson?.班级 || 班级)}
                    style={{ height: 36, borderRadius: 8, background: "#4F46E5", fontWeight: 500 }}
                  >
                    记一笔
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 今日课堂笔记清单卡片 */}
        <Card
          size="small"
          style={{
            marginTop: 16,
            borderRadius: 16,
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
          styles={{ body: { padding: "16px 18px" } }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: todayLogs.length > 0 ? 12 : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#EEF2FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4F46E5",
                  fontSize: 14,
                }}
              >
                <BookOutlined />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>今日课堂笔记</span>
              <Tag
                color={todayLogs.length > 0 ? "blue" : "default"}
                style={{ borderRadius: 10, margin: 0, fontWeight: 500 }}
              >
                {todayLogs.length} 条已记
              </Tag>
            </div>
            <Button
              type="link"
              size="small"
              onClick={() => navigate("/lesson-logs")}
              style={{ padding: 0, fontSize: 13, color: "#4F46E5", fontWeight: 500 }}
            >
              全部记录 ➔
            </Button>
          </div>

          {todayLogs.length === 0 ? (
            <div style={{ padding: "10px 0 4px", color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
              今日暂无课堂笔记，上课或下课后点击上方「记课堂」即可随时记录教学进度与作业。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayLogs.map((log: any) => {
                const periodNum = parseInt(String(log.节次).replace(/第|节/g, ""), 10) || log.节次;
                const matchingLesson = todayLessons.find(
                  (l: any) => String(l.节次号) === String(periodNum) && l.班级 === log.班级
                );
                return (
                  <div
                    key={log.id}
                    onClick={() =>
                      handleOpenLessonLog({
                        节次号: periodNum,
                        班级: log.班级,
                        科目: matchingLesson?.科目 || "",
                      })
                    }
                    style={{
                      background: "#F8FAFC",
                      borderRadius: 12,
                      padding: "12px 14px",
                      border: "1px solid #F1F5F9",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Tag
                        style={{
                          borderRadius: 6,
                          fontWeight: 600,
                          margin: 0,
                          background: "#EEF2FF",
                          borderColor: "#C7D2FE",
                          color: "#4F46E5",
                        }}
                      >
                        第{periodNum}节 · {log.班级}
                        {matchingLesson?.科目 ? ` · ${matchingLesson.科目}` : ""}
                      </Tag>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        style={{ color: "#6366F1", fontSize: 12, height: 24, padding: "0 6px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenLessonLog({
                            节次号: periodNum,
                            班级: log.班级,
                            科目: matchingLesson?.科目 || "",
                          });
                        }}
                      >
                        编辑
                      </Button>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: "#334155",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {log.内容}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 今日节奏 + 紧要的事 + 等着补测 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={8}>
            <Card size="small">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    border: "3px solid #1677ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#1677ff",
                    flexShrink: 0,
                  }}
                >
                  {todayLessons.length}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>今日节奏</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{todayTodos.length}</div>
                  <div style={{ fontSize: 12, color: "#8c8c8c" }}>待办</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: overdueTodos.length ? "#cf1322" : undefined }}>
                    {overdueTodos.length}
                  </div>
                  <div style={{ fontSize: 12, color: "#8c8c8c" }}>逾期</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: absentees.length ? "#fa8c16" : undefined }}>
                    {absentees.length}
                  </div>
                  <div style={{ fontSize: 12, color: "#8c8c8c" }}>补测</div>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card
              size="small"
              title={<span><AlertOutlined style={{ color: "#cf1322" }} /> 紧要的事</span>}
              extra={<a onClick={() => navigate("/todos")}>全部待办</a>}
            >
              {overdueTodos.length === 0 && todayTodos.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有紧要的事，太棒了！" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {overdueTodos.slice(0, 4).map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => handleCompleteTodo(t)}
                      title="点击直接标记为已完成"
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: "5px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: "#fff5f5",
                        border: "1px solid #fed7d7",
                        transition: "all 0.15s",
                      }}
                    >
                      <CheckCircleOutlined style={{ color: "#f56565", fontSize: 15 }} />
                      <Tag color="red" style={{ margin: 0 }}>逾期</Tag>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                        {t.事项}
                      </span>
                    </div>
                  ))}
                  {todayTodos.slice(0, 4).map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => handleCompleteTodo(t)}
                      title="点击直接标记为已完成"
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: "5px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: "#fffaf0",
                        border: "1px solid #feebc8",
                        transition: "all 0.15s",
                      }}
                    >
                      <CheckCircleOutlined style={{ color: "#ed8936", fontSize: 15 }} />
                      <Tag color="orange" style={{ margin: 0 }}>今天</Tag>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                        {t.事项}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card size="small" title={<span><RedoOutlined style={{ color: "#fa8c16" }} /> 等着补测{examName ? `·${examName}` : ""}</span>}>
              {absentees.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有缺考" />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {absentees.slice(0, 12).map((n: string) => (
                    <Tag key={n} color="orange">{n}</Tag>
                  ))}
                  {absentees.length > 12 && <Tag>+{absentees.length - 12}</Tag>}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 概览指标 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="最近考试均分" value={s?.考试?.均分 ?? "-"} suffix={s?.考试 ? "分" : ""} />
              <div style={{ color: "#999", fontSize: 12 }}>{s?.考试?.名 ?? "暂无考试"}</div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="及格率" value={s?.考试?.及格率 ?? "-"} suffix={s?.考试 ? "%" : ""} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="本周表现"
                value={(s?.表现?.本周加分 ?? 0) - (s?.表现?.本周减分 ?? 0)}
                suffix={`（加${s?.表现?.本周加分 ?? 0} / 减${s?.表现?.本周减分 ?? 0}）`}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="考勤异常" value={s?.考勤?.异常 ?? "-"} suffix={s?.考勤 ? "人次" : ""} />
            </Card>
          </Col>
        </Row>

        {/* 今日课表条 + 项目完成率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="今日课表" extra={<a onClick={() => navigate("/schedule")}>查看全部</a>}>
              {todayLessons.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="今天没有排课" />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {todayLessons.map((l: any) => {
                    const p = periods.find((x) => x.n === l.节次号);
                    const isNext = nextLesson && l.id === nextLesson.id;
                    return (
                      <Tag
                        key={l.id}
                        color={isNext ? "blue" : "default"}
                        style={{ fontSize: 13, padding: "3px 10px" }}
                      >
                        第{l.节次号}节 {l.班级}·{l.科目}
                        {p ? ` ${p.time}` : ""}
                      </Tag>
                    );
                  })}
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="项目完成率">
              {(s?.完成率 ?? []).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无打钩/过关类项目" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(s?.完成率 ?? []).map((c: any) => {
                    const rate = Math.round(c.完成率 ?? 0);
                    return (
                      <div key={c.项目}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                          <span>{c.项目}</span>
                          <span style={{ color: rate >= 100 ? "#52c41a" : "#1677ff", fontWeight: 600 }}>{rate}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(rate, 100)}%`,
                              borderRadius: 3,
                              background: rate >= 100 ? "#52c41a" : "#1677ff",
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* 课后课堂记录抽屉（移动端底部滑出） */}
      <LessonLogDrawer
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        lessonContext={logContext}
      />
    </div>
  );
}
