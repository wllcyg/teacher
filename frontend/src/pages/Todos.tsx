import { useMemo, useState } from "react";
import {
  Table,
  Button,
  Select,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Tag,
  DatePicker,
  Segmented,
  Empty,
  Badge,
  Tooltip,
  Pagination,
} from "antd";
import { AdaptiveModal } from "../components/AdaptiveModal";
import { PullToRefresh, Toast } from "antd-mobile";
import {
  PlusOutlined,
  CheckCircleFilled,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  BarsOutlined,
  CalendarOutlined,
  FireOutlined,
  CheckOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import type { Row } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { useIsMobileOrTablet } from "../hooks";

const KINDS = ["教学", "行政", "家校", "班务"];

// 类别彩色配置（柔和马卡龙/现代标签风格）
const KIND_THEMES: Record<string, { color: string; bg: string; border: string }> = {
  教学: { color: "#1677ff", bg: "#e6f4ff", border: "#91caff" },
  班务: { color: "#722ed1", bg: "#f9f0ff", border: "#d3adf7" },
  家校: { color: "#389e0d", bg: "#f6ffed", border: "#b7eb8f" },
  行政: { color: "#d46b08", bg: "#fff7e6", border: "#ffd591" },
};

export default function Todos() {
  const qc = useQueryClient();
  const isMobile = useIsMobileOrTablet();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  // 极速随手记快捷栏输入状态
  const [quickText, setQuickText] = useState("");
  const [quickKind, setQuickKind] = useState("教学");

  // 筛选与视图模式
  const [statusFilter, setStatusFilter] = useState<string>("待办");
  const [kindFilter, setKindFilter] = useState<string>("全部");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  // 状态指标精确统计（每个轻量查询仅拉取 1 条元数据获取精准 total，彻底杜绝 1000 条大表载荷）
  const todayStr = dayjs().format("YYYY-MM-DD");
  const yesterdayStr = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const pendingCountQuery = useQuery({
    queryKey: ["todos", "count", "pending"],
    queryFn: () => listTable("todos", { status_ne: "已办", page: 1, page_size: 1 }),
    staleTime: 30 * 1000,
  });
  const doneCountQuery = useQuery({
    queryKey: ["todos", "count", "done"],
    queryFn: () => listTable("todos", { status: "已办", page: 1, page_size: 1 }),
    staleTime: 30 * 1000,
  });
  const overdueCountQuery = useQuery({
    queryKey: ["todos", "count", "overdue", yesterdayStr],
    queryFn: () =>
      listTable("todos", {
        status_ne: "已办",
        date_lte: yesterdayStr,
        page: 1,
        page_size: 1,
      }),
    staleTime: 30 * 1000,
  });

  const pendingTotal = pendingCountQuery.data?.total ?? 0;
  const doneTotal = doneCountQuery.data?.total ?? 0;
  const overdueTotal = overdueCountQuery.data?.total ?? 0;
  const allTotal = pendingTotal + doneTotal;

  // 列表数据按需分状态、分分类、分页查询
  const listQueryParams = useMemo(() => {
    const p: Record<string, any> = { page, page_size: pageSize };
    if (statusFilter === "待办") {
      p.status_ne = "已办";
    } else if (statusFilter === "已办") {
      p.status = "已办";
    }
    if (kindFilter !== "全部") {
      p.category = kindFilter;
    }
    return p;
  }, [statusFilter, kindFilter, page, pageSize]);

  const { data: pagedData, isLoading } = useQuery({
    queryKey: ["todos", "list", listQueryParams],
    queryFn: () => listTable("todos", listQueryParams),
    staleTime: 30 * 1000,
  });

  const rawList = pagedData?.items ?? [];
  const currentTotal = pagedData?.total ?? 0;

  // 保存（新增/编辑）
  const save = useMutation({
    mutationFn: (v: Record<string, string>) =>
      editing ? updateRow("todos", editing.id, v) : createRow("todos", v),
    onSuccess: () => {
      triggerHaptic("success");
      message.success(editing ? "待办已更新" : "待办已添加");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  // 删除
  const del = useMutation({
    mutationFn: (id: number) => deleteRow("todos", id),
    onSuccess: () => {
      triggerHaptic("light");
      message.success("已删除待办");
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  // 📱 下拉刷新手势处理
  const handleRefreshTodos = async () => {
    triggerHaptic("light");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["todos"] }),
      pendingCountQuery.refetch(),
      doneCountQuery.refetch(),
      overdueCountQuery.refetch(),
    ]);
    Toast.show({
      icon: "success",
      content: "已刷新待办清单",
      duration: 1200,
    });
  };

  // 快速切换「已办/未办」
  const toggle = useMutation({
    mutationFn: (r: Row) => {
      const cur = r.status || r.状态;
      const next = cur === "已办" ? "未办" : "已办";
      return updateRow("todos", r.id, { status: next, 状态: next });
    },
    onSuccess: (_, r) => {
      const cur = r.status || r.状态;
      const nextDone = cur !== "已办";
      triggerHaptic(nextDone ? "success" : "light");
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  // 极速随手记快捷新增
  const handleQuickAdd = async () => {
    const text = quickText.trim();
    if (!text) {
      message.warning("请输入待办事项内容");
      return;
    }
    try {
      await save.mutateAsync({
        title: text,
        category: quickKind,
        date: dayjs().format("YYYY-MM-DD"),
        status: "未办",
        事项: text,
        类别: quickKind,
        日期: dayjs().format("YYYY-MM-DD"),
        状态: "未办",
      });
      setQuickText("");
    } catch (e: any) {
      message.error("添加失败：" + (e?.message ?? ""));
    }
  };

  const openEditModal = (r: Row) => {
    setEditing(r);
    const d = r.date || r.日期;
    form.setFieldsValue({
      title: r.title || r.事项,
      category: r.category || r.类别 || "教学",
      status: r.status || r.状态 || "未办",
      date: d ? dayjs(d) : null,
      事项: r.title || r.事项,
      类别: r.category || r.类别 || "教学",
      状态: r.status || r.状态 || "未办",
      日期: d ? dayjs(d) : null,
    });
    setOpen(true);
  };

  const openCreateModal = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      category: "教学",
      date: dayjs(),
      status: "未办",
      类别: "教学",
      日期: dayjs(),
      状态: "未办",
    });
    setOpen(true);
  };

  // 数据统计汇总
  const counts = useMemo(() => {
    return {
      total: allTotal,
      pending: pendingTotal,
      done: doneTotal,
      overdue: overdueTotal,
    };
  }, [allTotal, pendingTotal, doneTotal, overdueTotal]);

  // 智能排序：本页未办在前（逾期的放最前，其次今天，然后未来）；已办项放后面（按日期倒序）
  const filteredData = useMemo(() => {
    return [...rawList].sort((a, b) => {
      const aDone = (a.status || a.状态) === "已办";
      const bDone = (b.status || b.状态) === "已办";
      if (aDone !== bDone) return aDone ? 1 : -1;

      if (!aDone) {
        // 未办排序
        const aDate = a.date || a.日期 || "9999-99-99";
        const bDate = b.date || b.日期 || "9999-99-99";
        return aDate.localeCompare(bDate);
      } else {
        const aDate = a.date || a.日期 || "";
        const bDate = b.date || b.日期 || "";
        return bDate.localeCompare(aDate);
      }
    });
  }, [rawList]);

  // 类别数据统计（联动当前页及分类筛选）
  const kindCounts = useMemo(() => {
    const map: Record<string, number> = { 全部: currentTotal };
    for (const k of KINDS) map[k] = 0;
    for (const r of rawList) {
      const rKind = r.category || r.类别;
      if (rKind && map[rKind] !== undefined) {
        map[rKind]++;
      }
    }
    return map;
  }, [rawList, currentTotal]);

  // 辅助解析日期徽标
  const renderDateBadge = (dateStr: string, isDone: boolean) => {
    if (!dateStr) return null;
    const target = dayjs(dateStr).startOf("day");
    const today = dayjs().startOf("day");
    const diff = target.diff(today, "day");

    if (diff === 0) {
      return (
        <Tag color={isDone ? "default" : "processing"} icon={<ClockCircleOutlined />}>
          今天
        </Tag>
      );
    }
    if (diff === 1) {
      return (
        <Tag color={isDone ? "default" : "cyan"} icon={<CalendarOutlined />}>
          明天
        </Tag>
      );
    }
    if (diff < 0) {
      return isDone ? (
        <Tag color="default">{dateStr}</Tag>
      ) : (
        <Tag color="error" icon={<FireOutlined />}>
          逾期 {Math.abs(diff)} 天
        </Tag>
      );
    }
    return (
      <Tag color="default" icon={<CalendarOutlined />}>
        {target.format("M月D日")}
      </Tag>
    );
  };

  // 传统表格列配置
  const tableColumns = [
    {
      title: "状态",
      dataIndex: "status",
      width: 70,
      render: (_: any, r: Row) => {
        const isDone = (r.status || r.状态) === "已办";
        return (
          <div
            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
            onClick={() => toggle.mutate(r)}
          >
            {isDone ? (
              <CheckCircleFilled style={{ fontSize: 20, color: "#52c41a" }} />
            ) : (
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2px solid #94a3b8",
                }}
              />
            )}
          </div>
        );
      },
    },
    {
      title: "事项",
      dataIndex: "title",
      render: (_: any, r: Row) => {
        const isDone = (r.status || r.状态) === "已办";
        const val = r.title || r.事项;
        return (
          <span
            style={{
              textDecoration: isDone ? "line-through" : "none",
              color: isDone ? "#94a3b8" : "inherit",
              fontWeight: isDone ? "normal" : 500,
            }}
          >
            {val}
          </span>
        );
      },
    },
    {
      title: "类别",
      dataIndex: "category",
      width: 90,
      render: (_: any, r: Row) => {
        const v = r.category || r.类别;
        const theme = KIND_THEMES[v];
        return theme ? (
          <Tag style={{ color: theme.color, background: theme.bg, borderColor: theme.border }}>
            {v}
          </Tag>
        ) : (
          <Tag>{v || "-"}</Tag>
        );
      },
    },
    {
      title: "日期 / 期限",
      dataIndex: "date",
      width: 130,
      render: (_: any, r: Row) => renderDateBadge(r.date || r.日期, (r.status || r.状态) === "已办"),
    },
    {
      title: "操作",
      key: "op",
      width: 120,
      render: (_: any, r: Row) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openEditModal(r)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该待办？" onConfirm={() => del.mutate(r.id)}>
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PullToRefresh onRefresh={handleRefreshTodos}>
      <div className="page" style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* 头部标题与新建入口 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="page-title" style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 700 }}>
            待办清单
          </h2>
          {counts.pending > 0 && (
            <span
              style={{
                fontSize: 12,
                background: "#eff6ff",
                color: "#2563eb",
                padding: "2px 8px",
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              {counts.pending} 待办
            </span>
          )}
          {counts.overdue > 0 && (
            <span
              style={{
                fontSize: 12,
                background: "#fef2f2",
                color: "#dc2626",
                padding: "2px 8px",
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              {counts.overdue} 逾期
            </span>
          )}
        </div>

        <Space>
          {!isMobile && (
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as any)}
              options={[
                { value: "card", label: "卡片", icon: <AppstoreOutlined /> },
                { value: "table", label: "表格", icon: <BarsOutlined /> },
              ]}
            />
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ borderRadius: 10, fontWeight: 500, height: 36 }}
          >
            {isMobile ? "新建" : "详细新建"}
          </Button>
        </Space>
      </div>

      {/* ⚡ 极速随手记输入条（全新扁平胶囊轻量卡片） */}
      <div
        style={{
          background: "#ffffff",
          padding: "5px 6px 5px 12px",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Select
          value={quickKind}
          onChange={(v) => {
            triggerHaptic("light");
            setQuickKind(v);
          }}
          variant="borderless"
          popupMatchSelectWidth={false}
          dropdownStyle={{ minWidth: 110, padding: 4 }}
          style={{ width: 94, padding: 0, fontWeight: 500 }}
          options={KINDS.map((k) => ({
            value: k,
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: KIND_THEMES[k]?.color || "#94a3b8",
                    flexShrink: 0,
                  }}
                />
                <span>{k}</span>
              </span>
            ),
          }))}
        />
        <div style={{ width: 1, height: 18, background: "#e2e8f0" }} />
        <Input
          variant="borderless"
          placeholder="随时随手记待办，按回车添加..."
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          onPressEnter={handleQuickAdd}
          allowClear
          style={{ flex: 1, padding: "4px 2px", fontSize: 14 }}
        />
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={handleQuickAdd}
          loading={save.isPending}
          style={{
            borderRadius: 10,
            height: 34,
            padding: "0 14px",
            fontWeight: 500,
            boxShadow: "none",
          }}
        >
          记下
        </Button>
      </div>

      {/* 筛选控制器：状态切换 + 类别滚动药丸 */}
      <div style={{ marginBottom: 14 }}>
        {/* 状态分段控制器 */}
        <Segmented
          block
          value={statusFilter}
          onChange={(v) => {
            triggerHaptic("light");
            setStatusFilter(v as string);
            setPage(1);
          }}
          style={{
            borderRadius: 10,
            padding: 3,
            background: "#f1f5f9",
            marginBottom: 8,
          }}
          options={[
            {
              value: "待办",
              label: (
                <span style={{ fontWeight: statusFilter === "待办" ? 600 : 400 }}>
                  待办 {counts.pending > 0 && `(${counts.pending})`}
                </span>
              ),
            },
            {
              value: "已办",
              label: (
                <span style={{ fontWeight: statusFilter === "已办" ? 600 : 400 }}>
                  已办 {counts.done > 0 && `(${counts.done})`}
                </span>
              ),
            },
            {
              value: "全部",
              label: (
                <span style={{ fontWeight: statusFilter === "全部" ? 600 : 400 }}>
                  全部 ({counts.total})
                </span>
              ),
            },
          ]}
        />

        {/* 类别横向滚动标签 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            padding: "2px 0 4px",
          }}
        >
          {["全部", ...KINDS].map((k) => {
            const isSelected = kindFilter === k;
            const theme = KIND_THEMES[k];
            const count = kindCounts[k] || 0;

            return (
              <div
                key={k}
                onClick={() => {
                  triggerHaptic("light");
                  setKindFilter(k);
                  setPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  background: isSelected ? (theme?.bg || "#eff6ff") : "#fff",
                  color: isSelected ? (theme?.color || "#2563eb") : "#64748b",
                  border: `1px solid ${isSelected ? (theme?.border || "#bfdbfe") : "#e2e8f0"}`,
                  transition: "all 0.15s ease",
                }}
              >
                {theme && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: theme.color,
                    }}
                  />
                )}
                <span>{k}</span>
                <span
                  style={{
                    fontSize: 11,
                    opacity: isSelected ? 0.9 : 0.6,
                    fontWeight: "normal",
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 主展示区：卡片清单模式 (移动端 / iPad 默认) vs 传统表格模式 */}
      {viewMode === "card" ? (
        filteredData.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #f1f5f9",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {statusFilter === "待办" ? (
              <>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#ecfdf5",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    marginBottom: 12,
                  }}
                >
                  <CheckCircleFilled />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  太棒了！所有待办均已完成 🎉
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
                  今日任务已全部清零，享受轻松时光或随手记录新事项
                </div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                  style={{ borderRadius: 10, height: 36 }}
                >
                  新建一条待办
                </Button>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#f1f5f9",
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    marginBottom: 12,
                  }}
                >
                  <ClockCircleOutlined />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  暂无相关待办记录
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
                  可以在上方输入栏随手记下新待办
                </div>
                <Button
                  type="primary"
                  ghost
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                  style={{ borderRadius: 10, height: 36 }}
                >
                  添加待办
                </Button>
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            {filteredData.map((r) => {
              const isDone = r.状态 === "已办";
              const theme = KIND_THEMES[r.类别] || {
                color: "#64748b",
                bg: "#f1f5f9",
                border: "#cbd5e1",
              };

              return (
                <div
                  key={r.id}
                  style={{
                    background: isDone ? "#f8fafc" : "#ffffff",
                    border: `1px solid ${isDone ? "#e2e8f0" : "#e2e8f0"}`,
                    borderRadius: 14,
                    padding: "13px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    boxShadow: isDone ? "none" : "0 1px 3px rgba(15, 23, 42, 0.04)",
                    transition: "all 0.18s ease",
                    position: "relative",
                  }}
                >
                  {/* 左侧大触控圆形 Checkbox */}
                  <div
                    onClick={() => toggle.mutate(r)}
                    role="button"
                    tabIndex={0}
                    style={{
                      width: 34,
                      height: 34,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      borderRadius: "50%",
                      userSelect: "none",
                      WebkitTapHighlightColor: "transparent",
                    }}
                    title={isDone ? "标记为未办" : "标记为已办"}
                  >
                    {isDone ? (
                      <CheckCircleFilled
                        style={{
                          fontSize: 23,
                          color: "#10b981",
                          transition: "transform 0.15s ease",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 21,
                          height: 21,
                          borderRadius: "50%",
                          border: "2px solid #cbd5e1",
                          background: "#fff",
                          transition: "all 0.15s ease",
                        }}
                      />
                    )}
                  </div>

                  {/* 中间核心内容 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 事项标题 */}
                    <div
                      onClick={() => toggle.mutate(r)}
                      style={{
                        fontSize: 15,
                        lineHeight: 1.45,
                        fontWeight: isDone ? 400 : 500,
                        color: isDone ? "#94a3b8" : "#0f172a",
                        textDecoration: isDone ? "line-through" : "none",
                        cursor: "pointer",
                        wordBreak: "break-word",
                        marginBottom: 6,
                      }}
                    >
                      {r.title || r.事项}
                    </div>

                    {/* 标签与日期栏 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {(r.category || r.类别) && (
                        <Tag
                          style={{
                            margin: 0,
                            color: theme.color,
                            background: theme.bg,
                            borderColor: theme.border,
                            borderRadius: 6,
                            fontSize: 11,
                            padding: "0 6px",
                          }}
                        >
                          {r.category || r.类别}
                        </Tag>
                      )}
                      {renderDateBadge(r.date || r.日期, isDone)}
                    </div>
                  </div>

                  {/* 右侧快捷动作按钮 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      flexShrink: 0,
                    }}
                  >
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        size="small"
                        shape="circle"
                        icon={<EditOutlined style={{ color: "#94a3b8" }} />}
                        onClick={() => openEditModal(r)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除该待办？"
                      onConfirm={() => del.mutate(r.id)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        size="small"
                        shape="circle"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </div>
                </div>
              );
            })}
            {currentTotal > pageSize && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={currentTotal}
                  onChange={(p) => {
                    triggerHaptic("light");
                    setPage(p);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  showSizeChanger={false}
                  size="small"
                />
              </div>
            )}
          </div>
        )
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={filteredData}
            columns={tableColumns}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: currentTotal,
              onChange: (p) => {
                triggerHaptic("light");
                setPage(p);
              },
              size: "small",
              showSizeChanger: false,
            }}
            size="middle"
            scroll={{ x: "max-content" }}
          />
        </div>
      )}

      {/* 编辑/详细新建弹窗（手机端自动下沉为底部抽屉，iPad/PC保持居中） */}
      <AdaptiveModal
        title={editing ? "编辑待办" : "新建待办"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
        maskClosable={false}
        confirmLoading={save.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => {
            const d = v.date || v.日期;
            const dateStr = d ? (dayjs.isDayjs(d) ? d.format("YYYY-MM-DD") : String(d)) : "";
            save.mutate({
              title: v.title || v.事项,
              category: v.category || v.类别 || "教学",
              status: v.status || v.状态 || "未办",
              date: dateStr,
            });
          }}
        >
          <Form.Item
            name="title"
            label="待办事项"
            rules={[{ required: true, message: "请输入待办事项内容" }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="例如：周五前收齐八4班物理学案并批改完毕"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Form.Item name="category" label="分类">
              <Select
                options={KINDS.map((k) => ({ value: k, label: k }))}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { value: "未办", label: "未办" },
                  { value: "已办", label: "已办" },
                ]}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </div>

          <Form.Item name="date" label="截止日期 / 关联日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </AdaptiveModal>
    </div>
    </PullToRefresh>
  );
}
