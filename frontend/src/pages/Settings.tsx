import {
  Card,
  Form,
  Input,
  Button,
  message,
  Divider,
  Tag,
  Table,
  TimePicker,
  Space,
  Popconfirm,
  Alert,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import dayjs from "dayjs";
import { useAppStore } from "../store/app";
import { DEFAULT_PERIODS, type PeriodItem } from "../periods";

export default function Settings() {
  const 称呼 = useAppStore((s) => s.称呼);
  const 学期 = useAppStore((s) => s.学期);
  const periods = useAppStore((s) => s.periods);
  const set称呼 = useAppStore((s) => s.set称呼);
  const set学期 = useAppStore((s) => s.set学期);
  const setPeriods = useAppStore((s) => s.setPeriods);
  const resetPeriods = useAppStore((s) => s.resetPeriods);

  const [form] = Form.useForm();
  const [savedGreeting, setSavedGreeting] = useState(false);
  const [savedPeriods, setSavedPeriods] = useState(false);

  // 本地临时编辑的节次状态，便于用户修改多项后统一保存
  const [localPeriods, setLocalPeriods] = useState<PeriodItem[]>(
    periods && periods.length > 0 ? periods : DEFAULT_PERIODS
  );

  const onSaveGreeting = (v: { 称呼: string; 学期: string }) => {
    set称呼(v.称呼.trim() || "老师");
    set学期(v.学期.trim());
    setSavedGreeting(true);
    message.success("首页问候设置已保存");
    setTimeout(() => setSavedGreeting(false), 2000);
  };

  const handleTimeChange = (index: number, startStr: string, endStr: string) => {
    setLocalPeriods((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        start: startStr,
        end: endStr,
        time: `${startStr}-${endStr}`,
      };
      return next;
    });
  };

  const handleAddPeriod = () => {
    setLocalPeriods((prev) => {
      const nextN = prev.length > 0 ? Math.max(...prev.map((p) => p.n)) + 1 : 1;
      return [
        ...prev,
        {
          n: nextN,
          start: "21:00",
          end: "21:40",
          time: "21:00-21:40",
        },
      ];
    });
  };

  const handleDeletePeriod = (index: number) => {
    setLocalPeriods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePeriods = () => {
    // 校验
    for (const p of localPeriods) {
      if (!p.start || !p.end) {
        message.error(`第 ${p.n} 节的起止时间不能为空`);
        return;
      }
      if (p.start >= p.end) {
        message.error(`第 ${p.n} 节结束时间（${p.end}）必须晚于开始时间（${p.start}）`);
        return;
      }
    }
    setPeriods(localPeriods);
    setSavedPeriods(true);
    message.success("作息时间表已成功更新并生效");
    setTimeout(() => setSavedPeriods(false), 2000);
  };

  const handleResetPeriods = () => {
    resetPeriods();
    setLocalPeriods(DEFAULT_PERIODS);
    message.success("已恢复默认作息时间表");
  };

  const periodColumns = [
    {
      title: "节次",
      dataIndex: "n",
      width: 100,
      render: (n: number) => <span style={{ fontWeight: 600 }}>第 {n} 节</span>,
    },
    {
      title: "上课时间段（开始 - 结束）",
      dataIndex: "time",
      render: (_: any, record: PeriodItem, index: number) => (
        <TimePicker.RangePicker
          format="HH:mm"
          minuteStep={5}
          allowClear={false}
          value={[dayjs(record.start, "HH:mm"), dayjs(record.end, "HH:mm")]}
          onChange={(_, dateStrings) => {
            if (dateStrings && dateStrings[0] && dateStrings[1]) {
              handleTimeChange(index, dateStrings[0], dateStrings[1]);
            }
          }}
          style={{ width: 220 }}
        />
      ),
    },
    {
      title: "当前设定",
      dataIndex: "time",
      width: 140,
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Popconfirm
          title="确定删除此节次？"
          onConfirm={() => handleDeletePeriod(index)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="page">
      <h2 className="page-title">系统设置</h2>
      <div className="page-sub">自定义个人偏好、作息时间表与学校作息</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 16 }}>
        {/* 作息时间表设置 */}
        <Card
          size="small"
          title="作息时间表（节次起止时间）"
          extra={
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={handleAddPeriod}>
                添加节次
              </Button>
              <Popconfirm
                title="确定恢复系统默认 11 节作息时间？"
                onConfirm={handleResetPeriods}
                okText="恢复"
                cancelText="取消"
              >
                <Button size="small" icon={<ReloadOutlined />}>
                  恢复默认
                </Button>
              </Popconfirm>
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSavePeriods}
              >
                保存作息表
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            message="提示：调整各节次时间后点击「保存作息表」，全站（课表展示、今日课程倒计时与当前上课状态）将立即生效。"
            style={{ marginBottom: 16 }}
          />

          <Table
            rowKey="n"
            dataSource={localPeriods}
            columns={periodColumns}
            pagination={false}
            size="small"
          />

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            {savedPeriods && (
              <span style={{ marginRight: 16, color: "#52c41a", fontWeight: 500 }}>
                ✓ 作息时间表已保存并全站同步生效
              </span>
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSavePeriods}
            >
              保存作息表
            </Button>
          </div>
        </Card>

        {/* 首页问候设置 */}
        <Card size="small" title="首页问候" style={{ maxWidth: 520 }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ 称呼, 学期 }}
            onFinish={onSaveGreeting}
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
              保存问候设置
            </Button>
            {savedGreeting && <span style={{ marginLeft: 12, color: "#52c41a" }}>✓ 已保存</span>}
          </Form>
        </Card>

        {/* 关于信息 */}
        <Card size="small" title="关于系统" style={{ maxWidth: 520 }}>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
            教师工作台 · FastAPI + SQLite + React 现代化工作台
          </p>
          <Space wrap>
            <Tag color="blue">单用户</Tag>
            <Tag color="green">数据本地存储</Tag>
            <Tag color="purple">动态作息表</Tag>
            <Tag color="cyan">15 个功能页</Tag>
          </Space>
        </Card>
      </div>
    </div>
  );
}
