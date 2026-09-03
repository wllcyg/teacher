import { useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Empty,
  InputNumber,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
  message,
} from "antd";
import { CopyOutlined, PrinterOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { getExamReport, listTable } from "../api";
import { useCurrentClass } from "../hooks";

export default function Report() {
  const { 班级, set班级, classes } = useCurrentClass();

  // 考试选择
  const [项目, set项目] = useState("");

  // 三条线（可调）
  const [优, set优] = useState(85);
  const [及, set及] = useState(60);
  const [低, set低] = useState(40);

  // 报表是否带名次
  const [showRank, setShowRank] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  // 数据
  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => listTable("items"),
  });

  const scoreItems = useMemo(
    () => (items ?? []).filter((it) => it.计分制?.includes("分数")),
    [items]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["exam-report", 班级, 项目, 优, 及, 低],
    queryFn: () => getExamReport(项目, 班级, { 优, 及, 低 }),
    enabled: !!班级 && !!项目,
  });

  const stats = data?.统计;
  const prev = data?.上次考试;

  // 名次列表
  const rankRows = useMemo(() => {
    if (!stats?.快照?.成绩) return [];
    return stats.快照.成绩
      .slice()
      .sort((a: any, b: any) => b.分 - a.分)
      .map((r: any, idx: number, arr: any[]) => {
        // 同分并列、跳位
        let rank = idx + 1;
        if (idx > 0 && r.分 === arr[idx - 1].分) {
          // 找到第一个相同分数的位置
          let k = idx - 1;
          while (k > 0 && arr[k - 1].分 === r.分) k--;
          rank = k + 1;
        }
        return { 学生: r.学生, 分数: r.分, 名次: rank };
      });
  }, [stats]);

  // 复制为表格
  const handleCopy = () => {
    if (!reportRef.current) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(reportRef.current);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("copy");
    selection?.removeAllRanges();
    message.success("已复制报表内容，可粘贴到 Excel！");
  };

  const fullScore = stats?.满分 ?? 100;
  const now = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2 className="page-title">报表 · 考试成绩分析</h2>
          <div className="page-sub">选班级和考试，出一张能打印、能进 Excel 的正式报表。</div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <Button icon={<PrinterOutlined />} disabled={!stats} onClick={() => window.print()}>
            A4 打印
          </Button>
          <Button icon={<CopyOutlined />} disabled={!stats} onClick={handleCopy}>
            复制为表格
          </Button>
        </div>
      </div>

      {/* 操作区 */}
      <Card size="small" className="no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 班级切换 */}
          {classes.length > 0 && (
            <Segmented
              options={classes}
              value={班级}
              onChange={(val) => set班级(val as string)}
              size="middle"
            />
          )}

          {/* 考试选择 + 三条线 + 名次勾选 */}
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Select
              value={项目 || undefined}
              onChange={set项目}
              style={{ width: 220 }}
              placeholder="选择考试"
              options={scoreItems.map((it) => ({ value: it.项目名, label: it.项目名 }))}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#666", fontSize: 13 }}>三条线（占满分的 %）：</span>
              <span style={{ fontSize: 13 }}>优秀</span>
              <InputNumber
                size="small"
                value={优}
                onChange={(v) => set优(v ?? 85)}
                min={0}
                max={100}
                style={{ width: 56 }}
              />
              <span style={{ fontSize: 13 }}>及格</span>
              <InputNumber
                size="small"
                value={及}
                onChange={(v) => set及(v ?? 60)}
                min={0}
                max={100}
                style={{ width: 56 }}
              />
              <span style={{ fontSize: 13 }}>低分</span>
              <InputNumber
                size="small"
                value={低}
                onChange={(v) => set低(v ?? 40)}
                min={0}
                max={100}
                style={{ width: 56 }}
              />
            </div>

            <Checkbox checked={showRank} onChange={(e) => setShowRank(e.target.checked)}>
              报表带名次
            </Checkbox>
          </div>
        </div>
      </Card>

      {/* 报表正文 */}
      <Spin spinning={isLoading}>
        {!stats ? (
          <Empty description="选择一场考试查看报表" />
        ) : (
          <Card ref={reportRef} className="print-area">
            {/* 报表标题 */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                {班级} · 成绩分析
              </h3>
              <div style={{ color: "#8c8c8c", fontSize: 13, marginTop: 4 }}>
                覆盖度：已录 {stats.实录}/{stats.应录} · 未录/缺考 {stats.缺考.length} 人
              </div>
            </div>

            {/* 未录/缺考名单 */}
            {stats.缺考.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, borderLeft: "3px solid #faad14", paddingLeft: 8 }}>
                  未录 / 缺考名单（不计入任何统计）
                </div>
                <div style={{ lineHeight: 2 }}>
                  {stats.缺考.map((name: string, idx: number) => (
                    <Tag key={idx} color="warning" style={{ marginBottom: 4 }}>
                      {name}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* 总体统计 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, borderLeft: "3px solid #1677ff", paddingLeft: 8 }}>
                总体
              </div>
              <Table
                size="small"
                pagination={false}
                bordered
                dataSource={[
                  {
                    key: "data",
                    平均分: stats.平均,
                    最高: stats.最高,
                    最低: stats.最低,
                    优秀: `${stats.优秀数} 人 · ${stats.优秀率}%`,
                    及格: `${stats.及格数} 人 · ${stats.及格率}%`,
                    低分: `${stats.低分数} 人 · ${stats.低分率}%`,
                  },
                ]}
                columns={[
                  { title: "平均分", dataIndex: "平均分", align: "center" as const, width: 90 },
                  { title: "最高", dataIndex: "最高", align: "center" as const, width: 70 },
                  { title: "最低", dataIndex: "最低", align: "center" as const, width: 70 },
                  {
                    title: `优秀 ≥${stats.优秀线分}`,
                    dataIndex: "优秀",
                    align: "center" as const,
                  },
                  {
                    title: `及格 ≥${stats.及格线分}`,
                    dataIndex: "及格",
                    align: "center" as const,
                  },
                  {
                    title: `低分 <${stats.低分线分}`,
                    dataIndex: "低分",
                    align: "center" as const,
                  },
                ]}
              />
            </div>

            {/* 分数段分布 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, borderLeft: "3px solid #52c41a", paddingLeft: 8 }}>
                分数段
              </div>
              <Table
                size="small"
                pagination={false}
                bordered
                dataSource={[
                  {
                    key: "data",
                    ...(stats.分段 ?? []).reduce(
                      (acc: any, seg: any) => ({ ...acc, [seg.段]: `${seg.人数} 人` }),
                      {}
                    ),
                  },
                ]}
                columns={(stats.分段 ?? []).map((seg: any) => ({
                  title: seg.段,
                  dataIndex: seg.段,
                  align: "center" as const,
                }))}
              />
            </div>

            {/* 名次表（可选展示） */}
            {showRank && rankRows.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, borderLeft: "3px solid #722ed1", paddingLeft: 8 }}>
                  成绩名次（同分并列）
                </div>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  rowKey="学生"
                  dataSource={rankRows}
                  columns={[
                    {
                      title: "名次",
                      dataIndex: "名次",
                      width: 70,
                      align: "center" as const,
                      render: (v: number) => (
                        <span style={{ fontWeight: v <= 3 ? 700 : 400 }}>{v}</span>
                      ),
                    },
                    {
                      title: "学生",
                      dataIndex: "学生",
                      render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span>,
                    },
                    {
                      title: "分数",
                      dataIndex: "分数",
                      width: 80,
                      align: "center" as const,
                      render: (v: number) => (
                        <span
                          style={{
                            color: v >= stats.及格线分 ? "#389e0d" : "#cf1322",
                            fontWeight: 600,
                          }}
                        >
                          {v}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* 与上次考试对比 */}
            {prev && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, borderLeft: "3px solid #13c2c2", paddingLeft: 8 }}>
                  与上次考试「{prev.项目}」对比
                </div>
                <Table
                  size="small"
                  pagination={false}
                  bordered
                  dataSource={[
                    {
                      key: "data",
                      进步: `${prev.进退步?.进步 ?? 0} 人`,
                      退步: `${prev.进退步?.退步 ?? 0} 人`,
                      持平: `${prev.进退步?.持平 ?? 0} 人`,
                    },
                  ]}
                  columns={[
                    {
                      title: "进步 ↑",
                      dataIndex: "进步",
                      align: "center" as const,
                      render: (v: string) => <span style={{ color: "#389e0d", fontWeight: 600 }}>{v}</span>,
                    },
                    {
                      title: "退步 ↓",
                      dataIndex: "退步",
                      align: "center" as const,
                      render: (v: string) => <span style={{ color: "#cf1322", fontWeight: 600 }}>{v}</span>,
                    },
                    {
                      title: "持平 →",
                      dataIndex: "持平",
                      align: "center" as const,
                    },
                  ]}
                />
              </div>
            )}

            {/* 报表脚注 */}
            <div
              style={{
                borderTop: "1px solid #f0f0f0",
                paddingTop: 10,
                color: "#b0b0b0",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              优秀线{优} 及格线{及} 低分线{低}（满分 {fullScore}）· 未录与缺考不计入均分与三率 · 生成于{" "}
              {now} · 数据截至同步完毕
            </div>
          </Card>
        )}
      </Spin>
    </div>
  );
}
