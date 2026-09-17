import { useMemo, useState } from "react";
import {
  AutoComplete,
  Card,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Checkbox,
  Table,
  Modal,
  Tag,
  Empty,
  Spin,
  Space,
  Segmented,
  message,
  Alert,
  Collapse,
} from "antd";
import { CheckCircleOutlined, FormOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { batchUpsertAcademic, listAllTable } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";

export default function Scores() {
  const { 班级, class_id, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();

  // 考试名称（AutoComplete 可搜可建）
  const [examName, setExamName] = useState<string>("");
  const [examDate, setExamDate] = useState<Dayjs>(dayjs());
  const [examFullScore, setExamFullScore] = useState<number>(100);

  // 粘贴输入内容与解析预览
  const [pasteText, setPasteText] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedResults, setParsedResults] = useState<{
    matched: { student_name: string; student_no: string; score: string; 学生?: string; 学号?: string; 结果?: string }[];
    absent: { student_name: string; student_no: string; 学生?: string; 学号?: string }[];
    unrecognized: string[];
  }>({ matched: [], absent: [], unrecognized: [] });

  // 底部历次成绩：是否展示名次
  const [showRank, setShowRank] = useState(false);

  // 贴分区是否展开
  const [pasteExpanded, setPasteExpanded] = useState(true);

  // 数据查询（优先按 class_id 查询，避免 URL 中文编码）
  const queryClass = class_id || 班级;
  const classFilter = class_id ? { class_id } : { class_name: 班级 };

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students-all", queryClass],
    queryFn: () => listAllTable("students", classFilter),
    enabled: !!queryClass,
  });
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["items-all"],
    queryFn: () => listAllTable("items"),
    staleTime: 10 * 60 * 1000,
  });
  const { data: allAcademics, isLoading: loadingAcademics } = useQuery({
    queryKey: ["academic-all", queryClass],
    queryFn: () => listAllTable("academic", classFilter),
    enabled: !!queryClass,
  });

  // 在册学生列表（按学号自然序）
  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  // 所有「分数」类考试项目
  const scoreItems = useMemo(
    () =>
      (items ?? []).filter((it) => {
        const scoring = it.scoring_type || it.计分制 || "";
        return scoring.includes("分数");
      }),
    [items]
  );

  // AutoComplete 下拉选项：已有考试名列表，模糊匹配
  const examOptions = useMemo(() => {
    return scoreItems.map((it) => {
      const name = it.item_name || it.项目名;
      const full = it.full_score || it.满分 || 100;
      return {
        value: name as string,
        label: `${name}（满分 ${full}）`,
      };
    });
  }, [scoreItems]);

  // 当用户选中已有考试时，自动回填满分
  const handleExamSelect = (value: string) => {
    setExamName(value);
    const existing = scoreItems.find((it) => (it.item_name || it.项目名) === value);
    if (existing) {
      const full = parseFloat(existing.full_score || existing.满分) || 100;
      setExamFullScore(full);
    }
  };

  // ---------- 智能解析剪贴板文本 ----------
  const handleParseScores = () => {
    if (!examName.trim()) {
      message.warning("请先输入考试名称！");
      return;
    }
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      message.warning("请先在输入框中粘贴分数！");
      return;
    }

    const matchedMap = new Map<string, string>();
    const unrecognized: string[] = [];

    // 判断是否为纯分数列
    let pureNumberCount = 0;
    for (const line of lines) {
      if (/^\d+(\.\d+)?$/.test(line)) {
        pureNumberCount++;
      }
    }
    const isPureNumberMode = pureNumberCount >= lines.length * 0.7;

    if (isPureNumberMode) {
      lines.forEach((line, idx) => {
        const num = parseFloat(line);
        if (!isNaN(num) && idx < roster.length) {
          const sName = roster[idx].name || roster[idx].姓名;
          matchedMap.set(sName, String(num));
        } else {
          unrecognized.push(`第 ${idx + 1} 行: ${line}`);
        }
      });
    } else {
      const rosterNames = new Set(roster.map((s) => s.name || s.姓名));
      lines.forEach((line, idx) => {
        const parts = line.split(/[\t,，\s]+/).filter(Boolean);
        if (parts.length >= 2) {
          let name = "";
          let scoreStr = "";
          if (/^\d+(\.\d+)?$/.test(parts[1])) {
            name = parts[0];
            scoreStr = parts[1];
          } else if (/^\d+(\.\d+)?$/.test(parts[0])) {
            scoreStr = parts[0];
            name = parts[1];
          }

          if (name && scoreStr && rosterNames.has(name)) {
            matchedMap.set(name, scoreStr);
          } else if (name && scoreStr) {
            unrecognized.push(`姓名「${name}」不在当前班级名册中（分: ${scoreStr}）`);
          } else {
            unrecognized.push(`第 ${idx + 1} 行格式无法识别: ${line}`);
          }
        } else {
          unrecognized.push(`第 ${idx + 1} 行格式无法识别: ${line}`);
        }
      });
    }

    const matchedList: { student_name: string; student_no: string; score: string; 学生: string; 学号: string; 结果: string }[] = [];
    const absentList: { student_name: string; student_no: string; 学生: string; 学号: string }[] = [];

    roster.forEach((s) => {
      const sName = s.name || s.姓名;
      const sNo = s.student_no || s.学号 || "";
      if (matchedMap.has(sName)) {
        matchedList.push({
          student_name: sName,
          student_no: sNo,
          score: matchedMap.get(sName)!,
          学生: sName,
          学号: sNo,
          结果: matchedMap.get(sName)!,
        });
      } else {
        absentList.push({
          student_name: sName,
          student_no: sNo,
          学生: sName,
          学号: sNo,
        });
      }
    });

    setParsedResults({ matched: matchedList, absent: absentList, unrecognized });
    setPreviewOpen(true);
  };

  // ---------- 确认批量入库 ----------
  const commitMutation = useMutation({
    mutationFn: async () => {
      const records = parsedResults.matched.map((m) => ({
        student_name: m.student_name || m.学生,
        score: m.score || m.结果,
        status: "完成",
        notes: "",
        client_id: crypto.randomUUID(),
      }));
      return batchUpsertAcademic({
        class_id: class_id,
        class_name: 班级,
        item_name: examName.trim(),
        date: examDate.format("YYYY-MM-DD"),
        full_score: examFullScore,
        subject: "地理",
        records,
      });
    },
    onSuccess: (res) => {
      const extra = res.item_auto_created || res.项目自动创建 ? `（已自动创建考试「${examName}」）` : "";
      const count = res.total_inserted ?? res.总录入 ?? parsedResults.matched.length;
      message.success(`成功入库！已录入 ${count} 条成绩记录。${extra}`);
      setPreviewOpen(false);
      setPasteText("");
      setPasteExpanded(false);
      qc.invalidateQueries({ queryKey: ["academic-all"] });
      qc.invalidateQueries({ queryKey: ["items-all"] });
    },
    onError: (err: any) => {
      message.error("入库失败：" + (err?.message ?? "网络异常"));
    },
  });

  // ---------- 历次成绩数据与矩阵计算 ----------
  const examColumns = useMemo(() => {
    const list: { key: string; item_name: string; date: string; full_score: number; 项目: string; 日期: string; 满分: number }[] = [];
    const seen = new Set<string>();

    (allAcademics ?? []).forEach((r) => {
      const itName = r.item_name || r.项目;
      const rDate = r.date || r.日期;
      const it = scoreItems.find((x) => (x.item_name || x.项目名) === itName);
      if (!it || !rDate) return;
      const key = `${itName}@@${rDate}`;
      if (!seen.has(key)) {
        seen.add(key);
        const full = parseFloat(it.full_score || it.满分) || 100;
        list.push({ key, item_name: itName, date: rDate, full_score: full, 项目: itName, 日期: rDate, 满分: full });
      }
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [allAcademics, scoreItems]);

  const examRanksMap = useMemo(() => {
    const rankMap = new Map<string, Map<string, number>>();

    examColumns.forEach((col) => {
      const recordsForExam = (allAcademics ?? []).filter(
        (r) => (r.item_name || r.项目) === col.item_name && (r.date || r.日期) === col.date
      );
      const studentScores: { student_name: string; score: number }[] = [];
      recordsForExam.forEach((r) => {
        const sc = parseFloat(r.score || r.结果);
        const sName = r.student_name || r.学生;
        if (!isNaN(sc) && sName) {
          studentScores.push({ student_name: sName, score: sc });
        }
      });

      studentScores.sort((a, b) => b.score - a.score);

      const ranks = new Map<string, number>();
      let lastScore: number | null = null;
      let lastRank = 0;
      studentScores.forEach((s, idx) => {
        const rank = s.score === lastScore ? lastRank : idx + 1;
        ranks.set(s.student_name, rank);
        lastScore = s.score;
        lastRank = rank;
      });

      rankMap.set(col.key, ranks);
    });

    return rankMap;
  }, [allAcademics, examColumns]);

  const scoreLookup = useMemo(() => {
    const map = new Map<string, string>();
    (allAcademics ?? []).forEach((r) => {
      const sName = r.student_name || r.学生;
      const itName = r.item_name || r.项目;
      const rDate = r.date || r.日期;
      const sc = r.score || r.结果;
      const key = `${sName}##${itName}@@${rDate}`;
      map.set(key, sc);
    });
    return map;
  }, [allAcademics]);

  const historyColumns = useMemo(() => {
    const cols: any[] = [
      {
        title: "学号",
        dataIndex: "student_no",
        width: 70,
        fixed: "left" as const,
        render: (_: any, r: Row) => r.student_no || r.学号 || "-",
        sorter: (a: Row, b: Row) => (parseInt(a.student_no || a.学号) || 0) - (parseInt(b.student_no || b.学号) || 0),
      },
      {
        title: "姓名",
        dataIndex: "name",
        width: 100,
        fixed: "left" as const,
        render: (_: any, r: Row) => <span style={{ fontWeight: 600 }}>{r.name || r.姓名}</span>,
      },
    ];

    examColumns.forEach((col) => {
      cols.push({
        title: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600 }}>{col.item_name}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{col.date}</div>
          </div>
        ),
        dataIndex: col.key,
        width: 120,
        align: "center" as const,
        render: (_: any, row: Row) => {
          const sName = row.name || row.姓名;
          const rawScore = scoreLookup.get(`${sName}##${col.key}`);
          if (rawScore === undefined || rawScore === "") {
            return <span style={{ color: "#bfbfbf" }}>-</span>;
          }

          if (showRank) {
            const rMap = examRanksMap.get(col.key);
            const rank = rMap?.get(sName);
            if (!rank) return <span style={{ color: "#bfbfbf" }}>-</span>;
            return (
              <Tag
                color={rank <= 3 ? "gold" : rank <= 10 ? "blue" : "default"}
                style={{ fontWeight: rank <= 3 ? 600 : 400 }}
              >
                第 {rank} 名
              </Tag>
            );
          }

          const scoreNum = parseFloat(rawScore);
          const pass = scoreNum >= col.full_score * 0.6;
          return (
            <span style={{ color: pass ? "#389e0d" : "#cf1322", fontWeight: 600 }}>
              {rawScore}
            </span>
          );
        },
      });
    });

    return cols;
  }, [examColumns, scoreLookup, showRank, examRanksMap]);

  return (
    <div className="page">
      <h2 className="page-title">成绩</h2>
      <div className="page-sub">以一次考试为单位：选考试、贴分数，全班一次入库。</div>

      <Spin spinning={loadingStudents || loadingItems || loadingAcademics}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* 卡片 1：班级与考试设置 */}
          <Card size="small">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {classes.length > 0 && (
                <Segmented
                  options={classes}
                  value={班级}
                  onChange={(val) => set班级(val as string)}
                  size="middle"
                />
              )}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <AutoComplete
                  value={examName}
                  onChange={setExamName}
                  onSelect={handleExamSelect}
                  options={examOptions}
                  placeholder="输入考试名称（如：第一单元测试）"
                  style={{ width: 280 }}
                  filterOption={(input, option) =>
                    (option?.value as string)?.includes(input) ?? false
                  }
                />

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#666", fontSize: 14 }}>满分</span>
                  <InputNumber
                    value={examFullScore}
                    onChange={(v) => setExamFullScore(v ?? 100)}
                    min={10}
                    max={150}
                    style={{ width: 80 }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  <span style={{ color: "#666", fontSize: 14 }}>日期</span>
                  <DatePicker
                    value={examDate}
                    onChange={(d) => d && setExamDate(d)}
                    format="YYYY/MM/DD"
                    allowClear={false}
                    style={{ width: 140 }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 卡片 2：贴分数进来（可折叠） */}
          <Collapse
            activeKey={pasteExpanded ? ["paste"] : []}
            onChange={(keys) => setPasteExpanded(keys.includes("paste"))}
            items={[
              {
                key: "paste",
                label: "贴分数进来",
                extra: (
                  <span style={{ fontSize: 13, color: "#8c8c8c" }}>
                    及格线 {Math.round(examFullScore * 0.6 * 10) / 10}
                  </span>
                ),
                children: (
                  <>
                    <div style={{ color: "#8c8c8c", fontSize: 13, marginBottom: 12 }}>
                      两种贴法都行：①「姓名 分数」两列（从 Excel 复制直贴）②按花名册顺序的纯分数一列。贴完先过目，确认才入库。
                    </div>

                    <Input.TextArea
                      rows={6}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`张小明 87\n李小雨 95\n...\n或按名册学号顺序粘贴纯分数：\n87\n95`}
                      style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 14 }}
                    />

                    <Button type="primary" icon={<FormOutlined />} onClick={handleParseScores}>
                      先贴分数
                    </Button>
                  </>
                ),
              },
            ]}
          />

          {/* 卡片 3：历次成绩 */}
          <Card
            size="small"
            title={`${班级} 历次成绩`}
            extra={
              <Checkbox checked={showRank} onChange={(e) => setShowRank(e.target.checked)}>
                名次
              </Checkbox>
            }
          >
            {examColumns.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有成绩，贴一次就有了。"
                style={{ padding: "24px 0" }}
              />
            ) : (
              <Table
                rowKey="姓名"
                dataSource={roster}
                columns={historyColumns}
                scroll={{ x: "max-content" }}
                pagination={false}
                size="small"
                bordered
              />
            )}
          </Card>
        </Space>
      </Spin>

      {/* 弹窗：登分过目核对 */}
      <Modal
        title={`登分过目核对（${班级} · ${examName} · ${examDate.format("YYYY/MM/DD")}）`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={680}
        footer={[
          <Button key="cancel" onClick={() => setPreviewOpen(false)}>
            返回修改
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={commitMutation.isPending}
            onClick={() => commitMutation.mutate()}
            icon={<CheckCircleOutlined />}
          >
            确认入库（{parsedResults.matched.length} 人）
          </Button>,
        ]}
      >
        <Space style={{ marginBottom: 14 }} wrap>
          <Tag color="success">成功识别: {parsedResults.matched.length} 人</Tag>
          <Tag color={parsedResults.absent.length > 0 ? "warning" : "default"}>
            缺考/未录入: {parsedResults.absent.length} 人
          </Tag>
          {parsedResults.unrecognized.length > 0 && (
            <Tag color="error">异常格式: {parsedResults.unrecognized.length} 行</Tag>
          )}
        </Space>

        {parsedResults.unrecognized.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="存在无法自动匹配的行（将被忽略）："
            description={
              <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 80, overflowY: "auto" }}>
                {parsedResults.unrecognized.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            }
            style={{ marginBottom: 14 }}
          />
        )}

        <Table
          rowKey="student_name"
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={[
            ...parsedResults.matched.map((m) => ({
              ...m,
              status: "完成",
              状态: "完成",
            })),
            ...parsedResults.absent.map((a) => ({
              ...a,
              score: "-",
              status: "缺考",
              结果: "-",
              状态: "缺考",
            })),
          ]}
          columns={[
            {
              title: "学号",
              dataIndex: "student_no",
              width: 80,
              render: (_: any, r: any) => r.student_no || r.学号 || "-",
            },
            {
              title: "姓名",
              dataIndex: "student_name",
              width: 120,
              render: (_: any, r: any) => <strong>{r.student_name || r.学生}</strong>,
            },
            {
              title: "分数",
              dataIndex: "score",
              width: 100,
              render: (_: any, r: any) => {
                const v = r.score ?? r.结果;
                return (
                  <span
                    style={{
                      color:
                        v === "-"
                          ? "#999"
                          : parseFloat(v) < examFullScore * 0.6
                          ? "#cf1322"
                          : "#389e0d",
                      fontWeight: 600,
                    }}
                  >
                    {v}
                  </span>
                );
              },
            },
            {
              title: "状态",
              dataIndex: "status",
              width: 100,
              render: (_: any, r: any) => {
                const st = r.status || r.状态;
                return <Tag color={st === "完成" ? "green" : "orange"}>{st}</Tag>;
              },
            },
          ]}
        />
      </Modal>
    </div>
  );
}
