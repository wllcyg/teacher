import { useMemo, useState } from "react";
import { Table, Card, DatePicker, Select, Button, message, Tag, Space, Popconfirm } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { Dayjs } from "dayjs";
import { batchCreateRows, batchDeleteRows, deleteRow, listAllTable, updateRow } from "../api";
import { useCurrentClass, activeRoster } from "../hooks";
import type { Row } from "../types";
import { triggerHaptic } from "../utils/haptics";
import StudentAvatar from "../components/StudentAvatar";

const STATUSES = ["缺勤", "迟到", "早退", "请假"];

export default function Attendance() {
  const { 班级, class_id } = useCurrentClass();
  const qc = useQueryClient();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [marks, setMarks] = useState<Record<string, string>>({});

  const dateStr = date.format("YYYY-MM-DD");

  const queryClass = class_id || 班级;
  const { data: students } = useQuery({
    queryKey: ["students-all", queryClass],
    queryFn: () => listAllTable("students", class_id ? { class_id } : { class_name: 班级 }),
    enabled: !!queryClass,
  });
  const { data: attendance } = useQuery({
    queryKey: ["attendance-all", queryClass, dateStr],
    queryFn: () =>
      listAllTable(
        "attendance",
        class_id ? { class_id, date: dateStr } : { class_name: 班级, date: dateStr }
      ),
    enabled: !!queryClass,
  });

  const roster = useMemo(() => activeRoster(students, 班级), [students, 班级]);

  const existingMap = useMemo(() => {
    const m = new Map<string, Row>();
    (attendance ?? []).forEach((r) => m.set(r.student_name || r.学生, r));
    return m;
  }, [attendance]);

  const save = useMutation({
    mutationFn: async () => {
      const toDeleteIds: number[] = [];
      const toCreate: Record<string, any>[] = [];
      const toUpdate: { id: number; data: Record<string, any> }[] = [];

      for (const s of roster) {
        const sName = s.name || s.姓名;
        const exist = existingMap.get(sName);
        const st = sName in marks ? marks[sName] : ((exist?.status || exist?.状态) ?? "");

        if (st) {
          // 记异常
          if (exist) {
            if ((exist.status || exist.状态) !== st) {
              toUpdate.push({
                id: exist.id,
                data: {
                  ...exist,
                  status: st,
                  状态: st,
                  ...(s.student_id ? { student_id: s.student_id } : {}),
                  ...(class_id ? { class_id } : {}),
                },
              });
            }
          } else {
            toCreate.push({
              date: dateStr,
              student_id: s.student_id || undefined,
              student_name: sName,
              status: st,
              class_name: 班级,
              ...(class_id ? { class_id } : {}),
              notes: "",
              // 兼容字段
              日期: dateStr,
              学生: sName,
              状态: st,
              备注: "",
              班级,
            });
          }
        } else {
          // 正常：清掉已有异常
          if (exist) {
            toDeleteIds.push(exist.id);
          }
        }
      }

      if (toDeleteIds.length > 0) {
        await batchDeleteRows("attendance", toDeleteIds);
      }
      if (toCreate.length > 0) {
        await batchCreateRows("attendance", toCreate);
      }
      if (toUpdate.length > 0) {
        await Promise.all(toUpdate.map((u) => updateRow("attendance", u.id, u.data)));
      }
    },
    onSuccess: () => {
      triggerHaptic("success");
      message.success("考勤已保存");
      setMarks({});
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRow("attendance", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const abnormalCount = roster.filter((s) => {
    const sName = s.name || s.姓名;
    return marks[sName] || existingMap.has(sName);
  }).length;

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
          rowKey={(s) => s.name || s.姓名}
          size="small"
          scroll={{ x: "max-content" }}
          dataSource={roster}
          pagination={{ pageSize: 50 }}
          columns={[
            { title: "学号", dataIndex: "student_no", render: (v, s) => v || s.学号, width: 70 },
            {
              title: "姓名",
              dataIndex: "name",
              render: (t: string, s: Row) => {
                const sName = t || s.姓名;
                return (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <StudentAvatar student={s} size={24} />
                    <span style={{ fontWeight: 500 }}>{sName}</span>
                  </div>
                );
              },
            },
            {
              title: "状态",
              key: "st",
              width: 160,
              render: (_: any, s: Row) => {
                const sName = s.name || s.姓名;
                const exist = existingMap.get(sName);
                const current = marks[sName] ?? (exist?.status || exist?.状态) ?? "";
                return (
                  <Select
                    size="small"
                    style={{ width: 130 }}
                    value={current}
                    onChange={(v) => setMarks((m) => ({ ...m, [sName]: v }))}
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
            { title: "日期", dataIndex: "date", render: (v, r) => v || r.日期, width: 110 },
            { title: "学生", dataIndex: "student_name", render: (v, r) => v || r.学生 },
            {
              title: "状态",
              dataIndex: "status",
              render: (v: string, r: Row) => {
                const val = v || r.状态;
                return <Tag color={val === "缺勤" ? "red" : "orange"}>{val}</Tag>;
              },
            },
            { title: "备注", dataIndex: "notes", render: (v, r) => v || r.备注 },
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
