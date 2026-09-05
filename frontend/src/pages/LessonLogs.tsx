import React, { useState, useMemo } from "react";
import {
  Card,
  Input,
  Select,
  Button,
  Tag,
  Empty,
  Spin,
  Popconfirm,
  message,
  DatePicker,
  Radio,
} from "antd";
import {
  BookOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTable, deleteRow } from "../api";
import { useClasses, useCurrentClass } from "../hooks";
import LessonLogDrawer, { type LessonContext } from "../components/LessonLogDrawer";

dayjs.extend(isoWeek);

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function LessonLogs() {
  const qc = useQueryClient();
  const classes = useClasses();
  const { 班级: defaultClass } = useCurrentClass();

  // 筛选器状态
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "week" | "month" | "today" | "custom">("all");
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [searchKw, setSearchKw] = useState<string>("");

  // 抽屉编辑状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<LessonContext | null>(null);
  const [allowEditContext, setAllowEditContext] = useState(false);

  // 获取所有课堂记录
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["lesson_log"],
    queryFn: () => listTable("lesson_log"),
  });

  // 过滤记录
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // 1. 班级过滤
    if (selectedClass !== "ALL") {
      result = result.filter((r) => r.班级 === selectedClass);
    }

    // 2. 日期范围过滤
    const today = dayjs();
    if (dateFilterMode === "today") {
      const todayStr = today.format("YYYY-MM-DD");
      result = result.filter((r) => r.日期 === todayStr);
    } else if (dateFilterMode === "week") {
      const weekStart = today.startOf("isoWeek").format("YYYY-MM-DD");
      const weekEnd = today.endOf("isoWeek").format("YYYY-MM-DD");
      result = result.filter((r) => r.日期 >= weekStart && r.日期 <= weekEnd);
    } else if (dateFilterMode === "month") {
      const monthStart = today.startOf("month").format("YYYY-MM-DD");
      const monthEnd = today.endOf("month").format("YYYY-MM-DD");
      result = result.filter((r) => r.日期 >= monthStart && r.日期 <= monthEnd);
    } else if (dateFilterMode === "custom" && customRange && customRange[0] && customRange[1]) {
      const startStr = customRange[0].format("YYYY-MM-DD");
      const endStr = customRange[1].format("YYYY-MM-DD");
      result = result.filter((r) => r.日期 >= startStr && r.日期 <= endStr);
    }

    // 3. 关键字过滤（内容、班级、节次）
    if (searchKw.trim()) {
      const kw = searchKw.trim().toLowerCase();
      result = result.filter((r) => {
        const c = (r.内容 || "").toLowerCase();
        const k = (r.班级 || "").toLowerCase();
        const p = (r.节次 || "").toLowerCase();
        return c.includes(kw) || k.includes(kw) || p.includes(kw);
      });
    }

    // 4. 排序：日期倒序，节次倒序
    return result.sort((a, b) => {
      if (a.日期 !== b.日期) {
        return b.日期.localeCompare(a.日期);
      }
      const pA = parseInt(String(a.节次).replace(/\D/g, ""), 10) || 0;
      const pB = parseInt(String(b.节次).replace(/\D/g, ""), 10) || 0;
      return pB - pA;
    });
  }, [logs, selectedClass, dateFilterMode, customRange, searchKw]);

  // 统计数据
  const stats = useMemo(() => {
    const today = dayjs();
    const weekStart = today.startOf("isoWeek").format("YYYY-MM-DD");
    const weekEnd = today.endOf("isoWeek").format("YYYY-MM-DD");

    const totalCount = logs.length;
    const weekCount = logs.filter((r) => r.日期 >= weekStart && r.日期 <= weekEnd).length;
    const coveredClasses = new Set(logs.map((r) => r.班级)).size;

    return { totalCount, weekCount, coveredClasses };
  }, [logs]);

  // 按日期分组
  const groupedLogs = useMemo(() => {
    const groups: { [date: string]: any[] } = {};
    for (const log of filteredLogs) {
      if (!groups[log.日期]) {
        groups[log.日期] = [];
      }
      groups[log.日期].push(log);
    }
    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
  }, [filteredLogs]);

  const handleEditRecord = (log: any) => {
    setActiveContext({
      日期: log.日期,
      班级: log.班级,
      节次: log.节次,
    });
    setAllowEditContext(false);
    setDrawerOpen(true);
  };

  const handleCreateNew = () => {
    setActiveContext({
      日期: dayjs().format("YYYY-MM-DD"),
      班级: selectedClass !== "ALL" ? selectedClass : defaultClass || classes[0] || "",
      节次: "第1节",
    });
    setAllowEditContext(true);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRow("lesson_log", id);
      message.success("课堂笔记已删除");
      qc.invalidateQueries({ queryKey: ["lesson_log"] });
    } catch {
      message.error("删除失败");
    }
  };

  // 提取文本中的【标签】
  const renderFormattedContent = (text: string) => {
    if (!text) return <span style={{ color: "#94A3B8" }}>暂无详细内容</span>;

    // 拆分出【xxx】
    const tagMatches = text.match(/【([^】]+)】/g) || [];
    const cleanText = text.replace(/【([^】]+)】/g, "").trim();

    return (
      <div>
        {tagMatches.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {tagMatches.map((t, idx) => (
              <Tag
                key={idx}
                color="processing"
                style={{
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 500,
                  background: "#EEF2FF",
                  borderColor: "#E0E7FF",
                  color: "#4F46E5",
                  margin: 0,
                }}
              >
                {t.replace(/【|】/g, "")}
              </Tag>
            ))}
          </div>
        )}
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {cleanText || text}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px 40px" }}>
      {/* 顶部标题与统计概览 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 18,
                boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
              }}
            >
              <BookOutlined />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                课堂笔记
              </h1>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                记录授课进度、课后作业及随堂要点
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            style={{ borderRadius: 8 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNew}
            style={{
              borderRadius: 8,
              background: "#4F46E5",
              borderColor: "#4F46E5",
              fontWeight: 600,
              boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)",
            }}
          >
            补录笔记
          </Button>
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748B" }}>全部笔记</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", marginTop: 2 }}>
            {stats.totalCount} <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>篇</span>
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748B" }}>本周记录</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#4F46E5", marginTop: 2 }}>
            {stats.weekCount} <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>篇</span>
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748B" }}>覆盖班级</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0D9488", marginTop: 2 }}>
            {stats.coveredClasses} <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>个</span>
          </div>
        </div>
      </div>

      {/* 筛选与搜索工具条 */}
      <Card
        size="small"
        style={{
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
        styles={{ body: { padding: "12px 14px" } }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* 第一行：搜索框与班级筛选 */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Input
              prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
              placeholder="搜索教学进度、随堂作业、关键字..."
              allowClear
              value={searchKw}
              onChange={(e) => setSearchKw(e.target.value)}
              style={{ flex: 1, minWidth: 180, borderRadius: 8 }}
            />

            <Select
              value={selectedClass}
              onChange={setSelectedClass}
              style={{ width: 120 }}
              options={[
                { label: "全部班级", value: "ALL" },
                ...classes.map((c) => ({ label: c, value: c })),
              ]}
            />
          </div>

          {/* 第二行：时间范围预设 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Radio.Group
              size="small"
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="week">本周</Radio.Button>
              <Radio.Button value="month">本月</Radio.Button>
              <Radio.Button value="today">今天</Radio.Button>
              <Radio.Button value="custom">自选范围</Radio.Button>
            </Radio.Group>

            {dateFilterMode === "custom" && (
              <DatePicker.RangePicker
                size="small"
                value={customRange}
                onChange={(val) => setCustomRange(val)}
                style={{ borderRadius: 6 }}
              />
            )}
          </div>
        </div>
      </Card>

      {/* 笔记清单 */}
      <Spin spinning={isLoading}>
        {groupedLogs.length === 0 ? (
          <Card
            style={{
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              textAlign: "center",
              padding: "40px 20px",
            }}
          >
            <Empty
              description={
                <span style={{ color: "#94A3B8" }}>
                  {searchKw || selectedClass !== "ALL" || dateFilterMode !== "all"
                    ? "没有符合条件的课堂笔记"
                    : "暂无课堂笔记，下课后记一笔教学进度与作业吧"}
                </span>
              }
            >
              <Button type="primary" onClick={handleCreateNew} style={{ background: "#4F46E5", borderColor: "#4F46E5", borderRadius: 8 }}>
                记录第一条笔记
              </Button>
            </Empty>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groupedLogs.map((group) => {
              const weekName = WEEKDAY_NAMES[dayjs(group.date).day()];
              const isToday = group.date === dayjs().format("YYYY-MM-DD");

              return (
                <div key={group.date}>
                  {/* 日期组标题 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      paddingLeft: 4,
                    }}
                  >
                    <CalendarOutlined style={{ color: isToday ? "#4F46E5" : "#64748B", fontSize: 13 }} />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isToday ? "#4F46E5" : "#475569",
                      }}
                    >
                      {group.date} {weekName}
                    </span>
                    {isToday && (
                      <Tag color="purple" style={{ margin: 0, borderRadius: 10, fontSize: 11 }}>
                        今天
                      </Tag>
                    )}
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>({group.items.length} 节课)</span>
                  </div>

                  {/* 该日期下的记录卡片 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {group.items.map((log) => (
                      <Card
                        key={log.id}
                        size="small"
                        hoverable
                        onClick={() => handleEditRecord(log)}
                        style={{
                          borderRadius: 12,
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        styles={{ body: { padding: "14px 16px" } }}
                      >
                        {/* 卡片头部：节次、班级与操作按钮 */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Tag
                              color="blue"
                              style={{
                                margin: 0,
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 13,
                                padding: "2px 8px",
                              }}
                            >
                              {log.节次}
                            </Tag>
                            <Tag
                              color="cyan"
                              style={{
                                margin: 0,
                                borderRadius: 8,
                                fontWeight: 600,
                                fontSize: 13,
                                padding: "2px 8px",
                              }}
                            >
                              {log.班级}
                            </Tag>
                          </div>

                          <div
                            style={{ display: "flex", alignItems: "center", gap: 4 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined style={{ color: "#4F46E5" }} />}
                              onClick={() => handleEditRecord(log)}
                              style={{ borderRadius: 6, fontSize: 12 }}
                            >
                              编辑
                            </Button>

                            <Popconfirm
                              title="确定删除此课堂笔记？"
                              onConfirm={() => handleDelete(log.id)}
                              okText="删除"
                              cancelText="取消"
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                style={{ borderRadius: 6, fontSize: 12 }}
                              />
                            </Popconfirm>
                          </div>
                        </div>

                        {/* 卡片主体：笔记内容与标签 */}
                        {renderFormattedContent(log.内容)}
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      {/* 课堂笔记底部抽屉（移动端底抽屉 / 宽屏自适应，不使用弹窗） */}
      <LessonLogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lessonContext={activeContext}
        allowEditContext={allowEditContext}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["lesson_log"] });
        }}
      />
    </div>
  );
}
