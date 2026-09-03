import { useState } from "react";
import { Table, Button, Select, Modal, Form, Input, Space, Popconfirm, message, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import { useStudents } from "../hooks";
import type { Row } from "../types";

export default function Duties() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [typeFilter, setTypeFilter] = useState("");

  const { data: students } = useStudents();
  const { data, isLoading } = useQuery({ queryKey: ["duties"], queryFn: () => listTable("duties") });

  const save = useMutation({
    mutationFn: (v: Record<string, string>) =>
      editing ? updateRow("duties", editing.id, v) : createRow("duties", v),
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["duties"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("duties", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duties"] }),
  });

  const filtered = (data ?? []).filter((r) => !typeFilter || r.类型 === typeFilter);

  const columns = [
    { title: "岗位", dataIndex: "岗位" },
    { title: "学生", dataIndex: "学生" },
    { title: "类型", dataIndex: "类型", width: 90, render: (v: string) => <Tag color={v === "常任" ? "blue" : v === "轮值" ? "green" : "purple"}>{v}</Tag> },
    { title: "时间", dataIndex: "时间", width: 90 },
    { title: "备注", dataIndex: "备注" },
    {
      title: "操作",
      key: "op",
      width: 160,
      render: (_: any, r: Row) => (
        <Space>
          <Button size="small" type="link" onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>编辑</Button>
          <Popconfirm title="删除？" onConfirm={() => del.mutate(r.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const studentOptions = (students ?? []).map((s) => ({ value: s.姓名, label: s.姓名 }));

  return (
    <div className="page">
      <h2 className="page-title">班务</h2>
      <div className="page-sub">班干部、值日、座位安排（座位见「座位」页）</div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select allowClear placeholder="按类型筛选" style={{ width: 140 }} value={typeFilter || undefined} onChange={(v) => setTypeFilter(v || "")} options={["常任", "轮值", "座位"].map((t) => ({ value: t, label: t }))} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
          添加班务
        </Button>
      </Space>
      <Table rowKey="id" loading={isLoading} dataSource={filtered} columns={columns} pagination={{ pageSize: 15 }} size="middle" scroll={{ x: "max-content" }} />

      <Modal title={editing ? "编辑班务" : "添加班务"} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="岗位" label="岗位" rules={[{ required: true }]}>
            <Input placeholder="例如：班长 / 扫地" />
          </Form.Item>
          <Form.Item name="学生" label="学生">
            <Select showSearch options={studentOptions} filterOption={(input, o) => (o?.label ?? "").includes(input)} />
          </Form.Item>
          <Form.Item name="类型" label="类型">
            <Select options={["常任", "轮值", "座位"].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="时间" label="时间">
            <Input placeholder="例如：周一" />
          </Form.Item>
          <Form.Item name="备注" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
