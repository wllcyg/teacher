import React from "react";
import { Segmented, Tag, Button } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import type { Row } from "../../types";
import type { ScoreKind, StudentGroup, ViewMode } from "./types";
import { QuickNoteCard } from "./QuickNoteCard";

interface QuickNoteStudentGridProps {
  currentClass: string;
  currentItem?: Row;
  recordDate: Dayjs;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  studentGroups: StudentGroup[];
  roster: Row[];
  scoreKind: ScoreKind;
  studentBehaviorMap: Map<string, { total: number; count: number }>;
  studentAcademicMap: Map<string, Row>;
  onTapBehavior: (studentName: string) => void;
  onSetPass: (studentName: string, status: "过关" | "未过") => void;
  onToggleCheck: (studentName: string) => void;
  onPassGroup: (groupStudents: Row[], groupName: string) => void;
  onResetGroup: (groupStudents: Row[], groupName: string) => void;
  onEditNote?: (studentName: string, newNote: string) => void;
  gridColumns: number;
}

export const QuickNoteStudentGrid: React.FC<QuickNoteStudentGridProps> = ({
  currentClass,
  currentItem,
  recordDate,
  viewMode,
  onChangeViewMode,
  studentGroups,
  roster,
  scoreKind,
  studentBehaviorMap,
  studentAcademicMap,
  onTapBehavior,
  onSetPass,
  onToggleCheck,
  onPassGroup,
  onResetGroup,
  onEditNote,
  gridColumns,
}) => {
  return (
    <div>
      {/* 标题横条 */}
      <div
        style={{
          background: "#1e293b",
          color: "#fff",
          borderRadius: "8px 8px 0 0",
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>
            {currentClass} | {currentItem?.项目名}
          </span>
          <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>
            （共 {studentGroups.length} 组 / {roster.length} 人）
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* 视图切换：按组展示 vs 平铺展示 */}
          <Segmented
            size="small"
            value={viewMode}
            onChange={(val) => onChangeViewMode(val as ViewMode)}
            options={[
              { label: "按组展示", value: "group", icon: <TeamOutlined /> },
              { label: "平铺展示", value: "flat" },
            ]}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
          />
          <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>
            {recordDate.format("MM/DD")}
          </span>
        </div>
      </div>

      {/* 下方：学生卡片呈现（按组展示 / 平铺展示） */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          padding: 12,
        }}
      >
        {viewMode === "group" ? (
          // 模式 A：按组展示（默认）
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {studentGroups.map((group) => {
              const leader =
                group.students.find((s) => (s.标签 || "").includes("组长")) ||
                group.students[0];
              const passCount = group.students.filter(
                (s) => studentAcademicMap.get(s.姓名)?.结果 === "过关"
              ).length;
              const isAllPassed =
                group.students.length > 0 && passCount === group.students.length;

              return (
                <div
                  key={group.groupName}
                  style={{
                    background: "#f8fafc",
                    border: isAllPassed ? "1px solid #b7eb8f" : "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "10px 12px 12px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* 小组标题栏 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      paddingBottom: 6,
                      borderBottom: "1px dashed #cbd5e1",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                        👥 {group.groupName}
                      </span>
                      {leader && (
                        <Tag color="gold" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                          组长：{leader.姓名}
                        </Tag>
                      )}
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        共 {group.students.length} 人
                      </span>
                      {scoreKind === "过关" && (
                        <Tag
                          color={
                            isAllPassed ? "success" : passCount > 0 ? "processing" : "default"
                          }
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {passCount}/{group.students.length} 已过关
                        </Tag>
                      )}
                    </div>

                    {scoreKind === "过关" && (
                      <Button
                        size="small"
                        type={isAllPassed ? "default" : "primary"}
                        ghost={!isAllPassed}
                        style={{ fontSize: 12, height: 24, padding: "0 8px" }}
                        onClick={() => {
                          if (isAllPassed) {
                            onResetGroup(group.students, group.groupName);
                          } else {
                            onPassGroup(group.students, group.groupName);
                          }
                        }}
                      >
                        {isAllPassed ? "重新全过" : "本组全过"}
                      </Button>
                    )}
                  </div>

                  {/* 小组成员卡片网格 */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {group.students.map((s, idx) => {
                      const isLeader =
                        (s.标签 || "").includes("组长") || idx === 0;
                      return (
                        <QuickNoteCard
                          key={s.学号 || s.姓名}
                          student={s}
                          isLeader={isLeader}
                          showGroupName={false}
                          scoreKind={scoreKind}
                          behaviorStat={studentBehaviorMap.get(s.姓名)}
                          academicStat={studentAcademicMap.get(s.姓名)}
                          onTapBehavior={onTapBehavior}
                          onSetPass={onSetPass}
                          onToggleCheck={onToggleCheck}
                          onEditNote={onEditNote}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // 模式 B：全部平铺展示
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: 10,
            }}
          >
            {roster.map((s) => {
              const isLeader = (s.标签 || "").includes("组长");
              return (
                <QuickNoteCard
                  key={s.学号 || s.姓名}
                  student={s}
                  isLeader={isLeader}
                  showGroupName={true}
                  scoreKind={scoreKind}
                  behaviorStat={studentBehaviorMap.get(s.姓名)}
                  academicStat={studentAcademicMap.get(s.姓名)}
                  onTapBehavior={onTapBehavior}
                  onSetPass={onSetPass}
                  onToggleCheck={onToggleCheck}
                  onEditNote={onEditNote}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
