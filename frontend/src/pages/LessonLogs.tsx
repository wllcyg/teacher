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
  Pagination,
} from "antd";
import {
  PullToRefresh,
  SearchBar,
  Dialog,
  Toast,
  Empty as MobileEmpty,
  InfiniteScroll,
  FloatingBubble,
} from "antd-mobile";
import {
  BookOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTable, deleteRow } from "../api";
import { useClasses, useCurrentClass, useIsMobileOrTablet } from "../hooks";
import { triggerHaptic } from "../utils/haptics";
import LessonLogDrawer, { type LessonContext } from "../components/LessonLogDrawer";
import type { Row } from "../types";

dayjs.extend(isoWeek);

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const DATE_FILTER_TABS: { label: string; value: "all" | "week" | "month" | "today" | "custom" }[] = [
  { label: "全部", value: "all" },
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
  { label: "今日", value: "today" },
  { label: "自定义", value: "custom" },
];

export default function LessonLogs() {
  const { 班级: defaultClass, classItems } = useCurrentClass();
  const classes = useClasses();
  const isMobile = useIsMobileOrTablet();
  const qc = useQueryClient();

  // 筛选状态
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "week" | "month" | "today" | "custom">("all");
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [searchKw, setSearchKw] = useState<string>("");

  // PC 端分页状态
  const [pcPage, setPcPage] = useState(1);
  const [pcPageSize, setPcPageSize] = useState(15);

  // 抽屉编辑状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<LessonContext | null>(null);
  const [allowEditContext, setAllowEditContext] = useState(false);

  // -------------------------------------------------------------
  // 🎯 服务端查询参数构造（纯英文规范字段，零映射直接查 SQL）
  // -------------------------------------------------------------
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {};

    // 1. 班级过滤（优先用 class_id，消除中文编码）
    if (selectedClass !== "ALL") {
      const found = classItems?.find((c) => c.name === selectedClass || c.class_id === selectedClass);
      if (found?.class_id) {
        params.class_id = found.class_id;
      } else {
        params.class_name = selectedClass;
      }
    }

    // 2. 搜索关键词
    if (searchKw.trim()) {
      params.q = searchKw.trim();
    }

    // 3. 日期范围下沉过滤
    const today = dayjs();
    if (dateFilterMode === "today") {
      params.date = today.format("YYYY-MM-DD");
    } else if (dateFilterMode === "week") {
      params.date_gte = today.startOf("isoWeek").format("YYYY-MM-DD");
      params.date_lte = today.endOf("isoWeek").format("YYYY-MM-DD");
    } else if (dateFilterMode === "month") {
      params.date_gte = today.startOf("month").format("YYYY-MM-DD");
      params.date_lte = today.endOf("month").format("YYYY-MM-DD");
    } else if (dateFilterMode === "custom" && customRange && customRange[0] && customRange[1]) {
      params.date_gte = customRange[0].format("YYYY-MM-DD");
      params.date_lte = customRange[1].format("YYYY-MM-DD");
    }

    return params;
  }, [selectedClass, searchKw, dateFilterMode, customRange]);

  // -------------------------------------------------------------
  // 1. 移动端：基于筛选条件的真分页与触底静默加载更多
  // -------------------------------------------------------------
  const {
    data: infiniteLogs,
    fetchNextPage,
    hasNextPage,
    isLoading: mobileLoading,
    refetch: refetchMobile,
  } = useInfiniteQuery({
    queryKey: ["lesson_log-mobile", queryParams],
    queryFn: ({ pageParam = 1 }) =>
      listTable("lesson_log", { ...queryParams, page: pageParam, page_size: 15 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.page_size;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: isMobile,
  });

  // -------------------------------------------------------------
  // 2. PC 桌面端：服务端真分页
  // -------------------------------------------------------------
  const {
    data: pcPageResult,
    isLoading: pcLoading,
    refetch: refetchPc,
  } = useQuery({
    queryKey: ["lesson_log-pc", queryParams, pcPage, pcPageSize],
    queryFn: () =>
      listTable("lesson_log", { ...queryParams, page: pcPage, page_size: pcPageSize }),
    enabled: !isMobile,
  });

  // 统一数据源
  const logs: Row[] = useMemo(() => {
    if (isMobile) {
      return infiniteLogs ? infiniteLogs.pages.flatMap((p) => p.items) : [];
    }
    return pcPageResult?.items || [];
  }, [isMobile, infiniteLogs, pcPageResult]);

  const totalCount = isMobile
    ? (infiniteLogs?.pages[0]?.total ?? 0)
    : (pcPageResult?.total ?? 0);

  const isLoading = isMobile ? mobileLoading : pcLoading;

  const refreshLogs = () => {
    qc.invalidateQueries({ queryKey: ["lesson_log-mobile"] });
    qc.invalidateQueries({ queryKey: ["lesson_log-pc"] });
  };

  // 按日期分组渲染
  const groupedLogs = useMemo(() => {
    const groups: { [date: string]: Row[] } = {};
    for (const log of logs) {
      const d = log.date || log.日期 || "未设日期";
      if (!groups[d]) {
        groups[d] = [];
      }
      groups[d].push(log);
    }
    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
  }, [logs]);

  const handleEditRecord = (log: Row) => {
    triggerHaptic("light");
    const found = classItems?.find((c) => c.class_id === log.class_id || c.name === (log.class_name || log.班级));
    setActiveContext({
      date: log.date || log.日期,
      class_id: log.class_id || found?.class_id,
      class_name: log.class_name || log.班级,
      period: log.period || log.节次,
      日期: log.date || log.日期,
      班级: log.class_name || log.班级,
      节次: log.period || log.节次,
    });
    setAllowEditContext(false);
    setDrawerOpen(true);
  };

  const handleCreateNew = () => {
    triggerHaptic("light");
    const initClass = selectedClass !== "ALL" ? selectedClass : defaultClass || classes[0] || "";
    const found = classItems?.find((c) => c.name === initClass || c.class_id === initClass);
    setActiveContext({
      date: dayjs().format("YYYY-MM-DD"),
      class_id: found?.class_id,
      class_name: found?.name || initClass,
      period: "第1节",
      日期: dayjs().format("YYYY-MM-DD"),
      班级: found?.name || initClass,
      节次: "第1节",
    });
    setAllowEditContext(true);
    setDrawerOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRow("lesson_log", id);
      triggerHaptic("success");
      if (isMobile) {
        Toast.show({ icon: "success", content: "课堂笔记已删除", duration: 1500 });
      } else {
        message.success("课堂笔记已删除");
      }
      refreshLogs();
    } catch {
      triggerHaptic("warning");
      if (isMobile) {
        Toast.show({ icon: "fail", content: "删除失败" });
      } else {
        message.error("删除失败");
      }
    }
  };

  const handleMobileDelete = (log: Row) => {
    triggerHaptic("warning");
    const d = log.date || log.日期;
    const p = log.period || log.节次;
    const c = log.class_name || log.班级;
    Dialog.confirm({
      title: "确定删除此课堂笔记？",
      content: `${d} ${p} (${c}) 的笔记将被彻底删除`,
      confirmText: "删除",
      cancelText: "取消",
      onConfirm: async () => {
        await handleDelete(log.id);
      },
    });
  };

  const handleMobileRefresh = async () => {
    triggerHaptic("light");
    await refetchMobile();
    Toast.show({
      icon: "success",
      content: "已刷新课堂笔记",
      duration: 1200,
    });
  };

  // 提取文本中的【标签】
  const renderFormattedContent = (text: string) => {
    if (!text) return <span style={{ color: "#94A3B8" }}>暂无详细内容</span>;

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

  // -------------------------------------------------------------
  // 📱 移动端专属布局视图（条件过滤下沉 + 上拉触底无限加载）
  // -------------------------------------------------------------
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleMobileRefresh}>
        <div
          style={{
            minHeight: "100vh",
            background: "#F8FAFC",
            padding: "12px 14px 80px",
            boxSizing: "border-box",
          }}
        >
          {/* 移动端搜索栏 */}
          <div style={{ marginBottom: 10 }}>
            <SearchBar
              placeholder="搜索教学进度、课后作业、知识点..."
              value={searchKw}
              onChange={setSearchKw}
              onClear={() => setSearchKw("")}
              style={{
                "--background": "#FFFFFF",
                "--border-radius": "10px",
                "--height": "36px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            />
          </div>

          {/* 移动端横向滑轨筛选：时间模式 */}
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 6,
              marginBottom: 8,
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            {DATE_FILTER_TABS.map((tab) => {
              const isActive = dateFilterMode === tab.value;
              return (
                <div
                  key={tab.value}
                  onClick={() => {
                    triggerHaptic("light");
                    setDateFilterMode(tab.value);
                  }}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    background: isActive ? "#4F46E5" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#64748B",
                    border: isActive ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                    boxShadow: isActive ? "0 2px 6px rgba(79, 70, 229, 0.2)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </div>
              );
            })}
          </div>

          {/* 移动端自选日期范围 */}
          {dateFilterMode === "custom" && (
            <div
              style={{
                marginBottom: 10,
                background: "#fff",
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #E2E8F0",
              }}
            >
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>选择起始与截止日期：</div>
              <DatePicker.RangePicker
                size="small"
                value={customRange}
                onChange={(val) => setCustomRange(val)}
                style={{ width: "100%", borderRadius: 6 }}
              />
            </div>
          )}

          {/* 移动端横向滑轨筛选：班级 Chips */}
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 6,
              marginBottom: 12,
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            <div
              onClick={() => {
                triggerHaptic("light");
                setSelectedClass("ALL");
              }}
              style={{
                padding: "3px 10px",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: selectedClass === "ALL" ? 600 : 400,
                whiteSpace: "nowrap",
                cursor: "pointer",
                background: selectedClass === "ALL" ? "#EEF2FF" : "#FFFFFF",
                color: selectedClass === "ALL" ? "#4F46E5" : "#475569",
                border: selectedClass === "ALL" ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
              }}
            >
              全部班级
            </div>
            {classes.map((c) => {
              const isActive = selectedClass === c;
              return (
                <div
                  key={c}
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedClass(c);
                  }}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 14,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    background: isActive ? "#EEF2FF" : "#FFFFFF",
                    color: isActive ? "#4F46E5" : "#475569",
                    border: isActive ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
                  }}
                >
                  {c}
                </div>
              );
            })}
          </div>

          {/* 移动端笔记列表流 */}
          <Spin spinning={isLoading && logs.length === 0}>
            {groupedLogs.length === 0 && !isLoading ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "40px 16px",
                  border: "1px solid #E2E8F0",
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                <MobileEmpty
                  description={
                    <span style={{ color: "#94A3B8", fontSize: 13 }}>
                      {searchKw || selectedClass !== "ALL" || dateFilterMode !== "all"
                        ? "没有匹配的课堂笔记"
                        : "暂无笔记记录，上完课记一笔吧"}
                    </span>
                  }
                />
                <Button
                  type="primary"
                  onClick={handleCreateNew}
                  style={{
                    marginTop: 14,
                    background: "#4F46E5",
                    borderColor: "#4F46E5",
                    borderRadius: 18,
                    fontSize: 13,
                  }}
                >
                  记录第一条笔记
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {groupedLogs.map((group) => {
                  const weekName = WEEKDAY_NAMES[dayjs(group.date).day()];
                  const isToday = group.date === dayjs().format("YYYY-MM-DD");

                  return (
                    <div key={group.date}>
                      {/* 日期组分组标题 */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 6,
                          paddingLeft: 2,
                        }}
                      >
                        <CalendarOutlined style={{ color: isToday ? "#4F46E5" : "#64748B", fontSize: 12 }} />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: isToday ? "#4F46E5" : "#334155",
                          }}
                        >
                          {group.date} {weekName}
                        </span>
                        {isToday && (
                          <Tag color="purple" style={{ margin: 0, borderRadius: 10, fontSize: 10, padding: "0 6px" }}>
                            今天
                          </Tag>
                        )}
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>({group.items.length} 节)</span>
                      </div>

                      {/* 卡片列表 */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {group.items.map((log) => (
                          <div
                            key={log.id}
                            onClick={() => handleEditRecord(log)}
                            style={{
                              background: "#FFFFFF",
                              borderRadius: 12,
                              padding: "12px 14px",
                              border: "1px solid #E2E8F0",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {/* 卡片顶部：节次、班级与删除按钮 */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 6,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Tag
                                  color="blue"
                                  style={{
                                    margin: 0,
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    padding: "1px 6px",
                                  }}
                                >
                                  {log.period || log.节次}
                                </Tag>
                                <Tag
                                  color="cyan"
                                  style={{
                                    margin: 0,
                                    borderRadius: 6,
                                    fontWeight: 600,
                                    fontSize: 12,
                                    padding: "1px 6px",
                                  }}
                                >
                                  {log.class_name || log.班级}
                                </Tag>
                              </div>

                              <div
                                style={{ display: "flex", alignItems: "center", gap: 2 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined style={{ color: "#4F46E5" }} />}
                                  onClick={() => handleEditRecord(log)}
                                  style={{ padding: "0 6px", fontSize: 12 }}
                                >
                                  编辑
                                </Button>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleMobileDelete(log)}
                                  style={{ padding: "0 6px", fontSize: 12 }}
                                />
                              </div>
                            </div>

                            {/* 卡片内容与标签 */}
                            {renderFormattedContent(log.content || log.内容)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* 移动端上拉触底加载下一页 */}
                <InfiniteScroll
                  loadMore={async () => {
                    await fetchNextPage();
                  }}
                  hasMore={Boolean(hasNextPage)}
                />
              </div>
            )}
          </Spin>

          {/* 移动端吸附右侧可拖拽添加按钮 (FloatingBubble) */}
          <FloatingBubble
            axis="xy"
            magnetic="x"
            style={{
              "--initial-position-right": "20px",
              "--initial-position-bottom": "88px",
              "--z-index": "999",
              "--size": "54px",
              "--edge-distance": "16px",
              "--border-radius": "27px",
              "--background": "linear-gradient(135deg, #4F46E5, #6366F1)",
              boxShadow: "0 6px 18px rgba(79, 70, 229, 0.45)",
            }}
            onClick={() => {
              triggerHaptic("medium");
              handleCreateNew();
            }}
          >
            <PlusOutlined style={{ fontSize: 24, color: "#fff" }} />
          </FloatingBubble>

          <LessonLogDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            lessonContext={activeContext}
            allowEditContext={allowEditContext}
            onSuccess={refreshLogs}
          />
        </div>
      </PullToRefresh>
    );
  }

  // -------------------------------------------------------------
  // 💻 PC 桌面端布局视图（服务端分页器 + 筛选下沉）
  // -------------------------------------------------------------
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
                记录授课进度、课后作业及随堂要点（服务端实时查询与真分页）
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetchPc()}
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
              <Button
                type="primary"
                onClick={handleCreateNew}
                style={{ background: "#4F46E5", borderColor: "#4F46E5", borderRadius: 8 }}
              >
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
                              {log.period || log.节次}
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
                              {log.class_name || log.班级}
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
                        {renderFormattedContent(log.content || log.内容)}
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* PC 端服务端真分页器 */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <Pagination
                current={pcPage}
                pageSize={pcPageSize}
                total={totalCount}
                showTotal={(total) => `共 ${total} 条笔记`}
                onChange={(p, ps) => {
                  setPcPage(p);
                  setPcPageSize(ps);
                }}
              />
            </div>
          </div>
        )}
      </Spin>

      {/* 课堂笔记底部抽屉 */}
      <LessonLogDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lessonContext={activeContext}
        allowEditContext={allowEditContext}
        onSuccess={refreshLogs}
      />
    </div>
  );
}
