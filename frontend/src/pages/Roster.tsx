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
  listAllTable,
  updateRow,
} from "../api";
import { useClasses, useCurrentClass, LEFT_MARK, useIsMobileOrTablet } from "../hooks";
import type { Row } from "../types";
import StudentDetailModal from "../components/StudentDetailModal";
import { ActionSheet, Dialog, Toast, PullToRefresh } from "antd-mobile";
import type { Action } from "antd-mobile/es/components/action-sheet";
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
  const { 班级, class_id, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();
  // 统一判定：iPad 与 手机均采用触控移动端模式，PC 桌面端保持原版表格方案
  const isMobile = useIsMobileOrTablet();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  // PC 端分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  // 统一班级学生查询：以 class_id 优先拉取当前班级学生，彻底消除 URL 中文编码与重复调用
  const queryClass = class_id || 班级;
  const { data: allStudentsData, isLoading, refetch: refetchAllStudents } = useQuery({
    queryKey: ["students-all", queryClass],
    queryFn: () => listAllTable("students", class_id ? { class_id } : { class_name: 班级 }),
    enabled: !!queryClass,
  });

  const allStudents = allStudentsData ?? [];

  // 前端内存即时检索过滤（姓名、学号、标签、小组）：0网络延迟
  const filteredStudents = useMemo(() => {
    if (!keyword.trim()) return allStudents;
    const kw = keyword.trim().toLowerCase();
    return allStudents.filter((s) => {
      const name = (s.name || s.姓名 || "").toLowerCase();
      const sno = (s.student_no || s.学号 || "").toLowerCase();
      const tags = (s.tags || s.标签 || "").toLowerCase();
      const group = (s.group_name || s.小组 || "").toLowerCase();
      return name.includes(kw) || sno.includes(kw) || tags.includes(kw) || group.includes(kw);
    });
  }, [allStudents, keyword]);

  const students: Row[] = filteredStudents;
  const totalCount = filteredStudents.length;

  const refreshAllStudents = () => {
    qc.invalidateQueries({ queryKey: ["students-all", queryClass] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  // 📱 antd-mobile 下拉手势刷新
  const handleRefreshRoster = async () => {
    triggerHaptic("light");
    refreshAllStudents();
    Toast.show({
      icon: "success",
      content: "已刷新学生名册",
      duration: 1200,
    });
  };

  const handleMobileRefresh = async () => {
    triggerHaptic("light");
    refreshAllStudents();
    Toast.show({
      icon: "success",
      content: "已刷新学生名册",
      duration: 1200,
    });
  };

  // 新增/修改学生
  const saveMutation = useMutation({
    mutationFn: async (v: Record<string, string>) => {
      const payload: Record<string, any> = {
        name: v.name || v.姓名,
        student_no: v.student_no || v.学号 || "",
        group_name: v.group_name || v.小组 || "",
        tags: v.tags || v.标签 || "",
        class_name: 班级,
      };
      if (class_id) payload.class_id = class_id;
      if (editing) return updateRow("students", editing.id, payload);
      return createRow("students", payload);
    },
    onSuccess: () => {
      triggerHaptic("success");
      message.success(editing ? "学生信息已更新" : "已添加学生");
      setOpen(false);
      setEditing(null);
      refreshAllStudents();
    },
  });

  // 单个删除
  const delMutation = useMutation({
    mutationFn: (id: number) => deleteRow("students", id),
    onSuccess: () => {
      triggerHaptic("light");
      message.success("已删除");
      setActionSheetOpen(false);
      refreshAllStudents();
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
      refreshAllStudents();
    },
  });

  // 标记离班
  const leaveMutation = useMutation({
    mutationFn: async (s: Row) => {
      const cur = s.tags || s.标签 || "";
      const next = cur ? `${LEFT_MARK}, ${cur}` : LEFT_MARK;
      return updateRow("students", s.id, { tags: next });
    },
    onSuccess: () => {
      triggerHaptic("light");
      message.success("已标记离班");
      setActionSheetOpen(false);
      refreshAllStudents();
    },
  });

  // 恢复在册
  const restoreMutation = useMutation({
    mutationFn: async (s: Row) => {
      const cur = s.tags || s.标签 || "";
      const newTag = cur
        .split("|")
        .filter(
          (part: string) =>
            !part.includes(LEFT_MARK) && !/^\d{4}-\d{2}-\d{2}$/.test(part)
        )
        .join("|");
      return updateRow("students", s.id, { tags: newTag });
    },
    onSuccess: () => {
      triggerHaptic("success");
      message.success("已恢复在册");
      setActionSheetOpen(false);
      refreshAllStudents();
    },
  });

  // CSV 导入
  const importMutation = useMutation({
    mutationFn: () => importStudents(csvText, class_id || 班级),
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

  const openEdit = (r: Row) => {
    setEditing(r);
    form.setFieldsValue({
      name: r.name || r.姓名,
      student_no: r.student_no || r.学号,
      group_name: r.group_name || r.小组,
      tags: r.tags || r.标签,
      姓名: r.name || r.姓名,
      学号: r.student_no || r.学号,
      小组: r.group_name || r.小组,
      标签: r.tags || r.标签,
    });
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

  // ==================== PC 端表格列配置 ====================
  const pcColumns = [
    {
      title: "学号",
      dataIndex: "student_no",
      width: 80,
      render: (_: any, r: Row) => r.student_no || r.学号 || "-",
      sorter: (a: Row, b: Row) =>
        (parseInt(a.student_no || a.学号) || 0) - (parseInt(b.student_no || b.学号) || 0),
    },
    {
      title: "姓名",
      dataIndex: "name",
      render: (_: any, r: Row) => {
        const studentName = r.name || r.姓名;
        return (
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
              {studentName}
            </a>
          </div>
        );
      },
    },
    {
      title: "小组",
      dataIndex: "group_name",
      width: 100,
      render: (_: any, r: Row) => r.group_name || r.小组 || "-",
    },
    {
      title: "标签",
      dataIndex: "tags",
      render: (_: any, r: Row) => {
        const t = r.tags || r.标签 || "";
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
        const isLeft = (r.tags || r.标签 || "").includes(LEFT_MARK);
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
      const tags = s.tags || s.标签 || "";
      if (tags && tags.includes(LEFT_MARK)) {
        leftCount++;
      } else {
        activeTotal++;
        const grp = (s.group_name || s.小组 || "").trim();
        if (grp) {
          groupSet.add(grp);
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
        (s) => (s.group_name || s.小组) === g && !((s.tags || s.标签 || "").includes(LEFT_MARK))
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
      const isLeft = (s.tags || s.标签 || "").includes(LEFT_MARK);
      if (activeGroup === "已离班") return isLeft;
      if (isLeft) return false;
      if (activeGroup === "全部") return true;
      return (s.group_name || s.小组) === activeGroup;
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
    <PullToRefresh onRefresh={handleRefreshRoster}>
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
            pagination={{
              current: page,
              pageSize: pageSize,
              total: totalCount,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (t) => `共 ${t} 名学生`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
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
                const isLeft = (s.tags || s.标签 || "").includes(LEFT_MARK);

                const cleanTags = (s.tags || s.标签 || "")
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
                          {s.name || s.姓名}
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
                        <span>{s.group_name || s.小组 || "未分配小组"}</span>
                        {(s.student_no || s.学号) && <span>学号: {s.student_no || s.学号}</span>}
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

          {/* 📱 移动端 antd-mobile 原生动作面板 */}
          <ActionSheet
            visible={actionSheetOpen}
            actions={[
              { text: "查看学生全景档案", key: "detail" },
              { text: "编辑学生信息", key: "edit" },
              {
                text: actionStudent?.标签?.includes(LEFT_MARK) ? "恢复为在册学生" : "标记该生已离班",
                key: "toggle_leave",
                danger: !actionStudent?.标签?.includes(LEFT_MARK),
              },
              { text: "彻底删除学生", key: "delete", danger: true },
            ]}
            onClose={() => setActionSheetOpen(false)}
            onAction={(action) => {
              if (!actionStudent) return;
              if (action.key === "detail") {
                setActionSheetOpen(false);
                setDetailStudent(actionStudent);
                setDetailOpen(true);
              } else if (action.key === "edit") {
                setActionSheetOpen(false);
                openEdit(actionStudent);
              } else if (action.key === "toggle_leave") {
                setActionSheetOpen(false);
                if (actionStudent.标签 && actionStudent.标签.includes(LEFT_MARK)) {
                  restoreMutation.mutate(actionStudent);
                } else {
                  leaveMutation.mutate(actionStudent);
                }
              } else if (action.key === "delete") {
                setActionSheetOpen(false);
                Dialog.confirm({
                  title: "彻底删除学生",
                  content: `确定彻底删除学生「${actionStudent.姓名}」？此操作无法撤销。`,
                  confirmText: "删除",
                  cancelText: "取消",
                  onConfirm: () => {
                    delMutation.mutate(actionStudent.id);
                  },
                });
              }
            }}
            cancelText="取消"
            extra={
              actionStudent ? (
                <div style={{ textAlign: "center", padding: "4px 0" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    {actionStudent.姓名} <span style={{ fontSize: 13, color: "#64748b" }}>({actionStudent.学号 || "#"})</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {actionStudent.班级} · {actionStudent.小组 || "未分配小组"}
                  </div>
                </div>
              ) : null
            }
          />
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
            name="name"
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
            <Form.Item name="student_no" label="学号">
              <Input placeholder="例如：1" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="group_name" label="小组">
              <Input placeholder="例如：第1组" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <Form.Item name="tags" label="标签 / 职务">
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
    </PullToRefresh>
  );
}
