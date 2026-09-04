import { useMemo, useState } from "react";
import {
  Button,
  Select,
  Modal,
  Form,
  Input,
  Popconfirm,
  message,
  Grid,
  Segmented,
  Space,
  Tag,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CalendarOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import { useCurrentClass, usePeriods } from "../hooks";
import { WEEKDAYS } from "../periods";
import type { Row } from "../types";
import { triggerHaptic } from "../utils/haptics";

export default function Schedule() {
  const { 班级 } = useCurrentClass();
  const periods = usePeriods();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => listTable("schedule"),
  });

  // 按 (星期, 节次) 索引课程
  const cellMap = useMemo(() => {
    const map = new Map<string, Row>();
    (data ?? []).forEach((r: Row) => {
      const key = `${r.星期}-${String(r.节次).replace(/第|节/g, "").trim()}`;
      map.set(key, r);
    });
    return map;
  }, [data]);

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const todayDayIndex = dayjs().day();
  const defaultDay =
    todayDayIndex >= 1 && todayDayIndex <= 5 ? WEEKDAYS[todayDayIndex - 1] : "周一";
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay);
  const [mobileViewMode, setMobileViewMode] = useState<"single" | "all">("single");

  const save = useMutation({
    mutationFn: (v: Record<string, string>) =>
      editing ? updateRow("schedule", editing.id, v) : createRow("schedule", v),
    onSuccess: () => {
      triggerHaptic("success");
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("schedule", id),
    onSuccess: () => {
      triggerHaptic("warning");
      message.success("已删除");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const openAdd = (day: string, period: number) => {
    triggerHaptic("light");
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ 星期: day, 节次: String(period), 班级: 班级 || "", 科目: "" });
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    triggerHaptic("light");
    setEditing(r);
    form.setFieldsValue(r);
    setOpen(true);
  };

  return (
    <div className="page">
      <h2 className="page-title">课表</h2>
      <div className="page-sub">点击空格添加课程，点击卡片编辑或删除</div>

      {/* 移动端视图切换条 */}
      {isMobile && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Segmented
              size="small"
              options={[
                { label: "单日课表", value: "single", icon: <CalendarOutlined /> },
                { label: "全周矩阵", value: "all", icon: <TableOutlined /> },
              ]}
              value={mobileViewMode}
              onChange={(v) => {
                setMobileViewMode(v as "single" | "all");
                triggerHaptic("light");
              }}
            />
            {mobileViewMode === "single" && (
              <Tag color="blue" style={{ margin: 0 }}>
                {selectedDay === defaultDay ? `${selectedDay}（今天）` : selectedDay}
              </Tag>
            )}
          </div>

          {mobileViewMode === "single" && (
            <Segmented
              block
              options={WEEKDAYS.map((d) => ({
                label: d === defaultDay ? `${d} (今)` : d,
                value: d,
              }))}
              value={selectedDay}
              onChange={(v) => {
                setSelectedDay(v as string);
                triggerHaptic("light");
              }}
            />
          )}
        </div>
      )}

      {/* 移动端单日卡片纵向流 */}
      {isMobile && mobileViewMode === "single" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {periods.map((p) => {
            const key = `${selectedDay}-${p.n}`;
            const lesson = cellMap.get(key);
            return (
              <div
                key={key}
                onClick={() => (lesson ? openEdit(lesson) : openAdd(selectedDay, p.n))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: lesson ? "#f6ffed" : "#ffffff",
                  border: lesson ? "1.5px solid #b7eb8f" : "1px dashed #cbd5e1",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  cursor: "pointer",
                  touchAction: "manipulation",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: lesson ? "#e6f4ff" : "#f1f5f9",
                      borderRadius: 8,
                      width: 52,
                      height: 50,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      第{p.n}节
                    </span>
                    <span style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                      {p.time.split("-")[0]}
                    </span>
                  </div>

                  <div>
                    {lesson ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                          {lesson.科目}
                          <Tag color="green" style={{ marginLeft: 8, fontWeight: 500, fontSize: 11 }}>
                            {lesson.班级}
                          </Tag>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                          起止时间：{p.time}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        本节无排课 · 点击快速排课
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {lesson ? (
                    <Button size="small" type="text" icon={<EditOutlined style={{ color: "#2f6fed" }} />} />
                  ) : (
                    <Button size="small" type="dashed" icon={<PlusOutlined />} shape="circle" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 全周大矩阵（桌面端默认展示，手机端切到全周模式时横滑展示） */
        <div
          style={{
            background: "#faf7f2",
            borderRadius: 16,
            padding: 16,
            marginTop: 16,
            overflowX: "auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px repeat(5, minmax(140px, 1fr))",
              gap: 8,
              minWidth: 820,
            }}
          >
            {/* 表头 */}
            <div style={{ fontWeight: 600, color: "#8c8c8c", padding: "12px 8px" }}>节次</div>
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#595959",
                  padding: "12px 8px",
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: 8,
                }}
              >
                {d}
              </div>
            ))}

            {/* 节次行 */}
            {periods.map((p) => (
              <>
                <div
                  key={`label-${p.n}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "8px",
                    color: "#595959",
                    fontWeight: 500,
                  }}
                >
                  <span>第{p.n}节</span>
                  <span style={{ fontSize: 12, color: "#bfbfbf", marginTop: 2 }}>{p.time}</span>
                </div>
                {WEEKDAYS.map((d) => {
                  const key = `${d}-${p.n}`;
                  const lesson = cellMap.get(key);
                  return (
                    <div
                      key={key}
                      onClick={() => (lesson ? openEdit(lesson) : openAdd(d, p.n))}
                      style={{
                        minHeight: 72,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        background: lesson ? "#e8f5e9" : "rgba(255,255,255,0.5)",
                        border: lesson ? "1px solid #c8e6c9" : "1px dashed #d9d9d9",
                      }}
                      onMouseEnter={(e) => {
                        if (!lesson) e.currentTarget.style.background = "rgba(255,255,255,0.9)";
                      }}
                      onMouseLeave={(e) => {
                        if (!lesson) e.currentTarget.style.background = "rgba(255,255,255,0.5)";
                      }}
                    >
                      {lesson ? (
                        <div style={{ textAlign: "center", padding: "4px 8px" }}>
                          <div style={{ fontWeight: 600, color: "#2e7d32", fontSize: 15 }}>
                            {lesson.班级}
                          </div>
                          <div style={{ color: "#558b2f", fontSize: 13, marginTop: 2 }}>
                            {lesson.科目}
                          </div>
                        </div>
                      ) : (
                        <PlusOutlined style={{ color: "#bfbfbf", fontSize: 18 }} />
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}

      <Modal
        title={editing ? "编辑课程" : "添加课程"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
        footer={[
          editing && (
            <Popconfirm key="del" title="确定删除？" onConfirm={() => del.mutate(editing.id)}>
              <Button danger icon={<DeleteOutlined />} style={{ float: "left" }}>
                删除
              </Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={() => setOpen(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={() => form.submit()} loading={save.isPending}>
            保存
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="星期" label="星期" rules={[{ required: true }]}>
            <Select options={WEEKDAYS.map((d) => ({ value: d, label: d }))} />
          </Form.Item>
          <Form.Item name="节次" label="节次" rules={[{ required: true }]}>
            <Select options={periods.map((p) => ({ value: String(p.n), label: `第${p.n}节 (${p.time})` }))} />
          </Form.Item>
          <Form.Item name="班级" label="班级" rules={[{ required: true }]}>
            <Input placeholder="例如：八4班" />
          </Form.Item>
          <Form.Item name="科目" label="科目" rules={[{ required: true }]}>
            <Input placeholder="例如：地理" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
