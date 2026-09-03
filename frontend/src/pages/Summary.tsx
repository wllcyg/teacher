import { useMemo, useState } from "react";
import {
  Card,
  Col,
  Row,
  Statistic,
  Progress,
  Table,
  Empty,
  Spin,
  Segmented,
  Tag,
  Modal,
  Space,
  Button,
  List,
} from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  TrophyOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { listTable } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import { useAppStore } from "../store/app";
import type { Row as DataRow } from "../types";
import StudentDetailModal from "../components/StudentDetailModal";

dayjs.extend(isoWeek);

export default function Summary() {
  const { 班级, set班级, classes } = useCurrentClass();
  const 今天 = useAppStore((s) => s.今天) || dayjs().format("YYYY-MM-DD");

  // 顶部一级视图切换
  const [activeTab, setActiveTab] = useState<"overview" | "roster" | "behavior">("overview");

  // 待补测名单下钻弹窗
  const [retestModalOpen, setRetestModalOpen] = useState(false);

  // 考勤下钻弹窗
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  // 学生个人学情档案弹窗
  const [detailStudent, setDetailStudent] = useState<DataRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openStudentDetail = (studentName: string) => {
    const stu =
      roster.find((s) => s.姓名 === studentName) ||
      (students ?? []).find((s) => s.姓名 === studentName);
    if (stu) {
      setDetailStudent(stu);
      setDetailOpen(true);
    }
  };

  // ---- 数据查询 ----
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => listTable("students"),
  });
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["items"],
    queryFn: () => listTable("items"),
  });
  const { data: allAcademics, isLoading: loadingAcademics } = useQuery({
    queryKey: ["academic", 班级],
    queryFn: () => listTable("academic", { 班级 }),
    enabled: !!班级,
  });
  const { data: allBehavior, isLoading: loadingBehavior } = useQuery({
    queryKey: ["behavior", 班级],
    queryFn: () => listTable("behavior", { 班级 }),
    enabled: !!班级,
  });
  const { data: allAttendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["attendance", 班级],
    queryFn: () => listTable("attendance", { 班级 }),
    enabled: !!班级,
  });

  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);
  const rosterNames = useMemo(() => new Set(roster.map((s) => s.姓名)), [roster]);

  // ---------- 指标 1：待补测名单计算 ----------
  const retestList = useMemo(() => {
    const list: { 学生: string; 学号: string; 项目: string; 日期: string; 状态: string }[] = [];
    (allAcademics ?? []).forEach((r) => {
      if (rosterNames.has(r.学生) && (r.状态 === "未过" || r.结果 === "未过")) {
        const stu = roster.find((s) => s.姓名 === r.学生);
        list.push({
          学生: r.学生,
          学号: stu?.学号 ?? "",
          项目: r.项目,
          日期: r.日期,
          状态: "未过关",
        });
      }
    });
    return list;
  }, [allAcademics, roster, rosterNames]);

  // ---------- 指标 2：最新考试 ----------
  const scoreItems = useMemo(
    () => (items ?? []).filter((it) => it.计分制 && it.计分制.includes("分数")),
    [items]
  );

  const examExams = useMemo(() => {
    const map = new Map<string, { 项目: string; 日期: string; 满分: number; 分数列表: number[] }>();
    (allAcademics ?? []).forEach((r) => {
      const it = scoreItems.find((x) => x.项目名 === r.项目);
      if (!it || !r.日期) return;
      const key = `${r.项目}@@${r.日期}`;
      if (!map.has(key)) {
        map.set(key, {
          项目: r.项目,
          日期: r.日期,
          满分: parseFloat(it.满分) || 100,
          分数列表: [],
        });
      }
      const score = parseFloat(r.结果);
      if (!isNaN(score)) {
        map.get(key)!.分数列表.push(score);
      }
    });

    const list = Array.from(map.values())
      .map((e) => {
        const total = e.分数列表.reduce((acc, v) => acc + v, 0);
        const avg = e.分数列表.length > 0 ? Math.round((total / e.分数列表.length) * 10) / 10 : 0;
        const passCount = e.分数列表.filter((v) => v >= e.满分 * 0.6).length;
        const passRate = e.分数列表.length > 0 ? Math.round((passCount / e.分数列表.length) * 100) : 0;
        return {
          ...e,
          平均: avg,
          及格率: passRate,
          实录: e.分数列表.length,
        };
      })
      .sort((a, b) => a.日期.localeCompare(b.日期));

    return list;
  }, [allAcademics, scoreItems]);

  const latestExam = useMemo(() => {
    return examExams.length > 0 ? examExams[examExams.length - 1] : null;
  }, [examExams]);

  // ---------- 指标 3：本周表现 ----------
  const weekStart = dayjs(今天).startOf("isoWeek").format("YYYY-MM-DD");
  const weekEnd = dayjs(今天).endOf("isoWeek").format("YYYY-MM-DD");

  const thisWeekBehavior = useMemo(() => {
    let add = 0;
    let sub = 0;
    (allBehavior ?? []).forEach((r) => {
      if (r.日期 >= weekStart && r.日期 <= weekEnd && rosterNames.has(r.学生)) {
        const v = parseFloat(r.分值) || 0;
        if (v > 0) add += v;
        else if (v < 0) sub += Math.abs(v);
      }
    });
    return {
      加分: add,
      减分: sub,
      净值: add - sub,
    };
  }, [allBehavior, weekStart, weekEnd, rosterNames]);

  // ---------- 指标 4：本周考勤 ----------
  const thisWeekAttendance = useMemo(() => {
    const list: DataRow[] = [];
    (allAttendance ?? []).forEach((r) => {
      if (
        r.日期 >= weekStart &&
        r.日期 <= weekEnd &&
        rosterNames.has(r.学生) &&
        r.状态 &&
        !["正常", "全勤", "系统核对"].includes(r.状态)
      ) {
        list.push(r);
      }
    });
    return list;
  }, [allAttendance, weekStart, weekEnd, rosterNames]);

  // ---------- 日常项目近 10 天每日走势 ----------
  const dailyDates = useMemo(() => {
    const arr: string[] = [];
    for (let i = 9; i >= 0; i--) {
      arr.push(dayjs(今天).subtract(i, "day").format("YYYY-MM-DD"));
    }
    return arr;
  }, [今天]);

  const dailyItems = useMemo(() => {
    const targetItems = (items ?? []).filter(
      (it) => it.类型 === "学业" && !it.计分制?.includes("分数")
    );

    return targetItems.map((it) => {
      const records = (allAcademics ?? []).filter((r) => r.项目 === it.项目名);
      const totalRecordedStudents = new Set(
        records
          .filter((r) => r.状态 === "完成" || r.结果 === "过关" || r.结果 === "√")
          .map((r) => r.学生)
      ).size;
      const overallRate =
        roster.length > 0 ? Math.round((totalRecordedStudents / roster.length) * 100) : 0;

      // 统计近 10 天每天的完成率
      const dailyTrend = dailyDates.map((d) => {
        const dayRecords = records.filter(
          (r) => r.日期 === d && (r.状态 === "完成" || r.结果 === "过关" || r.结果 === "√")
        );
        const dayStudentCount = new Set(dayRecords.map((r) => r.学生)).size;
        const rate =
          roster.length > 0 ? Math.round((dayStudentCount / roster.length) * 100) : null;
        return {
          date: d,
          shortDate: dayjs(d).format("MM/DD"),
          count: dayStudentCount,
          rate: dayRecords.length > 0 ? rate : null,
        };
      });

      return {
        item: it,
        overallRate,
        dailyTrend,
        isPassKind: it.计分制?.includes("过关"),
        isCheckKind: it.计分制?.includes("打钩"),
      };
    });
  }, [items, allAcademics, roster.length, dailyDates]);

  // ---------- 近 6 周表现走势 ----------
  const sixWeeksTrend = useMemo(() => {
    const weeks: { label: string; 加分: number; 减分: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const wStart = dayjs(今天).subtract(i, "week").startOf("isoWeek").format("YYYY-MM-DD");
      const wEnd = dayjs(今天).subtract(i, "week").endOf("isoWeek").format("YYYY-MM-DD");
      let add = 0;
      let sub = 0;
      (allBehavior ?? []).forEach((r) => {
        if (r.日期 >= wStart && r.日期 <= wEnd && rosterNames.has(r.学生)) {
          const v = parseFloat(r.分值) || 0;
          if (v > 0) add += v;
          else if (v < 0) sub += Math.abs(v);
        }
      });
      weeks.push({
        label: `${dayjs(wStart).format("MM/DD")}`,
        加分: add,
        减分: sub,
      });
    }
    const hasData = weeks.some((w) => w.加分 > 0 || w.减分 > 0);
    return { weeks, hasData };
  }, [今天, allBehavior, rosterNames]);

  // ---------- 花名册总览表格数据 ----------
  const rosterTableData = useMemo(() => {
    return roster.map((s) => {
      // 表现积分
      let score = 0;
      (allBehavior ?? []).forEach((r) => {
        if (r.学生 === s.姓名) {
          score += parseFloat(r.分值) || 0;
        }
      });

      // 待补测数
      const retests = retestList.filter((r) => r.学生 === s.姓名);

      // 学业日常完成数
      const completedAcademic = (allAcademics ?? []).filter(
        (r) => r.学生 === s.姓名 && (r.状态 === "完成" || r.结果 === "过关" || r.结果 === "√")
      ).length;

      return {
        key: s.姓名,
        学号: s.学号,
        姓名: s.姓名,
        小组: s.小组 || "-",
        表现分: score,
        待补测数: retests.length,
        待补测项目: retests.map((r) => r.项目).join("、"),
        学业完成次数: completedAcademic,
      };
    });
  }, [roster, allBehavior, retestList, allAcademics]);

  // ---------- 表现排行榜数据 ----------
  const behaviorLeaderboard = useMemo(() => {
    const map = new Map<string, { 加: number; 减: number; 净: number }>();
    roster.forEach((s) => map.set(s.姓名, { 加: 0, 减: 0, 净: 0 }));

    (allBehavior ?? []).forEach((r) => {
      if (map.has(r.学生)) {
        const v = parseFloat(r.分值) || 0;
        const cur = map.get(r.学生)!;
        if (v > 0) cur.加 += v;
        else if (v < 0) cur.减 += Math.abs(v);
        cur.净 = cur.加 - cur.减;
      }
    });

    const list = Array.from(map.entries()).map(([name, stat]) => ({
      name,
      ...stat,
    }));

    list.sort((a, b) => b.净 - a.净);
    return list;
  }, [roster, allBehavior]);

  return (
    <div className="page" style={{ maxWidth: 1160, margin: "0 auto" }}>
      {/* 顶部标题与说明 */}
      <div style={{ marginBottom: 14 }}>
        <h2 className="page-title" style={{ marginBottom: 2 }}>
          汇总
        </h2>
        <div className="page-sub" style={{ color: "#64748b", fontSize: 13 }}>
          记过的账这里自动算好，数字都能点开看名单。
        </div>
      </div>

      <Spin
        spinning={
          loadingStudents ||
          loadingItems ||
          loadingAcademics ||
          loadingBehavior ||
          loadingAttendance
        }
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          {/* 顶部控制栏：三级视图切换 + 班级切换 */}
          <Card size="small">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <Segmented
                options={[
                  { label: "概览", value: "overview", icon: <DashboardOutlined /> },
                  { label: "花名册", value: "roster", icon: <TeamOutlined /> },
                  { label: "表现", value: "behavior", icon: <TrophyOutlined /> },
                ]}
                value={activeTab}
                onChange={(val) => setActiveTab(val as any)}
                size="middle"
              />

              {classes.length > 0 && (
                <Segmented
                  options={classes}
                  value={班级}
                  onChange={(val) => set班级(val as string)}
                  size="middle"
                />
              )}
            </div>
          </Card>

          {/* ==================== 视图 1：概览主看板 ==================== */}
          {activeTab === "overview" && (
            <>
              {/* 卡片 1：班级状态 */}
              <Card
                size="small"
                title={
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>班级状态</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
                      先看今天最需要处理的数字
                    </span>
                  </div>
                }
              >
                <Row gutter={[16, 16]}>
                  {/* 最新考试 */}
                  <Col xs={12} sm={6}>
                    <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>最新考试</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
                        {latestExam ? `${latestExam.平均}分` : "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                        {latestExam ? latestExam.项目 : "还没有有效考试"}
                      </div>
                    </div>
                  </Col>

                  {/* 等着补测 */}
                  <Col xs={12} sm={6}>
                    <div
                      onClick={() => setRetestModalOpen(true)}
                      style={{
                        padding: "8px 12px",
                        background: retestList.length > 0 ? "#fffbe6" : "#f8fafc",
                        border: retestList.length > 0 ? "1px solid #ffe58f" : "1px solid transparent",
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                        等着补测（点开看）
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: retestList.length > 0 ? "#d46b08" : "#0f172a",
                        }}
                      >
                        {retestList.length} 人
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                        {retestList.length > 0 ? "点击查看缺账名单" : "目前没有欠账"}
                      </div>
                    </div>
                  </Col>

                  {/* 本周表现 */}
                  <Col xs={12} sm={6}>
                    <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>本周表现</div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color:
                            thisWeekBehavior.净值 > 0
                              ? "#1677ff"
                              : thisWeekBehavior.净值 < 0
                              ? "#cf1322"
                              : "#0f172a",
                        }}
                      >
                        {thisWeekBehavior.净值 > 0 ? `+${thisWeekBehavior.净值}` : thisWeekBehavior.净值}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                        全班本周净值（加{thisWeekBehavior.加分}/减{thisWeekBehavior.减分}）
                      </div>
                    </div>
                  </Col>

                  {/* 本周考勤 */}
                  <Col xs={12} sm={6}>
                    <div
                      onClick={() => setAttendanceModalOpen(true)}
                      style={{
                        padding: "8px 12px",
                        background: thisWeekAttendance.length > 0 ? "#fff1f0" : "#f8fafc",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                        本周考勤（点开看）
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: thisWeekAttendance.length > 0 ? "#cf1322" : "#0f172a",
                        }}
                      >
                        {thisWeekAttendance.length} 条
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                        {thisWeekAttendance.length > 0 ? "点击查看异常名单" : "本周没有异常"}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* 卡片 2：学业趋势 */}
              <Card
                size="small"
                title={
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>学业趋势</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
                      最近五场均分与最新一场分布
                    </span>
                  </div>
                }
              >
                {examExams.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="还没有有效考试。录入分数后，这里会按时间列出最近五场均分和最新分布。"
                    style={{ padding: "16px 0" }}
                  />
                ) : (
                  <Row gutter={[20, 16]} align="middle">
                    {/* 最近 5 场走势条 */}
                    <Col xs={24} md={14}>
                      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                        最近考试平均分对比（满分归一）
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {examExams.slice(-5).map((e) => {
                          const pct = Math.round((e.平均 / e.满分) * 100);
                          return (
                            <div key={`${e.项目}@@${e.日期}`}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 13,
                                  marginBottom: 3,
                                }}
                              >
                                <span>
                                  <strong>{e.项目}</strong>{" "}
                                  <span style={{ color: "#94a3b8", fontSize: 11 }}>({e.日期})</span>
                                </span>
                                <span style={{ fontWeight: 600, color: "#1677ff" }}>
                                  均分 {e.平均} / 及格率 {e.及格率}%
                                </span>
                              </div>
                              <Progress percent={pct} strokeColor="#1677ff" size="small" />
                            </div>
                          );
                        })}
                      </div>
                    </Col>

                    {/* 最新一场分数段 */}
                    <Col xs={24} md={10}>
                      {latestExam && (
                        <div
                          style={{
                            background: "#f8fafc",
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                            最新场「{latestExam.项目}」情况
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>实考人数</div>
                              <div style={{ fontSize: 16, fontWeight: 700 }}>
                                {latestExam.实录} / {roster.length}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>平均分</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: "#1677ff" }}>
                                {latestExam.平均}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>及格率</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: "#52c41a" }}>
                                {latestExam.及格率}%
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>满分标准</div>
                              <div style={{ fontSize: 16, fontWeight: 700 }}>{latestExam.满分} 分</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Col>
                  </Row>
                )}
              </Card>

              {/* 卡片 3：日常项目（近十日每日完成率走势） */}
              <Card
                size="small"
                title={
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>日常项目</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
                      打钩、过关和等第项目会随项目表自动更新
                    </span>
                  </div>
                }
              >
                {dailyItems.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无日常学业项目，可在记一笔中新建"
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {dailyItems.map((itemObj) => (
                      <div
                        key={itemObj.item.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          paddingBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          {/* 左侧指标 */}
                          <div style={{ minWidth: 160 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                              {itemObj.item.项目名}
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                              {itemObj.item.计分制}
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: "#1677ff", marginTop: 4 }}>
                              {itemObj.overallRate}%
                              <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 6 }}>
                                有记录以来
                              </span>
                            </div>
                          </div>

                          {/* 右侧：近 10 日每日完成率横排微走势 */}
                          <div style={{ flex: 1, minWidth: 280 }}>
                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                              近十日每日完成率
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(10, 1fr)",
                                gap: 6,
                                textAlign: "center",
                              }}
                            >
                              {itemObj.dailyTrend.map((t) => {
                                const hasRate = t.rate !== null;
                                return (
                                  <div
                                    key={t.date}
                                    style={{
                                      background: hasRate ? "#f0fdf4" : "#f8fafc",
                                      border: hasRate ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                                      borderRadius: 6,
                                      padding: "6px 2px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: "#94a3b8",
                                        transform: "scale(0.9)",
                                      }}
                                    >
                                      {t.shortDate}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: hasRate
                                          ? t.rate! >= 100
                                            ? "#16a34a"
                                            : "#1677ff"
                                          : "#cbd5e1",
                                        marginTop: 2,
                                      }}
                                    >
                                      {hasRate ? `${t.rate}%` : "—"}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* 卡片 4：班级运行 */}
              <Card
                size="small"
                title={
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>班级运行</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
                      看全班趋势，不给学生排名
                    </span>
                  </div>
                }
              >
                <Row gutter={[24, 16]}>
                  {/* 近六周表现走势 */}
                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>
                      近六周表现（表扬 + / 提醒 -）
                    </div>
                    {!sixWeeksTrend.hasData ? (
                      <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
                        近六周还没有表现记录，暂不画趋势。
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 120 }}>
                        {sixWeeksTrend.weeks.map((w, idx) => (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              height: "100%",
                              justifyContent: "flex-end",
                            }}
                          >
                            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 80 }}>
                              <div
                                title={`加分: ${w.加分}`}
                                style={{
                                  width: 12,
                                  height: `${Math.min(w.加分 * 8, 80)}px`,
                                  background: "#52c41a",
                                  borderRadius: "3px 3px 0 0",
                                }}
                              />
                              <div
                                title={`减分: ${w.减分}`}
                                style={{
                                  width: 12,
                                  height: `${Math.min(w.减分 * 8, 80)}px`,
                                  background: "#cf1322",
                                  borderRadius: "3px 3px 0 0",
                                }}
                              />
                            </div>
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{w.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Col>

                  {/* 本周考勤构成 */}
                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>
                      本周考勤构成（共 {thisWeekAttendance.length} 条）
                    </div>
                    {thisWeekAttendance.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
                        本周没有考勤异常。
                      </div>
                    ) : (
                      <List
                        size="small"
                        dataSource={thisWeekAttendance}
                        renderItem={(item) => (
                          <List.Item style={{ padding: "6px 0", fontSize: 13 }}>
                            <Space>
                              <Tag color="red">{item.状态}</Tag>
                              <strong>{item.学生}</strong>
                              <span style={{ color: "#94a3b8" }}>{item.日期}</span>
                              {item.备注 && <span style={{ color: "#64748b" }}>({item.备注})</span>}
                            </Space>
                          </List.Item>
                        )}
                      />
                    )}
                  </Col>
                </Row>
              </Card>
            </>
          )}

          {/* ==================== 视图 2：花名册总览 ==================== */}
          {activeTab === "roster" && (
            <Card size="small" title={`${班级} 全体学生学情总览`}>
              <Table
                rowKey="姓名"
                dataSource={rosterTableData}
                size="small"
                pagination={false}
                bordered
                scroll={{ x: "max-content" }}
                onRow={(record) => ({
                  onClick: () => openStudentDetail(record.姓名),
                  style: { cursor: "pointer" },
                })}
                columns={[
                  { title: "学号", dataIndex: "学号", width: 70, fixed: "left" },
                  {
                    title: "姓名",
                    dataIndex: "姓名",
                    width: 100,
                    fixed: "left",
                    render: (t) => <a style={{ fontWeight: 600 }}>{t}</a>,
                  },
                  { title: "小组", dataIndex: "小组", width: 90 },
                  {
                    title: "表现净积分",
                    dataIndex: "表现分",
                    width: 110,
                    align: "center",
                    sorter: (a, b) => a.表现分 - b.表现分,
                    render: (v) => (
                      <span
                        style={{
                          fontWeight: 600,
                          color: v > 0 ? "#1677ff" : v < 0 ? "#cf1322" : "#64748b",
                        }}
                      >
                        {v > 0 ? `+${v}` : v}
                      </span>
                    ),
                  },
                  {
                    title: "待补测项",
                    dataIndex: "待补测数",
                    width: 120,
                    align: "center",
                    render: (num, row) =>
                      num > 0 ? (
                        <Tag color="orange">
                          {num} 项 ({row.待补测项目})
                        </Tag>
                      ) : (
                        <Tag color="green">全过关</Tag>
                      ),
                  },
                  {
                    title: "日常完成次数",
                    dataIndex: "学业完成次数",
                    width: 120,
                    align: "center",
                    sorter: (a, b) => a.学业完成次数 - b.学业完成次数,
                  },
                ]}
              />
            </Card>
          )}

          {/* ==================== 视图 3：表现走势与积分榜 ==================== */}
          {activeTab === "behavior" && (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card size="small" title="表现光荣榜（前列）">
                  <Table
                    rowKey="name"
                    dataSource={behaviorLeaderboard.slice(0, 15)}
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: "排位",
                        width: 60,
                        render: (_, __, idx) => (
                          <Tag color={idx < 3 ? "gold" : "default"}>{idx + 1}</Tag>
                        ),
                      },
                      {
                        title: "姓名",
                        dataIndex: "name",
                        render: (t) => (
                          <a onClick={() => openStudentDetail(t)} style={{ fontWeight: 600 }}>
                            {t}
                          </a>
                        ),
                      },
                      {
                        title: "表扬 (+)",
                        dataIndex: "加",
                        render: (v) => <span style={{ color: "#52c41a" }}>+{v}</span>,
                      },
                      {
                        title: "净得分",
                        dataIndex: "净",
                        align: "right",
                        render: (v) => <strong style={{ color: "#1677ff" }}>{v}</strong>,
                      },
                    ]}
                  />
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card size="small" title="提醒关注名单">
                  <Table
                    rowKey="name"
                    dataSource={behaviorLeaderboard.filter((x) => x.减 > 0 || x.净 < 0).slice(0, 15)}
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: "姓名",
                        dataIndex: "name",
                        render: (t) => (
                          <a onClick={() => openStudentDetail(t)} style={{ fontWeight: 600 }}>
                            {t}
                          </a>
                        ),
                      },
                      {
                        title: "提醒 (-)",
                        dataIndex: "减",
                        render: (v) => <span style={{ color: "#cf1322" }}>-{v}</span>,
                      },
                      {
                        title: "净得分",
                        dataIndex: "净",
                        align: "right",
                        render: (v) => (
                          <strong style={{ color: v < 0 ? "#cf1322" : "#64748b" }}>{v}</strong>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          )}
        </Space>
      </Spin>

      {/* 弹窗 1：待补测名单下钻弹窗 */}
      <Modal
        title={`待补测学生名单（${班级} · 共 ${retestList.length} 人次）`}
        open={retestModalOpen}
        onCancel={() => setRetestModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setRetestModalOpen(false)}>
            知道了
          </Button>,
        ]}
      >
        {retestList.length === 0 ? (
          <Empty description="全班目前全部过关，没有任何欠账！" />
        ) : (
          <Table
            size="small"
            pagination={false}
            rowKey={(r) => `${r.学号}-${r.项目}-${r.日期}`}
            dataSource={retestList}
            columns={[
              { title: "学号", dataIndex: "学号", width: 70 },
              {
                title: "姓名",
                dataIndex: "学生",
                render: (s) => (
                  <a onClick={() => openStudentDetail(s)} style={{ fontWeight: 600 }}>
                    {s}
                  </a>
                ),
              },
              { title: "待补测项目", dataIndex: "项目" },
              { title: "记录日期", dataIndex: "日期", width: 110 },
              {
                title: "状态",
                dataIndex: "状态",
                width: 90,
                render: () => <Tag color="orange">未过关</Tag>,
              },
            ]}
          />
        )}
      </Modal>

      {/* 弹窗 2：本周考勤异常下钻弹窗 */}
      <Modal
        title={`本周考勤异常名单（${班级} · 共 ${thisWeekAttendance.length} 条）`}
        open={attendanceModalOpen}
        onCancel={() => setAttendanceModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setAttendanceModalOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        {thisWeekAttendance.length === 0 ? (
          <Empty description="本周全勤，没有考勤异常记录！" />
        ) : (
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={thisWeekAttendance}
            columns={[
              {
                title: "学生",
                dataIndex: "学生",
                render: (s) => (
                  <a onClick={() => openStudentDetail(s)} style={{ fontWeight: 600 }}>
                    {s}
                  </a>
                ),
              },
              { title: "日期", dataIndex: "日期" },
              {
                title: "状态",
                dataIndex: "状态",
                render: (v) => <Tag color="red">{v}</Tag>,
              },
              { title: "备注", dataIndex: "备注" },
            ]}
          />
        )}
      </Modal>
      {/* 弹窗 3：学生个人学情与档案弹窗 */}
      <StudentDetailModal
        student={detailStudent}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
