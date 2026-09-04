import React from "react";
import Avatar from "boring-avatars";
import type { Row } from "../types";

// 精选适合中小学校园的青春活力柔和色板
const AVATAR_COLORS = [
  "#2563eb", // 活力蓝
  "#10b981", // 薄荷绿
  "#f59e0b", // 暖阳橙
  "#ec4899", // 珊瑚粉
  "#8b5cf6", // 罗兰紫
];

interface StudentAvatarProps {
  student?: Row | null;
  studentId?: string;
  name?: string;
  size?: number;
  variant?: "beam" | "marble" | "pixel" | "sunset" | "bauhaus" | "ring";
  style?: React.CSSProperties;
  className?: string;
}

export default function StudentAvatar({
  student,
  studentId,
  name,
  size = 40,
  variant = "beam",
  style,
  className,
}: StudentAvatarProps) {
  // 种子优先级：业务唯一编号 student_id > 库自增 ID > 姓名 > 传入参数
  const seed =
    student?.student_id ||
    studentId ||
    (student?.id ? `STU${student.id}` : "") ||
    student?.姓名 ||
    name ||
    "student";

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
        border: "1.5px solid #ffffff",
        background: "#f1f5f9",
        ...style,
      }}
    >
      <Avatar
        size={size}
        name={seed}
        variant={variant}
        colors={AVATAR_COLORS}
      />
    </div>
  );
}
