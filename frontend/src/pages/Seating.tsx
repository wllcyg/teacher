import { useMemo, useState } from "react";
import { Card, Select, Button, Space, message, Tag } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRow, listTable, updateRow } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";

export default function Seating() {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: students } = useQuery({ queryKey: ["students"], queryFn: () => listTable("students") });
  const { data: duties } = useQuery({ queryKey: ["duties"], queryFn: () => listTable("duties") });

  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  // 座位配置行：岗位="6x8"，时间=班级；其余 类型=座位 是具体座位
  const seatRows = useMemo(() => (duties ?? []).filter((d) => d.类型 === "座位"), [duties]);
  const config = seatRows.find((d) => d.学生 === "（系统）座位配置" && d.时间 === 班级);

  const { rows, cols } = useMemo(() => {
    if (!config) return { rows: 0, cols: 0 };
    const m = config.岗位.match(/^(\d+)x(\d+)$/);
    return m ? { rows: parseInt(m[1], 10), cols: parseInt(m[2], 10) } : { rows: 0, cols: 0 };
  }, [config]);

  // 座位位置 -> 学生
  const seatMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const d of seatRows) {
      const mm = d.岗位.match(/^(\d+)排(\d+)列$/);
      if (mm) m.set(`${mm[1]}-${mm[2]}`, d);
    }
    return m;
  }, [seatRows]);

  const assign = useMutation({
    mutationFn: async ({ r, c }: { r: number; c: number }) => {
      const key = `${r}-${c}`;
      const pos = `${r}排${c}列`;
      const exist = seatMap.get(key);
      if (selected) {
        if (exist) return updateRow("duties", exist.id, { ...exist, 学生: selected });
        return createRow("duties", { 岗位: pos, 学生: selected, 类型: "座位", 时间: "", 备注: "" });
      } else {
        if (exist) return updateRow("duties", exist.id, { ...exist, 学生: "" });
        return null;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duties"] }),
  });

  if (!config) {
    return (
      <div className="page">
        <h2 className="page-title">座位</h2>
        <Card>当前班「{班级}」还没有座位配置。可在「班务」页添加一行类型为「座位」、岗位为「行x列」（如 6x8）的配置。</Card>
      </div>
    );
  }

  const unassigned = roster.filter((s) => !Array.from(seatMap.values()).some((d) => d.学生 === s.姓名));

  return (
    <div className="page">
      <h2 className="page-title">座位表</h2>
      <div className="page-sub">{班级} · {rows} 排 × {cols} 列</div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          showSearch
          placeholder="选择学生，再点座位"
          style={{ width: 220 }}
          value={selected || undefined}
          onChange={(v) => setSelected(v ?? "")}
          options={roster.map((s) => ({ value: s.姓名, label: s.姓名 }))}
          filterOption={(input, o) => (o?.label ?? "").includes(input)}
        />
        <Button onClick={() => setSelected("")}>取消选择</Button>
      </Space>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-block" }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {Array.from({ length: cols }).map((_, c) => {
                const key = `${r + 1}-${c + 1}`;
                const d = seatMap.get(key);
                const name = d?.学生 || "";
                return (
                  <div
                    key={c}
                    onClick={() => assign.mutate({ r: r + 1, c: c + 1 })}
                    style={{
                      width: 72,
                      height: 56,
                      border: "1px solid #d9d9d9",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      background: name ? "#e6f4ff" : "#fff",
                      fontSize: 13,
                    }}
                  >
                    {name || `${r + 1}-${c + 1}`}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, color: "#666" }}>未安排座位：</div>
          <Space wrap>
            {unassigned.map((s) => (
              <Tag key={s.姓名} onClick={() => setSelected(s.姓名)} style={{ cursor: "pointer" }}>
                {s.姓名}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
}
