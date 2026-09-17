import { useState, useMemo } from "react";
import {
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Tag,
  DatePicker,
  Alert,
  Empty,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InfiniteScroll } from "antd-mobile";
import dayjs from "dayjs";
import {
  createRow,
  deleteRow,
  getContactBook,
  importParents,
  listTable,
  updateRow,
} from "../api";
import { useCurrentClass, useStudents, useIsMobileOrTablet } from "../hooks";
import type { Row } from "../types";
import { triggerHaptic } from "../utils/haptics";

const WAYS = ["电话", "微信", "当面", "家访"];
const WHO = ["妈妈", "爸爸", "爷爷", "奶奶", "外公", "外婆", "其他"];

export default function Comms() {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const isMobile = useIsMobileOrTablet();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState("");

  // PC 端分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data: students } = useStudents();

  // 1. PC 端分页查询
  const { data: commsPageResult, isLoading: pcLoading } = useQuery({
    queryKey: ["comms-pc", page, pageSize],
    queryFn: () => listTable("comms", { page, page_size: pageSize }),
    enabled: !isMobile,
  });

  // 2. 移动端触底无限滚动
  const {
    data: infiniteComms,
    fetchNextPage,
    hasNextPage,
    isLoading: mobileLoading,
  } = useInfiniteQuery({
    queryKey: ["comms-mobile"],
    queryFn: ({ pageParam = 1 }) => listTable("comms", { page: pageParam, page_size: 15 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.page_size;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: isMobile,
  });

  const commsList: Row[] = useMemo(() => {
    if (isMobile) {
      return infiniteComms ? infiniteComms.pages.flatMap((p) => p.items) : [];
    }
    return commsPageResult?.items || [];
  }, [isMobile, infiniteComms, commsPageResult]);

  const totalComms = isMobile
    ? (infiniteComms?.pages[0]?.total ?? 0)
    : (commsPageResult?.total ?? 0);

  const isLoading = isMobile ? mobileLoading : pcLoading;

  const { data: contact } = useQuery({
    queryKey: ["contact-book", 班级, keyword],
    queryFn: () => getContactBook(班级, keyword),
    enabled: !!班级,
  });

  const refreshComms = () => {
    qc.invalidateQueries({ queryKey: ["comms-pc"] });
    qc.invalidateQueries({ queryKey: ["comms-mobile"] });
  };

  const save = useMutation({
    mutationFn: (v: Record<string, any>) =>
      editing ? updateRow("comms", editing.id, v) : createRow("comms", v),
    onSuccess: () => {
      triggerHaptic("success");
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      refreshComms();
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("comms", id),
    onSuccess: () => {
      triggerHaptic("light");
      message.success("已删除");
      refreshComms();
    },
  });

  const importMutation = useMutation({
    mutationFn: (文本: string) => importParents(文本, 班级),
    onSuccess: () => {
      triggerHaptic("success");
      qc.invalidateQueries({ queryKey: ["contact-book"] });
    },
  });

  const studentOptions = (students ?? []).map((s) => {
    const val = s.name || s.姓名;
    return { value: val, label: val };
  });

  const commColumns = [
    {
      title: "日期",
      dataIndex: "date",
      width: 110,
      render: (_: any, r: Row) => r.date || r.日期 || "-",
      sorter: (a: Row, b: Row) => ((a.date || a.日期) || "").localeCompare((b.date || b.日期) || ""),
    },
    {
      title: "学生",
      dataIndex: "student_name",
      width: 100,
      render: (_: any, r: Row) => r.student_name || r.学生 || "-",
    },
    {
      title: "对象",
      dataIndex: "target",
      width: 80,
      render: (_: any, r: Row) => r.target || r.对象 || "-",
    },
    {
      title: "方式",
      dataIndex: "method",
      width: 80,
      render: (_: any, r: Row) => {
        const m = r.method || r.方式;
        return m ? <Tag>{m}</Tag> : "-";
      },
    },
    {
      title: "内容",
      dataIndex: "content",
      render: (_: any, r: Row) => r.content || r.内容 || "-",
    },
    {
      title: "结果",
      dataIndex: "result",
      width: 90,
      render: (_: any, r: Row) => r.result || r.结果 || "-",
    },
    {
      title: "操作",
      key: "op",
      width: 140,
      render: (_: any, r: Row) => (
        <Space>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setEditing(r);
              const dStr = r.date || r.日期;
              form.setFieldsValue({
                student_name: r.student_name || r.学生,
                target: r.target || r.对象 || "家长",
                method: r.method || r.方式 || "电话",
                content: r.content || r.内容,
                result: r.result || r.结果,
                date: dStr ? dayjs(dStr) : null,
                学生: r.student_name || r.学生,
                对象: r.target || r.对象 || "家长",
                方式: r.method || r.方式 || "电话",
                内容: r.content || r.内容,
                结果: r.result || r.结果,
                日期: dStr ? dayjs(dStr) : null,
              });
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此条记录？" onConfirm={() => del.mutate(r.id)}>
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const contactColumns = [
    {
      title: "学生",
      dataIndex: "name",
      width: 110,
      render: (_: any, r: Row) => r.name || r.姓名 || "-",
    },
    {
      title: "家长",
      dataIndex: "parents",
      render: (parentsList: Row[], r: Row) => {
        const list = parentsList || r.家长 || [];
        return list.length === 0 ? (
          <span style={{ color: "#bbb" }}>未登记</span>
        ) : (
          list.map((p: any) => (
            <Tag key={p.id} color="geekblue">
              {p.relationship || p.称谓 || "家长"} {p.phone || p.电话}
            </Tag>
          ))
        );
      },
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
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 16 }}
                  onClick={() => {
                    setEditing(null);
                    form.resetFields();
                    setOpen(true);
                  }}
                >
                  添加记录
                </Button>

                {isMobile ? (
                  /* 移动端触控卡片列表 + 上拉触底无限加载 */
                  <div>
                    {commsList.length === 0 && !isLoading ? (
                      <Empty description="暂无沟通记录" />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {commsList.map((r) => {
                          const sName = r.student_name || r.学生;
                          const tgt = r.target || r.对象;
                          const mth = r.method || r.方式;
                          const dt = r.date || r.日期;
                          const cnt = r.content || r.内容;
                          const res = r.result || r.结果;
                          return (
                            <div
                              key={r.id}
                              style={{
                                background: "#fff",
                                borderRadius: 12,
                                padding: "12px 14px",
                                border: "1px solid #e2e8f0",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 16, fontWeight: 600, color: "#1e293b" }}>{sName}</span>
                                  {tgt && <Tag color="blue">{tgt}</Tag>}
                                  {mth && <Tag color="default">{mth}</Tag>}
                                </div>
                                <span style={{ fontSize: 12, color: "#94a3b8" }}>{dt}</span>
                              </div>

                              {cnt && (
                                <div style={{ fontSize: 14, color: "#334155", margin: "8px 0 4px", lineHeight: 1.5 }}>
                                  {cnt}
                                </div>
                              )}

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px dashed #f1f5f9" }}>
                                <span style={{ fontSize: 12, color: res ? "#1677ff" : "#94a3b8" }}>
                                  {res ? `结果：${res}` : "未填写跟进结果"}
                                </span>
                                <Space>
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      setEditing(r);
                                      form.setFieldsValue({
                                        student_name: sName,
                                        target: tgt || "家长",
                                        method: mth || "电话",
                                        content: cnt,
                                        result: res,
                                        date: dt ? dayjs(dt) : null,
                                        学生: sName,
                                        对象: tgt || "家长",
                                        方式: mth || "电话",
                                        内容: cnt,
                                        结果: res,
                                        日期: dt ? dayjs(dt) : null,
                                      });
                                      setOpen(true);
                                    }}
                                  >
                                    编辑
                                  </Button>
                                  <Popconfirm title="确认删除？" onConfirm={() => del.mutate(r.id)}>
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              </div>
                            </div>
                          );
                        })}

                        <InfiniteScroll loadMore={async () => { await fetchNextPage(); }} hasMore={Boolean(hasNextPage)} />
                      </div>
                    )}
                  </div>
                ) : (
                  /* PC 端经典表格 + 真服务端分页 */
                  <Table
                    rowKey="id"
                    loading={isLoading}
                    dataSource={commsList}
                    columns={commColumns}
                    pagination={{
                      current: page,
                      pageSize,
                      total: totalComms,
                      showTotal: (total) => `共 ${total} 条记录`,
                      onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                      },
                    }}
                    size="middle"
                    scroll={{ x: "max-content" }}
                  />
                )}
              </>
            ),
          },
          {
            key: "book",
            label: "家长通讯录",
            children: (
              <>
                <Space style={{ marginBottom: 16 }} wrap>
                  <Input.Search
                    placeholder="按姓名/称谓/电话搜索"
                    allowClear
                    style={{ width: 260 }}
                    onSearch={setKeyword}
                    onChange={(e) => !e.target.value && setKeyword("")}
                  />
                </Space>
                <Table
                  rowKey="姓名"
                  dataSource={contact}
                  columns={contactColumns}
                  pagination={{ pageSize: 20 }}
                  size="middle"
                  scroll={{ x: "max-content" }}
                />
              </>
            ),
          },
          {
            key: "import",
            label: "批量导入",
            children: (
              <ParentImport
                onImport={(t) => importMutation.mutateAsync(t)}
                result={importMutation.data}
              />
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "编辑沟通记录" : "添加沟通记录"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => {
            const dt = v.date || v.日期;
            save.mutate({
              student_name: v.student_name || v.学生,
              target: v.target || v.对象 || "家长",
              method: v.method || v.方式 || "电话",
              content: v.content || v.内容 || "",
              result: v.result || v.结果 || "",
              date: dt ? (dayjs.isDayjs(dt) ? dt.format("YYYY-MM-DD") : String(dt)) : dayjs().format("YYYY-MM-DD"),
            });
          }}
        >
          <Form.Item name="date" label="日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: "请选择学生" }]}>
            <Select
              showSearch
              options={studentOptions}
              filterOption={(input, o) => (o?.label ?? "").includes(input)}
            />
          </Form.Item>
          <Form.Item name="target" label="对象">
            <Select options={WHO.map((w) => ({ value: w, label: w }))} />
          </Form.Item>
          <Form.Item name="method" label="方式">
            <Select options={WAYS.map((w) => ({ value: w, label: w }))} />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={3} placeholder="沟通要点及学生近期表现" />
          </Form.Item>
          <Form.Item name="result" label="结果">
            <Input placeholder="例如：家长承诺督促完成作业" />
          </Form.Item>
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
      <Input.TextArea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"张三 妈妈 13800138000\n李四 爸爸 13900139000"}
      />
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
          <Alert
            type="success"
            message={`可导入 ${result.对上.length} 条，名册外 ${result.名册外.length}，坏行 ${result.坏行.length}，已存在 ${result.已有.length}，未登记 ${result.没登记.length}`}
          />
        </div>
      )}
    </div>
  );
}
