import { useState } from "react";
import { Card, Button, Space, Upload, message, Alert, Table } from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vaultExport, vaultImport, listTable } from "../api";
import { getTables } from "../api";
import type { Row } from "../types";

export default function Vault() {
  const qc = useQueryClient();
  const [counts, setCounts] = useState<{ table: string; count: number }[]>([]);

  const { data: meta } = useQuery({ queryKey: ["tables-meta"], queryFn: getTables });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const data = await vaultExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `教师工作台-备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const data = JSON.parse(text);
      await vaultImport(data);
    },
    onSuccess: () => {
      message.success("导入成功");
      qc.invalidateQueries();
    },
    onError: (e: any) => message.error("导入失败：" + (e?.message ?? "JSON 格式错误")),
  });

  const statMutation = useMutation({
    mutationFn: async () => {
      const tables = Object.keys(meta ?? {});
      const res = [];
      for (const t of tables) {
        const rows = await listTable(t as any);
        res.push({ table: t, count: rows.length });
      }
      setCounts(res);
    },
  });

  return (
    <div className="page">
      <h2 className="page-title">数据保险箱</h2>
      <div className="page-sub">整库备份与恢复，安心折腾数据</div>

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Card size="small" title="备份">
          <Space>
            <Button type="primary" icon={<DownloadOutlined />} loading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              导出全部数据 (JSON)
            </Button>
          </Space>
        </Card>

        <Card size="small" title="恢复">
          <Alert type="warning" style={{ marginBottom: 12 }} message="恢复会用导入文件覆盖当前全部数据，请先备份！" />
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={(file) => {
              importMutation.mutate(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={importMutation.isPending}>
              选择备份文件恢复
            </Button>
          </Upload>
        </Card>

        <Card size="small" title="数据概况">
          <Button onClick={() => statMutation.mutate()} loading={statMutation.isPending}>
            统计各表行数
          </Button>
          {counts.length > 0 && (
            <Table
              style={{ marginTop: 12 }}
              rowKey="table"
              size="small"
              pagination={false}
              scroll={{ x: "max-content" }}
              dataSource={counts}
              columns={[
                { title: "表", dataIndex: "table" },
                { title: "行数", dataIndex: "count" },
              ]}
            />
          )}
        </Card>
      </Space>
    </div>
  );
}
