import { useMemo, useState, useEffect, useCallback } from "react";
import { Spin, message, Grid } from "antd";
import { PullToRefresh, Toast } from "antd-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import {
  createRow,
  deleteRow,
  updateRow,
  listTable,
  batchDeleteRows,
  batchUpdateRows,
  batchUpsertAcademic,
} from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";
import { triggerHaptic } from "../utils/haptics";
import type { UndoAction, ScoreKind, StudentGroup, ViewMode } from "./quicknote/types";
import { QuickNoteControlPanel } from "./quicknote/QuickNoteControlPanel";
import { QuickNoteStudentGrid } from "./quicknote/QuickNoteStudentGrid";
import { QuickNoteRecordsModal } from "./quicknote/QuickNoteRecordsModal";
import { NewItemModal, RenameItemModal } from "./quicknote/QuickNoteItemModals";

const { useBreakpoint } = Grid;

export default function QuickNote() {
  const { 班级, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();
  const screens = useBreakpoint();

  // 当前日期
  const [recordDate, setRecordDate] = useState<Dayjs>(dayjs());

  // 当前选中的项目名
  const [selectedItemName, setSelectedItemName] = useState<string>("");

  // 学业过关的本次具体内容（如：第1段、全篇、词语表P32）
  const [passContent, setPassContent] = useState<string>("");

  // 加减分模式下的当前分值（+1, +2, -1, -2）
  const [activeDelta, setActiveDelta] = useState<number>(1);

  // 撤销栈（存放本会话最近的操作）
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // 视图模式：默认按组展示（"group"），支持切换为平铺展示（"flat"）
  const [viewMode, setViewMode] = useState<ViewMode>("group");

  // 弹窗状态
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<"学业" | "表现">("表现");
  const [renameOpen, setRenameOpen] = useState(false);
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);

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

  // 📱 antd-mobile 下拉手势刷新
  const handleRefreshQuickNote = async () => {
    triggerHaptic("light");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["students"] }),
      qc.invalidateQueries({ queryKey: ["items"] }),
      qc.invalidateQueries({ queryKey: ["behavior", 班级, recordDate.format("YYYY-MM-DD")] }),
      qc.invalidateQueries({ queryKey: ["academic", 班级, recordDate.format("YYYY-MM-DD")] }),
    ]);
    Toast.show({
      icon: "success",
      content: "已刷新打卡数据",
      duration: 1200,
    });
  };

  // 当前班级在册名单
  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  // 按名册中的小组组织学生，组号升序排列，未分组置底
  const studentGroups = useMemo<StudentGroup[]>(() => {
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
        students: groupStudents.sort((a, b) => {
          const aLeader = (a.标签 || "").includes("组长");
          const bLeader = (b.标签 || "").includes("组长");
          if (aLeader && !bLeader) return -1;
          if (!aLeader && bLeader) return 1;
          return (parseInt(a.学号, 10) || 0) - (parseInt(b.学号, 10) || 0);
        }),
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

  // 确保 selectedItemName 与当前项目同步（使用 useEffect 规避副作用）
  useEffect(() => {
    if (!selectedItemName && currentItem) {
      setSelectedItemName(currentItem.项目名);
    }
  }, [currentItem, selectedItemName]);

  // 判断当前项目的记录类型
  const isBehavior = currentItem?.类型 === "表现";
  const scoreKind: ScoreKind = useMemo(() => {
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
    return isBehavior ? studentBehaviorMap.size : studentAcademicMap.size;
  }, [isBehavior, studentBehaviorMap, studentAcademicMap]);

  // ---------- 核心点按行为回调 ----------

  // 1. 点按加减分
  const handleTapBehavior = useCallback(async (studentName: string) => {
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
  }, [currentItem, activeDelta, 班级, recordDate, qc]);

  // 2. 点按过关 / 未过
  const handleSetPass = useCallback(
    async (studentName: string, status: "过关" | "未过") => {
      if (!currentItem) return;
      triggerHaptic(status === "过关" ? "light" : "medium");
      try {
        const existing = studentAcademicMap.get(studentName);
        const note =
          status === "过关"
            ? passContent.trim() || existing?.备注 || ""
            : existing?.备注 || "";
        if (existing) {
          await updateRow("academic", existing.id, {
            结果: status,
            状态: status === "过关" ? "完成" : "未过",
            备注: note,
          });
        } else {
          const res = await createRow("academic", {
            班级,
            学生: studentName,
            项目: currentItem.项目名,
            日期: recordDate.format("YYYY-MM-DD"),
            结果: status,
            状态: status === "过关" ? "完成" : "未过",
            备注: note,
          });
          setUndoStack((prev) => [
            ...prev,
            {
              table: "academic",
              id: res.id,
              studentName,
              desc: `${studentName} ${status}${note ? ` (${note})` : ""}`,
            },
          ]);
        }
        qc.invalidateQueries({ queryKey: ["academic"] });
      } catch (e: any) {
        message.error("标记失败：" + (e?.message ?? ""));
      }
    },
    [currentItem, studentAcademicMap, 班级, recordDate, passContent, qc]
  );

  // 3. 全班都完成（过关）- 单次批量合并请求
  const handleAllPass = useCallback(async () => {
    if (!currentItem) return;
    triggerHaptic("success");
    try {
      const note = passContent.trim();
      const records = roster.map((s) => ({
        学生: s.姓名,
        结果: "过关",
        状态: "完成",
        备注: note,
      }));
      await batchUpsertAcademic({
        班级,
        项目: currentItem.项目名,
        日期: recordDate.format("YYYY-MM-DD"),
        records,
      });
      message.success(
        note
          ? `全班已全部标记为过关（${note}）！`
          : "全班已全部标记为过关！如有未过的请单独点其「未过」"
      );
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("批量操作失败：" + (e?.message ?? ""));
    }
  }, [currentItem, roster, 班级, recordDate, passContent, qc]);

  // 3.1 小组批量过关
  const handlePassGroup = useCallback(
    async (groupStudents: Row[], groupName: string) => {
      if (!currentItem) return;
      triggerHaptic("success");
      try {
        const note = passContent.trim();
        const records = groupStudents.map((s) => ({
          学生: s.姓名,
          结果: "过关",
          状态: "完成",
          备注: note,
        }));
        await batchUpsertAcademic({
          班级,
          项目: currentItem.项目名,
          日期: recordDate.format("YYYY-MM-DD"),
          records,
        });
        message.success(
          note
            ? `${groupName} 全体已标记为过关（${note}）`
            : `${groupName} 全体已标记为过关`
        );
        qc.invalidateQueries({ queryKey: ["academic"] });
      } catch (e: any) {
        message.error("小组操作失败：" + (e?.message ?? ""));
      }
    },
    [currentItem, 班级, recordDate, passContent, qc]
  );

  // 3.2 单独修改学生过关内容备注
  const handleEditStudentNote = useCallback(
    async (studentName: string, newNote: string) => {
      if (!currentItem) return;
      const existing = studentAcademicMap.get(studentName);
      const trimmed = newNote.trim();
      try {
        if (existing) {
          await updateRow("academic", existing.id, { 备注: trimmed });
        } else {
          await createRow("academic", {
            班级,
            学生: studentName,
            项目: currentItem.项目名,
            日期: recordDate.format("YYYY-MM-DD"),
            结果: "过关",
            状态: "完成",
            备注: trimmed,
          });
        }
        message.success(`已更新 ${studentName} 的过关内容`);
        qc.invalidateQueries({ queryKey: ["academic"] });
      } catch (e: any) {
        message.error("更新内容失败：" + (e?.message ?? ""));
      }
    },
    [currentItem, studentAcademicMap, 班级, recordDate, qc]
  );

  // 3.2 小组重置
  const handleResetGroup = useCallback(async (groupStudents: Row[], groupName: string) => {
    if (!currentItem) return;
    triggerHaptic("medium");
    try {
      const ids = groupStudents
        .map((s) => studentAcademicMap.get(s.姓名)?.id)
        .filter((id): id is number => typeof id === "number");

      if (ids.length > 0) {
        await batchDeleteRows("academic", ids);
      }
      message.success(`${groupName} 已重置为初始状态`);
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("重置小组失败：" + (e?.message ?? ""));
    }
  }, [currentItem, studentAcademicMap, qc]);

  // 4. 点按打钩切换
  const handleToggleCheck = useCallback(async (studentName: string) => {
    if (!currentItem) return;
    triggerHaptic("light");
    try {
      const existing = studentAcademicMap.get(studentName);
      if (existing) {
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
  }, [currentItem, studentAcademicMap, 班级, recordDate, qc]);

  // 5. 全班都打钩
  const handleAllCheck = useCallback(async () => {
    if (!currentItem) return;
    triggerHaptic("success");
    try {
      const records = roster.map((s) => ({
        学生: s.姓名,
        结果: "√",
        状态: "完成",
        备注: "",
      }));
      await batchUpsertAcademic({
        班级,
        项目: currentItem.项目名,
        日期: recordDate.format("YYYY-MM-DD"),
        records,
      });
      message.success("全班已全部打钩完成！");
      qc.invalidateQueries({ queryKey: ["academic"] });
    } catch (e: any) {
      message.error("批量打钩失败：" + (e?.message ?? ""));
    }
  }, [currentItem, roster, 班级, recordDate, qc]);

  // ---------- 撤销上一笔 ----------
  const handleUndo = async () => {
    if (undoStack.length === 0) {
      message.info("暂无上一笔可撤销的操作");
      return;
    }
    const last = undoStack[undoStack.length - 1];
    try {
      await deleteRow(last.table, last.id);
      triggerHaptic("medium");
      Toast.show({
        icon: "success",
        content: `已撤销：${last.desc}`,
        duration: 1500,
      });
      setUndoStack((prev) => prev.slice(0, -1));
      qc.invalidateQueries({ queryKey: [last.table] });
    } catch (e: any) {
      Toast.show({
        icon: "fail",
        content: "撤销失败，记录可能已被删除",
      });
      setUndoStack((prev) => prev.slice(0, -1));
    }
  };

  // ---------- 项目改名与删除 ----------
  const handleRenameItem = async (newName: string) => {
    if (!currentItem) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await updateRow("items", currentItem.id, { 项目名: trimmed });
      message.success(`已改名为「${trimmed}」`);
      setRenameOpen(false);
      setSelectedItemName(trimmed);
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
      setSelectedItemName(vals.项目名.trim());
      qc.invalidateQueries({ queryKey: ["items"] });
    } catch (e: any) {
      message.error("创建失败：" + (e?.message ?? "未知错误"));
    }
  };

  // ---------- 本轮记录整批纠错 ----------
  const activeTable = isBehavior ? "behavior" : "academic";

  const handleBatchUpdateClass = async (ids: number[], newClass: string) => {
    try {
      await batchUpdateRows(activeTable, ids, { 班级: newClass });
      message.success(`已成功将 ${ids.length} 条记录转移到「${newClass}」！`);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量修改班级失败：" + (e?.message ?? ""));
    }
  };

  const handleBatchUpdateDate = async (ids: number[], newDate: Dayjs) => {
    const newDateStr = newDate.format("YYYY-MM-DD");
    try {
      await batchUpdateRows(activeTable, ids, { 日期: newDateStr });
      message.success(`已成功将 ${ids.length} 条记录变更为「${newDateStr}」！`);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量修改日期失败：" + (e?.message ?? ""));
    }
  };

  const handleBatchUpdateItem = async (ids: number[], newItem: string) => {
    try {
      await batchUpdateRows(activeTable, ids, { 项目: newItem });
      message.success(`已成功将 ${ids.length} 条记录平移到「${newItem}」！`);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量修改项目失败：" + (e?.message ?? ""));
    }
  };

  const handleBatchDelete = async (ids: number[]) => {
    try {
      await batchDeleteRows(activeTable, ids);
      message.success(`已批量删除 ${ids.length} 条记录！`);
      qc.invalidateQueries({ queryKey: [activeTable] });
    } catch (e: any) {
      message.error("批量删除失败：" + (e?.message ?? ""));
    }
  };

  // 响应式栅格列数：桌面7列，平板4列，手机3列
  const gridColumns = screens.xl ? 7 : screens.lg ? 6 : screens.md ? 4 : 3;

  return (
    <PullToRefresh onRefresh={handleRefreshQuickNote}>
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
          {/* 控制面板 */}
          <QuickNoteControlPanel
            classes={classes}
            currentClass={班级}
            onChangeClass={set班级}
            academicItems={academicItems}
            behaviorItems={behaviorItems}
            currentItem={currentItem}
            onSelectItemName={setSelectedItemName}
            onOpenNewItem={(type) => {
              setNewItemType(type);
              setNewItemOpen(true);
            }}
            recordDate={recordDate}
            onChangeDate={setRecordDate}
            scoreKind={scoreKind}
            passContent={passContent}
            onChangePassContent={setPassContent}
            activeDelta={activeDelta}
            onChangeDelta={setActiveDelta}
            onAllPass={handleAllPass}
            onAllCheck={handleAllCheck}
            recordedCount={recordedCount}
            rosterLength={roster.length}
            onOpenRename={() => setRenameOpen(true)}
            onDeleteItem={handleDeleteItem}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
            onOpenRecordsModal={() => setRecordsModalOpen(true)}
          />

          {/* 学生卡片网格列表 */}
          <QuickNoteStudentGrid
            currentClass={班级}
            currentItem={currentItem}
            recordDate={recordDate}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            studentGroups={studentGroups}
            roster={roster}
            scoreKind={scoreKind}
            studentBehaviorMap={studentBehaviorMap}
            studentAcademicMap={studentAcademicMap}
            onTapBehavior={handleTapBehavior}
            onSetPass={handleSetPass}
            onToggleCheck={handleToggleCheck}
            onPassGroup={handlePassGroup}
            onResetGroup={handleResetGroup}
            onEditNote={handleEditStudentNote}
            gridColumns={gridColumns}
          />
        </Spin>

        {/* 弹窗 1：本轮记录明细与四大整批纠错神技 */}
        <QuickNoteRecordsModal
          open={recordsModalOpen}
          onClose={() => setRecordsModalOpen(false)}
          currentClass={班级}
          currentItem={currentItem}
          recordDate={recordDate}
          currentRecords={currentRecords}
          isBehavior={isBehavior}
          classes={classes}
          candidateItems={isBehavior ? behaviorItems : academicItems}
          onBatchUpdateClass={handleBatchUpdateClass}
          onBatchUpdateDate={handleBatchUpdateDate}
          onBatchUpdateItem={handleBatchUpdateItem}
          onBatchDelete={handleBatchDelete}
        />

        {/* 弹窗 2：新建项目 Modal */}
        <NewItemModal
          open={newItemOpen}
          onClose={() => setNewItemOpen(false)}
          defaultType={newItemType}
          onCreate={handleCreateNewItem}
        />

        {/* 弹窗 3：改名 Modal */}
        <RenameItemModal
          open={renameOpen}
          onClose={() => setRenameOpen(false)}
          currentItemName={currentItem?.项目名 ?? ""}
          onRename={handleRenameItem}
        />
      </div>
    </PullToRefresh>
  );
}
