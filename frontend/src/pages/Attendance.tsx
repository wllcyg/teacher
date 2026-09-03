import { useMemo, useState } from "react";
import { Table, Card, DatePicker, Select, Button, message, Tag, Space, Popconfirm } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { Dayjs } from "dayjs";
import { createRow, deleteRow, listTable, updateRow } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";

const STATUSES = ["缺勤", "迟到", "早退", "请假"];

export default function Attendance() {
  const { 班级 } = useCurrentClass();
  const qc = useQueryClient();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [marks, setMarks] = useState<Record<string, string>>({});

  const dateStr = date.format("YYYY-MM-DD");

  const { data: students } = useQuery({ queryKey: ["students"], queryFn: () => listTable("students") });
  const { data: attendance } = useQuery({
    queryKey: ["attendance", dateStr],
    queryFn: () => listTable("attendance", { 日期: dateStr }),
  });

  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  const existingMap = useMemo(() => {
    const m = new Map<string, Row>();
    (attendance ?? []).forEach((r) => m.set(r.学生, r));
    return m;
  }, [attendance]);

  const save = useMutation({
    mutationFn: async () => {
      for (const s of roster) {
        const st = marks[s.姓名] ?? "";
        const exist = existingMap.get(s.姓名);
        if (st) {
          // 记异常
          if (exist) {
            if (exist.状态 !== st) await updateRow("attendance", exist.id, { ...exist, 状态: st });
          } else {
            await createRow("attendance", { 日期: dateStr, 学生: s.姓名, 状态: st, 备注: "" });
          }
        } else {
          // 正常：清掉已有异常
          if (exist) await deleteRow("attendance", exist.id);
        }
      }
    },
    onSuccess: () => {
      message.success("考勤已保存");
      setMarks({});
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("attendance", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const abnormalCount = roster.filter((s) => marks[s.姓名] || existingMap.has(s.姓名)).length;

  return (
    <div className="page">
      <h2 className="page-title">考勤</h2>
      <div className="page-sub">{班级} · 只记录异常（缺勤/迟到/早退/请假），正常不落行</div>

      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker value={date} onChange={(d) => { setDate(d ?? dayjs()); setMarks({}); }} allowClear={false} />
        <Button type="primary" loading={save.isPending} onClick={() => save.mutate()}>
          保存考勤{abnormalCount ? `（${abnormalCount} 条异常）` : ""}
        </Button>
      </Space>

      <Card size="small" title={`${dateStr} 考勤登记`}>
        <Table
          rowKey="姓名"
          size="small"
          scroll={{ x: "max-content" }}
          dataSource={roster}
          pagination={{ pageSize: 50 }}
          columns={[
            { title: "学号", dataIndex: "学号", width: 70 },
            { title: "姓名", dataIndex: "姓名" },
            {
              title: "状态",
              key: "st",
              width: 160,
              render: (_: any, s: Row) => {
                const current = marks[s.姓名] ?? existingMap.get(s.姓名)?.状态 ?? "";
                return (
                  <Select
                    size="small"
                    style={{ width: 130 }}
                    value={current}
                    onChange={(v) => setMarks((m) => ({ ...m, [s.姓名]: v }))}
                    options={[
                      { value: "", label: "正常" },
                      ...STATUSES.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                );
              },
            },
          ]}
        />
      </Card>

      <Card size="small" title="异常记录" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: "max-content" }}
          dataSource={attendance}
          pagination={{ pageSize: 15 }}
          columns={[
            { title: "日期", dataIndex: "日期", width: 110 },
            { title: "学生", dataIndex: "学生" },
            { title: "状态", dataIndex: "状态", render: (v: string) => <Tag color={v === "缺勤" ? "red" : "orange"}>{v}</Tag> },
            { title: "备注", dataIndex: "备注" },
            {
              title: "操作",
              key: "op",
              width: 80,
              render: (_: any, r: Row) => (
                <Popconfirm title="删除？" onConfirm={() => del.mutate(r.id)}>
                  <Button size="small" type="link" danger>删除</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
