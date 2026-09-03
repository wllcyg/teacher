import { useState } from "react";
import { Table, Button, Select, Modal, Form, Input, Space, Popconfirm, message, Tag, Upload, Alert, Statistic } from "antd";
import { PlusOutlined, UploadOutlined, DownloadOutlined, SearchOutlined, DeleteOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchDeleteRows, createRow, deleteRow, importStudents, listTable, updateRow } from "../api";
import { useClasses, useCurrentClass, LEFT_MARK } from "../hooks";
import type { Row } from "../types";
import StudentDetailModal from "../components/StudentDetailModal";

const CSV_TEMPLATE = "班级,姓名,学号,小组,标签\n八4班,张三,1,第1组,\n八4班,李四,2,第1组,课代表";

function downloadTemplate() {
  const blob = new Blob(["\ufeff" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "学生导入模板.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Roster() {
  const { 班级, set班级, classes } = useCurrentClass();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();

  // 学生详情档案弹窗
  const [detailStudent, setDetailStudent] = useState<Row | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // CSV 导入状态
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvName, setCsvName] = useState("");
  const [importResult, setImportResult] = useState<any>(null);

  // 姓名模糊搜索 + 多选删除
  const [keyword, setKeyword] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);

  const { data: students, isLoading } = useQuery({
    queryKey: ["students", 班级, keyword],
    queryFn: () => listTable("students", { 班级, ...(keyword.trim() ? { q: keyword.trim() } : {}) }),
    enabled: !!班级,
  });

  const saveMutation = useMutation({
    mutationFn: async (v: Record<string, string>) => {
      if (editing) return updateRow("students", editing.id, v);
      return createRow("students", { ...v, 班级 });
    },
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => deleteRow("students", id),
    onSuccess: () => {
      message.success("已删除");
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const batchDelMutation = useMutation({
    mutationFn: (ids: number[]) => batchDeleteRows("students", ids),
    onSuccess: (res) => {
      message.success(`已删除 ${res.deleted} 名学生`);
      setSelectedKeys([]);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (s: Row) => {
      const today = new Date().toISOString().slice(0, 10);
      const tag = s.标签 ? `${LEFT_MARK}|${today}|${s.标签}` : `${LEFT_MARK}|${today}`;
      return updateRow("students", s.id, { 标签: tag });
    },
    onSuccess: () => {
      message.success("已标记离班");
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: () => importStudents(csvText, 班级),
    onSuccess: (res: any) => {
      setImportResult(res);
      const st = res.统计;
      message.success(`导入完成：新增 ${st.新增}，已存在跳过 ${st.已存在}，无效 ${st.无效}`);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail ?? "导入失败");
    },
  });

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const openEdit = (s: Row) => {
    setEditing(s);
    form.setFieldsValue(s);
    setOpen(true);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setCsvName(file.name);
      setImportResult(null);
    };
    reader.readAsText(file, "utf-8");
    return false; // 阻止 antd 自动上传
  };

  const columns = [
    { title: "学号", dataIndex: "学号", width: 80, sorter: (a: Row, b: Row) => (parseInt(a.学号) || 0) - (parseInt(b.学号) || 0) },
    {
      title: "姓名",
      dataIndex: "姓名",
      render: (t: string, r: Row) => (
        <a
          style={{ fontWeight: 600 }}
          onClick={(e) => {
            e.stopPropagation();
            setDetailStudent(r);
            setDetailOpen(true);
          }}
        >
          {t}
        </a>
      ),
    },
    { title: "小组", dataIndex: "小组", width: 100 },
    { title: "标签", dataIndex: "标签", render: (t: string) => (t ? <Tag color="geekblue">{t}</Tag> : "-") },
    {
      title: "操作",
      key: "op",
      width: 200,
      render: (_: any, r: Row) => (
        <Space>
          <Button size="small" type="link" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button size="small" type="link" onClick={() => leaveMutation.mutate(r)}>
            离班
          </Button>
          <Popconfirm title="确定删除该学生？" onConfirm={() => delMutation.mutate(r.id)}>
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const csvPreview = csvText
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 6);

  return (
    <div className="page">
      <h2 className="page-title">学生名册</h2>
      <div className="page-sub">当前共 {students?.length ?? 0} 名在册学生</div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={班级}
          onChange={set班级}
          style={{ width: 180 }}
          options={classes.map((c) => ({ value: c, label: c }))}
        />
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索姓名 / 学号"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setSelectedKeys([]);
          }}
          style={{ width: 220 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          添加学生
        </Button>
        <Button icon={<UploadOutlined />} onClick={() => { setImportOpen(true); setImportResult(null); }}>
          CSV 导入
        </Button>
        {selectedKeys.length > 0 && (
          <Popconfirm
            title={`确定删除选中的 ${selectedKeys.length} 名学生？此操作不可恢复。`}
            onConfirm={() => batchDelMutation.mutate(selectedKeys)}
          >
            <Button danger icon={<DeleteOutlined />} loading={batchDelMutation.isPending}>
              删除选中 ({selectedKeys.length})
            </Button>
          </Popconfirm>
        )}
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={students}
        columns={columns}
        onRow={(r) => ({
          onClick: () => {
            setDetailStudent(r);
            setDetailOpen(true);
          },
          style: { cursor: "pointer" },
        })}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys as number[]),
        }}
        pagination={{ pageSize: 20 }}
        size="middle"
        scroll={{ x: "max-content" }}
      />

      <Modal
        title={editing ? "编辑学生" : "添加学生"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="姓名" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="学号" label="学号">
            <Input />
          </Form.Item>
          <Form.Item name="小组" label="小组">
            <Input placeholder="例如：第1组" />
          </Form.Item>
          <Form.Item name="标签" label="标签">
            <Input placeholder="例如：课代表 / 需关注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* CSV 导入弹窗 */}
      <Modal
        title="CSV 批量导入学生"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Alert
            type="info"
            showIcon
            message="CSV 首行为表头，支持列：班级、姓名、学号、小组、标签（缺省列留空即可）；也兼容只有姓名一列。已存在（同班级同名）的学生自动跳过。"
          />

          <Space wrap>
            <Upload accept=".csv" showUploadList={false} beforeUpload={readFile}>
              <Button icon={<UploadOutlined />}>选择 CSV 文件</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
              下载模板
            </Button>
          </Space>

          {csvName && !importResult && (
            <div>
              <div style={{ color: "#666", marginBottom: 4 }}>
                已读取「{csvName}」，前几行预览：
              </div>
              <pre
                style={{
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 8,
                  fontSize: 12,
                  overflowX: "auto",
                  margin: 0,
                }}
              >
                {csvPreview.join("\n")}
              </pre>
              <Button
                type="primary"
                style={{ marginTop: 12 }}
                loading={importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                确认导入到「{班级}」
              </Button>
            </div>
          )}

          {importResult && (
            <div>
              <Space size="large" style={{ marginBottom: 12 }}>
                <Statistic title="新增" value={importResult.统计.新增} valueStyle={{ color: "#3f8600" }} />
                <Statistic title="已存在跳过" value={importResult.统计.已存在} valueStyle={{ color: "#fa8c16" }} />
                <Statistic title="无效行" value={importResult.统计.无效} valueStyle={{ color: "#cf1322" }} />
              </Space>
              {importResult.无效行?.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`无效行：${importResult.无效行.map((x: any) => `第${x.行}行(${x.原因})`).join("、")}`}
                />
              )}
              <Button onClick={() => setImportOpen(false)}>完成</Button>
            </div>
          )}
        </Space>
      </Modal>

      {/* 学生个人学情与档案弹窗 */}
      <StudentDetailModal
        student={detailStudent}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
