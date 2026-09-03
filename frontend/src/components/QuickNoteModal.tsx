import { useState } from "react";
import { Modal, Tabs, Form, Input, Select, DatePicker, Button, InputNumber, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createRow, listTable } from "../api";
import { useCurrentClass, useStudents, activeRoster } from "../hooks";

const KINDS = ["教学", "行政", "家校", "班务"];

/** 「记一笔」快记弹窗：记待办 / 记表现（加减分） */
export default function QuickNoteModal({
  open,
  onClose,
  defaultTab = "todo",
}: {
  open: boolean;
  onClose: () => void;
  defaultTab?: "todo" | "behavior";
}) {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"todo" | "behavior">(defaultTab);
  const [todoForm] = Form.useForm();
  const [behaviorForm] = Form.useForm();

  const { data: students } = useStudents();
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => listTable("items") });
  const behaviorItems = (items ?? []).filter((it: any) => it.计分制?.includes("加减"));

  const addTodo = useMutation({
    mutationFn: (v: any) => createRow("todos", { ...v, 日期: v.日期.format("YYYY-MM-DD") }),
    onSuccess: () => {
      message.success("已记下待办");
      todoForm.resetFields();
      qc.invalidateQueries({ queryKey: ["todos"] });
      onClose();
    },
  });

  const addBehavior = useMutation({
    mutationFn: (v: any) =>
      createRow("behavior", {
        日期: v.日期.format("YYYY-MM-DD"),
        班级,
        学生: v.学生,
        项目: v.项目,
        分值: String(v.分值),
        备注: v.备注 ?? "",
      }),
    onSuccess: () => {
      message.success("已记录表现");
      behaviorForm.resetFields();
      qc.invalidateQueries({ queryKey: ["behavior"] });
      onClose();
    },
  });

  const roster = activeRoster(students, 班级);

  return (
    <Modal
      title="记一笔"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={420}
    >
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as "todo" | "behavior")}
        items={[
          {
            key: "todo",
            label: "记待办",
            children: (
              <Form form={todoForm} layout="vertical" onFinish={(v) => addTodo.mutate(v)}>
                <Form.Item name="事项" label="事项" rules={[{ required: true, message: "记点什么…" }]}>
                  <Input placeholder="例如：批改订正本" autoFocus />
                </Form.Item>
                <Form.Item name="类别" label="类别" initialValue={KINDS[0]}>
                  <Select options={KINDS.map((k) => ({ value: k, label: k }))} />
                </Form.Item>
                <Form.Item name="日期" label="日期" initialValue={dayjs()}>
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={addTodo.isPending}>
                  记下
                </Button>
              </Form>
            ),
          },
          {
            key: "behavior",
            label: "记表现",
            children: (
              <Form form={behaviorForm} layout="vertical" onFinish={(v) => addBehavior.mutate(v)}>
                <Form.Item name="学生" label="学生" rules={[{ required: true, message: "选择学生" }]}>
                  <Select
                    showSearch
                    placeholder="搜索学生"
                    options={roster.map((s) => ({ value: s.姓名, label: s.姓名 }))}
                    filterOption={(input, o) => (o?.label ?? "").includes(input)}
                  />
                </Form.Item>
                <Form.Item name="项目" label="项目" rules={[{ required: true, message: "选择项目" }]}>
                  <Select options={behaviorItems.map((it: any) => ({ value: it.项目名, label: it.项目名 }))} />
                </Form.Item>
                <Form.Item name="分值" label="分值" rules={[{ required: true, message: "输入分值" }]}>
                  <InputNumber min={-20} max={20} placeholder="+1 或 -1" style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="日期" label="日期" initialValue={dayjs()}>
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="备注" label="备注">
                  <Input />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={addBehavior.isPending}>
                  记下
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </Modal>
  );
}
