import { Card, Col, Row, Statistic, Progress, Table, Empty, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { getItemsSummary } from "../api";
import { useCurrentClass } from "../hooks";

export default function Summary() {
  const { 班级 } = useCurrentClass();
  const { data, isLoading } = useQuery({
    queryKey: ["items-summary", 班级],
    queryFn: () => getItemsSummary(班级),
    enabled: !!班级,
  });

  const items = data?.项目汇总 ?? [];

  return (
    <div className="page">
      <h2 className="page-title">汇总</h2>
      <div className="page-sub">{班级}</div>

      <Spin spinning={isLoading}>
        {items.length === 0 ? (
          <Empty description="暂无项目数据" />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((it: any) => (
              <Col xs={24} md={12} xl={8} key={it.项目}>
                <Card title={it.项目} size="small">
                  {it.kind === "分数" ? (
                    <Row gutter={8}>
                      <Col span={8}><Statistic title="平均" value={it.平均} /></Col>
                      <Col span={8}><Statistic title="最高" value={it.最高} /></Col>
                      <Col span={8}><Statistic title="最低" value={it.最低} /></Col>
                      <Col span={24} style={{ marginTop: 12 }}>
                        <div style={{ marginBottom: 4, fontSize: 13 }}>
                          及格率（及格线 {it.及格线} 分）
                        </div>
                        <Progress percent={it.及格率} status={it.及格率 >= 60 ? "normal" : "exception"} />
                      </Col>
                    </Row>
                  ) : it.kind === "等第" ? (
                    <div>
                      <div style={{ marginBottom: 8 }}>人数 {it.人数}</div>
                      {Object.entries(it.分布 as Record<string, number>).map(([g, n]) => (
                        <div key={g} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{g}</span>
                          <span>{n} 人</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <Progress percent={it.完成率} status={it.完成率 >= 100 ? "success" : "normal"} />
                      <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
                        完成 {it.完成人数} / 应到 {it.应到人数}
                        {it.待补测 ? ` · 待补测 ${it.待补测}` : ""}
                      </div>
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  );
}
