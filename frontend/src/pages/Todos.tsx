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
} from "antd";
import { AdaptiveModal } from "../components/AdaptiveModal";
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

  // 数据查询
  const { data = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: () => listTable("todos"),
  });

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

  // 快速切换「已办/未办」
  const toggle = useMutation({
    mutationFn: (r: Row) =>
      updateRow("todos", r.id, { 状态: r.状态 === "已办" ? "未办" : "已办" }),
    onSuccess: (_, r) => {
      const nextDone = r.状态 !== "已办";
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
    form.setFieldsValue({
      ...r,
      日期: r.日期 ? dayjs(r.日期) : null,
    });
    setOpen(true);
  };

  const openCreateModal = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      类别: "教学",
      日期: dayjs(),
      状态: "未办",
    });
    setOpen(true);
  };

  // 数据统计
  const counts = useMemo(() => {
    const total = data.length;
    let pending = 0;
    let done = 0;
    let overdue = 0;
    const todayStr = dayjs().format("YYYY-MM-DD");

    for (const r of data) {
      const isDone = r.状态 === "已办";
      if (isDone) {
        done++;
      } else {
        pending++;
        if (r.日期 && r.日期 < todayStr) {
          overdue++;
        }
      }
    }
    return { total, pending, done, overdue };
  }, [data]);

  // 智能过滤与排序（紧要待办优先）
  const filteredData = useMemo(() => {
    const todayStr = dayjs().format("YYYY-MM-DD");

    let list = data.filter((r) => {
      // 状态筛选
      if (statusFilter === "待办" && r.状态 === "已办") return false;
      if (statusFilter === "已办" && r.状态 !== "已办") return false;
      // 类别筛选
      if (kindFilter !== "全部" && r.类别 !== kindFilter) return false;
      return true;
    });

    // 智能排序：
    // 未办在前（逾期的放最前，其次今天，然后未来）；已办项放后面（按日期倒序）
    return list.sort((a, b) => {
      const aDone = a.状态 === "已办";
      const bDone = b.状态 === "已办";
      if (aDone !== bDone) return aDone ? 1 : -1;

      if (!aDone) {
        // 未办排序
        const aDate = a.日期 || "9999-99-99";
        const bDate = b.日期 || "9999-99-99";
        return aDate.localeCompare(bDate);
      } else {
        // 已办排序：后完成的排前面
        const aDate = a.日期 || "";
        const bDate = b.日期 || "";
        return bDate.localeCompare(aDate);
      }
    });
  }, [data, statusFilter, kindFilter]);

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
      dataIndex: "状态",
      width: 70,
      render: (_: any, r: Row) => {
        const isDone = r.状态 === "已办";
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
      dataIndex: "事项",
      render: (v: string, r: Row) => {
        const isDone = r.状态 === "已办";
        return (
          <span
            style={{
              textDecoration: isDone ? "line-through" : "none",
              color: isDone ? "#94a3b8" : "inherit",
              fontWeight: isDone ? "normal" : 500,
            }}
          >
            {v}
          </span>
        );
      },
    },
    {
      title: "类别",
      dataIndex: "类别",
      width: 90,
      render: (v: string) => {
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
      dataIndex: "日期",
      width: 130,
      render: (v: string, r: Row) => renderDateBadge(v, r.状态 === "已办"),
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
    <div className="page" style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* 头部标题与操作 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 className="page-title" style={{ margin: 0 }}>
              待办清单
            </h2>
            {counts.pending > 0 && (
              <Badge
                count={`${counts.pending} 件待办`}
                style={{ backgroundColor: "#1677ff", fontWeight: "normal" }}
              />
            )}
            {counts.overdue > 0 && (
              <Badge
                count={`${counts.overdue} 件逾期`}
                style={{ backgroundColor: "#ff4d4f", fontWeight: "normal" }}
              />
            )}
          </div>
          <div className="page-sub" style={{ margin: "4px 0 0" }}>
            轻点左侧圆圈快速打钩完成 · 单手高效随手记
          </div>
        </div>

        <Space wrap>
          {/* 视图切换按钮 */}
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as any)}
            options={[
              { value: "card", label: "卡片模式", icon: <AppstoreOutlined /> },
              { value: "table", label: "表格模式", icon: <BarsOutlined /> },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            详细新建
          </Button>
        </Space>
      </div>

      {/* ⚡ 极速随手记输入条（移动端/iPad 体验核心） */}
      <div
        style={{
          background: "#ffffff",
          padding: "10px 14px",
          borderRadius: 14,
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
          border: "1px solid #e2e8f0",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Select
            value={quickKind}
            onChange={setQuickKind}
            style={{ width: 88, flexShrink: 0 }}
            options={KINDS.map((k) => ({ value: k, label: k }))}
          />
          <Input
            placeholder="随时随手记待办，按回车速记..."
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onPressEnter={handleQuickAdd}
            allowClear
            style={{ borderRadius: 8 }}
          />
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleQuickAdd}
            loading={save.isPending}
            style={{ flexShrink: 0, borderRadius: 8 }}
          >
            记下
          </Button>
        </div>
      </div>

      {/* 筛选控制器：状态分段 + 类别筛选药丸 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {/* 状态分段器 */}
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as string)}
          options={[
            {
              value: "待办",
              label: (
                <div style={{ padding: "0 4px" }}>
                  <span>待办</span>
                  {counts.pending > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: "#1677ff",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    >
                      {counts.pending}
                    </span>
                  )}
                </div>
              ),
            },
            {
              value: "全部",
              label: `全部 (${counts.total})`,
            },
            {
              value: "已办",
              label: `已办 (${counts.done})`,
            },
          ]}
        />

        {/* 类别药丸 */}
        <Space size={6} wrap>
          {["全部", ...KINDS].map((k) => {
            const isSelected = kindFilter === k;
            return (
              <Tag.CheckableTag
                key={k}
                checked={isSelected}
                onChange={() => setKindFilter(k)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {k}
              </Tag.CheckableTag>
            );
          })}
        </Space>
      </div>

      {/* 主展示区：卡片清单模式 (移动端 / iPad 默认) vs 传统表格模式 */}
      {viewMode === "card" ? (
        filteredData.length === 0 ? (
          <div
            style={{
              padding: "48px 16px",
              background: "#fff",
              borderRadius: 16,
              border: "1px dashed #cbd5e1",
              textAlign: "center",
            }}
          >
            <Empty
              description={
                statusFilter === "待办"
                  ? "太棒了！所有待办均已完成 🎉"
                  : "当前暂无待办事项"
              }
            >
              <Button type="primary" ghost icon={<PlusOutlined />} onClick={openCreateModal}>
                新建一条待办
              </Button>
            </Empty>
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
                    background: isDone ? "#fafafa" : "#ffffff",
                    border: `1px solid ${isDone ? "#e2e8f0" : "#cbd5e1"}`,
                    borderRadius: 14,
                    padding: "14px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    boxShadow: isDone
                      ? "none"
                      : "0 2px 6px rgba(0, 0, 0, 0.03)",
                    transition: "all 0.2s ease",
                    position: "relative",
                  }}
                >
                  {/* 左侧大触控圆形 Checkbox（44px 触控靶心） */}
                  <div
                    onClick={() => toggle.mutate(r)}
                    role="button"
                    tabIndex={0}
                    style={{
                      width: 36,
                      height: 36,
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
                          fontSize: 24,
                          color: "#52c41a",
                          transition: "transform 0.15s ease",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: "2px solid #94a3b8",
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
                        color: isDone ? "#94a3b8" : "#1e293b",
                        textDecoration: isDone ? "line-through" : "none",
                        cursor: "pointer",
                        wordBreak: "break-word",
                        marginBottom: 6,
                      }}
                    >
                      {r.事项}
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
                      {r.类别 && (
                        <Tag
                          style={{
                            margin: 0,
                            color: theme.color,
                            background: theme.bg,
                            borderColor: theme.border,
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          {r.类别}
                        </Tag>
                      )}
                      {renderDateBadge(r.日期, isDone)}
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
                        icon={<EditOutlined style={{ color: "#64748b" }} />}
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
            pagination={{ pageSize: 15 }}
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
        confirmLoading={save.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) =>
            save.mutate({
              ...v,
              日期: v.日期 ? v.日期.format("YYYY-MM-DD") : "",
            })
          }
        >
          <Form.Item
            name="事项"
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
            <Form.Item name="类别" label="分类">
              <Select
                options={KINDS.map((k) => ({ value: k, label: k }))}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item name="状态" label="状态">
              <Select
                options={[
                  { value: "未办", label: "未办" },
                  { value: "已办", label: "已办" },
                ]}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </div>

          <Form.Item name="日期" label="截止日期 / 关联日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </AdaptiveModal>
    </div>
  );
}
