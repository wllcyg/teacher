import type { ReactNode } from "react";
import {
  HomeOutlined,
  EditOutlined,
  TeamOutlined,
  ReadOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CalendarOutlined,
  BookOutlined,
  AppstoreOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  MessageOutlined,
  SafetyOutlined,
  SyncOutlined,
  SettingOutlined,
} from "@ant-design/icons";

export interface NavItem {
  key: string; // 路由路径
  label: string;
  icon: ReactNode;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "主工作台",
    items: [
      { key: "/today", label: "今天", icon: <HomeOutlined /> },
      { key: "/quicknote", label: "快记", icon: <EditOutlined /> },
    ],
  },
  {
    title: "学生与成绩",
    items: [
      { key: "/roster", label: "名册", icon: <TeamOutlined /> },
      { key: "/scores", label: "成绩", icon: <ReadOutlined /> },
      { key: "/summary", label: "汇总", icon: <BarChartOutlined /> },
      { key: "/report", label: "报表", icon: <FileTextOutlined /> },
    ],
  },
  {
    title: "日常管理",
    items: [
      { key: "/schedule", label: "课表", icon: <CalendarOutlined /> },
      { key: "/lesson-logs", label: "课堂笔记", icon: <BookOutlined /> },
      { key: "/seating", label: "座位", icon: <AppstoreOutlined /> },
      { key: "/todos", label: "待办", icon: <CheckSquareOutlined /> },
      { key: "/attendance", label: "考勤", icon: <ClockCircleOutlined /> },
      { key: "/duties", label: "班务", icon: <CrownOutlined /> },
    ],
  },
  {
    title: "家校",
    items: [{ key: "/comms", label: "沟通", icon: <MessageOutlined /> }],
  },
  {
    title: "系统",
    items: [
      { key: "/vault", label: "数据保险箱", icon: <SafetyOutlined /> },
      { key: "/sync", label: "同步", icon: <SyncOutlined /> },
      { key: "/settings", label: "设置", icon: <SettingOutlined /> },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
