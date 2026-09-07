import React, { useState, useEffect } from "react";
import {
  Checkbox,
  Tag,
  Select,
  DatePicker,
  Button,
  Popconfirm,
  Empty,
  message,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import type { Row } from "../../types";
import { AdaptiveModal } from "../../components/AdaptiveModal";

interface QuickNoteRecordsModalProps {
  open: boolean;
  onClose: () => void;
  currentClass: string;
  currentItem?: Row;
  recordDate: Dayjs;
  currentRecords: Row[];
  isBehavior: boolean;
  classes: string[];
  candidateItems: Row[];
  onBatchUpdateClass: (ids: number[], newClass: string) => Promise<void>;
  onBatchUpdateDate: (ids: number[], newDate: Dayjs) => Promise<void>;
  onBatchUpdateItem: (ids: number[], newItem: string) => Promise<void>;
  onBatchDelete: (ids: number[]) => Promise<void>;
}

export const QuickNoteRecordsModal: React.FC<QuickNoteRecordsModalProps> = ({
  open,
  onClose,
  currentClass,
  currentItem,
  recordDate,
  currentRecords,
  isBehavior,
  classes,
  candidateItems,
  onBatchUpdateClass,
  onBatchUpdateDate,
  onBatchUpdateItem,
  onBatchDelete,
}) => {
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [targetClass, setTargetClass] = useState<string>(currentClass);
  const [targetDate, setTargetDate] = useState<Dayjs>(recordDate);
  const [targetItem, setTargetItem] = useState<string>(currentItem?.项目名 ?? "");

  useEffect(() => {
    if (open) {
      setTargetClass(currentClass);
      setTargetDate(recordDate);
      setTargetItem(currentItem?.项目名 ?? "");
      setSelectedRecordIds([]);
    }
  }, [open, currentClass, recordDate, currentItem]);

  const handleBatchUpdateClass = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要修改的记录！");
      return;
    }
    if (!targetClass) {
      message.warning("请选择目标班级！");
      return;
    }
    await onBatchUpdateClass(selectedRecordIds, targetClass);
    setSelectedRecordIds([]);
  };

  const handleBatchUpdateDate = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要修改的记录！");
      return;
    }
    await onBatchUpdateDate(selectedRecordIds, targetDate);
    setSelectedRecordIds([]);
  };

  const handleBatchUpdateItem = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要修改的记录！");
      return;
    }
    if (!targetItem) {
      message.warning("请选择目标项目！");
      return;
    }
    await onBatchUpdateItem(selectedRecordIds, targetItem);
    setSelectedRecordIds([]);
  };

  const handleBatchDelete = async () => {
    if (selectedRecordIds.length === 0) {
      message.warning("请先勾选需要删除的记录！");
      return;
    }
    await onBatchDelete(selectedRecordIds);
    setSelectedRecordIds([]);
  };

  return (
    <AdaptiveModal
      title={`本轮记录明细（${currentClass} · ${currentItem?.项目名} · ${recordDate.format("MM/DD")}）`}
      open={open}
      onCancel={onClose}
      width={680}
      drawerHeight="85vh"
      footer={null}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 记录列表 */}
        <div
          style={{
            maxHeight: 320,
            overflowY: "auto",
            border: "1px solid #f1f5f9",
            borderRadius: 8,
            padding: 8,
          }}
        >
          {currentRecords.length === 0 ? (
            <Empty description="本轮还没有任何记录" style={{ padding: "20px 0" }} />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  borderBottom: "1px solid #f1f5f9",
                  marginBottom: 6,
                }}
              >
                <Checkbox
                  checked={
                    selectedRecordIds.length === currentRecords.length &&
                    currentRecords.length > 0
                  }
                  indeterminate={
                    selectedRecordIds.length > 0 &&
                    selectedRecordIds.length < currentRecords.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRecordIds(currentRecords.map((r) => r.id));
                    } else {
                      setSelectedRecordIds([]);
                    }
                  }}
                >
                  全选（已选 {selectedRecordIds.length} / {currentRecords.length}）
                </Checkbox>
              </div>

              {currentRecords.map((r) => {
                const isChecked = selectedRecordIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 8px",
                      borderBottom: "1px solid #f8fafc",
                      fontSize: 13,
                    }}
                  >
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecordIds((prev) => [...prev, r.id]);
                        } else {
                          setSelectedRecordIds((prev) => prev.filter((id) => id !== r.id));
                        }
                      }}
                    />
                    <span style={{ color: "#94a3b8" }}>{r.日期}</span>
                    <Tag>{r.班级}</Tag>
                    <strong style={{ color: "#0f172a" }}>{r.学生}</strong>
                    <span style={{ color: "#64748b" }}>· {r.项目}:</span>
                    <strong
                      style={{
                        color:
                          isBehavior && parseFloat(r.分值) > 0
                            ? "#1677ff"
                            : isBehavior
                            ? "#cf1322"
                            : r.结果 === "过关"
                            ? "#52c41a"
                            : "#fa8c16",
                      }}
                    >
                      {isBehavior ? r.分值 : r.结果}
                    </strong>
                    {r.备注 && (
                      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 400, marginLeft: 4 }}>
                        （{r.备注}）
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* 底部整批纠错控制条 */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
            整批纠错工具（针对勾选的 {selectedRecordIds.length} 条记录）
          </div>

          {/* 1. 整批改班级 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, minWidth: 70, color: "#64748b" }}>改到班级:</span>
            <Select
              size="small"
              value={targetClass}
              onChange={setTargetClass}
              style={{ width: 130 }}
              options={classes.map((c) => ({ value: c, label: c }))}
            />
            <Button size="small" onClick={handleBatchUpdateClass}>
              改班级
            </Button>
          </div>

          {/* 2. 整批改日期 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, minWidth: 70, color: "#64748b" }}>改日期:</span>
            <DatePicker
              size="small"
              value={targetDate}
              onChange={(d) => d && setTargetDate(d)}
              format="YYYY/MM/DD"
              allowClear={false}
              style={{ width: 130 }}
            />
            <Button size="small" onClick={handleBatchUpdateDate}>
              改日期
            </Button>
          </div>

          {/* 3. 整批改项目 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, minWidth: 70, color: "#64748b" }}>改项目:</span>
            <Select
              size="small"
              value={targetItem}
              onChange={setTargetItem}
              style={{ width: 160 }}
              options={candidateItems.map((it) => ({
                value: it.项目名,
                label: it.项目名,
              }))}
            />
            <Button size="small" onClick={handleBatchUpdateItem}>
              改项目
            </Button>
          </div>

          {/* 4. 整批删除 */}
          <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 8 }}>
            <Popconfirm
              title={`确定删除选中的 ${selectedRecordIds.length} 条记录吗？`}
              onConfirm={handleBatchDelete}
              okText="确定删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={selectedRecordIds.length === 0}
              >
                整批删除勾选的
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </AdaptiveModal>
  );
};
