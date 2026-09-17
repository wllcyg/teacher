import { useState } from "react";
import { Table, Button, Select, Modal, Form, Input, Space, Popconfirm, message, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRow, deleteRow, listAllTable, updateRow } from "../api";
import { useStudents } from "../hooks";
import type { Row } from "../types";

export default function Duties() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [typeFilter, setTypeFilter] = useState("");

  const { data: students } = useStudents();
  const { data, isLoading } = useQuery({ queryKey: ["duties"], queryFn: () => listAllTable("duties") });

  const save = useMutation({
    mutationFn: (v: Record<string, string>) => {
      const payload = {
        duty_name: v.duty_name,
        student_name: v.student_name,
        duty_type: v.duty_type,
        schedule_time: v.schedule_time,
        notes: v.notes,
        // 兼容原字段
        岗位: v.duty_name,
        学生: v.student_name,
        类型: v.duty_type,
        时间: v.schedule_time,
        备注: v.notes,
      };
      return editing ? updateRow("duties", editing.id, payload) : createRow("duties", payload);
    },
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

  const filtered = (data ?? []).filter((r) => !typeFilter || (r.duty_type || r.类型) === typeFilter);

  const columns = [
    { title: "岗位", dataIndex: "duty_name", render: (v: string, r: Row) => v || r.岗位 },
    { title: "学生", dataIndex: "student_name", render: (v: string, r: Row) => v || r.学生 },
    {
      title: "类型",
      dataIndex: "duty_type",
      width: 90,
      render: (v: string, r: Row) => {
        const val = v || r.类型;
        return <Tag color={val === "常任" ? "blue" : val === "轮值" ? "green" : "purple"}>{val}</Tag>;
      },
    },
    { title: "时间", dataIndex: "schedule_time", width: 90, render: (v: string, r: Row) => v || r.时间 },
    { title: "备注", dataIndex: "notes", render: (v: string, r: Row) => v || r.备注 },
    {
      title: "操作",
      key: "op",
      width: 160,
      render: (_: any, r: Row) => (
        <Space>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({
                duty_name: r.duty_name || r.岗位,
                student_name: r.student_name || r.学生,
                duty_type: r.duty_type || r.类型,
                schedule_time: r.schedule_time || r.时间,
                notes: r.notes || r.备注,
              });
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="删除？" onConfirm={() => del.mutate(r.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const studentOptions = (students ?? []).map((s) => ({
    value: s.name || s.姓名,
    label: s.name || s.姓名,
  }));

  return (
    <div className="page">
      <h2 className="page-title">班务</h2>
      <div className="page-sub">班干部、值日、座位安排（座位见「座位」页）</div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="按类型筛选"
          style={{ width: 140 }}
          value={typeFilter || undefined}
          onChange={(v) => setTypeFilter(v || "")}
          options={["常任", "轮值", "座位"].map((t) => ({ value: t, label: t }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setOpen(true);
          }}
        >
          添加班务
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 15 }}
        size="middle"
        scroll={{ x: "max-content" }}
      />

      <Modal
        title={editing ? "编辑班务" : "添加班务"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="duty_name" label="岗位" rules={[{ required: true, message: "请输入岗位" }]}>
            <Input placeholder="例如：班长 / 扫地" />
          </Form.Item>
          <Form.Item name="student_name" label="学生">
            <Select showSearch options={studentOptions} filterOption={(input, o) => (o?.label ?? "").includes(input)} />
          </Form.Item>
          <Form.Item name="duty_type" label="类型">
            <Select options={["常任", "轮值", "座位"].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="schedule_time" label="时间">
            <Input placeholder="例如：周一" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
