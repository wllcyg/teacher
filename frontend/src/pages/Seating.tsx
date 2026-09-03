import { useMemo, useState } from "react";
import {
  Card,
  Button,
  Space,
  message,
  Tag,
  InputNumber,
  Segmented,
  Popconfirm,
  Spin,
} from "antd";
import {
  PrinterOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";

export default function Seating() {
  const { 班级, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();

  // 当前点选选中的学生（触屏模式/鼠标点击模式）
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  // 拖拽悬停的目标格子
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // 数据查询
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => listTable("students"),
  });
  const { data: duties, isLoading: loadingDuties } = useQuery({
    queryKey: ["duties"],
    queryFn: () => listTable("duties"),
  });

  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  // 本班所有座位相关记录
  const classDuties = useMemo(
    () => (duties ?? []).filter((d) => d.类型 === "座位" && (d.时间 === 班级 || !d.时间)),
    [duties, 班级]
  );

  // 座位配置行（岗位="6x8"，时间=班级）
  const configRow = useMemo(
    () => classDuties.find((d) => d.学生 === "（系统）座位配置" && d.时间 === 班级),
    [classDuties, 班级]
  );

  // 行数与列数（默认 6 排 8 列）
  const [customRows, setCustomRows] = useState<number>(6);
  const [customCols, setCustomCols] = useState<number>(8);

  // 同步 configRow 中的行列数
  useMemo(() => {
    if (configRow) {
      const m = configRow.岗位.match(/^(\d+)x(\d+)$/);
      if (m) {
        setCustomRows(parseInt(m[1], 10));
        setCustomCols(parseInt(m[2], 10));
      }
    }
  }, [configRow]);

  const rows = customRows;
  const cols = customCols;

  // 座位坐标 key: "r-c" -> 记录
  const seatMap = useMemo(() => {
    const map = new Map<string, Row>();
    for (const d of classDuties) {
      if (d.学生 === "（系统）座位配置") continue;
      const m = d.岗位.match(/^(\d+)排(\d+)列$/);
      if (m) {
        map.set(`${m[1]}-${m[2]}`, d);
      }
    }
    return map;
  }, [classDuties]);

  // 已落座学生集合
  const seatedNames = useMemo(() => {
    const set = new Set<string>();
    for (const d of seatMap.values()) {
      if (d.学生) set.add(d.学生);
    }
    return set;
  }, [seatMap]);

  // 未安排座位的学生列表（按学号排序）
  const unseatedStudents = useMemo(() => {
    return roster
      .filter((s) => !seatedNames.has(s.姓名))
      .sort((a, b) => (a.学号 || "").localeCompare(b.学号 || "", undefined, { numeric: true }));
  }, [roster, seatedNames]);

  // ---------- 保存行列配置 ----------
  const handleSaveConfig = async (newR: number, newC: number) => {
    setCustomRows(newR);
    setCustomCols(newC);
    const posStr = `${newR}x${newC}`;
    try {
      if (configRow) {
        await updateRow("duties", configRow.id, { ...configRow, 岗位: posStr });
      } else {
        await createRow("duties", {
          学生: "（系统）座位配置",
          类型: "座位",
          时间: 班级,
          岗位: posStr,
          备注: "",
        });
      }
      qc.invalidateQueries({ queryKey: ["duties"] });
    } catch (e: any) {
      message.error("保存座位规格失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 单个座位落座 / 移出 / 互换 ----------
  const setSeatStudent = async (r: number, c: number, studentName: string) => {
    const key = `${r}-${c}`;
    const pos = `${r}排${c}列`;
    const exist = seatMap.get(key);

    if (studentName) {
      if (exist) {
        await updateRow("duties", exist.id, { ...exist, 学生: studentName });
      } else {
        await createRow("duties", {
          岗位: pos,
          学生: studentName,
          类型: "座位",
          时间: 班级,
          备注: "",
        });
      }
    } else {
      if (exist) {
        await deleteRow("duties", exist.id);
      }
    }
  };

  // 移出某座位的学生（清空该格子）
  const handleUnseat = async (r: number, c: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = `${r}-${c}`;
    const exist = seatMap.get(key);
    if (exist) {
      try {
        await deleteRow("duties", exist.id);
        qc.invalidateQueries({ queryKey: ["duties"] });
      } catch (err: any) {
        message.error("移除失败");
      }
    }
  };

  // ---------- 拖拽核心交互 (HTML5 Drag & Drop) ----------

  // 1. 拖动开始：从池子拖动 or 从某个座位拖动
  const handleDragStartFromPool = (e: React.DragEvent, studentName: string) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "from-pool", student: studentName })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartFromSeat = (
    e: React.DragEvent,
    studentName: string,
    r: number,
    c: number
  ) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "from-seat", student: studentName, r, c })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  // 2. 拖放到座位格子 (Drop on Seat)
  const handleDropOnSeat = async (e: React.DragEvent, targetR: number, targetC: number) => {
    e.preventDefault();
    setDragOverKey(null);
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      const targetKey = `${targetR}-${targetC}`;
      const targetCurrent = seatMap.get(targetKey)?.学生 || "";

      // 情况 A：从下方待安排池拖上来
      if (data.type === "from-pool") {
        const studentName = data.student;
        await setSeatStudent(targetR, targetC, studentName);
        message.success(`${studentName} 已落座 ${targetR}排${targetC}列`);
        qc.invalidateQueries({ queryKey: ["duties"] });
      }
      // 情况 B：从另一个座位拖动过来（内部拖动 / 互换）
      else if (data.type === "from-seat") {
        const sourceR = data.r;
        const sourceC = data.c;
        const sourceStudent = data.student;

        // 如果拖到原座位，不作处理
        if (sourceR === targetR && sourceC === targetC) return;

        // 目标格子已有学生 -> 两人互换座位！
        if (targetCurrent) {
          await setSeatStudent(targetR, targetC, sourceStudent);
          await setSeatStudent(sourceR, sourceC, targetCurrent);
          message.success(`${sourceStudent} 与 ${targetCurrent} 互换座位！`);
        } else {
          // 目标格子为空 -> 移动到新格子，并清空原格子
          await setSeatStudent(targetR, targetC, sourceStudent);
          await setSeatStudent(sourceR, sourceC, "");
          message.success(`${sourceStudent} 移动到 ${targetR}排${targetC}列`);
        }
        qc.invalidateQueries({ queryKey: ["duties"] });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // 3. 拖回下方待选池 (Drop on Pool to Unseat)
  const handleDropOnPool = async (e: React.DragEvent) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;
    try {
      const data = JSON.parse(dataStr);
      if (data.type === "from-seat") {
        await handleUnseat(data.r, data.c);
        message.success(`${data.student} 已移出座位`);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // ---------- 触屏与点击模式（点名字 -> 点格子） ----------
  const handleSeatClick = async (r: number, c: number) => {
    const key = `${r}-${c}`;
    const currentOccupant = seatMap.get(key)?.学生 || "";

    // 如果当前选了未坐学生，点空格子落座
    if (selectedStudent) {
      await setSeatStudent(r, c, selectedStudent);
      message.success(`${selectedStudent} 已落座 ${r}排${c}列`);
      setSelectedStudent("");
      qc.invalidateQueries({ queryKey: ["duties"] });
      return;
    }

    // 如果没选待坐学生，但点击了有人的格子，选中该座位的学生以便移动
    if (currentOccupant) {
      setSelectedStudent(currentOccupant);
      message.info(`已选中「${currentOccupant}」，点击其他空格移动，或点原位移回待选池`);
    }
  };

  // ---------- 快捷功能：按学号蛇形自动填充 ----------
  const handleAutoFillSerpentine = async () => {
    try {
      // 1. 清理已有座位
      const deletePromises = Array.from(seatMap.values()).map((d) => deleteRow("duties", d.id));
      await Promise.all(deletePromises);

      // 2. 蛇形填充排座
      const createPromises: Promise<any>[] = [];
      let studentIndex = 0;

      for (let r = 1; r <= rows; r++) {
        // 奇数排：1 -> cols；偶数排：cols -> 1（蛇形行走）
        const colIndices =
          r % 2 === 1
            ? Array.from({ length: cols }, (_, i) => i + 1)
            : Array.from({ length: cols }, (_, i) => cols - i);

        for (const c of colIndices) {
          if (studentIndex >= roster.length) break;
          const s = roster[studentIndex];
          createPromises.push(
            createRow("duties", {
              岗位: `${r}排${c}列`,
              学生: s.姓名,
              类型: "座位",
              时间: 班级,
              备注: "",
            })
          );
          studentIndex++;
        }
      }

      await Promise.all(createPromises);
      message.success(`已按学号蛇形为全班 ${roster.length} 名学生安排好座位！可继续拖拽微调。`);
      qc.invalidateQueries({ queryKey: ["duties"] });
    } catch (e: any) {
      message.error("自动排座失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 清空全部座位 ----------
  const handleClearAllSeats = async () => {
    try {
      const deletePromises = Array.from(seatMap.values()).map((d) => deleteRow("duties", d.id));
      await Promise.all(deletePromises);
      message.success("已清空所有座位！");
      qc.invalidateQueries({ queryKey: ["duties"] });
    } catch (e: any) {
      message.error("清空失败：" + (e?.message ?? ""));
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* 头部标题与 A4 打印 */}
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
          <h2 className="page-title" style={{ marginBottom: 2 }}>
            {班级} 座位表
          </h2>
          <div className="page-sub" style={{ color: "#64748b", fontSize: 13 }}>
            鼠标可拖动未落座学生或已坐学生；触屏按「点对象 → 点格子」排座。座位实时存储，换设备也在。
          </div>
        </div>

        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={() => window.print()}
          className="no-print"
        >
          A4 打印
        </Button>
      </div>

      <Spin spinning={loadingStudents || loadingDuties}>
        {/* 操作区卡片 */}
        <Card size="small" className="no-print" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            {/* 班级切换 */}
            {classes.length > 0 && (
              <Segmented
                options={classes}
                value={班级}
                onChange={(val) => set班级(val as string)}
                size="middle"
              />
            )}

            {/* 行列规格与快捷按钮 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span>行</span>
                <InputNumber
                  size="small"
                  min={1}
                  max={12}
                  value={rows}
                  onChange={(v) => v && handleSaveConfig(v, cols)}
                  style={{ width: 54 }}
                />
                <span>列</span>
                <InputNumber
                  size="small"
                  min={1}
                  max={14}
                  value={cols}
                  onChange={(v) => v && handleSaveConfig(rows, v)}
                  style={{ width: 54 }}
                />
              </div>

              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={handleAutoFillSerpentine}
                title="只是省打字的起点，坐哪你说算"
              >
                自动填充起点 (按学号蛇形)
              </Button>

              <Popconfirm
                title="确定要清空全班座位吗？"
                onConfirm={handleClearAllSeats}
                okText="清空"
                cancelText="取消"
              >
                <Button size="small" danger icon={<ClearOutlined />}>
                  清空座位
                </Button>
              </Popconfirm>
            </div>
          </div>
        </Card>

        {/* 教室座位核心大图 */}
        <Card size="small" style={{ marginBottom: 16, overflowX: "auto" }}>
          <div
            style={{
              minWidth: cols * 86 + 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "16px 8px",
            }}
          >
            {/* 讲台 */}
            <div
              style={{
                width: 240,
                height: 38,
                borderRadius: 8,
                border: "2px solid #334155",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                color: "#1e293b",
                letterSpacing: 8,
                marginBottom: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              讲 台
            </div>

            {/* 座位网格 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 84px)`,
                gap: 10,
              }}
            >
              {Array.from({ length: rows }).map((_, rIdx) => {
                const r = rIdx + 1;
                return Array.from({ length: cols }).map((_, cIdx) => {
                  const c = cIdx + 1;
                  const key = `${r}-${c}`;
                  const occupant = seatMap.get(key)?.学生 || "";
                  const isDragOver = dragOverKey === key;
                  const isSelectedForMove = selectedStudent && selectedStudent === occupant;

                  return (
                    <div
                      key={key}
                      onClick={() => handleSeatClick(r, c)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverKey !== key) setDragOverKey(key);
                      }}
                      onDragLeave={() => {
                        if (dragOverKey === key) setDragOverKey(null);
                      }}
                      onDrop={(e) => handleDropOnSeat(e, r, c)}
                      draggable={!!occupant}
                      onDragStart={(e) => occupant && handleDragStartFromSeat(e, occupant, r, c)}
                      style={{
                        width: 84,
                        height: 52,
                        borderRadius: 8,
                        border: isDragOver
                          ? "2px dashed #1677ff"
                          : isSelectedForMove
                          ? "2px solid #1677ff"
                          : occupant
                          ? "1px solid #cbd5e1"
                          : "1.5px dashed #cbd5e1",
                        background: isDragOver
                          ? "#e6f4ff"
                          : isSelectedForMove
                          ? "#f0f7ff"
                          : occupant
                          ? "#ffffff"
                          : "rgba(248, 250, 252, 0.7)",
                        boxShadow: occupant ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
                        cursor: occupant ? "grab" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        userSelect: "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {occupant ? (
                        <>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#0f172a",
                            }}
                          >
                            {occupant}
                          </span>
                          {/* 右上角移出小按钮 */}
                          <button
                            type="button"
                            onClick={(e) => handleUnseat(r, c, e)}
                            title="移回未安排池"
                            className="no-print"
                            style={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              width: 16,
                              height: 16,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#94a3b8",
                              borderRadius: "50%",
                              padding: 0,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#cf1322")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                          >
                            <CloseOutlined style={{ fontSize: 10 }} />
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8", opacity: 0.6 }}>
                          {r}-{c}
                        </span>
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </Card>

        {/* 下方：还没座位的学生池（支持拖回待选池） */}
        <Card
          size="small"
          className="no-print"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnPool}
        >
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              还没座位的 {unseatedStudents.length} 人（可拖拽落座，或点名字再点格子）：
            </span>
            {selectedStudent && (
              <Tag
                color="processing"
                closable
                onClose={() => setSelectedStudent("")}
                style={{ fontSize: 13, padding: "2px 8px" }}
              >
                当前选中：{selectedStudent}（点击座位落座）
              </Tag>
            )}
          </div>

          {unseatedStudents.length === 0 ? (
            <div style={{ color: "#52c41a", fontSize: 13, padding: "8px 0" }}>
              🎉 全班所有学生都已安排好座位！
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {unseatedStudents.map((s) => {
                const isSelected = selectedStudent === s.姓名;
                return (
                  <div
                    key={s.学号}
                    draggable
                    onDragStart={(e) => handleDragStartFromPool(e, s.姓名)}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedStudent("");
                      } else {
                        setSelectedStudent(s.姓名);
                        message.info(`已选中「${s.姓名}」，点击上方空格子落座`);
                      }
                    }}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 18,
                      border: isSelected ? "1.5px solid #1677ff" : "1px solid #cbd5e1",
                      background: isSelected ? "#e6f4ff" : "#ffffff",
                      color: isSelected ? "#0958d9" : "#334155",
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 500,
                      cursor: "grab",
                      userSelect: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {s.姓名}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </Spin>
    </div>
  );
}
