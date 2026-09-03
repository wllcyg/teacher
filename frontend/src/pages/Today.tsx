import { useMemo, useState } from "react";
import { Card, Row, Col, Tag, Empty, Spin, Statistic } from "antd";
import { EditOutlined, ClockCircleOutlined, AlertOutlined, RedoOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getSummary, getExamReport, listTable } from "../api";
import { useAppStore } from "../store/app";
import { useCurrentClass } from "../hooks";
import { PERIODS, hhmmToMinutes } from "../periods";
import QuickNoteModal from "../components/QuickNoteModal";

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
  const 称呼 = useAppStore((s) => s.称呼);
  const 今天 = useAppStore((s) => s.今天);
  const { 班级, set班级, classes } = useCurrentClass();
  const [noteOpen, setNoteOpen] = useState(false);

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

  // 下一节：当前时间之后结束的第一节课
  const nowMinutes = dayjs().hour() * 60 + dayjs().minute();
  const nextLesson = useMemo(() => {
    return (
      todayLessons.find((l: any) => {
        const p = PERIODS.find((x) => x.n === l.节次号);
        return p && hhmmToMinutes(p.end) > nowMinutes;
      }) ?? null
    );
  }, [todayLessons, nowMinutes]);
  const nextPeriod = nextLesson ? PERIODS.find((p) => p.n === nextLesson.节次号) : null;

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
  const ringDay = dayjs(今天).date();

  return (
    <div className="page">
      {/* 问候 + 日期 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          {greeting()}，{称呼}
        </h2>
        <span style={{ color: "#8c8c8c" }}>
          {dayjs(今天).format("YYYY年M月D日")} {weekLabel}
        </span>
      </div>

      {/* 班级切换标签 */}
      {classes.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {classes.map((c) => {
            const active = c === 班级;
            return (
              <div
                key={c}
                onClick={() => set班级(c)}
                style={{
                  padding: "5px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "#7a6a55",
                  background: active ? "#e07b39" : "rgba(224,123,57,0.10)",
                  border: active ? "1px solid #e07b39" : "1px solid rgba(224,123,57,0.25)",
                  transition: "all .2s",
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      )}

      <Spin spinning={summary.isLoading}>
        {/* 主视觉：下一节 + 记一笔 */}
        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            padding: "22px 24px",
            background: "linear-gradient(135deg, #fdf3e7 0%, #f9e5cf 100%)",
            border: "1px solid #f0d9bd",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "#a07947", fontSize: 13, marginBottom: 6 }}>下一节</div>
            {nextLesson && nextPeriod ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#5b4426" }}>
                  第{nextLesson.节次号}节 {nextLesson.班级}·{nextLesson.科目}
                </div>
                <div style={{ color: "#a07947", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <ClockCircleOutlined /> {nextPeriod.time}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 700, color: "#5b4426" }}>
                {todayLessons.length === 0 ? "今天没有排课" : "今天的课上完了"}
              </div>
            )}
          </div>
          <button
            onClick={() => setNoteOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background: "#e07b39",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(224,123,57,.35)",
            }}
          >
            <EditOutlined /> 记一笔
          </button>
        </div>

        {/* 今日节奏 + 紧要的事 + 等着补测 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={8}>
            <Card size="small" style={{ borderRadius: 14, background: "#fffdf9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "3px solid #e07b39",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#e07b39",
                    flexShrink: 0,
                  }}
                >
                  {ringDay}
                </div>
                <div style={{ fontWeight: 600, color: "#5b4426", marginBottom: 6 }}>今日节奏</div>
              </div>
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#5b4426" }}>{todayTodos.length}</div>
                  <div style={{ fontSize: 12, color: "#a07947" }}>待办</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: overdueTodos.length ? "#cf1322" : "#5b4426" }}>
                    {overdueTodos.length}
                  </div>
                  <div style={{ fontSize: 12, color: "#a07947" }}>逾期</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: absentees.length ? "#fa8c16" : "#5b4426" }}>
                    {absentees.length}
                  </div>
                  <div style={{ fontSize: 12, color: "#a07947" }}>补测</div>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card size="small" title={<span><AlertOutlined style={{ color: "#cf1322" }} /> 紧要的事</span>} style={{ borderRadius: 14 }}>
              {overdueTodos.length === 0 && todayTodos.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有紧要的事" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {overdueTodos.slice(0, 4).map((t: any) => (
                    <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Tag color="red">逾期</Tag>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.事项}</span>
                    </div>
                  ))}
                  {todayTodos.slice(0, 4).map((t: any) => (
                    <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Tag color="orange">今天</Tag>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.事项}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card size="small" title={<span><RedoOutlined style={{ color: "#fa8c16" }} /> 等着补测{examName ? `·${examName}` : ""}</span>} style={{ borderRadius: 14 }}>
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
            <Card size="small" title="今日课表" style={{ borderRadius: 14 }} extra={<a onClick={() => navigate("/schedule")}>查看全部</a>}>
              {todayLessons.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="今天没有排课" />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {todayLessons.map((l: any) => {
                    const p = PERIODS.find((x) => x.n === l.节次号);
                    const isNext = nextLesson && l.id === nextLesson.id;
                    return (
                      <Tag
                        key={l.id}
                        color={isNext ? "orange" : "default"}
                        style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8 }}
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
            <Card size="small" title="项目完成率" style={{ borderRadius: 14 }}>
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
                          <span style={{ color: rate >= 100 ? "#52c41a" : "#fa8c16", fontWeight: 600 }}>{rate}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${rate}%`,
                              borderRadius: 3,
                              background: rate >= 100 ? "#52c41a" : "#fa8c16",
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

      <QuickNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} />
    </div>
  );
}
