import { useMemo, useState } from "react";
import { Table, Select, InputNumber, Space, message, Tag, Card, Statistic } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRow, listTable, updateRow } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";

export default function Scores() {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const [项目, set项目] = useState<string>("");

  const { data: students } = useQuery({ queryKey: ["students"], queryFn: () => listTable("students") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => listTable("items") });
  const { data: records } = useQuery({
    queryKey: ["academic", 班级, 项目],
    queryFn: () => listTable("academic", { 班级, 项目 }),
    enabled: !!班级 && !!项目,
  });

  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);
  const scoreItems = useMemo(
    () => (items ?? []).filter((it) => it.计分制.includes("分数")),
    [items]
  );
  const currentItem = items?.find((it) => it.项目名 === 项目);

  // 该项目所有日期（升序）
  const dates = useMemo(() => {
    const set = new Set<string>();
    (records ?? []).forEach((r) => r.日期 && set.add(r.日期));
    return Array.from(set).sort();
  }, [records]);

  const full = useMemo(() => {
    const raw = currentItem?.满分 ?? "100";
    const n = parseFloat(raw);
    return isFinite(n) && n > 0 ? n : 100;
  }, [currentItem]);
  const passLine = Math.round(full * 0.6 * 10) / 10;

  const upsert = useMutation({
    mutationFn: async ({ 学生, 日期, val }: { 学生: string; 日期: string; val: string }) => {
      const exist = (records ?? []).find((r) => r.学生 === 学生 && r.日期 === 日期 && r.项目 === 项目);
      const base = { 日期, 班级, 学生, 项目, 结果: val, 状态: "完成", 备注: "" };
      if (exist) return updateRow("academic", exist.id, { ...exist, 结果: val });
      return createRow("academic", base);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic"] }),
  });

  function cell(学生: string, 日期: string): string | undefined {
    const r = (records ?? []).find((x) => x.学生 === 学生 && x.日期 === 日期);
    return r?.结果;
  }

  const latestScores = useMemo(() => {
    const map = new Map<string, { 日期: string; 分: number }>();
    (records ?? []).forEach((r) => {
      const n = parseFloat(r.结果);
      if (!isFinite(n)) return;
      const cur = map.get(r.学生);
      if (!cur || (r.日期 ?? "") >= cur.日期) {
        map.set(r.学生, { 日期: r.日期 ?? "", 分: n });
      }
    });
    return new Map(Array.from(map.entries()).map(([k, v]) => [k, v.分]));
  }, [records]);

  if (scoreItems.length === 0) {
    return (
      <div className="page">
        <h2 className="page-title">成绩</h2>
        <Card>还没有「分数」类项目，请先在「项目」里添加（计分制选「分数」）。</Card>
      </div>
    );
  }

  const dataColumns = [
    {
      title: "学生",
      dataIndex: "姓名",
      fixed: "left" as const,
      width: 110,
    },
    ...dates.map((d) => ({
      title: d,
      dataIndex: d,
      width: 90,
      render: (_: any, row: Row) => {
        const val = cell(row.姓名, d);
        return (
          <InputNumber
            min={0}
            max={full}
            size="small"
            value={val !== undefined ? Number(val) : undefined}
            onChange={(v) => {
              if (v === null) return;
              upsert.mutate({ 学生: row.姓名, 日期: d, val: String(v) });
            }}
            style={{ width: 70 }}
          />
        );
      },
    })),
    {
      title: "最新",
      dataIndex: "最新",
      width: 80,
      render: (_: any, row: Row) => {
        const n = latestScores.get(row.姓名);
        if (n === undefined) return <span style={{ color: "#bbb" }}>-</span>;
        return (
          <span style={{ color: n < passLine ? "#cf1322" : "#389e0d", fontWeight: 600 }}>{n}</span>
        );
      },
    },
  ];

  const data = roster.map((s) => ({ ...s, 姓名: s.姓名 }));

  return (
    <div className="page">
      <h2 className="page-title">成绩录入</h2>
      <div className="page-sub">
        {班级} · 满分 {full} · 及格线 {passLine}（<Tag color="red">红=不及格</Tag>）
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={项目}
          onChange={set项目}
          style={{ width: 200 }}
          placeholder="选择考试项目"
          options={scoreItems.map((it) => ({ value: it.项目名, label: it.项目名 }))}
        />
      </Space>

      {项目 && (
        <Table
          rowKey="姓名"
          dataSource={data}
          columns={dataColumns}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 50 }}
          size="small"
        />
      )}
    </div>
  );
}
