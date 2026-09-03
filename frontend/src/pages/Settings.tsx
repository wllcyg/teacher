import { Card, Form, Input, Button, message, Divider, Tag } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useAppStore } from "../store/app";

export default function Settings() {
  const 称呼 = useAppStore((s) => s.称呼);
  const 学期 = useAppStore((s) => s.学期);
  const set称呼 = useAppStore((s) => s.set称呼);
  const set学期 = useAppStore((s) => s.set学期);
  const [form] = Form.useForm();
  const [saved, setSaved] = useState(false);

  const onSave = (v: { 称呼: string; 学期: string }) => {
    set称呼(v.称呼.trim() || "老师");
    set学期(v.学期.trim());
    setSaved(true);
    message.success("设置已保存");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page">
      <h2 className="page-title">设置</h2>
      <div className="page-sub">首页称呼等偏好设置</div>

      <Card size="small" title="首页问候" style={{ maxWidth: 480 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ 称呼, 学期 }}
          onFinish={onSave}
        >
          <Form.Item
            name="称呼"
            label="称呼（首页会显示「早上好，{称呼}」）"
            rules={[{ required: true, message: "请输入称呼" }]}
          >
            <Input placeholder="例如：康康老师" />
          </Form.Item>
          <Form.Item name="学期" label="学期（可选）">
            <Input placeholder="例如：2026 秋季" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            保存设置
          </Button>
          {saved && <span style={{ marginLeft: 12, color: "#52c41a" }}>✓ 已保存</span>}
        </Form>
      </Card>

      <Divider />

      <Card size="small" title="关于" style={{ maxWidth: 480 }}>
        <p style={{ color: "#666", fontSize: 13 }}>
          教师工作台 · FastAPI + SQLite + React 复刻版
        </p>
        <Tag color="blue">单用户</Tag>
        <Tag color="green">数据本地存储</Tag>
        <Tag color="purple">15 个功能页</Tag>
      </Card>
    </div>
  );
}
