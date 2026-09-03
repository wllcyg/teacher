import { useState } from "react";
import { Card, Form, Input, Select, DatePicker, Button, message, Space, InputNumber, Row, Col } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createRow, listTable } from "../api";
import { useCurrentClass, useStudents, activeRoster } from "../hooks";

const KINDS = ["教学", "行政", "家校", "班务"];

export default function QuickNote() {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const [todoForm] = Form.useForm();
  const [behaviorForm] = Form.useForm();

  const { data: students } = useStudents();
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => listTable("items") });
  const behaviorItems = (items ?? []).filter((it) => it.计分制.includes("加减"));

  const addTodo = useMutation({
    mutationFn: (v: any) => createRow("todos", { ...v, 日期: v.日期.format("YYYY-MM-DD") }),
    onSuccess: () => {
      message.success("已记下待办");
      todoForm.resetFields();
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const addBehavior = useMutation({
    mutationFn: (v: any) =>
      createRow("behavior", { 日期: v.日期.format("YYYY-MM-DD"), 班级, 学生: v.学生, 项目: v.项目, 分值: String(v.分值), 备注: v.备注 ?? "" }),
    onSuccess: () => {
      message.success("已记录表现");
      behaviorForm.resetFields();
      qc.invalidateQueries({ queryKey: ["behavior"] });
    },
  });

  const roster = activeRoster(students, 班级);

  return (
    <div className="page">
      <h2 className="page-title">快记</h2>
      <div className="page-sub">两秒记一笔，不打断上课节奏</div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="记待办" size="small">
            <Form form={todoForm} layout="vertical" onFinish={(v) => addTodo.mutate(v)}>
              <Form.Item name="事项" label="事项" rules={[{ required: true }]}>
                <Input placeholder="例如：批改订正本" />
              </Form.Item>
              <Form.Item name="类别" label="类别">
                <Select options={KINDS.map((k) => ({ value: k, label: k }))} />
              </Form.Item>
              <Form.Item name="日期" label="日期" initialValue={dayjs()}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={addTodo.isPending}>
                记下
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="记表现（加减分）" size="small">
            <Form form={behaviorForm} layout="vertical" onFinish={(v) => addBehavior.mutate(v)}>
              <Form.Item name="学生" label="学生" rules={[{ required: true }]}>
                <Select showSearch options={roster.map((s) => ({ value: s.姓名, label: s.姓名 }))} filterOption={(input, o) => (o?.label ?? "").includes(input)} />
              </Form.Item>
              <Form.Item name="项目" label="项目" rules={[{ required: true }]}>
                <Select options={behaviorItems.map((it) => ({ value: it.项目名, label: it.项目名 }))} />
              </Form.Item>
              <Space wrap>
                <Form.Item name="分值" label="分值" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                  <InputNumber min={-20} max={20} placeholder="+1 或 -1" />
                </Form.Item>
                <Form.Item name="日期" label="日期" initialValue={dayjs()} style={{ marginBottom: 0 }}>
                  <DatePicker />
                </Form.Item>
              </Space>
              <Form.Item name="备注" label="备注" style={{ marginTop: 12 }}>
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={addBehavior.isPending}>
                记下
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
