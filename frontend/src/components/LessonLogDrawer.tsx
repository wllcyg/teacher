import React, { useState, useEffect } from "react";
import { Drawer, Button, Input, Tag, Space, message, Spin, Popconfirm, DatePicker, Select } from "antd";
import {
  BookOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTable, createRow, updateRow, deleteRow } from "../api";
import { useClasses, usePeriods } from "../hooks";

export interface LessonContext {
  日期: string;
  班级: string;
  节次: string | number;
  科目?: string;
}

interface LessonLogDrawerProps {
  open: boolean;
  onClose: () => void;
  lessonContext: LessonContext | null;
  onSuccess?: () => void;
  allowEditContext?: boolean;
}

const QUICK_TAGS = [
  "新课讲授",
  "重点复习",
  "随堂测验",
  "作业布置",
  "纪律良好",
  "进度正常",
  "重难点答疑",
];

export const LessonLogDrawer: React.FC<LessonLogDrawerProps> = ({
  open,
  onClose,
  lessonContext,
  onSuccess,
  allowEditContext = false,
}) => {
  const qc = useQueryClient();
  const classes = useClasses();
  const periods = usePeriods();

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 当允许编辑上下文（补录/自定义）时的独立选择状态
  const [customDate, setCustomDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [customClass, setCustomClass] = useState<string>("");
  const [customPeriod, setCustomPeriod] = useState<string>("第1节");

  useEffect(() => {
    if (open) {
      if (lessonContext) {
        setCustomDate(lessonContext.日期 || dayjs().format("YYYY-MM-DD"));
        setCustomClass(lessonContext.班级 || (classes[0] || ""));
        const pStr = String(lessonContext.节次);
        setCustomPeriod(pStr.startsWith("第") ? pStr : `第${pStr}节`);
      } else {
        setCustomDate(dayjs().format("YYYY-MM-DD"));
        setCustomClass(classes[0] || "");
        setCustomPeriod("第1节");
      }
    }
  }, [open, lessonContext, classes]);

  const activeDate = allowEditContext ? customDate : lessonContext?.日期 || "";
  const activeClass = allowEditContext ? customClass : lessonContext?.班级 || "";
  const activePeriod = allowEditContext
    ? customPeriod
    : lessonContext
    ? String(lessonContext.节次).startsWith("第")
      ? String(lessonContext.节次)
      : `第${lessonContext.节次}节`
    : "";

  const queryFilters = activeDate && activeClass && activePeriod
    ? {
        日期: activeDate,
        班级: activeClass,
        节次: activePeriod,
      }
    : null;

  // 查询该节课是否已有记录
  const { data: logs, isLoading: loadingLog } = useQuery({
    queryKey: ["lesson_log", queryFilters],
    queryFn: () => listTable("lesson_log", queryFilters as Record<string, string>),
    enabled: open && !!queryFilters,
    staleTime: 0,
  });

  const existingRecord = logs && logs.length > 0 ? logs[0] : null;

  useEffect(() => {
    if (open) {
      if (existingRecord) {
        setContent(existingRecord.内容 || "");
      } else {
        setContent("");
      }
    }
  }, [open, existingRecord]);

  const handleInsertTag = (tag: string) => {
    setContent((prev) => {
      const prefix = `【${tag}】`;
      if (prev.includes(prefix)) return prev;
      return prev ? `${prev} ${prefix} ` : `${prefix} `;
    });
  };

  const handleSave = async () => {
    if (!activeDate || !activeClass || !activePeriod) {
      message.warning("请完善日期、班级和节次信息");
      return;
    }
    if (!content.trim()) {
      message.warning("请输入课堂记录内容");
      return;
    }

    setSaving(true);
    try {
      if (existingRecord) {
        await updateRow("lesson_log", existingRecord.id, {
          内容: content.trim(),
        });
      } else {
        await createRow("lesson_log", {
          日期: activeDate,
          班级: activeClass,
          节次: activePeriod,
          内容: content.trim(),
        });
      }
      message.success("已保存课堂记录");
      qc.invalidateQueries({ queryKey: ["lesson_log"] });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRecord) return;
    setDeleting(true);
    try {
      await deleteRow("lesson_log", existingRecord.id);
      message.success("已删除课堂记录");
      setContent("");
      qc.invalidateQueries({ queryKey: ["lesson_log"] });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      placement="bottom"
      height="auto"
      open={open}
      onClose={onClose}
      destroyOnClose
      styles={{
        content: {
          maxWidth: 600,
          margin: "0 auto",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: "hidden",
          maxHeight: "85vh",
        },
        header: {
          padding: "16px 20px 12px",
          borderBottom: "1px solid #F1F5F9",
        },
        body: {
          padding: "16px 20px 24px",
          overflowY: "auto",
        },
      }}
      title={
        allowEditContext ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#EEF2FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4F46E5",
                  fontSize: 16,
                }}
              >
                <BookOutlined />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>
                {existingRecord ? "编辑课堂记录" : "补录课堂记录"}
              </div>
            </div>
            {existingRecord && (
              <Tag color="success" icon={<CheckCircleFilled />} style={{ margin: 0, borderRadius: 12 }}>
                已记录
              </Tag>
            )}
          </div>
        ) : lessonContext ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#EEF2FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4F46E5",
                  fontSize: 16,
                }}
              >
                <BookOutlined />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", lineHeight: 1.2 }}>
                  {activePeriod} · {activeClass} {lessonContext.科目 ? `· ${lessonContext.科目}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  {activeDate} 课堂记录
                </div>
              </div>
            </div>
            {existingRecord && (
              <Tag color="success" icon={<CheckCircleFilled />} style={{ margin: 0, borderRadius: 12 }}>
                已记录
              </Tag>
            )}
          </div>
        ) : (
          "课堂记录"
        )
      }
    >
      <Spin spinning={loadingLog}>
        {/* 手动补录时的班级/节次/日期选择器 */}
        {allowEditContext && (
          <div
            style={{
              marginBottom: 14,
              background: "#F8FAFC",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #E2E8F0",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>日期</div>
                <DatePicker
                  value={activeDate ? dayjs(activeDate) : dayjs()}
                  onChange={(d) => d && setCustomDate(d.format("YYYY-MM-DD"))}
                  allowClear={false}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>班级</div>
                <Select
                  value={activeClass || undefined}
                  onChange={(val) => setCustomClass(val)}
                  placeholder="选择班级"
                  style={{ width: "100%" }}
                  options={classes.map((c) => ({ label: c, value: c }))}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>节次</div>
                <Select
                  value={activePeriod}
                  onChange={(val) => setCustomPeriod(val)}
                  style={{ width: "100%" }}
                  options={periods.map((p) => ({
                    label: `第${p.n}节`,
                    value: `第${p.n}节`,
                  }))}
                />
              </div>
            </div>
          </div>
        )}
        {/* 快捷输入标签栏 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>快捷短语标签（点击插入）：</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_TAGS.map((tag) => (
              <Tag
                key={tag}
                style={{
                  cursor: "pointer",
                  borderRadius: 12,
                  padding: "2px 10px",
                  fontSize: 13,
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  color: "#334155",
                  userSelect: "none",
                }}
                onClick={() => handleInsertTag(tag)}
              >
                + {tag}
              </Tag>
            ))}
          </div>
        </div>

        {/* 文本输入框 */}
        <Input.TextArea
          rows={4}
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录本节课讲授进度、课后作业、随堂突出情况等（如：完成第3课练习册P20，小测均分88分）..."
          showCount
          maxLength={300}
          style={{
            borderRadius: 8,
            fontSize: 15,
            padding: "10px 12px",
            lineHeight: 1.5,
          }}
        />

        {/* 底部按钮栏 */}
        <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
          {existingRecord && (
            <Popconfirm
              title="确定删除这条课堂记录吗？"
              onConfirm={handleDelete}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="large"
                loading={deleting}
                style={{ borderRadius: 8 }}
              >
                删除
              </Button>
            </Popconfirm>
          )}

          <Button
            type="primary"
            size="large"
            block
            loading={saving}
            icon={existingRecord ? <EditOutlined /> : <BookOutlined />}
            onClick={handleSave}
            style={{
              borderRadius: 8,
              background: "#4F46E5",
              borderColor: "#4F46E5",
              fontWeight: 600,
            }}
          >
            {existingRecord ? "更新记录" : "保存课堂记录"}
          </Button>
        </div>
      </Spin>
    </Drawer>
  );
};
export default LessonLogDrawer;
