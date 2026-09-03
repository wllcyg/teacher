import { useMemo, useState } from "react";
import { Card, Row, Col, Tag, Empty, Spin, Statistic, Segmented, Button, message } from "antd";
import {
  EditOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  RedoOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getSummary, getExamReport, listTable, updateRow } from "../api";
import { useAppStore } from "../store/app";
import { useCurrentClass, usePeriods } from "../hooks";
import { hhmmToMinutes } from "../periods";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

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
    if (weekLabel === "周六" || weekLabel === "周日") return [];
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

  // 待办：今天的未办 + 逾期的未办
  const todayTodos = useMemo(
    () => (todos.data ?? []).filter((t: any) => t.日期 === 今天 && t.状态 !== "已办"),
    [todos.data, 今天]
  );
  const overdueTodos = useMemo(
    () => (todos.data ?? []).filter((t: any) => t.日期 < 今天 && t.状态 !== "已办"),
    [todos.data, 今天]
  );

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

  const s = summary.data;

  return (
    <div className="page">
      {/* 问候 + 日期 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          {greeting()}，{称呼}
        </h2>
        <span style={{ color: "#94A3B8" }}>
          {dayjs(今天).format("YYYY年M月D日")} {weekLabel}
        </span>
      </div>

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
                borderRadius: nextLesson ? "12px 12px 0 0" : 12,
              }}
              styles={{ body: { padding: "20px 24px" } }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#4F46E5",
                        animation: "pulse 2s ease-in-out infinite",
                        boxShadow: "0 0 0 3px rgba(79,70,229,0.2)",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#6366F1", fontWeight: 500 }}>正在上课</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#818CF8",
                        background: "#EEF2FF",
                        border: "1px solid #C7D2FE",
                        borderRadius: 20,
                        padding: "1px 10px",
                        marginLeft: 4,
                      }}
                    >
                      还剩 {remainMinutes} 分钟
                    </span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1E1B4B" }}>
                    第{currentLesson.节次号}节 {currentLesson.班级}·{currentLesson.科目}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366F1", fontSize: 13 }}>
                      <ClockCircleOutlined /> {currentPeriod.time}
                    </div>
                    {/* 进度条 */}
                    <div style={{ flex: 1, maxWidth: 180, height: 4, borderRadius: 2, background: "rgba(99,102,241,0.15)", overflow: "hidden" }}>
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
                    <span style={{ fontSize: 12, color: "#818CF8" }}>{progressPct}%</span>
                  </div>
                </div>

                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  size="large"
                  onClick={() => handleGoQuickNote(currentLesson.班级)}
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
              borderRadius: currentLesson ? "0 0 12px 12px" : 12,
              borderTop: currentLesson ? "1px dashed #E2E8F0" : undefined,
            }}
            styles={{ body: { padding: currentLesson ? "14px 24px" : "20px 24px" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                {nextLesson && nextPeriod ? (
                  <>
                    <div style={{ color: "#94A3B8", fontSize: 13, marginBottom: 4 }}>
                      {currentLesson ? "接下来" : "下一节"}
                    </div>
                    <div style={{ fontSize: currentLesson ? 17 : 22, fontWeight: currentLesson ? 600 : 700, color: "#0F172A" }}>
                      第{nextLesson.节次号}节 {nextLesson.班级}·{nextLesson.科目}
                    </div>
                    <div style={{ color: "#94A3B8", marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      <ClockCircleOutlined /> {nextPeriod.time}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#0F172A" }}>
                    {todayLessons.length === 0 ? "今天没有排课" : currentLesson ? "这是今天最后一节课了" : "今天的课上完了"}
                  </div>
                )}
              </div>
              {!currentLesson && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  size="large"
                  onClick={() => handleGoQuickNote(nextLesson?.班级 || 班级)}
                >
                  记一笔
                </Button>
              )}
            </div>
          </Card>
        </div>

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
    </div>
  );
}
