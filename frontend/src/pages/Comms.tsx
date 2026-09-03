import { useState } from "react";
import { Tabs, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Tag, DatePicker, Upload, Alert } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createRow, deleteRow, getContactBook, importParents, listTable, updateRow } from "../api";
import { useCurrentClass, useStudents } from "../hooks";
import type { Row } from "../types";

const WAYS = ["电话", "微信", "当面", "家访"];
const WHO = ["妈妈", "爸爸", "爷爷", "奶奶", "外公", "外婆", "其他"];

export default function Comms() {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState("");

  const { data: students } = useStudents();
  const { data: comms, isLoading } = useQuery({ queryKey: ["comms"], queryFn: () => listTable("comms") });
  const { data: contact } = useQuery({
    queryKey: ["contact-book", 班级, keyword],
    queryFn: () => getContactBook(班级, keyword),
    enabled: !!班级,
  });

  const save = useMutation({
    mutationFn: (v: Record<string, string>) =>
      editing ? updateRow("comms", editing.id, v) : createRow("comms", v),
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["comms"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("comms", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comms"] }),
  });

  const importMutation = useMutation({
    mutationFn: (文本: string) => importParents(文本, 班级),
  });

  const studentOptions = (students ?? []).map((s) => ({ value: s.姓名, label: s.姓名 }));

  const commColumns = [
    { title: "日期", dataIndex: "日期", width: 110, sorter: (a: Row, b: Row) => a.日期.localeCompare(b.日期) },
    { title: "学生", dataIndex: "学生", width: 100 },
    { title: "对象", dataIndex: "对象", width: 80 },
    { title: "方式", dataIndex: "方式", width: 80, render: (v: string) => (v ? <Tag>{v}</Tag> : "-") },
    { title: "内容", dataIndex: "内容" },
    { title: "结果", dataIndex: "结果", width: 90 },
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

  const contactColumns = [
    { title: "学生", dataIndex: "姓名", width: 110 },
    {
      title: "家长",
      dataIndex: "家长",
      render: (parents: Row[]) =>
        parents.length === 0 ? (
          <span style={{ color: "#bbb" }}>未登记</span>
        ) : (
          parents.map((p) => (
            <Tag key={p.id} color="geekblue">
              {p.称谓 || "家长"} {p.电话}
            </Tag>
          ))
        ),
    },
  ];

  return (
    <div className="page">
      <h2 className="page-title">家校沟通</h2>
      <div className="page-sub">{班级}</div>

      <Tabs
        items={[
          {
            key: "comms",
            label: "沟通记录",
            children: (
              <>
                <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
                  添加记录
                </Button>
                <Table rowKey="id" loading={isLoading} dataSource={comms} columns={commColumns} pagination={{ pageSize: 15 }} size="middle" scroll={{ x: "max-content" }} />
              </>
            ),
          },
          {
            key: "book",
            label: "家长通讯录",
            children: (
              <>
                <Space style={{ marginBottom: 16 }} wrap>
                  <Input.Search placeholder="按姓名/称谓/电话搜索" allowClear style={{ width: 260 }} onSearch={setKeyword} onChange={(e) => !e.target.value && setKeyword("")} />
                </Space>
                <Table rowKey="姓名" dataSource={contact} columns={contactColumns} pagination={{ pageSize: 20 }} size="middle" scroll={{ x: "max-content" }} />
              </>
            ),
          },
          {
            key: "import",
            label: "批量导入",
            children: <ParentImport onImport={(t) => importMutation.mutateAsync(t)} result={importMutation.data} />,
          },
        ]}
      />

      <Modal title={editing ? "编辑沟通记录" : "添加沟通记录"} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate({ ...v, 日期: v.日期 ? v.日期.format("YYYY-MM-DD") : "" })}>
          <Form.Item name="日期" label="日期"><DatePicker style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="学生" label="学生" rules={[{ required: true }]}>
            <Select showSearch options={studentOptions} filterOption={(input, o) => (o?.label ?? "").includes(input)} />
          </Form.Item>
          <Form.Item name="对象" label="对象"><Select options={WHO.map((w) => ({ value: w, label: w }))} /></Form.Item>
          <Form.Item name="方式" label="方式"><Select options={WAYS.map((w) => ({ value: w, label: w }))} /></Form.Item>
          <Form.Item name="内容" label="内容"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="结果" label="结果"><Input placeholder="例如：已记录" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function ParentImport({ onImport, result }: { onImport: (t: string) => Promise<any>; result: any }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div>
      <Alert
        type="info"
        style={{ marginBottom: 12 }}
        message="每行一条：学生名 称谓 电话（或 学生名 电话），例如「张三 妈妈 13800138000」。"
      />
      <Input.TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"张三 妈妈 13800138000\n李四 爸爸 13900139000"} />
      <Button
        type="primary"
        style={{ marginTop: 12 }}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await onImport(text);
          } finally {
            setLoading(false);
          }
        }}
      >
        预览导入
      </Button>
      {result && (
        <div style={{ marginTop: 16 }}>
          <Alert type="success" message={`可导入 ${result.对上.length} 条，名册外 ${result.名册外.length}，坏行 ${result.坏行.length}，已存在 ${result.已有.length}，未登记 ${result.没登记.length}`} />
        </div>
      )}
    </div>
  );
}
