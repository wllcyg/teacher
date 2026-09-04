import { useMemo, useState } from "react";
import {
  Modal,
  Card,
  Tag,
  Button,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Divider,
  Alert,
  Spin,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  PhoneOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import type { Row } from "../types";
import StudentAvatar from "./StudentAvatar";

interface StudentDetailModalProps {
  student: Row | null;
  open: boolean;
  onClose: () => void;
}

export default function StudentDetailModal({
  student,
  open,
  onClose,
}: StudentDetailModalProps) {
  const qc = useQueryClient();
  const studentName = student?.姓名 || "";
  const studentClass = student?.班级 || "";

  // 基础信息编辑弹窗
  const [editBasicOpen, setEditBasicOpen] = useState(false);
  const [basicForm] = Form.useForm();

  // 添加家长联系表单
  const [parentForm] = Form.useForm();

  // 添加家校沟通表单
  const [commOpen, setCommOpen] = useState(false);
  const [commForm] = Form.useForm();

  // 查询该学生所有数据
  const { data: allAcademics, isLoading: loadingAcademics } = useQuery({
    queryKey: ["academic", studentClass],
    queryFn: () => listTable("academic", { 班级: studentClass }),
    enabled: !!studentClass && open,
  });

  const { data: allBehavior, isLoading: loadingBehavior } = useQuery({
    queryKey: ["behavior", studentClass],
    queryFn: () => listTable("behavior", { 班级: studentClass }),
    enabled: !!studentClass && open,
  });

  const { data: allAttendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["attendance", studentClass],
    queryFn: () => listTable("attendance", { 班级: studentClass }),
    enabled: !!studentClass && open,
  });

  const { data: allParents, isLoading: loadingParents } = useQuery({
    queryKey: ["parents"],
    queryFn: () => listTable("parents"),
    enabled: open,
  });

  const { data: allComms, isLoading: loadingComms } = useQuery({
    queryKey: ["comms"],
    queryFn: () => listTable("comms"),
    enabled: open,
  });

  // 筛选属于当前学生的数据（优先用 student_id 精准匹配，兼容老数据姓名匹配）
  const studentId = student?.student_id || "";
  const matchStudent = (r: Row) => {
    if (studentId && r.student_id) {
      return r.student_id === studentId;
    }
    return r.学生 === studentName;
  };

  const academics = useMemo(
    () => (allAcademics ?? []).filter(matchStudent),
    [allAcademics, studentName, studentId]
  );

  const behaviors = useMemo(
    () => (allBehavior ?? []).filter(matchStudent),
    [allBehavior, studentName, studentId]
  );

  const attendances = useMemo(
    () =>
      (allAttendance ?? []).filter(
        (r) =>
          matchStudent(r) &&
          r.状态 &&
          !["正常", "全勤", "系统核对"].includes(r.状态)
      ),
    [allAttendance, studentName, studentId]
  );

  const parents = useMemo(
    () => (allParents ?? []).filter(matchStudent),
    [allParents, studentName, studentId]
  );

  const comms = useMemo(
    () => (allComms ?? []).filter(matchStudent),
    [allComms, studentName, studentId]
  );

  // 表现总分
  const totalBehavior = useMemo(() => {
    return behaviors.reduce((acc, r) => acc + (parseFloat(r.分值) || 0), 0);
  }, [behaviors]);

  // ---------- 删除各模块记录 ----------
  const handleDeleteRow = async (
    table: "academic" | "behavior" | "attendance" | "parents" | "comms",
    id: number
  ) => {
    try {
      await deleteRow(table, id);
      message.success("已删除该条记录");
      qc.invalidateQueries({ queryKey: [table] });
    } catch (e: any) {
      message.error("删除失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 保存基础信息编辑 ----------
  const handleSaveBasic = async (vals: any) => {
    if (!student) return;
    try {
      await updateRow("students", student.id, {
        ...student,
        ...vals,
      });
      message.success("学生信息已更新");
      setEditBasicOpen(false);
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch (e: any) {
      message.error("保存失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 添加一条家长联系 ----------
  const handleAddParent = async (vals: { 称谓: string; 电话: string; 备注?: string }) => {
    if (!studentName) return;
    try {
      await createRow("parents", {
        student_id: studentId,
        学生: studentName,
        称谓: vals.称谓.trim(),
        电话: vals.电话.trim(),
        备注: (vals.备注 || "").trim(),
      });
      message.success("已添加家长联系方式");
      parentForm.resetFields();
      qc.invalidateQueries({ queryKey: ["parents"] });
    } catch (e: any) {
      message.error("添加失败：" + (e?.message ?? ""));
    }
  };

  // ---------- 添加一条沟通记录 ----------
  const handleAddComm = async (vals: { 方式: string; 内容: string; 结果?: string }) => {
    if (!studentName) return;
    try {
      await createRow("comms", {
        student_id: studentId,
        日期: dayjs().format("YYYY-MM-DD"),
        学生: studentName,
        对象: "家长",
        方式: vals.方式,
        内容: vals.内容.trim(),
        结果: (vals.结果 || "").trim(),
      });
      message.success("已记录沟通痕迹");
      setCommOpen(false);
      commForm.resetFields();
      qc.invalidateQueries({ queryKey: ["comms"] });
    } catch (e: any) {
      message.error("记录失败：" + (e?.message ?? ""));
    }
  };

  const isLoading =
    loadingAcademics || loadingBehavior || loadingAttendance || loadingParents || loadingComms;

  if (!student) return null;

  const firstChar = studentName ? studentName.slice(0, 1) : "";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
      style={{ top: 20 }}
      styles={{ body: { padding: "12px 16px 24px" } }}
    >
      {/* 头部学生档案 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          paddingBottom: 14,
          borderBottom: "1px solid #f1f5f9",
          marginBottom: 16,
        }}
      >
        {/* 学生专属头像 */}
        <StudentAvatar student={student} size={50} />

        {/* 姓名与标签 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
              {studentName}
            </span>
            <Tag color="default" style={{ margin: 0 }}>
              {studentClass}
            </Tag>
            {student?.student_id && (
              <Tag color="cyan" style={{ margin: 0, fontFamily: "monospace", fontWeight: 600 }}>
                {student.student_id}
              </Tag>
            )}
            <Tag
              color={totalBehavior > 0 ? "blue" : totalBehavior < 0 ? "red" : "default"}
              style={{ margin: 0 }}
            >
              表现 {totalBehavior > 0 ? `+${totalBehavior}` : totalBehavior}
            </Tag>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                basicForm.setFieldsValue({
                  小组: student.小组,
                  学号: student.学号,
                  标签: student.标签,
                });
                setEditBasicOpen(true);
              }}
              style={{ borderRadius: 12, fontSize: 12 }}
            >
              编辑
            </Button>
          </div>

          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {student.小组 ? `${student.小组}` : "未分组"}
            {student.标签 ? ` · ${student.标签}` : " · 组员"}
            {student.学号 ? ` · 学号 ${student.学号}` : ""}
          </div>
        </div>
      </div>

      <Spin spinning={isLoading}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 卡片 1：学业记录 */}
          <Card size="small" style={{ borderRadius: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                学业记录
              </span>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                记错了？每条右边可以删掉，会问一句再删。
              </div>
            </div>

            {academics.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
                还没有学业记录。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {academics.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.日期}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>
                        {r.项目}:{" "}
                        <span
                          style={{
                            color:
                              r.结果 === "过关" || r.结果 === "√"
                                ? "#16a34a"
                                : r.结果 === "未过"
                                ? "#ea580c"
                                : "#1677ff",
                          }}
                        >
                          {r.结果}
                        </span>
                      </div>
                    </div>
                    <Popconfirm
                      title="确定删除该条学业记录吗？"
                      onConfirm={() => handleDeleteRow("academic", r.id)}
                      okText="删掉"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger style={{ fontSize: 12 }}>
                        删掉
                      </Button>
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 卡片 2：表现记录 */}
          <Card size="small" style={{ borderRadius: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                表现记录
              </span>
            </div>

            {behaviors.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
                还没有记录。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {behaviors.map((r) => {
                  const val = parseFloat(r.分值) || 0;
                  return (
                    <div
                      key={r.id}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #f1f5f9",
                        borderRadius: 8,
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.日期}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>
                          {r.项目}:{" "}
                          <span style={{ color: val > 0 ? "#1677ff" : "#cf1322" }}>
                            {val > 0 ? `+${val}` : val}
                          </span>
                          {r.备注 && (
                            <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 8 }}>
                              ({r.备注})
                            </span>
                          )}
                        </div>
                      </div>
                      <Popconfirm
                        title="确定删除该表现记录吗？"
                        onConfirm={() => handleDeleteRow("behavior", r.id)}
                        okText="删掉"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" type="text" danger style={{ fontSize: 12 }}>
                          删掉
                        </Button>
                      </Popconfirm>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 卡片 3：考勤异常 */}
          <Card size="small" style={{ borderRadius: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                考勤异常
              </span>
            </div>

            {attendances.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
                全勤，没有异常记录。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {attendances.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: "#fff1f0",
                      border: "1px solid #ffccc7",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.日期}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#cf1322", marginTop: 2 }}>
                        {r.状态}
                        {r.备注 && (
                          <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>
                            ({r.备注})
                          </span>
                        )}
                      </div>
                    </div>
                    <Popconfirm
                      title="确定删除该考勤异常吗？"
                      onConfirm={() => handleDeleteRow("attendance", r.id)}
                      okText="删掉"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger style={{ fontSize: 12 }}>
                        删掉
                      </Button>
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 卡片 4：家长联系 */}
          <Card size="small" style={{ borderRadius: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                家长联系
              </span>
            </div>

            {/* 提示文案 */}
            <div
              style={{
                background: "#fffbe6",
                border: "1px dashed #ffe58f",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                color: "#d46b08",
                marginBottom: 10,
              }}
            >
              这块只在学生个人页显示，不会出现在汇总、花名册矩阵和打印里。
            </div>

            {/* 已有家长列表 */}
            {parents.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
                还没填家长联系方式。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {parents.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Space size={12}>
                      <Tag color="blue">{p.称谓 || "家长"}</Tag>
                      <strong style={{ fontSize: 14 }}>{p.电话}</strong>
                      {p.备注 && <span style={{ color: "#64748b", fontSize: 12 }}>({p.备注})</span>}
                    </Space>
                    <Popconfirm
                      title="确定删除此联系人吗？"
                      onConfirm={() => handleDeleteRow("parents", p.id)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}

            {/* 加一条家长联系 */}
            <Form form={parentForm} layout="inline" onFinish={handleAddParent}>
              <Form.Item name="称谓" rules={[{ required: true, message: "如妈妈" }]}>
                <Input placeholder="称谓（如妈妈）" style={{ width: 110 }} />
              </Form.Item>
              <Form.Item name="电话" rules={[{ required: true, message: "手机号" }]}>
                <Input placeholder="手机号" style={{ width: 130 }} />
              </Form.Item>
              <Form.Item name="备注">
                <Input placeholder="什么时候方便联系" style={{ width: 160 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  加一条
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* 卡片 5：家校沟通 */}
          <Card size="small" style={{ borderRadius: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                家校沟通
              </span>
              <Button
                size="small"
                icon={<MessageOutlined />}
                onClick={() => setCommOpen(true)}
              >
                记一次沟通
              </Button>
            </div>

            {comms.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
                还没留过痕。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {comms.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {c.日期} · 方式: {c.方式 || "电话"}
                      </div>
                      <div style={{ fontSize: 13, color: "#1e293b", marginTop: 2 }}>
                        {c.内容}
                      </div>
                      {c.结果 && (
                        <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>
                          结果: {c.结果}
                        </div>
                      )}
                    </div>
                    <Popconfirm
                      title="确定删除该条沟通记录吗？"
                      onConfirm={() => handleDeleteRow("comms", c.id)}
                      okText="删掉"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger style={{ fontSize: 12 }}>
                        删掉
                      </Button>
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Spin>

      {/* 弹窗：编辑基本信息 */}
      <Modal
        title="编辑学生档案"
        open={editBasicOpen}
        onCancel={() => setEditBasicOpen(false)}
        onOk={() => basicForm.submit()}
        okText="保存"
      >
        <Form form={basicForm} layout="vertical" onFinish={handleSaveBasic}>
          <Form.Item name="学号" label="学号">
            <Input />
          </Form.Item>
          <Form.Item name="小组" label="小组">
            <Input placeholder="如第1组、第2组" />
          </Form.Item>
          <Form.Item name="标签" label="职务 / 标签">
            <Input placeholder="如班长、课代表、组员" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 弹窗：记一次沟通 */}
      <Modal
        title={`记一次家校沟通（${studentName}）`}
        open={commOpen}
        onCancel={() => setCommOpen(false)}
        onOk={() => commForm.submit()}
        okText="记录"
      >
        <Form
          form={commForm}
          layout="vertical"
          initialValues={{ 方式: "电话" }}
          onFinish={handleAddComm}
        >
          <Form.Item name="方式" label="沟通方式" rules={[{ required: true }]}>
            <Input placeholder="如电话、微信、面谈" />
          </Form.Item>
          <Form.Item name="内容" label="沟通内容" rules={[{ required: true, message: "请输入内容" }]}>
            <Input.TextArea rows={3} placeholder="如：反馈近期课堂知识掌握情况..." />
          </Form.Item>
          <Form.Item name="结果" label="反馈与结果">
            <Input placeholder="如：家长表示今晚督促背诵" />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}
