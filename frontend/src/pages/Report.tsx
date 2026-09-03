import { useMemo, useState } from "react";
import { Card, Col, Row as AntRow, Statistic, Select, Table, Tag, Empty, Spin, List, Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { getExamReport, listTable } from "../api";
import { useCurrentClass } from "../hooks";
import type { Row } from "../types";

export default function Report() {
  const { 班级 } = useCurrentClass();
  const [项目, set项目] = useState("");

  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => listTable("items") });
  const scoreItems = useMemo(
    () => (items ?? []).filter((it) => it.计分制.includes("分数")),
    [items]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["exam-report", 班级, 项目],
    queryFn: () => getExamReport(项目, 班级),
    enabled: !!班级 && !!项目,
  });

  const stats = data?.统计;
  const prev = data?.上次考试;

  const rankRows = useMemo(() => {
    if (!stats?.快照?.成绩) return [];
    const ranks = prev?.名次 ?? {};
    return stats.快照.成绩
      .slice()
      .sort((a: any, b: any) => b.分 - a.分)
      .map((r: any) => ({ 学生: r.学生, 分数: r.分, 名次: ranks[r.学生] ?? "-" }));
  }, [stats, prev]);

  return (
    <div className="page">
      <h2 className="page-title">报表</h2>
      <div className="page-sub">{班级} · 打印友好的正式报表</div>

      <div className="no-print" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <Select
          value={项目}
          onChange={set项目}
          style={{ width: 200 }}
          placeholder="选择考试"
          options={scoreItems.map((it) => ({ value: it.项目名, label: it.项目名 }))}
        />
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          disabled={!stats}
          onClick={() => window.print()}
        >
          打印报表
        </Button>
      </div>

      <Spin spinning={isLoading}>
        {!stats ? (
          <Empty description="选择一场考试查看报表" />
        ) : (
          <div className="print-area">
            <div className="print-header">
              <div className="print-title">{班级} · {项目} 成绩报表</div>
              <div className="print-meta">打印日期：{new Date().toLocaleDateString("zh-CN")}</div>
            </div>

            <AntRow gutter={[16, 16]}>
              <Col xs={12} md={6}><Card><Statistic title="应录" value={stats.应录} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="实录" value={stats.实录} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="平均" value={stats.平均} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="最高/最低" value={`${stats.最高}/${stats.最低}`} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="及格率" value={stats.及格率} suffix="%" /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="优秀率" value={stats.优秀率} suffix="%" /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="低分率" value={stats.低分率} suffix="%" /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="缺考" value={stats.缺考.length} /></Card></Col>
            </AntRow>

            <AntRow gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={10}>
                <Card title="分数段分布" size="small">
                  <Table
                    rowKey="段"
                    size="small"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    dataSource={stats.分段}
                    columns={[
                      { title: "分数段", dataIndex: "段" },
                      { title: "人数", dataIndex: "人数" },
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24} md={14}>
                <Card title="名次（同分并列）" size="small">
                  <Table
                    rowKey="学生"
                    size="small"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    dataSource={rankRows}
                    columns={[
                      { title: "名次", dataIndex: "名次", width: 70 },
                      { title: "学生", dataIndex: "学生" },
                      { title: "分数", dataIndex: "分数" },
                    ]}
                  />
                </Card>
              </Col>
            </AntRow>

            {prev && (
              <Card title={`与上次考试「${prev.项目}」对比`} size="small" style={{ marginTop: 16 }}>
                <AntRow gutter={16}>
                  <Col span={8}><Statistic title="进步" value={prev.进退步?.进步 ?? 0} valueStyle={{ color: "#3f8600" }} /></Col>
                  <Col span={8}><Statistic title="退步" value={prev.进退步?.退步 ?? 0} valueStyle={{ color: "#cf1322" }} /></Col>
                  <Col span={8}><Statistic title="持平" value={prev.进退步?.持平 ?? 0} /></Col>
                </AntRow>
              </Card>
            )}

            {stats.缺考.length > 0 && (
              <Card title="缺考名单" size="small" style={{ marginTop: 16 }}>
                <List
                  size="small"
                  dataSource={stats.缺考}
                  renderItem={(n: string) => <List.Item><Tag color="orange">缺考</Tag>{n}</List.Item>}
                />
              </Card>
            )}
          </div>
        )}
      </Spin>
    </div>
  );
}
