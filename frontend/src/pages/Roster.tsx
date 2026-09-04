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
  Upload,
  Alert,
  Statistic,
  Drawer,
  Checkbox,
  Dropdown,
  Grid,
  Empty,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  SearchOutlined,
  DeleteOutlined,
  MoreOutlined,
  UserOutlined,
  EditOutlined,
  UserDeleteOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  batchDeleteRows,
  createRow,
  deleteRow,
  importStudents,
  listTable,
  updateRow,
} from "../api";
import { useClasses, useCurrentClass, LEFT_MARK, useIsMobileOrTablet } from "../hooks";
import type { Row } from "../types";
import StudentDetailModal from "../components/StudentDetailModal";
import StudentAvatar from "../components/StudentAvatar";
import { triggerHaptic } from "../utils/haptics";

const CSV_TEMPLATE =
  "班级,姓名,学号,小组,标签\n八4班,张三,1,第1组,\n八4班,李四,2,第1组,课代表";

function downloadTemplate() {
  const blob = new Blob(["\ufeff" + CSV_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "学生导入模板.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Roster() {
  const { 班级, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();
  // 统一判定：iPad 与 手机均采用触控移动端模式，PC 桌面端保持原版表格方案
  const isMobile = useIsMobileOrTablet();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  // 学生详情档案弹窗
  const [detailStudent, setDetailStudent] = useState<Row | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 移动端专用状态：Vant 风格 ActionSheet（底部操作面板）
  const [actionStudent, setActionStudent] = useState<Row | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("全部");
  const [isBatchMode, setIsBatchMode] = useState(false);

  // CSV 导入状态
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvName, setCsvName] = useState("");
  const [importResult, setImportResult] = useState<any>(null);

  // 搜索关键字、多选 keys
  const [keyword, setKeyword] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);

  // 查询学生列表
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", 班级, keyword],
    queryFn: () =>
      listTable("students", {
        班级,
        ...(keyword.trim() ? { q: keyword.trim() } : {}),
      }),
    enabled: !!班级,
  });

  // 新增/修改学生
  const saveMutation = useMutation({
    mutationFn: async (v: Record<string, string>) => {
      if (editing) return updateRow("students", editing.id, v);
      return createRow("students", { ...v, 班级 });
    },
    onSuccess: () => {
      triggerHaptic("success");
      message.success(editing ? "学生信息已更新" : "已添加学生");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // 单个删除
  const delMutation = useMutation({
    mutationFn: (id: number) => deleteRow("students", id),
    onSuccess: () => {
      triggerHaptic("light");
      message.success("已删除");
      setActionSheetOpen(false);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // 批量删除
  const batchDelMutation = useMutation({
    mutationFn: (ids: number[]) => batchDeleteRows("students", ids),
    onSuccess: (res) => {
      triggerHaptic("success");
      message.success(`已删除 ${res.deleted} 名学生`);
      setSelectedKeys([]);
      setIsBatchMode(false);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // 标记离班
  const leaveMutation = useMutation({
    mutationFn: async (s: Row) => {
      const today = new Date().toISOString().slice(0, 10);
      const tag = s.标签
        ? `${LEFT_MARK}|${today}|${s.标签}`
        : `${LEFT_MARK}|${today}`;
      return updateRow("students", s.id, { 标签: tag });
    },
    onSuccess: () => {
      triggerHaptic("light");
      message.success("已标记离班");
      setActionSheetOpen(false);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // 恢复在册
  const restoreMutation = useMutation({
    mutationFn: async (s: Row) => {
      const newTag = (s.标签 || "")
        .split("|")
        .filter(
          (part: string) =>
            !part.includes(LEFT_MARK) && !/^\d{4}-\d{2}-\d{2}$/.test(part)
        )
        .join("|");
      return updateRow("students", s.id, { 标签: newTag });
    },
    onSuccess: () => {
      triggerHaptic("success");
      message.success("已恢复在册");
      setActionSheetOpen(false);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // CSV 导入
  const importMutation = useMutation({
    mutationFn: () => importStudents(csvText, 班级),
    onSuccess: (res: any) => {
      triggerHaptic("success");
      setImportResult(res);
      const st = res.统计;
      message.success(
        `导入完成：新增 ${st.新增}，已存在跳过 ${st.已存在}，无效 ${st.无效}`
      );
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail ?? "导入失败");
    },
  });

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (s: Row) => {
    setEditing(s);
    form.setFieldsValue(s);
    setOpen(true);
    setActionSheetOpen(false);
  };

  const handleOpenActionSheet = (s: Row, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");
    setActionStudent(s);
    setActionSheetOpen(true);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setCsvName(file.name);
      setImportResult(null);
    };
    reader.readAsText(file, "utf-8");
    return false;
  };

  // ==================== PC 端原方案表格列配置（保持原方案与原交互完全不改） ====================
  const pcColumns = [
    {
      title: "学号",
      dataIndex: "学号",
      width: 80,
      sorter: (a: Row, b: Row) =>
        (parseInt(a.学号) || 0) - (parseInt(b.学号) || 0),
    },
    {
      title: "姓名",
      dataIndex: "姓名",
      render: (t: string, r: Row) => (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <StudentAvatar student={r} size={28} />
          <a
            style={{ fontWeight: 600 }}
            onClick={(e) => {
              e.stopPropagation();
              setDetailStudent(r);
              setDetailOpen(true);
            }}
          >
            {t}
          </a>
        </div>
      ),
    },
    { title: "小组", dataIndex: "小组", width: 100 },
    {
      title: "标签",
      dataIndex: "标签",
      render: (t: string) => {
        if (!t) return "-";
        const isLeft = t.includes(LEFT_MARK);
        return (
          <Tag color={isLeft ? "default" : "geekblue"}>
            {isLeft ? "已离班" : t}
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "op",
      width: 200,
      render: (_: any, r: Row) => {
        const isLeft = r.标签 && r.标签.includes(LEFT_MARK);
        return (
          <Space>
            <Button size="small" type="link" onClick={() => openEdit(r)}>
              编辑
            </Button>
            {isLeft ? (
              <Button
                size="small"
                type="link"
                onClick={() => restoreMutation.mutate(r)}
              >
                恢复
              </Button>
            ) : (
              <Button
                size="small"
                type="link"
                onClick={() => leaveMutation.mutate(r)}
              >
                离班
              </Button>
            )}
            <Popconfirm
              title="确定删除该学生？"
              onConfirm={() => delMutation.mutate(r.id)}
            >
              <Button size="small" type="link" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // ==================== 移动端专用数据计算 ====================
  const groupTabs = useMemo(() => {
    const groupSet = new Set<string>();
    let leftCount = 0;
    let activeTotal = 0;

    for (const s of students) {
      if (s.标签 && s.标签.includes(LEFT_MARK)) {
        leftCount++;
      } else {
        activeTotal++;
        if (s.小组 && s.小组.trim()) {
          groupSet.add(s.小组.trim());
        }
      }
    }

    const sortedGroups = Array.from(groupSet).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, "")) || 0;
      const nb = parseInt(b.replace(/\D/g, "")) || 0;
      return na - nb || a.localeCompare(b);
    });

    const tabs = [{ label: "全部", key: "全部", count: activeTotal }];
    for (const g of sortedGroups) {
      const c = students.filter(
        (s) => s.小组 === g && !(s.标签 && s.标签.includes(LEFT_MARK))
      ).length;
      tabs.push({ label: g, key: g, count: c });
    }
    if (leftCount > 0) {
      tabs.push({ label: "已离班", key: "已离班", count: leftCount });
    }
    return tabs;
  }, [students]);

  const mobileDisplayStudents = useMemo(() => {
    return students.filter((s) => {
      const isLeft = s.标签 && s.标签.includes(LEFT_MARK);
      if (activeGroup === "已离班") return isLeft;
      if (isLeft) return false;
      if (activeGroup === "全部") return true;
      return s.小组 === activeGroup;
    });
  }, [students, activeGroup]);

  const toggleSelectStudent = (id: number) => {
    triggerHaptic("light");
    setSelectedKeys((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedKeys.length === mobileDisplayStudents.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(mobileDisplayStudents.map((s) => s.id));
    }
    triggerHaptic("light");
  };

  const csvPreview = csvText
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 6);

  // ==================== 渲染主体 ====================
  return (
    <div className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* 电脑端 (PC)：严格使用原方案结构与交互展示 */}
      {!isMobile ? (
        <>
          <h2 className="page-title">学生名册</h2>
          <div className="page-sub">当前共 {students?.length ?? 0} 名在册学生</div>

          <Space style={{ marginBottom: 16 }} wrap>
            <Select
              value={班级}
              onChange={set班级}
              style={{ width: 180 }}
              options={classes.map((c) => ({ value: c, label: c }))}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索姓名 / 学号"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setSelectedKeys([]);
              }}
              style={{ width: 220 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              添加学生
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                setImportOpen(true);
                setImportResult(null);
              }}
            >
              CSV 导入
            </Button>
            {selectedKeys.length > 0 && (
              <Popconfirm
                title={`确定删除选中的 ${selectedKeys.length} 名学生？此操作不可恢复。`}
                onConfirm={() => batchDelMutation.mutate(selectedKeys)}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={batchDelMutation.isPending}
                >
                  删除选中 ({selectedKeys.length})
                </Button>
              </Popconfirm>
            )}
          </Space>

          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={students}
            columns={pcColumns}
            onRow={(r) => ({
              onClick: () => {
                setDetailStudent(r);
                setDetailOpen(true);
              },
              style: { cursor: "pointer" },
            })}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys as number[]),
            }}
            pagination={{ pageSize: 20 }}
            size="middle"
            scroll={{ x: "max-content" }}
          />
        </>
      ) : (
        /* 移动端 / iPad：Vant 风格触控交互 */
        <>
          {/* 移动端顶部标题与工具栏 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: 18 }}>
                学生名册
              </h2>
              <span style={{ fontSize: 13, color: "#8c8c8c" }}>
                ({students.length}人)
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Select
                value={班级}
                onChange={set班级}
                style={{ width: 110 }}
                options={classes.map((c) => ({ value: c, label: c }))}
              />
              <Button
                type={isBatchMode ? "primary" : "default"}
                onClick={() => {
                  triggerHaptic("light");
                  setIsBatchMode(!isBatchMode);
                  if (isBatchMode) setSelectedKeys([]);
                }}
              >
                {isBatchMode ? "完成" : "管理"}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                添加
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "csv-import",
                      icon: <UploadOutlined />,
                      label: "CSV 批量导入",
                      onClick: () => {
                        setImportOpen(true);
                        setImportResult(null);
                      },
                    },
                    {
                      key: "csv-template",
                      icon: <DownloadOutlined />,
                      label: "下载导入模板",
                      onClick: downloadTemplate,
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button icon={<MoreOutlined />} />
              </Dropdown>
            </div>
          </div>

          {/* 🔍 Vant 风格吸顶搜索栏 */}
          <div
            style={{
              background: "#f1f5f9",
              borderRadius: 24,
              padding: "4px 12px",
              display: "flex",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <SearchOutlined style={{ color: "#94a3b8", fontSize: 16, marginRight: 8 }} />
            <Input
              variant="borderless"
              placeholder="搜索学生姓名、学号或标签..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setSelectedKeys([]);
              }}
              allowClear
              style={{ padding: "4px 0", fontSize: 14 }}
            />
          </div>

          {/* 🗂️ Vant 风格横向标签滑轨 */}
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 8,
              marginBottom: 10,
              WebkitOverflowScrolling: "touch",
              msOverflowStyle: "none",
              scrollbarWidth: "none",
            }}
          >
            {groupTabs.map((tab) => {
              const isActive = activeGroup === tab.key;
              return (
                <div
                  key={tab.key}
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveGroup(tab.key);
                  }}
                  style={{
                    flexShrink: 0,
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    background: isActive ? "#1677ff" : "#ffffff",
                    color: isActive ? "#ffffff" : "#475569",
                    border: `1px solid ${isActive ? "#1677ff" : "#e2e8f0"}`,
                    boxShadow: isActive
                      ? "0 2px 6px rgba(22, 119, 255, 0.25)"
                      : "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                    userSelect: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "0 5px",
                      borderRadius: 8,
                      background: isActive ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#64748b",
                    }}
                  >
                    {tab.count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 📇 移动端 Vant 单元格列表 */}
          {mobileDisplayStudents.length === 0 ? (
            <div
              style={{
                padding: "48px 16px",
                background: "#fff",
                borderRadius: 16,
                border: "1px dashed #cbd5e1",
                textAlign: "center",
              }}
            >
              <Empty description="当前分类下暂无学生">
                <Button type="primary" ghost icon={<PlusOutlined />} onClick={openAdd}>
                  添加学生
                </Button>
              </Empty>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 8,
                paddingBottom: isBatchMode ? 70 : 0,
              }}
            >
              {mobileDisplayStudents.map((s) => {
                const isSelected = selectedKeys.includes(s.id);
                const isLeft = s.标签 && s.标签.includes(LEFT_MARK);

                const cleanTags = (s.标签 || "")
                  .split("|")
                  .map((t: string) => t.trim())
                  .filter(
                    (t: string) =>
                      Boolean(t) &&
                      !t.includes(LEFT_MARK) &&
                      !/^\d{4}-\d{2}-\d{2}$/.test(t)
                  );

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (isBatchMode) {
                        toggleSelectStudent(s.id);
                      }
                    }}
                    style={{
                      background: isSelected ? "#eff6ff" : "#ffffff",
                      border: `1px solid ${isSelected ? "#93c5fd" : "#e2e8f0"}`,
                      borderRadius: 14,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: isBatchMode ? "pointer" : "default",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    {isBatchMode && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelectStudent(s.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    <StudentAvatar
                      student={s}
                      size={44}
                      style={{ opacity: isLeft ? 0.45 : 1 }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: isLeft ? "#94a3b8" : "#1e293b",
                            textDecoration: isLeft ? "line-through" : "none",
                          }}
                        >
                          {s.姓名}
                        </span>

                        {isLeft && (
                          <Tag color="default" style={{ borderRadius: 6, margin: 0 }}>
                            已离班
                          </Tag>
                        )}

                        {cleanTags.map((tag: string, idx: number) => {
                          const isLeader = tag.includes("长") || tag.includes("代表");
                          return (
                            <Tag
                              key={idx}
                              color={isLeader ? "purple" : "geekblue"}
                              style={{ borderRadius: 6, margin: 0, fontSize: 11 }}
                            >
                              {tag}
                            </Tag>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>{s.小组 || "未分配小组"}</span>
                        {s.学号 && <span>学号: {s.学号}</span>}
                      </div>
                    </div>

                    {!isBatchMode && (
                      <Button
                        type="text"
                        shape="circle"
                        icon={<MoreOutlined style={{ fontSize: 20, color: "#64748b" }} />}
                        onClick={(e) => handleOpenActionSheet(s, e)}
                        style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 🎯 移动端 Vant 风格吸底批量操作栏 */}
          {isBatchMode && (
            <div
              style={{
                position: "fixed",
                bottom: "calc(54px + env(safe-area-inset-bottom, 0px))",
                left: 0,
                right: 0,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                borderTop: "1px solid #e2e8f0",
                padding: "10px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                zIndex: 100,
                boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Button size="small" onClick={handleSelectAll}>
                  {selectedKeys.length === mobileDisplayStudents.length ? "取消全选" : "全选本组"}
                </Button>
                <span style={{ fontSize: 13, color: "#475569" }}>
                  已选 <b style={{ color: "#2563eb" }}>{selectedKeys.length}</b> 人
                </span>
              </div>

              <Space size={8}>
                <Button size="small" onClick={() => setIsBatchMode(false)}>
                  退出管理
                </Button>
                {selectedKeys.length > 0 && (
                  <Popconfirm
                    title={`确定删除选中的 ${selectedKeys.length} 名学生？此操作不可恢复。`}
                    onConfirm={() => batchDelMutation.mutate(selectedKeys)}
                  >
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      loading={batchDelMutation.isPending}
                    >
                      删除 ({selectedKeys.length})
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </div>
          )}

          {/* 📱 移动端 Vant 风格底部动作面板 */}
          <Drawer
            placement="bottom"
            open={actionSheetOpen}
            onClose={() => setActionSheetOpen(false)}
            height="auto"
            styles={{
              body: { padding: "16px 16px 28px 16px" },
              content: { borderRadius: "20px 20px 0 0" },
            }}
            closable={false}
          >
            {actionStudent && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingBottom: 14,
                    marginBottom: 10,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "#eff6ff",
                      color: "#2563eb",
                      fontWeight: 700,
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {actionStudent.学号 || "#"}
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                      {actionStudent.姓名}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {actionStudent.班级} · {actionStudent.小组 || "未分配小组"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Button
                    block
                    size="large"
                    icon={<UserOutlined style={{ color: "#2563eb" }} />}
                    style={{
                      height: 46,
                      justifyContent: "flex-start",
                      borderRadius: 12,
                      fontSize: 15,
                    }}
                    onClick={() => {
                      setActionSheetOpen(false);
                      setDetailStudent(actionStudent);
                      setDetailOpen(true);
                    }}
                  >
                    查看学生全景档案
                  </Button>

                  <Button
                    block
                    size="large"
                    icon={<EditOutlined style={{ color: "#1677ff" }} />}
                    style={{
                      height: 46,
                      justifyContent: "flex-start",
                      borderRadius: 12,
                      fontSize: 15,
                    }}
                    onClick={() => openEdit(actionStudent)}
                  >
                    编辑学生信息
                  </Button>

                  {actionStudent.标签 && actionStudent.标签.includes(LEFT_MARK) ? (
                    <Button
                      block
                      size="large"
                      icon={<RollbackOutlined style={{ color: "#52c41a" }} />}
                      style={{
                        height: 46,
                        justifyContent: "flex-start",
                        borderRadius: 12,
                        fontSize: 15,
                      }}
                      onClick={() => restoreMutation.mutate(actionStudent)}
                    >
                      恢复为在册学生
                    </Button>
                  ) : (
                    <Button
                      block
                      size="large"
                      icon={<UserDeleteOutlined style={{ color: "#fa8c16" }} />}
                      style={{
                        height: 46,
                        justifyContent: "flex-start",
                        borderRadius: 12,
                        fontSize: 15,
                      }}
                      onClick={() => leaveMutation.mutate(actionStudent)}
                    >
                      标记该生已离班
                    </Button>
                  )}

                  <Popconfirm
                    title="确定彻底删除该学生？此操作无法撤销。"
                    onConfirm={() => delMutation.mutate(actionStudent.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      block
                      danger
                      size="large"
                      icon={<DeleteOutlined />}
                      style={{
                        height: 46,
                        justifyContent: "flex-start",
                        borderRadius: 12,
                        fontSize: 15,
                      }}
                    >
                      彻底删除学生
                    </Button>
                  </Popconfirm>

                  <Button
                    block
                    size="large"
                    style={{
                      height: 44,
                      marginTop: 6,
                      borderRadius: 12,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "none",
                    }}
                    onClick={() => setActionSheetOpen(false)}
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}
          </Drawer>
        </>
      )}

      {/* 新增/编辑学生弹窗 */}
      <Modal
        title={editing ? "编辑学生" : "添加学生"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item
            name="姓名"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="例如：李明" style={{ borderRadius: 8 }} />
          </Form.Item>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Form.Item name="学号" label="学号">
              <Input placeholder="例如：1" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="小组" label="小组">
              <Input placeholder="例如：第1组" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <Form.Item name="标签" label="标签 / 职务">
            <Input
              placeholder="例如：课代表 / 需关注（多个用逗号隔开）"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* CSV 批量导入弹窗 */}
      <Modal
        title="CSV 批量导入学生"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Alert
            type="info"
            showIcon
            message="CSV 首行为表头，支持列：班级、姓名、学号、小组、标签（缺省列留空即可）；也兼容只有姓名一列。已存在（同班级同名）的学生自动跳过。"
          />

          <Space wrap>
            <Upload accept=".csv" showUploadList={false} beforeUpload={readFile}>
              <Button icon={<UploadOutlined />}>选择 CSV 文件</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
              下载模板
            </Button>
          </Space>

          {csvName && !importResult && (
            <div>
              <div style={{ color: "#666", marginBottom: 4 }}>
                已读取「{csvName}」，前几行预览：
              </div>
              <pre
                style={{
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 8,
                  fontSize: 12,
                  overflowX: "auto",
                  margin: 0,
                }}
              >
                {csvPreview.join("\n")}
              </pre>
              <Button
                type="primary"
                style={{ marginTop: 12 }}
                loading={importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                确认导入到「{班级}」
              </Button>
            </div>
          )}

          {importResult && (
            <div>
              <Space size="large" style={{ marginBottom: 12 }}>
                <Statistic
                  title="新增"
                  value={importResult.统计.新增}
                  valueStyle={{ color: "#3f8600" }}
                />
                <Statistic
                  title="已存在跳过"
                  value={importResult.统计.已存在}
                  valueStyle={{ color: "#fa8c16" }}
                />
                <Statistic
                  title="无效行"
                  value={importResult.统计.无效}
                  valueStyle={{ color: "#cf1322" }}
                />
              </Space>
              {importResult.无效行?.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`无效行：${importResult.无效行
                    .map((x: any) => `第${x.行}行(${x.原因})`)
                    .join("、")}`}
                />
              )}
              <Button onClick={() => setImportOpen(false)}>完成</Button>
            </div>
          )}
        </Space>
      </Modal>

      {/* 学生个人学情与档案全景弹窗 */}
      <StudentDetailModal
        student={detailStudent}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
