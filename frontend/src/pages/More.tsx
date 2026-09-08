import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Button } from "antd";
import { AdaptiveModal } from "../components/AdaptiveModal";
import {
  LogoutOutlined,
  RightOutlined,
  ReadOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CalendarOutlined,
  BookOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  MessageOutlined,
  SafetyOutlined,
  SyncOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  SmileOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { useAppStore } from "../store/app";
import { useAuthStore } from "../store/auth";
import { triggerHaptic } from "../utils/haptics";

dayjs.locale("zh-cn");

interface FeatureItem {
  key: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface FeatureSection {
  title: string;
  items: FeatureItem[];
}

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: "学情与分析",
    items: [
      {
        key: "/scores",
        title: "成绩录入",
        desc: "单元与测试登分、正答率统计",
        icon: <ReadOutlined />,
        color: "#2563eb",
        bgColor: "#eff6ff",
      },
      {
        key: "/summary",
        title: "学期汇总",
        desc: "积分总榜与多维综合测评",
        icon: <BarChartOutlined />,
        color: "#7c3aed",
        bgColor: "#f5f3ff",
      },
      {
        key: "/report",
        title: "学情报表",
        desc: "图表可视化与 A4 打印导出",
        icon: <FileTextOutlined />,
        color: "#059669",
        bgColor: "#ecfdf5",
      },
    ],
  },
  {
    title: "日常教学与班务",
    items: [
      {
        key: "/schedule",
        title: "课表总览",
        desc: "每周排课与每日课程对照",
        icon: <CalendarOutlined />,
        color: "#d97706",
        bgColor: "#fffbeb",
      },
      {
        key: "/lesson-logs",
        title: "课堂小记",
        desc: "随堂教学笔记与进度速记",
        icon: <BookOutlined />,
        color: "#0284c7",
        bgColor: "#f0f9ff",
      },
      {
        key: "/seating",
        title: "座位编排",
        desc: "可视化排座与座位图预览",
        icon: <AppstoreOutlined />,
        color: "#4f46e5",
        bgColor: "#eef2ff",
      },
      {
        key: "/attendance",
        title: "考勤打卡",
        desc: "请假出勤与每日出勤统计",
        icon: <ClockCircleOutlined />,
        color: "#ea580c",
        bgColor: "#fff7ed",
      },
      {
        key: "/duties",
        title: "值日班务",
        desc: "轮值安排与卫生值日管理",
        icon: <CrownOutlined />,
        color: "#db2777",
        bgColor: "#fdf2f8",
      },
    ],
  },
  {
    title: "家校与系统维护",
    items: [
      {
        key: "/comms",
        title: "家校沟通",
        desc: "家长电话簿与沟通记录备忘",
        icon: <MessageOutlined />,
        color: "#0d9488",
        bgColor: "#f0fdfa",
      },
      {
        key: "/vault",
        title: "数据保险箱",
        desc: "本地数据库灾备与一键快照",
        icon: <SafetyOutlined />,
        color: "#16a34a",
        bgColor: "#f0fdf4",
      },
      {
        key: "/sync",
        title: "多端同步",
        desc: "配置云端或局域网协同同步",
        icon: <SyncOutlined />,
        color: "#4338ca",
        bgColor: "#e0e7ff",
      },
      {
        key: "/settings",
        title: "系统设置",
        desc: "教师称呼、学期与作息时间",
        icon: <SettingOutlined />,
        color: "#475569",
        bgColor: "#f1f5f9",
      },
    ],
  },
];

export default function More() {
  const navigate = useNavigate();
  const clearToken = useAuthStore((s) => s.clearToken);
  const 称呼 = useAppStore((s) => s.称呼) || "任课教师";
  const 学期 = useAppStore((s) => s.学期);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleNavigate = (path: string) => {
    triggerHaptic("light");
    navigate(path);
  };

  const handleLogout = () => {
    triggerHaptic("warning");
    clearToken();
    setLogoutModalOpen(false);
  };

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      {/* 顶部教师身份与状态横幅卡片 */}
      <div
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
          borderRadius: 16,
          padding: "20px 18px",
          color: "#fff",
          marginBottom: 16,
          boxShadow: "0 8px 20px -4px rgba(37, 99, 235, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <img
            src="/teacher_avatar.jpg"
            alt="教师头像"
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.3 }}>
              {称呼}
            </div>
            <div style={{ fontSize: 12, opacity: 0.88, marginTop: 2 }}>
              {dayjs().format("YYYY年M月D日 dddd")}
            </div>
          </div>
          <Tag
            color="success"
            style={{
              borderRadius: 12,
              padding: "2px 8px",
              border: "none",
              background: "rgba(255, 255, 255, 0.22)",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            <SafetyCertificateOutlined style={{ marginRight: 4 }} />
            在线工作台
          </Tag>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0, 0, 0, 0.12)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
          }}
        >
          <span style={{ opacity: 0.9 }}>
            当前学期：<strong style={{ fontWeight: 600 }}>{学期 ? `第 ${学期} 学期` : "已配置"}</strong>
          </span>
          <span
            onClick={() => handleNavigate("/settings")}
            style={{
              color: "#bfdbfe",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            调整配置 <RightOutlined style={{ fontSize: 10 }} />
          </span>
        </div>
      </div>

      {/* 分类功能模块磁贴 */}
      {FEATURE_SECTIONS.map((sec) => (
        <div key={sec.title} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#64748b",
              marginBottom: 8,
              paddingLeft: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 3, height: 12, borderRadius: 2, background: "#3b82f6" }} />
            {sec.title}
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            {sec.items.map((it, idx) => (
              <div
                key={it.key}
                onClick={() => handleNavigate(it.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "13px 14px",
                  borderBottom: idx < sec.items.length - 1 ? "1px solid #f1f5f9" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: it.bgColor,
                    color: it.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 19,
                    marginRight: 13,
                    flexShrink: 0,
                  }}
                >
                  {it.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>
                    {it.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.desc}
                  </div>
                </div>
                <RightOutlined style={{ color: "#cbd5e1", fontSize: 13, marginLeft: 8 }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 底部退出登录与系统提示 */}
      <div style={{ marginTop: 24 }}>
        <Button
          danger
          block
          size="large"
          icon={<LogoutOutlined />}
          onClick={() => {
            triggerHaptic("light");
            setLogoutModalOpen(true);
          }}
          style={{
            height: 46,
            borderRadius: 12,
            fontWeight: 500,
            background: "#fff",
            border: "1px solid #fecaca",
          }}
        >
          退出当前账号
        </Button>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#94a3b8" }}>
          教师高效教学与学情工作台 · PWA 离线运行模式已就绪
        </div>
      </div>

      {/* 退出确认弹窗 */}
      <AdaptiveModal
        title="确认退出登录？"
        open={logoutModalOpen}
        onOk={handleLogout}
        onCancel={() => setLogoutModalOpen(false)}
        okText="确认退出"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: "#64748b", margin: "12px 0 6px" }}>
          退出后将清除本地会话缓存，下次使用时需重新输入教师密码。
        </p>
      </AdaptiveModal>
    </div>
  );
}
