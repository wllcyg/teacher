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
  Switch,
  Select,
} from "antd";
import { Popup } from "antd-mobile";
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ClockCircleOutlined,

  RightOutlined,
  ArrowRightOutlined,
  BellOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  NotificationOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store/app";
import { useAuthStore } from "../store/auth";
import { DEFAULT_PERIODS, hhmmToMinutes, type PeriodItem } from "../periods";
import { updateSettings } from "../api";
import { useIsMobileOrTablet } from "../hooks";
import { triggerHaptic } from "../utils/haptics";
import {
  getNotificationPermission,
  isPushSupported,
  getPushSubscription,
  subscribePushNotification,
  unsubscribePushNotification,
  sendBackendTestPush,
  getPushStatus,
  isIOS,
  type NotificationPermissionState,
} from "../utils/notifications";



const HOURS = Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, "0")); // 06 ~ 23
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export default function Settings() {
  const isMobile = useIsMobileOrTablet();
  const clearToken = useAuthStore((s) => s.clearToken);
  const 称呼 = useAppStore((s) => s.称呼);
  const 学期 = useAppStore((s) => s.学期);
  const periods = useAppStore((s) => s.periods);
  const set称呼 = useAppStore((s) => s.set称呼);
  const set学期 = useAppStore((s) => s.set学期);
  const setPeriods = useAppStore((s) => s.setPeriods);
  const resetPeriods = useAppStore((s) => s.resetPeriods);

  const [form] = Form.useForm();
  const qc = useQueryClient();
  const [savedGreeting, setSavedGreeting] = useState(false);
  const [savedPeriods, setSavedPeriods] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // 移动端专用：作息时间表底部配置面板与时分选择器抽屉状态
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempStart, setTempStart] = useState("08:20");
  const [tempEnd, setTempEnd] = useState("09:00");
  const [activeTab, setActiveTab] = useState<"start" | "end">("start");


  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true);

  // ---- PWA 消息通知与系统离线推送状态 ----
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(getNotificationPermission());


  // Web Push 离线推送特有状态

  const [pushCapable, setPushCapable] = useState(isPushSupported());
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);
  const [testingBackendPush, setTestingBackendPush] = useState(false);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
    setPushCapable(isPushSupported());
    if (isPushSupported()) {
      getPushSubscription().then((sub) => {
        setPushSubscribed(!!sub);
      });
      getPushStatus().then((status) => {
        setDeviceCount(status.subscribedDevices);
      }).catch(() => {});
    }
  }, []);

  const handleSubscribePush = async () => {
    triggerHaptic("medium");
    setSubscribingPush(true);
    try {
      await subscribePushNotification();
      setPushSubscribed(true);
      setNotifPermission("granted");
      message.success("已成功开启 PWA 系统级离线推送！");
      getPushStatus().then((s) => setDeviceCount(s.subscribedDevices)).catch(() => {});
    } catch (err: any) {
      console.error(err);
      message.error(`开启离线推送失败: ${err.message || "请检查系统权限"}`);
    } finally {
      setSubscribingPush(false);
    }
  };

  const handleUnsubscribePush = async () => {
    triggerHaptic("light");
    try {
      await unsubscribePushNotification();
      setPushSubscribed(false);
      message.info("已取消当前设备的后台离线推送");
      getPushStatus().then((s) => setDeviceCount(s.subscribedDevices)).catch(() => {});
    } catch (err) {
      message.error("注销推送失败");
    }
  };

  const handleTestBackendPush = async () => {
    triggerHaptic("light");
    setTestingBackendPush(true);
    try {
      const res = await sendBackendTestPush({
        title: "【工作台离线推送测试】",
        body: "系统级 Web Push 通道畅通！即使关闭页面或最小化也能准时收到。",
        url: "/settings",
        badgeCount: 1,
      });
      if (res.ok) {
        message.success("后端已下发系统推送，请最小化窗口或查看通知中心！");
      } else {
        message.warning(res.message || "推送下发异常");
      }
    } catch (err: any) {
      message.error(`测试推送失败: ${err.response?.data?.detail || err.message || "未知错误"}`);
    } finally {
      setTestingBackendPush(false);
    }
  };




  // 表单与 store 保持同步
  useEffect(() => {
    form.setFieldsValue({ 称呼, 学期 });
  }, [称呼, 学期, form]);

  // 本地临时编辑的节次状态，便于用户修改多项后统一保存
  const [localPeriods, setLocalPeriods] = useState<PeriodItem[]>(
    periods && periods.length > 0 ? periods : DEFAULT_PERIODS
  );

  useEffect(() => {
    if (periods && periods.length > 0) {
      setLocalPeriods(periods);
    }
  }, [periods]);

  const onSaveGreeting = async (v: { 称呼: string; 学期: string }) => {
    triggerHaptic("light");
    const trimmed称呼 = v.称呼.trim() || "崔老师";
    const trimmed学期 = v.学期.trim();
    set称呼(trimmed称呼);
    set学期(trimmed学期);
    try {
      await updateSettings({ 称呼: trimmed称呼, 学期: trimmed学期 });
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSavedGreeting(true);
      triggerHaptic("success");
      message.success("首页问候设置已持久化到数据库");
      setTimeout(() => setSavedGreeting(false), 2000);
    } catch {
      triggerHaptic("warning");
      message.error("保存设置到数据库失败");
    }
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
    triggerHaptic("light");
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
    triggerHaptic("medium");
    setLocalPeriods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePeriods = async () => {
    triggerHaptic("light");
    // 校验
    for (const p of localPeriods) {
      if (!p.start || !p.end) {
        triggerHaptic("warning");
        message.error(`第 ${p.n} 节的起止时间不能为空`);
        return;
      }
      if (p.start >= p.end) {
        triggerHaptic("warning");
        message.error(`第 ${p.n} 节结束时间（${p.end}）必须晚于开始时间（${p.start}）`);
        return;
      }
    }
    setPeriods(localPeriods);
    try {
      await updateSettings({ periods: localPeriods });
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSavedPeriods(true);
      triggerHaptic("success");
      message.success("作息时间表已成功更新并持久化到数据库");
      setScheduleDrawerOpen(false);
      setTimeout(() => setSavedPeriods(false), 2000);

    } catch {
      triggerHaptic("warning");
      message.error("保存作息表到数据库失败");
    }
  };

  const handleResetPeriods = async () => {
    triggerHaptic("medium");
    resetPeriods();
    setLocalPeriods(DEFAULT_PERIODS);
    try {
      await updateSettings({ periods: DEFAULT_PERIODS });
      qc.invalidateQueries({ queryKey: ["settings"] });
      triggerHaptic("success");
      message.success("已恢复默认作息时间表并同步到数据库");
    } catch {
      triggerHaptic("warning");
      message.error("重置作息表失败");
    }
  };

  // ----- 📱 移动端底部时间段选择器控制逻辑 -----
  const handleOpenMobileTimePicker = (index: number) => {
    triggerHaptic("light");
    const item = localPeriods[index];
    setEditingIndex(index);
    setTempStart(item.start || "08:00");
    setTempEnd(item.end || "08:45");
    setActiveTab("start");
    setMobileDrawerOpen(true);
  };

  const handleConfirmMobileTime = () => {
    if (editingIndex === null) return;
    if (tempStart >= tempEnd) {
      triggerHaptic("warning");
      message.error("结束时间必须晚于开始时间");
      return;
    }
    triggerHaptic("success");
    handleTimeChange(editingIndex, tempStart, tempEnd);
    setMobileDrawerOpen(false);
    message.success(`第 ${localPeriods[editingIndex].n} 节时间已设为 ${tempStart} ~ ${tempEnd}`);
  };

  const handleApplyPresetDuration = (targetMins: number) => {
    triggerHaptic("light");
    const startM = hhmmToMinutes(tempStart);
    const newEndM = startM + targetMins;
    const h = String(Math.floor(newEndM / 60) % 24).padStart(2, "0");
    const m = String(newEndM % 60).padStart(2, "0");
    setTempEnd(`${h}:${m}`);
  };

  const currentActiveTime = activeTab === "start" ? tempStart : tempEnd;
  const [currentHour = "08", currentMinute = "00"] = (currentActiveTime || "08:00").split(":");

  const handleSelectHour = (hourStr: string) => {
    if (activeTab === "start") {
      const [, m] = tempStart.split(":");
      setTempStart(`${hourStr}:${m || "00"}`);
    } else {
      const [, m] = tempEnd.split(":");
      setTempEnd(`${hourStr}:${m || "00"}`);
    }
  };

  const handleSelectMinute = (minStr: string) => {
    if (activeTab === "start") {
      const [h] = tempStart.split(":");
      setTempStart(`${h || "08"}:${minStr}`);
    } else {
      const [h] = tempEnd.split(":");
      setTempEnd(`${h || "08"}:${minStr}`);
    }
  };

  const handleMinuteStep = (step: number) => {
    triggerHaptic("light");
    if (activeTab === "start") {
      const cur = hhmmToMinutes(tempStart);
      const n = Math.max(0, Math.min(24 * 60 - 1, cur + step));
      const h = String(Math.floor(n / 60)).padStart(2, "0");
      const m = String(n % 60).padStart(2, "0");
      setTempStart(`${h}:${m}`);
    } else {
      const cur = hhmmToMinutes(tempEnd);
      const n = Math.max(0, Math.min(24 * 60 - 1, cur + step));
      const h = String(Math.floor(n / 60)).padStart(2, "0");
      const m = String(n % 60).padStart(2, "0");
      setTempEnd(`${h}:${m}`);
    }
  };

  const currentDuration = hhmmToMinutes(tempEnd) - hhmmToMinutes(tempStart);

  // PC 端表格列配置
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
    <div className="page" style={{ maxWidth: 880, margin: "0 auto" }}>
      {/* 页面顶栏标题 */}
      <div style={{ marginBottom: isMobile ? 12 : 20 }}>
        <h2 className="page-title" style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 700 }}>
          系统设置
        </h2>
        <div className="page-sub" style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
          自定义个人偏好、作息时间表与学校作息
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24 }}>
        {/* 作息时间表设置 */}
        <Card
          size="small"
          title="作息时间表（节次起止时间）"
          style={{ borderRadius: 14, border: "1px solid #e2e8f0" }}
          extra={
            !isMobile ? (
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
            ) : null
          }
        >
          {isMobile ? (
            /* 📱 移动端紧凑入口按钮：点击呼出底部配置面板，彻底告别平铺刷屏 */
            <div
              onClick={() => {
                triggerHaptic("light");
                setScheduleDrawerOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                background: "linear-gradient(135deg, #f8faff 0%, #f1f5f9 100%)",
                borderRadius: 12,
                border: "1px solid #e0e7ff",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: "#eef2ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4f46e5",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  <ClockCircleOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>作息时间表配置</span>
                    <Tag color="blue" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                      共 {localPeriods.length} 节
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {localPeriods[0]?.start || "08:00"} ~ {localPeriods[localPeriods.length - 1]?.end || "21:40"} · 点击弹出面板编辑
                  </div>
                </div>
              </div>

              <Button
                type="primary"
                size="middle"
                style={{
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  boxShadow: "0 2px 6px rgba(99, 102, 241, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                配置作息 <RightOutlined style={{ fontSize: 11 }} />
              </Button>
            </div>
          ) : (
            /* 💻 PC 端原有表格视图 */
            <>
              <Alert
                type="info"
                showIcon
                message="提示：调整各节次时间后点击「保存作息表」，全站（课表展示、今日课程倒计时与当前上课状态）将立即生效。"
                style={{ marginBottom: 14, fontSize: 12.5 }}
              />

              <Table
                rowKey="n"
                dataSource={localPeriods}
                columns={periodColumns}
                pagination={false}
                size="small"
                scroll={{ x: 500 }}
              />

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {savedPeriods && (
                  <span style={{ color: "#52c41a", fontWeight: 500, marginRight: 8 }}>
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
            </>
          )}
        </Card>


        {/* 首页问候设置 */}
        <Card
          size="small"
          title="首页问候"
          style={{ width: "100%", maxWidth: 640, borderRadius: 14, border: "1px solid #e2e8f0" }}
        >
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
              <Input placeholder="例如：崔老师" size={isMobile ? "large" : "middle"} />
            </Form.Item>
            <Form.Item name="学期" label="学期（可选）">
              <Input placeholder="例如：2026 秋季" size={isMobile ? "large" : "middle"} />
            </Form.Item>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                gap: 10,
                marginTop: 6,
              }}
            >
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                size={isMobile ? "large" : "middle"}
                block={isMobile}
              >
                保存问候设置
              </Button>
              {savedGreeting && (
                <span
                  style={{
                    color: "#52c41a",
                    fontWeight: 500,
                    textAlign: isMobile ? "center" : "left",
                    marginLeft: isMobile ? 0 : 8,
                  }}
                >
                  ✓ 已保存到数据库
                </span>
              )}
            </div>
          </Form>
        </Card>

        {/* 🔔 PWA 系统离线消息推送 */}
        <Card
          size="small"
          title={
            <Space>
              <NotificationOutlined style={{ color: "#6366f1" }} />
              <span>系统离线消息推送 (PWA)</span>
            </Space>
          }
          style={{ width: "100%", maxWidth: 640, borderRadius: 14, border: "1px solid #e2e8f0" }}
        >
          {isIOS() && !isStandalone && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14, borderRadius: 10 }}
              message="iPhone / iPad 用户提示"
              description="iOS 需将工作台「添加到主屏幕」后方可开启系统级通知。点击 Safari 底部「分享」按钮，选择「添加到主屏幕」，从桌面图标打开即可。"
            />
          )}

          <div
            style={{
              padding: "14px 16px",
              background: "linear-gradient(135deg, #f8faff 0%, #f1f5f9 100%)",
              borderRadius: 12,
              border: "1px solid #e0e7ff",
              marginBottom: 0,
            }}
          >

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>PWA 离线系统推送 (Web Push)</span>
                  {pushSubscribed ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      已就绪 (离线可达)
                    </Tag>
                  ) : (
                    <Tag color="default" icon={<ClockCircleOutlined />}>
                      未开启
                    </Tag>
                  )}
                  {deviceCount !== null && deviceCount > 0 && (
                    <Tag color="purple">已连通 {deviceCount} 台设备</Tag>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, maxWidth: 420, lineHeight: 1.5 }}>
                  基于系统级推送通道（iOS APNs / Windows WNS）。即使关闭 PWA 窗口或标签页，依然能在锁屏与桌面收到通知，并联动桌面图标红点。
                </div>
              </div>

              {/* 操作按钮区 */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {!pushSubscribed ? (
                  <Button
                    type="primary"
                    icon={<BellOutlined />}
                    loading={subscribingPush}
                    disabled={!pushCapable}
                    onClick={handleSubscribePush}
                    style={{
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    }}
                  >
                    开启系统级离线推送
                  </Button>
                ) : (
                  <>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={testingBackendPush}
                      onClick={handleTestBackendPush}
                      style={{
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      }}
                    >
                      发送离线测试推送
                    </Button>
                    <Button
                      size="small"
                      danger
                      type="text"
                      onClick={handleUnsubscribePush}
                      style={{ fontSize: 12 }}
                    >
                      注销本设备
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>



        {/* 关于信息与 PWA 更新 */}
        <Card
          size="small"
          title="关于系统与应用更新"
          style={{ width: "100%", maxWidth: 640, borderRadius: 14, border: "1px solid #e2e8f0" }}
        >
          <p style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
            教师工作台 · FastAPI + SQLite + React 现代化工作台
          </p>
          <Space wrap style={{ marginBottom: 14 }}>
            <Tag color={isStandalone ? "processing" : "default"}>
              {isStandalone ? "已安装应用模式 (PWA)" : "浏览器网页模式"}
            </Tag>
            <Tag color="blue">静默热更新</Tag>
            <Tag color="green">数据本地存储</Tag>
            <Tag color="purple">动态作息表</Tag>
            <Tag color="cyan">15 个功能页</Tag>
          </Space>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
            ⚡ 系统已开启全自动静默热更新。每次发版均由系统推送主动唤醒，打开即享最新版本。
          </div>
          <Divider style={{ margin: "12px 0" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              size={isMobile ? "middle" : "small"}
              icon={<ReloadOutlined />}
              onClick={() => {
                triggerHaptic("light");
                window.location.reload();
              }}
              style={{ flex: isMobile ? 1 : "initial", minWidth: 120 }}
            >
              刷新工作台
            </Button>

            <Popconfirm
              title="确定退出登录？"
              okText="退出"
              cancelText="取消"
              onConfirm={() => {
                triggerHaptic("light");
                clearToken();
              }}
            >
              <Button
                danger
                size={isMobile ? "middle" : "small"}
                icon={<LogoutOutlined />}
                style={{ flex: isMobile ? 1 : "initial", minWidth: 120 }}
              >
                退出登录
              </Button>
            </Popconfirm>
          </div>
        </Card>
      </div>

      {/* 📱 移动端底部弹起的作息时间表配置主面板 Popup */}
      <Popup
        position="bottom"
        visible={scheduleDrawerOpen}
        onMaskClick={() => setScheduleDrawerOpen(false)}
        bodyStyle={{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "88vh",
          height: "88vh",
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          padding: "16px 16px calc(24px + env(safe-area-inset-bottom, 16px)) 16px",
          overflow: "hidden",
        }}
      >
        {/* 顶部手柄指示条 */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "#cbd5e1",
            borderRadius: 2,
            margin: "0 auto 12px",
          }}
        />

        {/* 抽屉顶栏 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>作息时间表配置</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              共 {localPeriods.length} 节次，点击各节次可快速调节起止时间
            </div>
          </div>
          <Button
            type="text"
            onClick={() => setScheduleDrawerOpen(false)}
            style={{ color: "#64748b", fontSize: 14 }}
          >
            完成
          </Button>
        </div>

        {/* 快捷操作栏：添加节次 & 恢复默认 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddPeriod}
            style={{ flex: 1, borderRadius: 8, fontWeight: 500 }}
          >
            添加节次
          </Button>
          <Popconfirm
            title="确定恢复系统默认 11 节作息时间？"
            onConfirm={handleResetPeriods}
            okText="恢复"
            cancelText="取消"
          >
            <Button icon={<ReloadOutlined />} style={{ flex: 1, borderRadius: 8 }}>
              恢复默认
            </Button>
          </Popconfirm>
        </div>

        {/* 节次卡片滚动列表 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingRight: 2,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {localPeriods.map((p, index) => {
            const duration =
              p.start && p.end
                ? hhmmToMinutes(p.end) - hhmmToMinutes(p.start)
                : 0;
            return (
              <div
                key={p.n}
                onClick={() => handleOpenMobileTimePicker(index)}
                style={{
                  padding: "12px 14px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", minWidth: 46 }}>
                    第 {p.n} 节
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ClockCircleOutlined style={{ color: "#6366f1", fontSize: 14 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
                      {p.start} ~ {p.end}
                    </span>
                  </div>
                  {duration > 0 && (
                    <Tag color="blue" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                      {duration}分
                    </Tag>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 12.5, color: "#6366f1", fontWeight: 500, display: "flex", alignItems: "center" }}>
                    修改 <RightOutlined style={{ fontSize: 10, marginLeft: 2 }} />
                  </div>
                  <Popconfirm
                    title="确定删除此节次？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeletePeriod(index);
                    }}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginLeft: 4 }}
                    />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部吸底保存生效按钮 */}
        <div style={{ paddingTop: 12, borderTop: "1px solid #e2e8f0", marginTop: 10 }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<SaveOutlined />}
            onClick={handleSavePeriods}
            style={{
              borderRadius: 12,
              height: 44,
              fontWeight: 600,
              fontSize: 15,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
            }}
          >
            保存作息表并全站生效
          </Button>
        </div>
      </Popup>

      {/* 📱 移动端底部弹起的时间段选择器 Popup */}
      <Popup
        position="bottom"
        visible={mobileDrawerOpen}
        onMaskClick={() => setMobileDrawerOpen(false)}
        bodyStyle={{
          padding: "12px 16px calc(24px + env(safe-area-inset-bottom, 16px)) 16px",
          background: "#fff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: "hidden",
        }}
      >
        {/* 顶部手柄指示条 */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "#e2e8f0",
            borderRadius: 2,
            margin: "0 auto 12px",
          }}
        />

        {/* 抽屉顶栏操作区 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Button
            type="text"
            onClick={() => setMobileDrawerOpen(false)}
            style={{ color: "#64748b", fontSize: 14 }}
          >
            取消
          </Button>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
            {editingIndex !== null ? `第 ${localPeriods[editingIndex]?.n} 节 上课时间` : "设置时间段"}
          </div>
          <Button
            type="primary"
            onClick={handleConfirmMobileTime}
            style={{ borderRadius: 8, fontSize: 14 }}
          >
            完成
          </Button>
        </div>

        {/* 开始时间 vs 结束时间 切换卡片 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {/* 开始时间卡片 */}
          <div
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("start");
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              background: activeTab === "start" ? "#eef2ff" : "#f8fafc",
              border: activeTab === "start" ? "2px solid #6366f1" : "1px solid #e2e8f0",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontSize: 12, color: activeTab === "start" ? "#6366f1" : "#64748b", fontWeight: 500 }}>
              开始时间
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: activeTab === "start" ? "#4338ca" : "#1e293b",
                marginTop: 2,
                letterSpacing: 0.5,
              }}
            >
              {tempStart}
            </div>
          </div>

          {/* 中间时长标签 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <ArrowRightOutlined style={{ color: "#94a3b8", fontSize: 14 }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: currentDuration > 0 ? "#4338ca" : "#ef4444",
                background: currentDuration > 0 ? "#e0e7ff" : "#fee2e2",
                padding: "2px 8px",
                borderRadius: 10,
                whiteSpace: "nowrap",
              }}
            >
              {currentDuration > 0 ? `${currentDuration}分钟` : "时间有误"}
            </span>
          </div>

          {/* 结束时间卡片 */}
          <div
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("end");
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              background: activeTab === "end" ? "#eef2ff" : "#f8fafc",
              border: activeTab === "end" ? "2px solid #6366f1" : "1px solid #e2e8f0",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontSize: 12, color: activeTab === "end" ? "#6366f1" : "#64748b", fontWeight: 500 }}>
              结束时间
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: activeTab === "end" ? "#4338ca" : "#1e293b",
                marginTop: 2,
                letterSpacing: 0.5,
              }}
            >
              {tempEnd}
            </div>
          </div>
        </div>

        {/* 快捷课时预设按钮（教育场景一键按开始时间推算结束） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
            课时快捷设为：
          </span>
          {[35, 40, 45, 50].map((mins) => (
            <Button
              key={mins}
              size="small"
              onClick={() => handleApplyPresetDuration(mins)}
              style={{
                borderRadius: 12,
                fontSize: 12,
                borderColor: currentDuration === mins ? "#6366f1" : "#e2e8f0",
                color: currentDuration === mins ? "#6366f1" : "#334155",
                background: currentDuration === mins ? "#f5f3ff" : "#fff",
                fontWeight: currentDuration === mins ? 600 : 400,
              }}
            >
              {mins}分钟
            </Button>
          ))}
        </div>

        {/* 触控选择面板：时 / 分 两列独立滚轮 */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "12px 14px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>
              正在调节「{activeTab === "start" ? "开始时间" : "结束时间"}」
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <Button
                size="small"
                onClick={() => handleMinuteStep(-1)}
                style={{ fontSize: 11, padding: "0 8px", borderRadius: 6 }}
              >
                -1分
              </Button>
              <Button
                size="small"
                onClick={() => handleMinuteStep(1)}
                style={{ fontSize: 11, padding: "0 8px", borderRadius: 6 }}
              >
                +1分
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, height: 175 }}>
            {/* 小时滚轮列 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 4 }}>
                时
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  borderRadius: 10,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  padding: "4px 0",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {HOURS.map((h) => {
                  const isSelected = h === currentHour;
                  return (
                    <div
                      key={h}
                      onClick={() => {
                        triggerHaptic("light");
                        handleSelectHour(h);
                      }}
                      style={{
                        padding: "8px 0",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: isSelected ? 700 : 400,
                        color: isSelected ? "#4f46e5" : "#334155",
                        background: isSelected ? "#eef2ff" : "transparent",
                        cursor: "pointer",
                        borderRadius: 6,
                        margin: "2px 6px",
                        transition: "all 0.1s ease",
                      }}
                    >
                      {h} 时
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 分钟滚轮列 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 4 }}>
                分
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  borderRadius: 10,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  padding: "4px 0",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {MINUTES.map((m) => {
                  const isSelected = m === currentMinute;
                  return (
                    <div
                      key={m}
                      onClick={() => {
                        triggerHaptic("light");
                        handleSelectMinute(m);
                      }}
                      style={{
                        padding: "8px 0",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: isSelected ? 700 : 400,
                        color: isSelected ? "#4f46e5" : "#334155",
                        background: isSelected ? "#eef2ff" : "transparent",
                        cursor: "pointer",
                        borderRadius: 6,
                        margin: "2px 6px",
                        transition: "all 0.1s ease",
                      }}
                    >
                      {m} 分
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 底部确认大按钮 */}
        <Button
          type="primary"
          size="large"
          block
          onClick={handleConfirmMobileTime}
          style={{
            marginTop: 14,
            borderRadius: 12,
            height: 44,
            fontWeight: 600,
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
          }}
        >
          确定上课时间 ({tempStart} ~ {tempEnd})
        </Button>
      </Popup>
    </div>
  );
}
