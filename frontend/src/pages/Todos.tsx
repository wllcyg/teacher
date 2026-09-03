import { useState } from "react";
import { Table, Button, Select, Modal, Form, Input, Space, Popconfirm, message, Tag, DatePicker } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import type { Row } from "../types";

const KINDS = ["教学", "行政", "家校", "班务"];

export default function Todos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({ queryKey: ["todos"], queryFn: () => listTable("todos") });

  const save = useMutation({
    mutationFn: (v: Record<string, string>) =>
      editing ? updateRow("todos", editing.id, v) : createRow("todos", v),
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("todos", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  const toggle = useMutation({
    mutationFn: (r: Row) => updateRow("todos", r.id, { 状态: r.状态 === "已办" ? "未办" : "已办" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  const columns = [
    { title: "日期", dataIndex: "日期", width: 110, sorter: (a: Row, b: Row) => a.日期.localeCompare(b.日期) },
    { title: "事项", dataIndex: "事项" },
    { title: "类别", dataIndex: "类别", width: 90, render: (v: string) => (v ? <Tag>{v}</Tag> : "-") },
    {
      title: "状态",
      dataIndex: "状态",
      width: 100,
      render: (v: string, r: Row) => (
        <Tag color={v === "已办" ? "green" : "orange"} style={{ cursor: "pointer" }} onClick={() => toggle.mutate(r)}>
          {v || "未办"}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "op",
      width: 160,
      render: (_: any, r: Row) => (
        <Space>
          <Button size="small" type="link" onClick={() => { setEditing(r); form.setFieldsValue({ ...r, 日期: r.日期 ? dayjs(r.日期) : null }); setOpen(true); }}>编辑</Button>
          <Popconfirm title="删除？" onConfirm={() => del.mutate(r.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page">
      <h2 className="page-title">待办</h2>
      <div className="page-sub">点击状态标签可快速切换「已办/未办」</div>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
        添加待办
      </Button>
      <Table rowKey="id" loading={isLoading} dataSource={data} columns={columns} pagination={{ pageSize: 15 }} size="middle" scroll={{ x: "max-content" }} />

      <Modal title={editing ? "编辑待办" : "添加待办"} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate({ ...v, 日期: v.日期 ? v.日期.format("YYYY-MM-DD") : "" })}>
          <Form.Item name="事项" label="事项" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="类别" label="类别">
            <Select options={KINDS.map((k) => ({ value: k, label: k }))} />
          </Form.Item>
          <Form.Item name="日期" label="日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="状态" label="状态">
            <Select options={[{ value: "未办", label: "未办" }, { value: "已办", label: "已办" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
