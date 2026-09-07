import React, { useState } from "react";
import {
  Card,
  Button,
  DatePicker,
  Segmented,
  Space,
  Popconfirm,
} from "antd";
import {
  Input as MobileInput,
  DatePicker as MobileDatePicker,
} from "antd-mobile";
import {
  PlusOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  EditOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import type { Row } from "../../types";
import type { ScoreKind } from "./types";
import { useIsMobileOrTablet } from "../../hooks";

interface QuickNoteControlPanelProps {
  classes: string[];
  currentClass: string;
  onChangeClass: (val: string) => void;
  academicItems: Row[];
  behaviorItems: Row[];
  currentItem?: Row;
  onSelectItemName: (name: string) => void;
  onOpenNewItem: (type: "学业" | "表现") => void;
  recordDate: Dayjs;
  onChangeDate: (d: Dayjs) => void;
  scoreKind: ScoreKind;
  passContent: string;
  onChangePassContent: (content: string) => void;
  activeDelta: number;
  onChangeDelta: (delta: number) => void;
  onAllPass: () => void;
  onAllCheck: () => void;
  recordedCount: number;
  rosterLength: number;
  onOpenRename: () => void;
  onDeleteItem: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onOpenRecordsModal: () => void;
}

const PRESET_PASS_TAGS = ["全篇", "第1段", "第2段", "生字词", "默写", "错题重做"];

export const QuickNoteControlPanel: React.FC<QuickNoteControlPanelProps> = ({
  classes,
  currentClass,
  onChangeClass,
  academicItems,
  behaviorItems,
  currentItem,
  onSelectItemName,
  onOpenNewItem,
  recordDate,
  onChangeDate,
  scoreKind,
  passContent,
  onChangePassContent,
  activeDelta,
  onChangeDelta,
  onAllPass,
  onAllCheck,
  recordedCount,
  rosterLength,
  onOpenRename,
  onDeleteItem,
  onUndo,
  canUndo,
  onOpenRecordsModal,
}) => {
  const isMobile = useIsMobileOrTablet();
  const [mobileDatePickerOpen, setMobileDatePickerOpen] = useState(false);

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
      bodyStyle={{ padding: isMobile ? "10px 12px" : "12px 16px" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 行 1：班级切换 */}
        {classes.length > 0 && (
          <div style={{ overflowX: "auto", paddingBottom: 2 }}>
            <Segmented
              options={classes}
              value={currentClass}
              onChange={(val) => onChangeClass(val as string)}
              size={isMobile ? "small" : "middle"}
              block={isMobile}
            />
          </div>
        )}

        {/* 行 2：学业轨项目 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 2,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, flexShrink: 0 }}>
            学业
          </span>
          {academicItems.map((it) => {
            const isSelected = it.项目名 === currentItem?.项目名;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelectItemName(it.项目名)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 16,
                  fontSize: 12,
                  border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                  background: isSelected ? "#1677ff" : "#fff",
                  color: isSelected ? "#fff" : "#334155",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 2px 4px rgba(22,119,255,0.2)" : "none",
                }}
              >
                {it.项目名}
              </button>
            );
          })}
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => onOpenNewItem("学业")}
            style={{ borderRadius: 16, fontSize: 12, flexShrink: 0, height: 26 }}
          >
            新项目
          </Button>
        </div>

        {/* 行 3：表现轨项目 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 2,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, flexShrink: 0 }}>
            表现
          </span>
          {behaviorItems.map((it) => {
            const isSelected = it.项目名 === currentItem?.项目名;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onSelectItemName(it.项目名)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 16,
                  fontSize: 12,
                  border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                  background: isSelected ? "#1677ff" : "#fff",
                  color: isSelected ? "#fff" : "#334155",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 2px 4px rgba(22,119,255,0.2)" : "none",
                }}
              >
                {it.项目名}
              </button>
            );
          })}
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => onOpenNewItem("表现")}
            style={{ borderRadius: 16, fontSize: 12, flexShrink: 0, height: 26 }}
          >
            新项目
          </Button>
        </div>

        {/* 行 4：日期与模式参数 */}
        <div
          style={{
            borderTop: "1px dashed #f1f5f9",
            paddingTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* 过关模式：移动端专属输入框 + 日期胶囊 */}
          {scoreKind === "过关" && (
            <>
              {/* 日期 + 移动端专属输入框 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                {/* 移动端/桌面端日期胶囊 */}
                {isMobile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMobileDatePickerOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 18,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                        flexShrink: 0,
                        height: 32,
                      }}
                    >
                      <CalendarOutlined style={{ color: "#1677ff" }} />
                      <span>{recordDate.format("MM/DD")}</span>
                    </button>
                    <MobileDatePicker
                      visible={mobileDatePickerOpen}
                      onClose={() => setMobileDatePickerOpen(false)}
                      defaultValue={recordDate.toDate()}
                      onConfirm={(val) => {
                        onChangeDate(dayjs(val));
                      }}
                    />
                  </>
                ) : (
                  <DatePicker
                    value={recordDate}
                    onChange={(d) => d && onChangeDate(d)}
                    format="YYYY/MM/DD"
                    allowClear={false}
                    size="small"
                    style={{ width: 110, height: 32, borderRadius: 16 }}
                  />
                )}

                {/* 移动端专属输入框容器（原生质感胶囊卡片） */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "#f1f5f9",
                    borderRadius: 18,
                    padding: "4px 10px",
                    flex: 1,
                    minWidth: 130,
                    height: 32,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <EditOutlined style={{ color: "#94a3b8", fontSize: 13, marginRight: 6, flexShrink: 0 }} />
                  <MobileInput
                    value={passContent}
                    onChange={onChangePassContent}
                    placeholder="过关内容（如：第1段）"
                    clearable
                    style={{
                      "--font-size": "13px",
                      "--placeholder-color": "#94a3b8",
                      "--color": "#0f172a",
                      width: "100%",
                    }}
                  />
                </div>
              </div>

              {/* 快捷预设短语标签栏 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  overflowX: "auto",
                  padding: "1px 0",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>快捷:</span>
                {PRESET_PASS_TAGS.map((tag) => {
                  const isSelected = passContent === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onChangePassContent(isSelected ? "" : tag)}
                      style={{
                        padding: "3px 9px",
                        borderRadius: 12,
                        fontSize: 11,
                        border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                        background: isSelected ? "#e6f4ff" : "#ffffff",
                        color: isSelected ? "#0958d9" : "#475569",
                        fontWeight: isSelected ? 600 : 400,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* 操作栏：全班都完成 + 进度徽标 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 2,
                }}
              >
                <Button
                  type="primary"
                  size="small"
                  onClick={onAllPass}
                  style={{
                    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    borderColor: "#16a34a",
                    borderRadius: 16,
                    fontWeight: 600,
                    fontSize: 12,
                    height: 28,
                    padding: "0 14px",
                    boxShadow: "0 1px 3px rgba(22, 163, 74, 0.2)",
                  }}
                >
                  全班都完成
                </Button>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  本轮已记{" "}
                  <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>
                    {recordedCount}
                  </span>{" "}
                  / {rosterLength} 人
                </div>
              </div>
            </>
          )}

          {/* 加减分模式 */}
          {scoreKind === "加减分" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isMobile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMobileDatePickerOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 16,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <CalendarOutlined style={{ color: "#1677ff" }} />
                      <span>{recordDate.format("MM/DD")}</span>
                    </button>
                    <MobileDatePicker
                      visible={mobileDatePickerOpen}
                      onClose={() => setMobileDatePickerOpen(false)}
                      defaultValue={recordDate.toDate()}
                      onConfirm={(val) => onChangeDate(dayjs(val))}
                    />
                  </>
                ) : (
                  <DatePicker
                    value={recordDate}
                    onChange={(d) => d && onChangeDate(d)}
                    format="YYYY/MM/DD"
                    allowClear={false}
                    size="small"
                    style={{ width: 110, borderRadius: 16 }}
                  />
                )}
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>分值:</span>
                {[1, 2, -1, -2].map((v) => {
                  const isSelected = activeDelta === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onChangeDelta(v)}
                      style={{
                        width: 34,
                        height: 26,
                        borderRadius: 6,
                        border: isSelected ? "1px solid #1677ff" : "1px solid #e2e8f0",
                        background: isSelected ? "#e6f4ff" : "#fff",
                        color: isSelected ? "#0958d9" : "#475569",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {v > 0 ? `+${v}` : v}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: "#64748b" }}>
                本轮已记 <span style={{ color: "#1677ff", fontWeight: 700 }}>{recordedCount}</span> / {rosterLength} 人
              </div>
            </div>
          )}

          {/* 打钩模式 */}
          {scoreKind === "打钩" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isMobile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMobileDatePickerOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 16,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <CalendarOutlined style={{ color: "#1677ff" }} />
                      <span>{recordDate.format("MM/DD")}</span>
                    </button>
                    <MobileDatePicker
                      visible={mobileDatePickerOpen}
                      onClose={() => setMobileDatePickerOpen(false)}
                      defaultValue={recordDate.toDate()}
                      onConfirm={(val) => onChangeDate(dayjs(val))}
                    />
                  </>
                ) : (
                  <DatePicker
                    value={recordDate}
                    onChange={(d) => d && onChangeDate(d)}
                    format="YYYY/MM/DD"
                    allowClear={false}
                    size="small"
                    style={{ width: 110, borderRadius: 16 }}
                  />
                )}
                <Button
                  type="primary"
                  size="small"
                  onClick={onAllCheck}
                  style={{ borderRadius: 14, fontSize: 12 }}
                >
                  全班都打钩
                </Button>
              </div>

              <div style={{ fontSize: 12, color: "#64748b" }}>
                本轮已记 <span style={{ color: "#1677ff", fontWeight: 700 }}>{recordedCount}</span> / {rosterLength} 人
              </div>
            </div>
          )}
        </div>

        {/* 行 5：轻量底栏工具（当前项目操作与撤销） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 6,
            fontSize: 12,
            color: "#64748b",
            borderTop: "1px dashed #f1f5f9",
            paddingTop: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 12 }}>
              {currentItem?.项目名}
            </span>
            {currentItem && (
              <Space size={6}>
                <a onClick={onOpenRename} style={{ fontSize: 12 }}>
                  改名
                </a>
                <Popconfirm
                  title={`确定删除项目「${currentItem.项目名}」吗？`}
                  description="不会删除已有的历史记录"
                  onConfirm={onDeleteItem}
                  okText="确定"
                  cancelText="取消"
                >
                  <a style={{ fontSize: 12, color: "#cf1322" }}>删除</a>
                </Popconfirm>
              </Space>
            )}
          </div>

          <Space size={6}>
            <Button
              size="small"
              icon={<UndoOutlined />}
              onClick={onUndo}
              disabled={!canUndo}
              style={{ borderRadius: 14, fontSize: 12, height: 26, padding: "0 8px" }}
            >
              撤销上一笔
            </Button>
            <Button
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={onOpenRecordsModal}
              style={{ borderRadius: 14, fontSize: 12, height: 26, padding: "0 8px" }}
            >
              本轮记录
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
};
