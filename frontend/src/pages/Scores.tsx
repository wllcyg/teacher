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
import { batchUpsertAcademic, listTable } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";

export default function Scores() {
  const { 班级, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();

  // 考试名称（AutoComplete 可搜可建）
  const [examName, setExamName] = useState<string>("");
  const [examDate, setExamDate] = useState<Dayjs>(dayjs());
  const [examFullScore, setExamFullScore] = useState<number>(100);

  // 粘贴输入内容与解析预览
  const [pasteText, setPasteText] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedResults, setParsedResults] = useState<{
    matched: { 学生: string; 学号: string; 结果: string }[];
    absent: { 学生: string; 学号: string }[];
    unrecognized: string[];
  }>({ matched: [], absent: [], unrecognized: [] });

  // 底部历次成绩：是否展示名次
  const [showRank, setShowRank] = useState(false);

  // 贴分区是否展开
  const [pasteExpanded, setPasteExpanded] = useState(true);

  // 数据查询
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => listTable("students"),
  });
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["items"],
    queryFn: () => listTable("items"),
  });
  const { data: allAcademics, isLoading: loadingAcademics } = useQuery({
    queryKey: ["academic", 班级],
    queryFn: () => listTable("academic", { 班级 }),
    enabled: !!班级,
  });

  // 在册学生列表（按学号自然序）
  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  // 所有「分数」类考试项目
  const scoreItems = useMemo(
    () => (items ?? []).filter((it) => it.计分制 && it.计分制.includes("分数")),
    [items]
  );

  // AutoComplete 下拉选项：已有考试名列表，模糊匹配
  const examOptions = useMemo(() => {
    return scoreItems.map((it) => ({
      value: it.项目名 as string,
      label: `${it.项目名}（满分 ${it.满分 || 100}）`,
    }));
  }, [scoreItems]);

  // 当用户选中已有考试时，自动回填满分
  const handleExamSelect = (value: string) => {
    setExamName(value);
    const existing = scoreItems.find((it) => it.项目名 === value);
    if (existing) {
      const full = parseFloat(existing.满分) || 100;
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
          matchedMap.set(roster[idx].姓名, String(num));
        } else {
          unrecognized.push(`第 ${idx + 1} 行: ${line}`);
        }
      });
    } else {
      const rosterNames = new Set(roster.map((s) => s.姓名));
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

    const matchedList: { 学生: string; 学号: string; 结果: string }[] = [];
    const absentList: { 学生: string; 学号: string }[] = [];

    roster.forEach((s) => {
      if (matchedMap.has(s.姓名)) {
        matchedList.push({
          学生: s.姓名,
          学号: s.学号,
          结果: matchedMap.get(s.姓名)!,
        });
      } else {
        absentList.push({ 学生: s.姓名, 学号: s.学号 });
      }
    });

    setParsedResults({ matched: matchedList, absent: absentList, unrecognized });
    setPreviewOpen(true);
  };

  // ---------- 确认批量入库 ----------
  const commitMutation = useMutation({
    mutationFn: async () => {
      const records = parsedResults.matched.map((m) => ({
        学生: m.学生,
        结果: m.结果,
        状态: "完成",
        备注: "",
      }));
      return batchUpsertAcademic({
        班级,
        项目: examName.trim(),
        日期: examDate.format("YYYY-MM-DD"),
        满分: examFullScore,
        学科: "地理",
        records,
      });
    },
    onSuccess: (res) => {
      const extra = res.项目自动创建 ? `（已自动创建考试「${examName}」）` : "";
      message.success(`成功入库！已录入 ${res.总录入} 条成绩记录。${extra}`);
      setPreviewOpen(false);
      setPasteText("");
      setPasteExpanded(false);
      qc.invalidateQueries({ queryKey: ["academic"] });
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (err: any) => {
      message.error("入库失败：" + (err?.message ?? "网络异常"));
    },
  });

  // ---------- 历次成绩数据与矩阵计算 ----------
  const examColumns = useMemo(() => {
    const list: { key: string; 项目: string; 日期: string; 满分: number }[] = [];
    const seen = new Set<string>();

    (allAcademics ?? []).forEach((r) => {
      const it = scoreItems.find((x) => x.项目名 === r.项目);
      if (!it || !r.日期) return;
      const key = `${r.项目}@@${r.日期}`;
      if (!seen.has(key)) {
        seen.add(key);
        const full = parseFloat(it.满分) || 100;
        list.push({ key, 项目: r.项目, 日期: r.日期, 满分: full });
      }
    });

    return list.sort((a, b) => a.日期.localeCompare(b.日期));
  }, [allAcademics, scoreItems]);

  const examRanksMap = useMemo(() => {
    const rankMap = new Map<string, Map<string, number>>();

    examColumns.forEach((col) => {
      const recordsForExam = (allAcademics ?? []).filter(
        (r) => r.项目 === col.项目 && r.日期 === col.日期
      );
      const studentScores: { 学生: string; 分: number }[] = [];
      recordsForExam.forEach((r) => {
        const score = parseFloat(r.结果);
        if (!isNaN(score)) {
          studentScores.push({ 学生: r.学生, 分: score });
        }
      });

      studentScores.sort((a, b) => b.分 - a.分);

      const ranks = new Map<string, number>();
      let lastScore: number | null = null;
      let lastRank = 0;
      studentScores.forEach((s, idx) => {
        const rank = s.分 === lastScore ? lastRank : idx + 1;
        ranks.set(s.学生, rank);
        lastScore = s.分;
        lastRank = rank;
      });

      rankMap.set(col.key, ranks);
    });

    return rankMap;
  }, [allAcademics, examColumns]);

  const scoreLookup = useMemo(() => {
    const map = new Map<string, string>();
    (allAcademics ?? []).forEach((r) => {
      const key = `${r.学生}##${r.项目}@@${r.日期}`;
      map.set(key, r.结果);
    });
    return map;
  }, [allAcademics]);

  const historyColumns = useMemo(() => {
    const cols: any[] = [
      {
        title: "学号",
        dataIndex: "学号",
        width: 70,
        fixed: "left" as const,
        sorter: (a: Row, b: Row) => (parseInt(a.学号) || 0) - (parseInt(b.学号) || 0),
      },
      {
        title: "姓名",
        dataIndex: "姓名",
        width: 100,
        fixed: "left" as const,
        render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span>,
      },
    ];

    examColumns.forEach((col) => {
      cols.push({
        title: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600 }}>{col.项目}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{col.日期}</div>
          </div>
        ),
        dataIndex: col.key,
        width: 120,
        align: "center" as const,
        render: (_: any, row: Row) => {
          const rawScore = scoreLookup.get(`${row.姓名}##${col.key}`);
          if (rawScore === undefined || rawScore === "") {
            return <span style={{ color: "#bfbfbf" }}>-</span>;
          }

          if (showRank) {
            const rMap = examRanksMap.get(col.key);
            const rank = rMap?.get(row.姓名);
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
          const pass = scoreNum >= col.满分 * 0.6;
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
          rowKey="学生"
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={[
            ...parsedResults.matched.map((m) => ({ ...m, 状态: "完成" })),
            ...parsedResults.absent.map((a) => ({ ...a, 结果: "-", 状态: "缺考" })),
          ]}
          columns={[
            { title: "学号", dataIndex: "学号", width: 80 },
            { title: "姓名", dataIndex: "学生", width: 120, render: (s) => <strong>{s}</strong> },
            {
              title: "分数",
              dataIndex: "结果",
              width: 100,
              render: (v) => (
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
              ),
            },
            {
              title: "状态",
              dataIndex: "状态",
              width: 100,
              render: (st) => <Tag color={st === "完成" ? "green" : "orange"}>{st}</Tag>,
            },
          ]}
        />
      </Modal>
    </div>
  );
}
