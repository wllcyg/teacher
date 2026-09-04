import { useMemo, useState } from "react";
import {
  Card,
  Button,
  DatePicker,
  Segmented,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Empty,
  Spin,
  Space,
  message,
  Popconfirm,
  Grid,
} from "antd";
import {
  PlusOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CrownOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import {
  createRow,
  deleteRow,
  updateRow,
  listTable,
  batchDeleteRows,
  batchUpdateRows,
} from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";
import { triggerHaptic } from "../utils/haptics";

const { useBreakpoint } = Grid;

export default function QuickNote() {
  const { 班级, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();
  const screens = useBreakpoint();

  // 当前日期
  const [recordDate, setRecordDate] = useState<Dayjs>(dayjs());

  // 当前选中的项目名
  const [selectedItemName, setSelectedItemName] = useState<string>("");

  // 加减分模式下的当前分值（+1, +2, -1, -2）
  const [activeDelta, setActiveDelta] = useState<number>(1);

  // 等第模式下的当前等第（A, B, C, D）
  const [activeGrade, setActiveGrade] = useState<string>("A");

  // 撤销栈（存放本会话最近的操作：{ table, id, studentName, desc }）
  const [undoStack, setUndoStack] = useState<
    { table: "behavior" | "academic"; id: number; studentName: string; desc: string }[]
  >([]);

  // 弹窗状态
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemForm] = Form.useForm();

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameForm] = Form.useForm();

  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);

  // 整批修改的目标参数
  const [targetClass, setTargetClass] = useState<string>("");
  const [targetDate, setTargetDate] = useState<Dayjs>(dayjs());
  const [targetItem, setTargetItem] = useState<string>("");

  // 数据查询
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => listTable("students"),
  });
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["items"],
    queryFn: () => listTable("items"),
  });
  const { data: allBehavior, isLoading: loadingBehavior } = useQuery({
    queryKey: ["behavior", 班级, recordDate.format("YYYY-MM-DD")],
    queryFn: () =>
      listTable("behavior", { 班级, 日期: recordDate.format("YYYY-MM-DD") }),
    enabled: !!班级,
  });
  const { data: allAcademic, isLoading: loadingAcademic } = useQuery({
    queryKey: ["academic", 班级, recordDate.format("YYYY-MM-DD")],
    queryFn: () =>
      listTable("academic", { 班级, 日期: recordDate.format("YYYY-MM-DD") }),
    enabled: !!班级,
  });

  // 当前班级在册名单
  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  // 视图模式：默认按组展示（"group"），支持切换为平铺展示（"flat"）
  const [viewMode, setViewMode] = useState<"group" | "flat">("group");

  // 按名册中的小组组织学生，组号升序排列，未分组置底
  const studentGroups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const s of roster) {
      const g = (s.小组 || "").trim() || "未分组";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }

    const parseNum = (name: string) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0], 10) : 9999;
    };

    return Array.from(map.entries())
      .map(([groupName, groupStudents]) => ({
        groupName,
        students: groupStudents.sort(
          (a, b) => (parseInt(a.学号, 10) || 0) - (parseInt(b.学号, 10) || 0)
        ),
      }))
      .sort((a, b) => {
        if (a.groupName === "未分组") return 1;
        if (b.groupName === "未分组") return -1;
        return parseNum(a.groupName) - parseNum(b.groupName);
      });
  }, [roster]);

  // 项目双轨分类
  const academicItems = useMemo(
    () => (items ?? []).filter((it) => it.类型 === "学业"),
    [items]
  );
  const behaviorItems = useMemo(
    () => (items ?? []).filter((it) => it.类型 === "表现"),
    [items]
  );

  // 默认选中项目
  const currentItem = useMemo(() => {
    if (!selectedItemName && (items ?? []).length > 0) {
      return items![0];
    }
    return (items ?? []).find((it) => it.项目名 === selectedItemName) ?? items?.[0];
  }, [items, selectedItemName]);

  // 确保 selectedItemName 有值
  useMemo(() => {
    if (!selectedItemName && currentItem) {
      setSelectedItemName(currentItem.项目名);
    }
  }, [currentItem, selectedItemName]);

  // 判断当前项目的记录类型
  const isBehavior = currentItem?.类型 === "表现";
  const scoreKind = useMemo(() => {
    const s = currentItem?.计分制 ?? "";
    if (s.includes("加减")) return "加减分";
    if (s.includes("过关")) return "过关";
    if (s.includes("打钩")) return "打钩";
    if (s.includes("等第")) return "等第";
    if (s.includes("分数")) return "分数";
    return "打钩";
  }, [currentItem]);

  // 当前项目、当前班级、当前日期的已记录集合
  const currentRecords = useMemo(() => {
    if (!currentItem) return [];
    if (isBehavior) {
      return (allBehavior ?? []).filter((r) => r.项目 === currentItem.项目名);
    } else {
      return (allAcademic ?? []).filter((r) => r.项目 === currentItem.项目名);
    }
  }, [currentItem, isBehavior, allBehavior, allAcademic]);

  // 学生姓名 -> 记录映射
  // 对于加减分：计算学生累计总分与记录列表
  const studentBehaviorMap = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    if (isBehavior) {
      currentRecords.forEach((r) => {
        const val = parseFloat(r.分值) || 0;
        const prev = map.get(r.学生) ?? { total: 0, count: 0 };
        map.set(r.学生, { total: prev.total + val, count: prev.count + 1 });
      });
    }
    return map;
  }, [currentRecords, isBehavior]);

  // 对于学业（过关/打钩/等第）：学生最新结果
  const studentAcademicMap = useMemo(() => {
    const map = new Map<string, Row>();
    if (!isBehavior) {
      currentRecords.forEach((r) => {
        map.set(r.学生, r);
      });
    }
    return map;
  }, [currentRecords, isBehavior]);

  // 本轮记录总人数
  const recordedCount = useMemo(() => {
    if (isBehavior) {
      return studentBehaviorMap.size;
    } else {
      return studentAcademicMap.size;
    }
  }, [isBehavior, studentBehaviorMap, studentAcademicMap]);

  // ---------- 核心连点记录行为 ----------

  // 1. 点按加减分
  const handleTapBehavior = async (studentName: string) => {
    if (!currentItem) return;
    triggerHaptic("light");
    try {
      const deltaStr = activeDelta > 0 ? `+${activeDelta}` : `${activeDelta}`;
      const res = await createRow("behavior", {
        班级,
        学生: studentName,
        项目: currentItem.项目名,
        日期: recordDate.format("YYYY-MM-DD"),
        分值: deltaStr,
        备注: "",
      });
      // 压入撤销栈
      setUndoStack((prev) => [
        ...prev,
        {
          table: "behavior",
          id: res.id,
          studentName,
          desc: `${studentName} ${deltaStr}`,
        },
      ]);
      qc.invalidateQueries({ queryKey: ["behavior"] });
    } catch (e: any) {
      message.error("记录失败：" + (e?.message ?? ""));
    }
  };

  // 2. 点按过关 / 未过
  const handleSetPass = async (studentName: string, status: "过关" | "未过") => {
    if (!currentItem) return;
    triggerHaptic(status === "过关" ? "light" : "medium");
    try {
      const existing = studentAcademicMap.get(studentName);
      if (existing) {
        await updateRow("academic", existing.id, {
          结果: status,
          状态: status === "过关" ? "完成" : "未过",
        });
      } else {
        const res = await createRow("academic", {
          班级,
          学生: studentName,
          项目: currentItem.项目名,
          日期: recordDate.format("YYYY-MM-DD"),
          结果: status,
          状态: status === "过关" ? "完成" : "未过",
          备注: "",
        });
        setUndoStack((prev) => [
          ...prev,
          {
            table: "academic",
            id: res.id,
            studentName,
            desc: `${studentName} ${status}`,
          },
        ]);
      }
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("标记失败：" + (e?.message ?? ""));
    }
  };

  // 3. 全班都完成（过关）
  const handleAllPass = async () => {
    if (!currentItem) return;
    triggerHaptic("success");
    try {
      // 批量将全班尚未过关的学生全部设为过关
      const promises = roster.map(async (s) => {
        const exist = studentAcademicMap.get(s.姓名);
        if (exist) {
          if (exist.结果 !== "过关") {
            return updateRow("academic", exist.id, {
              结果: "过关",
              状态: "完成",
            });
          }
        } else {
          return createRow("academic", {
            班级,
            学生: s.姓名,
            项目: currentItem.项目名,
            日期: recordDate.format("YYYY-MM-DD"),
            结果: "过关",
            状态: "完成",
            备注: "",
          });
        }
      });
      await Promise.all(promises);
      message.success("全班已全部标记为过关！如有未过的请单独点其「未过」");
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("批量操作失败：" + (e?.message ?? ""));
    }
  };

  // 3.1 小组批量过关
  const handlePassGroup = async (groupStudents: Row[], groupName: string) => {
    if (!currentItem) return;
    triggerHaptic("success");
    try {
      const promises = groupStudents.map(async (s) => {
        const exist = studentAcademicMap.get(s.姓名);
        if (exist) {
          if (exist.结果 !== "过关") {
            return updateRow("academic", exist.id, {
              结果: "过关",
              状态: "完成",
            });
          }
        } else {
          return createRow("academic", {
            班级,
            学生: s.姓名,
            项目: currentItem.项目名,
            日期: recordDate.format("YYYY-MM-DD"),
            结果: "过关",
            状态: "完成",
            备注: "",
          });
        }
      });
      await Promise.all(promises);
      message.success(`${groupName} 全体已标记为过关`);
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("小组操作失败：" + (e?.message ?? ""));
    }
  };

  // 3.2 小组重置（清空本组记录，恢复初始未过关状态）
  const handleResetGroup = async (groupStudents: Row[], groupName: string) => {
    if (!currentItem) return;
    triggerHaptic("medium");
    try {
      const promises = groupStudents.map(async (s) => {
        const exist = studentAcademicMap.get(s.姓名);
        if (exist) {
          return deleteRow("academic", exist.id);
        }
      });
      await Promise.all(promises);
      message.success(`${groupName} 已重置为初始状态`);
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("重置小组失败：" + (e?.message ?? ""));
    }
  };

  // 4. 点按打钩切换
  const handleToggleCheck = async (studentName: string) => {
    if (!currentItem) return;
    triggerHaptic("light");
    try {
      const existing = studentAcademicMap.get(studentName);
      if (existing) {
        // 如果已有记录，再次点击取消打钩（删除该条记录）
        await deleteRow("academic", existing.id);
      } else {
        const res = await createRow("academic", {
          班级,
          学生: studentName,
          项目: currentItem.项目名,
          日期: recordDate.format("YYYY-MM-DD"),
          结果: "√",
          状态: "完成",
          备注: "",
        });
        setUndoStack((prev) => [
          ...prev,
          {
            table: "academic",
            id: res.id,
            studentName,
            desc: `${studentName} 打钩`,
          },
        ]);
      }
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("打钩失败：" + (e?.message ?? ""));
    }
  };

  // 5. 全班都打钩
  const handleAllCheck = async () => {
    if (!currentItem) return;
    try {
      const promises = roster.map(async (s) => {
        const exist = studentAcademicMap.get(s.姓名);
        if (!exist) {
          return createRow("academic", {
            班级,
            学生: s.姓名,
            项目: currentItem.项目名,
            日期: recordDate.format("YYYY-MM-DD"),
            结果: "√",
            状态: "完成",
            备注: "",
          });
        }
      });
      await Promise.all(promises);
      message.success("全班已全部打钩完成！");
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("批量打钩失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 撤销上一笔 ----------
  const handleUndo = async () => {
    if (undoStack.length === 0) {
      message.info("暂无上一笔可撤销的操作");
      return;
    }
    const last = undoStack[undoStack.length - 1];
    try {
      await deleteRow(last.table, last.id);
      message.success(`已撤销：${last.desc}`);
      setUndoStack((prev) => prev.slice(0, -1));
      qc.invalidateQueries({ queryKey: [last.table] });
    } catch (e: any) {
      message.error("撤销失败，该记录可能已被修改或删除");
      setUndoStack((prev) => prev.slice(0, -1));
    }
  };

  // ---------- 项目改名与删除 ----------
  const handleRenameItem = async (vals: { 新项目名: string }) => {
    if (!currentItem) return;
    const newName = vals.新项目名.trim();
    if (!newName) return;
    try {
      await updateRow("items", currentItem.id, { 项目名: newName });
      message.success(`已改名为「${newName}」`);
      setRenameOpen(false);
      setSelectedItemName(newName);
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (e: any) {
      message.error("改名失败：" + (e?.message ?? ""));
    }
  };

  const handleDeleteItem = async () => {
    if (!currentItem) return;
    try {
      await deleteRow("items", currentItem.id);
      message.success(`已删除项目「${currentItem.项目名}」`);
      setSelectedItemName("");
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (e: any) {
      message.error("删除失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 新建项目提交 ----------
  const handleCreateNewItem = async (vals: {
    项目名: string;
    类型: "学业" | "表现";
    计分制: string;
  }) => {
    try {
      await createRow("items", {
        项目名: vals.项目名.trim(),
        类型: vals.类型,
        计分制: vals.计分制,
        满分: "100",
        类别: "日常",
        学科: "地理",
        周期: "学期",
        权重: "1",
      });
      message.success(`新项目「${vals.项目名}」创建成功！`);
      setNewItemOpen(false);
      newItemForm.resetFields();
      setSelectedItemName(vals.项目名.trim());
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (e: any) {
      message.error("创建失败：" + (e?.message ?? "未知错误"));
    }
  };

  // ---------- 本轮记录批量纠错 ----------
  const activeTable = isBehavior ? "behavior" : "academic";

  // 1. 整批改班级
  const handleBatchUpdateClass = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要修改的记录！");
      return;
    }
    if (!targetClass) {
      message.warning("请选择目标班级！");
      return;
    }
    try {
      await batchUpdateRows(activeTable, selectedRecordIds, { 班级: targetClass });
      message.success(`已成功将 ${selectedRecordIds.length} 条记录转移到「${targetClass}」！`);
      setSelectedRecordIds([]);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量修改班级失败：" + (e?.message ?? ""));
    }
  };

  // 2. 整批改日期
  const handleBatchUpdateDate = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要修改的记录！");
      return;
    }
    const newDateStr = targetDate.format("YYYY-MM-DD");
    try {
      await batchUpdateRows(activeTable, selectedRecordIds, { 日期: newDateStr });
      message.success(`已成功将 ${selectedRecordIds.length} 条记录变更为「${newDateStr}」！`);
      setSelectedRecordIds([]);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量修改日期失败：" + (e?.message ?? ""));
    }
  };

  // 3. 整批改项目
  const handleBatchUpdateItem = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要修改的记录！");
      return;
    }
    if (!targetItem) {
      message.warning("请选择目标项目！");
      return;
    }
    try {
      await batchUpdateRows(activeTable, selectedRecordIds, { 项目: targetItem });
      message.success(`已成功将 ${selectedRecordIds.length} 条记录平移到「${targetItem}」！`);
      setSelectedRecordIds([]);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量修改项目失败：" + (e?.message ?? ""));
    }
  };

  // 4. 整批删除
  const handleBatchDelete = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要删除的记录！");
      return;
    }
    try {
      await batchDeleteRows(activeTable, selectedRecordIds);
      message.success(`已批量删除 ${selectedRecordIds.length} 条记录！`);
      setSelectedRecordIds([]);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量删除失败：" + (e?.message ?? ""));
    }
  };

  // 响应式栅格列数：桌面7列，平板4列，手机3列
  const gridColumns = screens.xl ? 7 : screens.lg ? 6 : screens.md ? 4 : 3;

  return (
    <div className="page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* 标题与口号 */}
      <div style={{ marginBottom: 14 }}>
        <h2 className="page-title" style={{ marginBottom: 2 }}>
          记一笔
        </h2>
        <div className="page-sub" style={{ color: "#64748b", fontSize: 13 }}>
          选班级 → 选项目 → 在名单上点，一轮 30 秒记完。
        </div>
      </div>

      <Spin spinning={loadingStudents || loadingItems || loadingBehavior || loadingAcademic}>
        {/* 控制面板卡片 */}
        <Card size="small" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 行 1：班级切换 */}
            {classes.length > 0 && (
              <div style={{ overflowX: "auto", paddingBottom: 2 }}>
                <Segmented
                  options={classes}
                  value={班级}
                  onChange={(val) => set班级(val as string)}
                  size="middle"
                />
              </div>
            )}

            {/* 行 2：学业轨项目 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#64748b", minWidth: 32 }}>学业</span>
              {academicItems.map((it) => {
                const isSelected = it.项目名 === currentItem?.项目名;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedItemName(it.项目名)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: 18,
                      fontSize: 13,
                      border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                      background: isSelected ? "#1677ff" : "#fff",
                      color: isSelected ? "#fff" : "#334155",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {it.项目名}
                  </button>
                );
              })}
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  newItemForm.setFieldsValue({ 类型: "学业", 计分制: "过关" });
                  setNewItemOpen(true);
                }}
                style={{ borderRadius: 18 }}
              >
                新项目
              </Button>
            </div>

            {/* 行 3：表现轨项目 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#64748b", minWidth: 32 }}>表现</span>
              {behaviorItems.map((it) => {
                const isSelected = it.项目名 === currentItem?.项目名;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedItemName(it.项目名)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: 18,
                      fontSize: 13,
                      border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                      background: isSelected ? "#1677ff" : "#fff",
                      color: isSelected ? "#fff" : "#334155",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {it.项目名}
                  </button>
                );
              })}
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  newItemForm.setFieldsValue({ 类型: "表现", 计分制: "加减分" });
                  setNewItemOpen(true);
                }}
                style={{ borderRadius: 18 }}
              >
                新项目
              </Button>
            </div>

            {/* 行 4：日期与模式参数 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                borderTop: "1px dashed #f1f5f9",
                paddingTop: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>日期</span>
                <DatePicker
                  value={recordDate}
                  onChange={(d) => d && setRecordDate(d)}
                  format="YYYY/MM/DD"
                  allowClear={false}
                  size="small"
                  style={{ width: 120 }}
                />
              </div>

              {/* 加减分微调器 */}
              {scoreKind === "加减分" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>分值</span>
                  {[1, 2, -1, -2].map((v) => {
                    const isSelected = activeDelta === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setActiveDelta(v)}
                        style={{
                          width: 38,
                          height: 28,
                          borderRadius: 6,
                          border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                          background: isSelected ? "#e6f4ff" : "#fff",
                          color: isSelected ? "#0958d9" : "#475569",
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {v > 0 ? `+${v}` : v}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 过关模式逆向快捷键 */}
              {scoreKind === "过关" && (
                <Button
                  type="primary"
                  size="small"
                  onClick={handleAllPass}
                  style={{ background: "#389e0d", borderColor: "#389e0d" }}
                >
                  全班都完成
                </Button>
              )}

              {/* 打钩模式逆向快捷键 */}
              {scoreKind === "打钩" && (
                <Button type="primary" size="small" onClick={handleAllCheck}>
                  全班都打钩
                </Button>
              )}

              {/* 右侧：本轮计数器 */}
              <div style={{ marginLeft: "auto", fontSize: 13, color: "#94a3b8" }}>
                本轮 {recordedCount}/{roster.length}
              </div>
            </div>

            {/* 行 5：操作提示与辅助按钮 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              <div>
                当前是「{currentItem?.项目名}」（{scoreKind}）：
                {scoreKind === "加减分" && "先选分值，再点名字，可以连点。"}
                {scoreKind === "过关" && "过了点「过关」，没过点「未过」——没过的自动进入待补测。"}
                {scoreKind === "打钩" && "点击打钩完成，再次点击取消。"}
                {currentItem && (
                  <Space style={{ marginLeft: 8 }}>
                    <a
                      onClick={() => {
                        renameForm.setFieldsValue({ 新项目名: currentItem.项目名 });
                        setRenameOpen(true);
                      }}
                      style={{ fontSize: 12 }}
                    >
                      改名
                    </a>
                    <Popconfirm
                      title={`确定删除项目「${currentItem.项目名}」吗？`}
                      description="不会删除已有的历史记录"
                      onConfirm={handleDeleteItem}
                      okText="确定"
                      cancelText="取消"
                    >
                      <a style={{ fontSize: 12, color: "#cf1322" }}>删除</a>
                    </Popconfirm>
                  </Space>
                )}
              </div>

              <Space>
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  撤销上一笔
                </Button>
                <Button
                  size="small"
                  icon={<UnorderedListOutlined />}
                  onClick={() => {
                    setTargetClass(班级);
                    setTargetDate(recordDate);
                    setTargetItem(currentItem?.项目名 ?? "");
                    setSelectedRecordIds([]);
                    setRecordsModalOpen(true);
                  }}
                >
                  本轮记录
                </Button>
              </Space>
            </div>
          </div>
        </Card>

        {/* 标题横条 */}
        <div
          style={{
            background: "#1e293b",
            color: "#fff",
            borderRadius: "8px 8px 0 0",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              {班级} | {currentItem?.项目名}
            </span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>
              （共 {studentGroups.length} 组 / {roster.length} 人）
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* 视图切换：按组展示 vs 平铺展示 */}
            <Segmented
              size="small"
              value={viewMode}
              onChange={(val) => setViewMode(val as "group" | "flat")}
              options={[
                { label: "按组展示", value: "group", icon: <TeamOutlined /> },
                { label: "平铺展示", value: "flat" },
              ]}
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
            />
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>
              {recordDate.format("MM/DD")}
            </span>
          </div>
        </div>

        {/* 下方：学生卡片呈现（按组展示 / 平铺展示） */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            padding: 12,
          }}
        >
          {(() => {
            // 单个学生卡片渲染函数
            const renderCard = (s: Row, isLeader: boolean, showGroupName = false) => {
              const behaviorStat = studentBehaviorMap.get(s.姓名);
              const academicStat = studentAcademicMap.get(s.姓名);
              const isPassed = academicStat?.结果 === "过关";
              const isFailed = academicStat?.结果 === "未过";
              const isChecked = academicStat?.结果 === "√";

              const roleBadge = isLeader ? (
                <Tag
                  color="gold"
                  style={{
                    margin: 0,
                    fontSize: 10,
                    padding: "0 4px",
                    lineHeight: "16px",
                    fontWeight: 700,
                    borderRadius: 4,
                    border: "none",
                  }}
                >
                  👑 组长
                </Tag>
              ) : (
                <Tag
                  style={{
                    margin: 0,
                    fontSize: 10,
                    padding: "0 4px",
                    lineHeight: "16px",
                    color: "#64748b",
                    background: "#f1f5f9",
                    borderRadius: 4,
                    border: "none",
                  }}
                >
                  组员
                </Tag>
              );

              // 1. 表现加减分模式
              if (scoreKind === "加减分") {
                const hasScore = behaviorStat && behaviorStat.total !== 0;
                return (
                  <button
                    key={s.学号}
                    type="button"
                    className="fast-tap-card"
                    onClick={() => handleTapBehavior(s.姓名)}
                    style={{
                      position: "relative",
                      minHeight: 56,
                      padding: "8px 8px",
                      borderRadius: 10,
                      border: hasScore
                        ? "1.5px solid #1677ff"
                        : isLeader
                        ? "1.5px solid #facc15"
                        : "1px solid #e2e8f0",
                      background: hasScore ? "#f0f7ff" : isLeader ? "#fffdf5" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      userSelect: "none",
                      transition: "all 0.1s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                        {s.姓名}
                      </span>
                      {roleBadge}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        marginTop: 4,
                      }}
                    >
                      {showGroupName && s.小组 ? (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{s.小组}</span>
                      ) : (
                        <span />
                      )}
                      {hasScore && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: behaviorStat.total > 0 ? "#1677ff" : "#cf1322",
                            background: behaviorStat.total > 0 ? "#e6f4ff" : "#fff1f0",
                            borderRadius: 10,
                            padding: "0 5px",
                            lineHeight: "16px",
                          }}
                        >
                          {behaviorStat.total > 0 ? `+${behaviorStat.total}` : behaviorStat.total}
                        </span>
                      )}
                    </div>
                  </button>
                );
              }

              // 2. 过关类模式
              if (scoreKind === "过关") {
                return (
                  <div
                    key={s.学号}
                    className="fast-tap-card"
                    style={{
                      padding: "8px 8px",
                      borderRadius: 10,
                      border: isPassed
                        ? "1.5px solid #52c41a"
                        : isFailed
                        ? "1.5px solid #fa8c16"
                        : isLeader
                        ? "1.5px solid #facc15"
                        : "1px solid #e2e8f0",
                      background: isPassed
                        ? "#f6ffed"
                        : isFailed
                        ? "#fffbe6"
                        : isLeader
                        ? "#fffdf5"
                        : "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1e293b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span>{s.姓名}</span>
                        {isPassed && <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 13 }} />}
                        {isFailed && <CloseCircleOutlined style={{ color: "#fa8c16", fontSize: 13 }} />}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {showGroupName && s.小组 && (
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{s.小组}</span>
                        )}
                        {roleBadge}
                      </div>
                    </div>

                    {/* 子按键：过关 / 未过 */}
                    <div style={{ display: "flex", gap: 5, width: "100%" }}>
                      <button
                        type="button"
                        onClick={() => handleSetPass(s.姓名, "过关")}
                        style={{
                          flex: 1,
                          padding: "3px 0",
                          fontSize: 12,
                          borderRadius: 4,
                          border: isPassed ? "1px solid #52c41a" : "1px solid #d9d9d9",
                          background: isPassed ? "#52c41a" : "#fff",
                          color: isPassed ? "#fff" : "#52c41a",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "all 0.1s ease",
                        }}
                      >
                        过关
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetPass(s.姓名, "未过")}
                        style={{
                          flex: 1,
                          padding: "3px 0",
                          fontSize: 12,
                          borderRadius: 4,
                          border: isFailed ? "1px solid #fa8c16" : "1px solid #d9d9d9",
                          background: isFailed ? "#fa8c16" : "#fff",
                          color: isFailed ? "#fff" : "#fa8c16",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "all 0.1s ease",
                        }}
                      >
                        未过
                      </button>
                    </div>
                  </div>
                );
              }

              // 3. 打钩类模式
              return (
                <button
                  key={s.学号}
                  type="button"
                  className="fast-tap-card"
                  onClick={() => handleToggleCheck(s.姓名)}
                  style={{
                    minHeight: 52,
                    padding: "8px 8px",
                    borderRadius: 10,
                    border: isChecked
                      ? "1.5px solid #52c41a"
                      : isLeader
                      ? "1.5px solid #facc15"
                      : "1px solid #e2e8f0",
                    background: isChecked
                      ? "#f6ffed"
                      : isLeader
                      ? "#fffdf5"
                      : "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    userSelect: "none",
                    transition: "all 0.1s ease",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                      {s.姓名}
                    </span>
                    {isChecked && (
                      <CheckOutlined style={{ color: "#52c41a", fontSize: 13, fontWeight: 700 }} />
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {showGroupName && s.小组 && (
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{s.小组}</span>
                    )}
                    {roleBadge}
                  </div>
                </button>
              );
            };

            // 模式 A：按组展示（默认）
            if (viewMode === "group") {
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {studentGroups.map((group) => {
                    const leader =
                      group.students.find((s) => (s.标签 || "").includes("组长")) ||
                      group.students[0];
                    const passCount = group.students.filter(
                      (s) => studentAcademicMap.get(s.姓名)?.结果 === "过关"
                    ).length;
                    const isAllPassed =
                      group.students.length > 0 && passCount === group.students.length;

                    return (
                      <div
                        key={group.groupName}
                        style={{
                          background: "#f8fafc",
                          border: isAllPassed ? "1px solid #b7eb8f" : "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding: "10px 12px 12px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {/* 小组标题栏 */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                            paddingBottom: 6,
                            borderBottom: "1px dashed #cbd5e1",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                              👥 {group.groupName}
                            </span>
                            {leader && (
                              <Tag color="gold" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                                组长：{leader.姓名}
                              </Tag>
                            )}
                            <span style={{ fontSize: 12, color: "#64748b" }}>
                              共 {group.students.length} 人
                            </span>
                            {scoreKind === "过关" && (
                              <Tag
                                color={
                                  isAllPassed ? "success" : passCount > 0 ? "processing" : "default"
                                }
                                style={{ margin: 0, fontSize: 11 }}
                              >
                                {passCount}/{group.students.length} 已过关
                              </Tag>
                            )}
                          </div>

                          {scoreKind === "过关" && (
                            <Button
                              size="small"
                              type={isAllPassed ? "default" : "primary"}
                              ghost={!isAllPassed}
                              style={{ fontSize: 12, height: 24, padding: "0 8px" }}
                              onClick={() => {
                                if (isAllPassed) {
                                  handleResetGroup(group.students, group.groupName);
                                } else {
                                  handlePassGroup(group.students, group.groupName);
                                }
                              }}
                            >
                              {isAllPassed ? "重新全过" : "本组全过"}
                            </Button>
                          )}
                        </div>

                        {/* 小组成员卡片网格 */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: 10,
                          }}
                        >
                          {group.students.map((s, idx) => {
                            const isLeader =
                              (s.标签 || "").includes("组长") || idx === 0;
                            return renderCard(s, isLeader, false);
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // 模式 B：全部平铺展示
            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: 10,
                }}
              >
                {roster.map((s, idx) => {
                  const isLeader = (s.标签 || "").includes("组长");
                  return renderCard(s, isLeader, true);
                })}
              </div>
            );
          })()}
        </div>
      </Spin>

      {/* 弹窗 1：本轮记录明细与四大整批纠错神技 */}
      <Modal
        title={`本轮记录明细（${班级} · ${currentItem?.项目名} · ${recordDate.format("MM/DD")}）`}
        open={recordsModalOpen}
        onCancel={() => setRecordsModalOpen(false)}
        width={680}
        footer={null}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 记录列表 */}
          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              border: "1px solid #f1f5f9",
              borderRadius: 8,
              padding: 8,
            }}
          >
            {currentRecords.length === 0 ? (
              <Empty description="本轮还没有任何记录" style={{ padding: "20px 0" }} />
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    borderBottom: "1px solid #f1f5f9",
                    marginBottom: 6,
                  }}
                >
                  <Checkbox
                    checked={
                      selectedRecordIds.length === currentRecords.length &&
                      currentRecords.length > 0
                    }
                    indeterminate={
                      selectedRecordIds.length > 0 &&
                      selectedRecordIds.length < currentRecords.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRecordIds(currentRecords.map((r) => r.id));
                      } else {
                        setSelectedRecordIds([]);
                      }
                    }}
                  >
                    全选（已选 {selectedRecordIds.length} / {currentRecords.length}）
                  </Checkbox>
                </div>

                {currentRecords.map((r) => {
                  const isChecked = selectedRecordIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 8px",
                        borderBottom: "1px solid #f8fafc",
                        fontSize: 13,
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecordIds((prev) => [...prev, r.id]);
                          } else {
                            setSelectedRecordIds((prev) => prev.filter((id) => id !== r.id));
                          }
                        }}
                      />
                      <span style={{ color: "#94a3b8" }}>{r.日期}</span>
                      <Tag>{r.班级}</Tag>
                      <strong style={{ color: "#0f172a" }}>{r.学生}</strong>
                      <span style={{ color: "#64748b" }}>· {r.项目}:</span>
                      <strong
                        style={{
                          color:
                            isBehavior && parseFloat(r.分值) > 0
                              ? "#1677ff"
                              : isBehavior
                              ? "#cf1322"
                              : r.结果 === "过关"
                              ? "#52c41a"
                              : "#fa8c16",
                        }}
                      >
                        {isBehavior ? r.分值 : r.结果}
                      </strong>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* 底部整批纠错控制条 */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              整批纠错工具（针对勾选的 {selectedRecordIds.length} 条记录）
            </div>

            {/* 1. 整批改班级 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, minWidth: 70, color: "#64748b" }}>改到班级:</span>
              <Select
                size="small"
                value={targetClass}
                onChange={setTargetClass}
                style={{ width: 130 }}
                options={classes.map((c) => ({ value: c, label: c }))}
              />
              <Button size="small" onClick={handleBatchUpdateClass}>
                改班级
              </Button>
            </div>

            {/* 2. 整批改日期 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, minWidth: 70, color: "#64748b" }}>改日期:</span>
              <DatePicker
                size="small"
                value={targetDate}
                onChange={(d) => d && setTargetDate(d)}
                format="YYYY/MM/DD"
                allowClear={false}
                style={{ width: 130 }}
              />
              <Button size="small" onClick={handleBatchUpdateDate}>
                改日期
              </Button>
            </div>

            {/* 3. 整批改项目 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, minWidth: 70, color: "#64748b" }}>改项目:</span>
              <Select
                size="small"
                value={targetItem}
                onChange={setTargetItem}
                style={{ width: 160 }}
                options={(isBehavior ? behaviorItems : academicItems).map((it) => ({
                  value: it.项目名,
                  label: it.项目名,
                }))}
              />
              <Button size="small" onClick={handleBatchUpdateItem}>
                改项目
              </Button>
            </div>

            {/* 4. 整批删除 */}
            <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 8 }}>
              <Popconfirm
                title={`确定删除选中的 ${selectedRecordIds.length} 条记录吗？`}
                onConfirm={handleBatchDelete}
                okText="确定删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  disabled={selectedRecordIds.length === 0}
                >
                  整批删除勾选的
                </Button>
              </Popconfirm>
            </div>
          </div>
        </div>
      </Modal>

      {/* 弹窗 2：新建项目 Modal */}
      <Modal
        title="新项目"
        open={newItemOpen}
        onCancel={() => setNewItemOpen(false)}
        onOk={() => newItemForm.submit()}
        okText="创建项目"
      >
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          建好马上就能在快速记录里点。
        </div>
        <Form
          form={newItemForm}
          layout="vertical"
          initialValues={{ 类型: "表现", 计分制: "加减分" }}
          onFinish={handleCreateNewItem}
        >
          <Form.Item
            name="项目名"
            label="叫什么"
            rules={[{ required: true, message: "请输入项目名（如：跳绳达标、课堂发言）" }]}
          >
            <Input placeholder="比如：第四单元测 / 跳绳达标 / 课堂纪律" />
          </Form.Item>

          <Form.Item name="类型" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "学业", label: "学业" },
                { value: "表现", label: "表现" },
              ]}
              onChange={(val) => {
                if (val === "表现") {
                  newItemForm.setFieldValue("计分制", "加减分");
                } else {
                  newItemForm.setFieldValue("计分制", "过关");
                }
              }}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.类型 !== cur.类型}
          >
            {({ getFieldValue }) => {
              const typeVal = getFieldValue("类型");
              const options =
                typeVal === "表现"
                  ? [{ value: "加减分", label: "加减分" }]
                  : [
                      { value: "过关", label: "过关" },
                      { value: "打钩", label: "打钩" },
                      { value: "等第", label: "等第" },
                      { value: "分数", label: "分数" },
                    ];
              return (
                <Form.Item name="计分制" label="怎么记" rules={[{ required: true }]}>
                  <Select options={options} />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* 弹窗 3：改名 Modal */}
      <Modal
        title="修改项目名称"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => renameForm.submit()}
        okText="保存"
      >
        <Form form={renameForm} layout="vertical" onFinish={handleRenameItem}>
          <Form.Item
            name="新项目名"
            label="新项目名"
            rules={[{ required: true, message: "请输入新名称" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
