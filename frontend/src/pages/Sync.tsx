import { Card, Table, Tag, Alert, Space } from "antd";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { getTables } from "../api";

export default function Sync() {
  const { data: meta } = useQuery({ queryKey: ["tables-meta"], queryFn: getTables });
  const { data: health, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.get("/health")).data,
  });

  const tables = Object.keys(meta ?? {});

  return (
    <div className="page">
      <h2 className="page-title">同步与数据状态</h2>
      <div className="page-sub">本版本数据统一存放在本地 SQLite，无需手动同步</div>

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Alert
          type={health?.ok ? "success" : "error"}
          showIcon
          message={health?.ok ? "后端连接正常" : isLoading ? "检测中…" : "后端连接失败"}
        />

        <Card size="small" title="数据表">
          <Table
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ x: "max-content" }}
            dataSource={tables.map((t) => ({ key: t, 表: t, 列数: meta?.[t]?.columns?.length ?? 0, 自然键: meta?.[t]?.natural_key?.length ? meta![t].natural_key!.join("、") : "—" }))}
            columns={[
              { title: "表名", dataIndex: "表" },
              { title: "列数", dataIndex: "列数", width: 80 },
              {
                title: "自然键（去重）",
                dataIndex: "自然键",
                render: (v: string) => (v === "—" ? <span style={{ color: "#bbb" }}>—</span> : <Tag color="blue">{v}</Tag>),
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
}
