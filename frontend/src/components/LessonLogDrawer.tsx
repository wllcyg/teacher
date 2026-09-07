import React, { useState, useEffect, useMemo } from "react";
import { Drawer, Button, Input, Tag, message, Spin, Popconfirm } from "antd";
import { Toast, DatePicker as MobileDatePicker, Dialog } from "antd-mobile";
import {
  BookOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTable, createRow, updateRow, deleteRow } from "../api";
import { useClasses, usePeriods, useIsMobileOrTablet } from "../hooks";
import { triggerHaptic } from "../utils/haptics";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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
  const isMobile = useIsMobileOrTablet();
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
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // 关键修复：仅在抽屉打开时基于传入的 lessonContext 初始化一次初值，
  // 避免输入内容或选择节次触发重新渲染时导致 customPeriod 被反复打回默认值
  useEffect(() => {
    if (open) {
      setCustomDate(lessonContext?.日期 || dayjs().format("YYYY-MM-DD"));
      setCustomClass(lessonContext?.班级 || (classes[0] || ""));
      const pRaw = lessonContext?.节次;
      const pStr = pRaw !== undefined && pRaw !== null ? String(pRaw) : "第1节";
      setCustomPeriod(pStr.startsWith("第") ? pStr : `第${pStr}节`);
    }
  }, [open]);

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

  // 1. 优先从父级已有的全局缓存中毫秒级本地查找（0 延迟、0 网络请求）
  const allCachedLogs = qc.getQueryData<any[]>(["lesson_log"]);

  const cachedMatch = useMemo(() => {
    if (!allCachedLogs || !activeDate || !activeClass || !activePeriod) return null;
    const targetPeriodNum = String(activePeriod).replace(/第|节/g, "");
    return (
      allCachedLogs.find(
        (r) =>
          r.日期 === activeDate &&
          r.班级 === activeClass &&
          (r.节次 === activePeriod || String(r.节次).replace(/第|节/g, "") === targetPeriodNum)
      ) || null
    );
  }, [allCachedLogs, activeDate, activeClass, activePeriod]);

  // 2. 只有在本地没有全局缓存时（例如独立页面），才向服务端发起单条查询，并设置 60s 缓存
  const { data: remoteLogs, isLoading: loadingLog } = useQuery({
    queryKey: ["lesson_log", queryFilters],
    queryFn: () => listTable("lesson_log", queryFilters as Record<string, string>),
    enabled: open && !allCachedLogs && !!queryFilters,
    staleTime: 60 * 1000,
  });

  const existingRecord = allCachedLogs
    ? cachedMatch
    : remoteLogs && remoteLogs.length > 0
    ? remoteLogs[0]
    : null;

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
    triggerHaptic("light");
    setContent((prev) => {
      const prefix = `【${tag}】`;
      if (prev.includes(prefix)) return prev;
      return prev ? `${prev} ${prefix} ` : `${prefix} `;
    });
  };

  const handleSave = async () => {
    if (!activeDate || !activeClass || !activePeriod) {
      const msg = "请完善日期、班级和节次信息";
      if (isMobile) Toast.show({ content: msg, icon: "fail" });
      else message.warning(msg);
      return;
    }
    if (!content.trim()) {
      const msg = "请输入课堂记录内容";
      if (isMobile) Toast.show({ content: msg, icon: "fail" });
      else message.warning(msg);
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
      triggerHaptic("success");
      if (isMobile) {
        Toast.show({ icon: "success", content: "已保存课堂记录", duration: 1500 });
      } else {
        message.success("已保存课堂记录");
      }
      qc.invalidateQueries({ queryKey: ["lesson_log"] });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      triggerHaptic("warning");
      const errDetail = err?.response?.data?.detail || "保存失败，请稍后重试";
      if (isMobile) {
        Toast.show({ icon: "fail", content: errDetail });
      } else {
        message.error(errDetail);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRecord) return;
    setDeleting(true);
    try {
      await deleteRow("lesson_log", existingRecord.id);
      triggerHaptic("success");
      if (isMobile) {
        Toast.show({ icon: "success", content: "已删除课堂记录", duration: 1500 });
      } else {
        message.success("已删除课堂记录");
      }
      setContent("");
      qc.invalidateQueries({ queryKey: ["lesson_log"] });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      triggerHaptic("warning");
      const errDetail = err?.response?.data?.detail || "删除失败";
      if (isMobile) {
        Toast.show({ icon: "fail", content: errDetail });
      } else {
        message.error(errDetail);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleMobileConfirmDelete = () => {
    if (!existingRecord) return;
    triggerHaptic("warning");
    Dialog.confirm({
      title: "确定删除此课堂记录？",
      content: `${activeDate} ${activePeriod} (${activeClass}) 的记录将被彻底删除。`,
      confirmText: "删除",
      cancelText: "取消",
      onConfirm: async () => {
        await handleDelete();
      },
    });
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
        {/* 手动补录时的班级/节次/日期选择器（全面贴合移动端触控设计） */}
        {allowEditContext && (
          <div
            style={{
              marginBottom: 16,
              background: "#F8FAFC",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* 1. 日期选择区 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>授课日期</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <span
                    onClick={() => {
                      triggerHaptic("light");
                      setCustomDate(dayjs().format("YYYY-MM-DD"));
                    }}
                    style={{
                      fontSize: 12,
                      padding: "2px 10px",
                      borderRadius: 12,
                      cursor: "pointer",
                      background: activeDate === dayjs().format("YYYY-MM-DD") ? "#EEF2FF" : "#FFFFFF",
                      color: activeDate === dayjs().format("YYYY-MM-DD") ? "#4F46E5" : "#64748B",
                      border: activeDate === dayjs().format("YYYY-MM-DD") ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
                      fontWeight: activeDate === dayjs().format("YYYY-MM-DD") ? 600 : 400,
                    }}
                  >
                    今天
                  </span>
                  <span
                    onClick={() => {
                      triggerHaptic("light");
                      setCustomDate(dayjs().subtract(1, "day").format("YYYY-MM-DD"));
                    }}
                    style={{
                      fontSize: 12,
                      padding: "2px 10px",
                      borderRadius: 12,
                      cursor: "pointer",
                      background: activeDate === dayjs().subtract(1, "day").format("YYYY-MM-DD") ? "#EEF2FF" : "#FFFFFF",
                      color: activeDate === dayjs().subtract(1, "day").format("YYYY-MM-DD") ? "#4F46E5" : "#64748B",
                      border: activeDate === dayjs().subtract(1, "day").format("YYYY-MM-DD") ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
                      fontWeight: activeDate === dayjs().subtract(1, "day").format("YYYY-MM-DD") ? 600 : 400,
                    }}
                  >
                    昨天
                  </span>
                </div>
              </div>

              {/* 点击卡片唤起移动端滚轮选择器 */}
              <div
                onClick={() => {
                  triggerHaptic("light");
                  setDatePickerVisible(true);
                }}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: 10,
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CalendarOutlined style={{ color: "#4F46E5", fontSize: 16 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>
                    {activeDate} {WEEKDAY_NAMES[dayjs(activeDate).day()]}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#4F46E5", fontWeight: 500 }}>
                  更改日期 ›
                </span>
              </div>
            </div>

            {/* 2. 授课班级选择区 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>授课班级</span>
                <span style={{ fontSize: 12, color: "#4F46E5", fontWeight: 600 }}>当前：{activeClass || "未选择"}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {classes.map((c) => {
                  const isSelected = activeClass === c;
                  return (
                    <div
                      key={c}
                      onClick={() => {
                        triggerHaptic("light");
                        setCustomClass(c);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 500,
                        cursor: "pointer",
                        background: isSelected ? "#4F46E5" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : "#334155",
                        border: isSelected ? "1.5px solid #4F46E5" : "1px solid #E2E8F0",
                        boxShadow: isSelected ? "0 2px 6px rgba(79, 70, 229, 0.25)" : "none",
                        transition: "all 0.15s ease",
                        userSelect: "none",
                      }}
                    >
                      {c}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 上课节次选择区（全景网格：根据配置的全部节次平铺展示，带开课时间） */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                  上课节次（共 {periods.length} 节可选）
                </span>
                <span style={{ fontSize: 12, color: "#4F46E5", fontWeight: 600 }}>
                  当前已选：{activePeriod}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {periods.map((p) => {
                  const pValue = `第${p.n}节`;
                  const isSelected = activePeriod === pValue;
                  return (
                    <div
                      key={p.n}
                      onClick={() => {
                        triggerHaptic("light");
                        setCustomPeriod(pValue);
                      }}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 10,
                        textAlign: "center",
                        cursor: "pointer",
                        background: isSelected ? "#4F46E5" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : "#334155",
                        border: isSelected ? "1.5px solid #4F46E5" : "1px solid #E2E8F0",
                        boxShadow: isSelected ? "0 2px 8px rgba(79, 70, 229, 0.3)" : "none",
                        transition: "all 0.15s ease",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600 }}>第{p.n}节</div>
                      {p.start && (
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 2,
                            color: isSelected ? "rgba(255,255,255,0.85)" : "#94A3B8",
                          }}
                        >
                          {p.start}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 移动端滚轮日期选择器 */}
            <MobileDatePicker
              visible={datePickerVisible}
              onClose={() => setDatePickerVisible(false)}
              defaultValue={activeDate ? dayjs(activeDate).toDate() : new Date()}
              onConfirm={(val) => {
                setCustomDate(dayjs(val).format("YYYY-MM-DD"));
                triggerHaptic("light");
              }}
            />
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
            isMobile ? (
              <Button
                danger
                icon={<DeleteOutlined />}
                size="large"
                loading={deleting}
                onClick={handleMobileConfirmDelete}
                style={{ borderRadius: 8 }}
              >
                删除
              </Button>
            ) : (
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
            )
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
