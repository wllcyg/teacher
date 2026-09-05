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
  Drawer,
  Switch,
  Select,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CloudSyncOutlined,
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
  requestNotificationPermission,
  getStoredNotificationSettings,
  saveStoredNotificationSettings,
  sendNotification,
  isIOS,
  type NotificationSettings,
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

  // 移动端专用：底部弹起时间段抽屉选择器状态
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempStart, setTempStart] = useState("08:20");
  const [tempEnd, setTempEnd] = useState("09:00");
  const [activeTab, setActiveTab] = useState<"start" | "end">("start");

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true);

  // ---- PWA 消息通知与课前提醒状态 ----
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(getNotificationPermission());
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getStoredNotificationSettings());
  const [requestingNotif, setRequestingNotif] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleRequestNotif = async () => {
    triggerHaptic("light");
    setRequestingNotif(true);
    try {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        message.success("已成功开启消息通知权限！");
        await sendNotification("【通知已开启】", {
          body: "教师工作台课前提醒与教学通知已就绪。",
          data: { url: "/settings" },
        });
      } else if (perm === "denied") {
        message.error("通知权限被浏览器拦截，请在浏览器地址栏左侧网站权限设置中解除限制。");
      }
    } finally {
      setRequestingNotif(false);
    }
  };

  const handleTestNotif = async () => {
    triggerHaptic("light");
    setTestingNotif(true);
    try {
      const ok = await sendNotification("【工作台测试通知】", {
        body: "提醒功能运转正常！上课前将准时为您发送系统通知。",
        data: { url: "/settings" },
      });
      if (ok) {
        message.success("已发送测试通知，请查看手机顶部通知栏或电脑通知中心");
      } else {
        message.warning("发送失败，请确认系统通知权限是否已授权");
      }
    } finally {
      setTestingNotif(false);
    }
  };

  const handleUpdateNotifSettings = (partial: Partial<NotificationSettings>) => {
    triggerHaptic("light");
    const next = { ...notifSettings, ...partial };
    setNotifSettings(next);
    saveStoredNotificationSettings(next);
    message.success("通知设置已保存");
  };

  const handleCheckUpdate = async () => {
    if (!("serviceWorker" in navigator)) {
      message.warning("当前浏览器环境不支持 Service Worker 离线更新");
      return;
    }
    setCheckingUpdate(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        message.success("已请求最新版本信息，若检测到新版本将在右下角弹出提示");
      } else {
        message.info("暂未检测到活动的 Service Worker，当前可能处于本地开发环境");
      }
    } catch {
      message.error("检查更新失败，请确认网络连接是否正常");
    } finally {
      setTimeout(() => setCheckingUpdate(false), 800);
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
          <Alert
            type="info"
            showIcon
            message="提示：调整各节次时间后点击「保存作息表」，全站（课表展示、今日课程倒计时与当前上课状态）将立即生效。"
            style={{ marginBottom: 14, fontSize: 12.5 }}
          />

          {/* 移动端快捷操作栏 */}
          {isMobile && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <Button
                size="middle"
                icon={<PlusOutlined />}
                onClick={handleAddPeriod}
                style={{ flex: 1, minWidth: 100 }}
              >
                添加节次
              </Button>
              <Popconfirm
                title="确定恢复系统默认 11 节作息时间？"
                onConfirm={handleResetPeriods}
                okText="恢复"
                cancelText="取消"
              >
                <Button size="middle" icon={<ReloadOutlined />} style={{ flex: 1, minWidth: 100 }}>
                  恢复默认
                </Button>
              </Popconfirm>
            </div>
          )}

          {/* 移动端卡片列表（点击呼出底部抽屉选择器） vs PC 端表格 */}
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {localPeriods.map((p, index) => {
                const duration =
                  p.start && p.end
                    ? hhmmToMinutes(p.end) - hhmmToMinutes(p.start)
                    : 0;
                return (
                  <div
                    key={p.n}
                    style={{
                      padding: "12px 14px",
                      background: "#f8fafc",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                          第 {p.n} 节
                        </span>
                        {duration > 0 ? (
                          <Tag color="blue" style={{ margin: 0, fontSize: 12 }}>
                            {duration} 分钟
                          </Tag>
                        ) : (
                          <Tag color="default" style={{ margin: 0, fontSize: 12 }}>
                            {p.time}
                          </Tag>
                        )}
                      </div>
                      <Popconfirm
                        title="确定删除此节次？"
                        onConfirm={() => handleDeletePeriod(index)}
                        okText="删除"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{ padding: "4px 8px" }}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </div>

                    {/* 📱 点击该卡片直接从屏幕底部滑出时间段选择面板 */}
                    <div
                      onClick={() => handleOpenMobileTimePicker(index)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "#fff",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ClockCircleOutlined style={{ color: "#6366f1", fontSize: 16 }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", letterSpacing: 0.5 }}>
                          {p.start} ~ {p.end}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366f1", fontSize: 13, fontWeight: 500 }}>
                        <span>修改时间</span>
                        <RightOutlined style={{ fontSize: 11 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table
              rowKey="n"
              dataSource={localPeriods}
              columns={periodColumns}
              pagination={false}
              size="small"
              scroll={{ x: 500 }}
            />
          )}

          {/* 底部保存按钮 */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: isMobile ? "stretch" : "flex-end",
              alignItems: isMobile ? "stretch" : "center",
              gap: 10,
            }}
          >
            {savedPeriods && (
              <span
                style={{
                  color: "#52c41a",
                  fontWeight: 500,
                  textAlign: isMobile ? "center" : "right",
                  marginRight: isMobile ? 0 : 8,
                }}
              >
                ✓ 作息时间表已保存并全站同步生效
              </span>
            )}
            <Button
              type="primary"
              size={isMobile ? "large" : "middle"}
              icon={<SaveOutlined />}
              onClick={handleSavePeriods}
              block={isMobile}
            >
              保存作息表
            </Button>
          </div>
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

        {/* 🔔 PWA 消息通知与课前提醒 */}
        <Card
          size="small"
          title={
            <Space>
              <NotificationOutlined style={{ color: "#6366f1" }} />
              <span>消息通知与课前提醒</span>
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

          {/* 权限状态栏 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px solid #f1f5f9",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>
                系统级通知权限
              </div>
              <div>
                {notifPermission === "granted" && (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    已授权开启
                  </Tag>
                )}
                {notifPermission === "default" && (
                  <Tag color="warning" icon={<ClockCircleOutlined />}>
                    未授权 (待开启)
                  </Tag>
                )}
                {notifPermission === "denied" && (
                  <Tag color="error" icon={<CloseCircleOutlined />}>
                    已被浏览器拦截
                  </Tag>
                )}
                {notifPermission === "unsupported" && (
                  <Tag color="default">当前环境不支持</Tag>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {notifPermission !== "granted" ? (
                <Button
                  type="primary"
                  icon={<BellOutlined />}
                  loading={requestingNotif}
                  onClick={handleRequestNotif}
                  style={{
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  }}
                >
                  开启系统通知
                </Button>
              ) : (
                <Button
                  icon={<SendOutlined />}
                  loading={testingNotif}
                  onClick={handleTestNotif}
                  style={{ borderRadius: 8 }}
                >
                  发送测试通知
                </Button>
              )}
            </div>
          </div>

          {/* 提醒项目选项 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 课前提醒 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>课前自动提醒</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  每节课开始前通过系统通知栏弹出课程班级与开始时间
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {notifSettings.lessonRemindEnabled && (
                  <Select
                    size="small"
                    value={notifSettings.lessonRemindMinutes}
                    onChange={(val) => handleUpdateNotifSettings({ lessonRemindMinutes: val })}
                    options={[
                      { label: "提前 5 分钟", value: 5 },
                      { label: "提前 10 分钟", value: 10 },
                      { label: "提前 15 分钟", value: 15 },
                    ]}
                    style={{ width: 110 }}
                  />
                )}
                <Switch
                  checked={notifSettings.lessonRemindEnabled}
                  onChange={(checked) => handleUpdateNotifSettings({ lessonRemindEnabled: checked })}
                />
              </div>
            </div>

            {/* 晨间寄语问候 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>清晨寄语问候</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  工作日早晨初次唤起工作台时送上今日寄语与温馨勉励
                </div>
              </div>
              <Switch
                checked={notifSettings.morningGreetingEnabled}
                onChange={(checked) => handleUpdateNotifSettings({ morningGreetingEnabled: checked })}
              />
            </div>

            {/* 待办提醒 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1e293b" }}>教学待办轻提醒</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  离校前检测到有今日未结或逾期待办时轻提醒
                </div>
              </div>
              <Switch
                checked={notifSettings.todoRemindEnabled}
                onChange={(checked) => handleUpdateNotifSettings({ todoRemindEnabled: checked })}
              />
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
            <Tag color="blue">单用户</Tag>
            <Tag color="green">数据本地存储</Tag>
            <Tag color="purple">动态作息表</Tag>
            <Tag color="cyan">15 个功能页</Tag>
          </Space>
          <Divider style={{ margin: "12px 0" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              size={isMobile ? "middle" : "small"}
              icon={<CloudSyncOutlined />}
              loading={checkingUpdate}
              onClick={() => {
                triggerHaptic("light");
                handleCheckUpdate();
              }}
              style={{ flex: isMobile ? 1 : "initial", minWidth: 120 }}
            >
              检查新版本
            </Button>
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

      {/* 📱 移动端底部弹起的时间段抽屉选择器（Vant / ActionSheet 风格） */}
      <Drawer
        placement="bottom"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        height="auto"
        closable={false}
        styles={{
          body: {
            padding: "12px 16px calc(20px + env(safe-area-inset-bottom, 16px)) 16px",
            background: "#fff",
            borderRadius: "20px 20px 0 0",
          },
          content: {
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.12)",
          },
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
      </Drawer>
    </div>
  );
}
