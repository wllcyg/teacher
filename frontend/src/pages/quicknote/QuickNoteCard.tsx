import React, { memo, useState, useEffect } from "react";
import { Tag, Popover, Button } from "antd";
import { Input as MobileInput } from "antd-mobile";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  EditOutlined,
} from "@ant-design/icons";
import type { Row } from "../../types";
import type { ScoreKind } from "./types";

interface QuickNoteCardProps {
  student: Row;
  isLeader: boolean;
  showGroupName?: boolean;
  scoreKind: ScoreKind;
  behaviorStat?: { total: number; count: number };
  academicStat?: Row;
  onTapBehavior: (studentName: string) => void;
  onSetPass: (studentName: string, status: "过关" | "未过") => void;
  onToggleCheck: (studentName: string) => void;
  onEditNote?: (studentName: string, newNote: string) => void;
}

export const QuickNoteCard = memo(function QuickNoteCard({
  student: s,
  isLeader,
  showGroupName = false,
  scoreKind,
  behaviorStat,
  academicStat,
  onTapBehavior,
  onSetPass,
  onToggleCheck,
  onEditNote,
}: QuickNoteCardProps) {
  const studentName = s.name || s.姓名;
  const groupName = s.group_name || s.小组;
  const academicScore = academicStat?.score || academicStat?.结果;
  const academicNotes = academicStat?.notes || academicStat?.备注;

  const isPassed = academicScore === "过关";
  const isFailed = academicScore === "未过";
  const isChecked = academicScore === "√";

  // 单独修改备注 Popover 状态
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [noteText, setNoteText] = useState(academicNotes || "");

  useEffect(() => {
    setNoteText(academicNotes || "");
  }, [academicNotes]);

  const handleSaveNote = () => {
    onEditNote?.(studentName, noteText);
    setPopoverOpen(false);
  };

  const roleBadge = isLeader ? (
    <Tag
      color="gold"
      style={{
        margin: 0,
        fontSize: 10,
        padding: "0 4px",
        lineHeight: "16px",
        fontWeight: 700,
        borderRadius: 4,
        border: "none",
      }}
    >
      👑 组长
    </Tag>
  ) : (
    <Tag
      style={{
        margin: 0,
        fontSize: 10,
        padding: "0 4px",
        lineHeight: "16px",
        color: "#64748b",
        background: "#f1f5f9",
        borderRadius: 4,
        border: "none",
      }}
    >
      组员
    </Tag>
  );

  // 1. 表现加减分模式
  if (scoreKind === "加减分") {
    const hasScore = behaviorStat && behaviorStat.total !== 0;
    return (
      <button
        type="button"
        className="fast-tap-card"
        onClick={() => onTapBehavior(studentName)}
        style={{
          position: "relative",
          minHeight: 56,
          padding: "8px 8px",
          borderRadius: 10,
          border: hasScore
            ? "1.5px solid #1677ff"
            : isLeader
            ? "1.5px solid #facc15"
            : "1px solid #e2e8f0",
          background: hasScore ? "#f0f7ff" : isLeader ? "#fffdf5" : "#ffffff",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          userSelect: "none",
          transition: "all 0.1s ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
            {studentName}
          </span>
          {roleBadge}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 4,
          }}
        >
          {showGroupName && groupName ? (
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{groupName}</span>
          ) : (
            <span />
          )}
          {hasScore && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: behaviorStat.total > 0 ? "#1677ff" : "#cf1322",
                background: behaviorStat.total > 0 ? "#e6f4ff" : "#fff1f0",
                borderRadius: 10,
                padding: "0 5px",
                lineHeight: "16px",
              }}
            >
              {behaviorStat.total > 0 ? `+${behaviorStat.total}` : behaviorStat.total}
            </span>
          )}
        </div>
      </button>
    );
  }

  // 2. 过关类模式
  if (scoreKind === "过关") {
    const editPopoverContent = (
      <div style={{ padding: 4, width: 190 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#1e293b" }}>
          修改 {studentName} 的过关内容
        </div>
        <div
          style={{
            background: "#f1f5f9",
            borderRadius: 8,
            padding: "3px 8px",
            marginBottom: 8,
            border: "1px solid #e2e8f0",
          }}
        >
          <MobileInput
            value={noteText}
            onChange={setNoteText}
            placeholder="如: 只背了前2段"
            clearable
            style={{ "--font-size": "13px" }}
            onEnterPress={handleSaveNote}
          />
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 4 }}>
          <Button size="small" onClick={() => setPopoverOpen(false)}>
            取消
          </Button>
          <Button size="small" type="primary" onClick={handleSaveNote}>
            保存
          </Button>
        </div>
      </div>
    );

    return (
      <div
        className="fast-tap-card"
        style={{
          padding: "8px 8px",
          borderRadius: 10,
          border: isPassed
            ? "1.5px solid #52c41a"
            : isFailed
            ? "1.5px solid #fa8c16"
            : isLeader
            ? "1.5px solid #facc15"
            : "1px solid #e2e8f0",
          background: isPassed
            ? "#f6ffed"
            : isFailed
            ? "#fffbe6"
            : isLeader
            ? "#fffdf5"
            : "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span>{studentName}</span>
            {isPassed && <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 13 }} />}
            {isFailed && <CloseCircleOutlined style={{ color: "#fa8c16", fontSize: 13 }} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {showGroupName && groupName && (
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{groupName}</span>
            )}
            {roleBadge}
          </div>
        </div>

        {/* 过关内容微标 / 单人备注 */}
        {academicNotes ? (
          <Popover
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            trigger="click"
            content={editPopoverContent}
            placement="bottom"
          >
            <div
              style={{
                fontSize: 11,
                color: isPassed ? "#15803d" : "#c2410c",
                background: isPassed ? "#dcfce7" : "#ffedd5",
                borderRadius: 4,
                padding: "2px 6px",
                lineHeight: "15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              title="点击修改此学生具体过关内容"
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📝 {academicNotes}
              </span>
              <EditOutlined style={{ fontSize: 9, opacity: 0.7, marginLeft: 3 }} />
            </div>
          </Popover>
        ) : isPassed ? (
          <Popover
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            trigger="click"
            content={editPopoverContent}
            placement="bottom"
          >
            <div
              style={{
                fontSize: 10,
                color: "#94a3b8",
                cursor: "pointer",
                textAlign: "center",
                padding: "1px 0",
              }}
              title="点击为此学生单独备注过关内容"
            >
              + 备注内容
            </div>
          </Popover>
        ) : null}

        {/* 子按键：过关 / 未过 */}
        <div style={{ display: "flex", gap: 5, width: "100%" }}>
          <button
            type="button"
            onClick={() => onSetPass(studentName, "过关")}
            style={{
              flex: 1,
              padding: "3px 0",
              fontSize: 12,
              borderRadius: 4,
              border: isPassed ? "1px solid #52c41a" : "1px solid #d9d9d9",
              background: isPassed ? "#52c41a" : "#fff",
              color: isPassed ? "#fff" : "#52c41a",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.1s ease",
            }}
          >
            过关
          </button>
          <button
            type="button"
            onClick={() => onSetPass(studentName, "未过")}
            style={{
              flex: 1,
              padding: "3px 0",
              fontSize: 12,
              borderRadius: 4,
              border: isFailed ? "1px solid #fa8c16" : "1px solid #d9d9d9",
              background: isFailed ? "#fa8c16" : "#fff",
              color: isFailed ? "#fff" : "#fa8c16",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.1s ease",
            }}
          >
            未过
          </button>
        </div>
      </div>
    );
  }

  // 3. 打钩类模式（以及等第等默认回退）
  return (
    <button
      type="button"
      className="fast-tap-card"
      onClick={() => onToggleCheck(studentName)}
      style={{
        minHeight: 52,
        padding: "8px 8px",
        borderRadius: 10,
        border: isChecked
          ? "1.5px solid #52c41a"
          : isLeader
          ? "1.5px solid #facc15"
          : "1px solid #e2e8f0",
        background: isChecked
          ? "#f6ffed"
          : isLeader
          ? "#fffdf5"
          : "#ffffff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none",
        transition: "all 0.1s ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
          {studentName}
        </span>
        {isChecked && (
          <CheckOutlined style={{ color: "#52c41a", fontSize: 13, fontWeight: 700 }} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {showGroupName && groupName && (
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{groupName}</span>
        )}
        {roleBadge}
      </div>
    </button>
  );
});
