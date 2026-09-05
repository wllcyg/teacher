"""通用 CRUD + 报表查询接口。

- 通用 CRUD：为 10 张表各生成 列表/详情/新建/更新/删除 五个标准端点。
- 报表接口：把 scoring 层的纯函数包装成 REST，供前端直接消费。
"""

import datetime
import json
import os
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from . import enums, models, scoring
from .card_generator import THEMES, get_or_generate_card_path, resolve_theme_by_date
from .database import get_db

router = APIRouter(prefix="/api", tags=["api"])


# ---------- 通用工具 ----------
def _model(table: str):
    if table not in models.MODELS:
        raise HTTPException(status_code=404, detail=f"未知表: {table}")
    return models.MODELS[table]


def _cols(table: str) -> list[str]:
    return enums.TABLE_COLUMNS[table]


def _to_dict(row, table: str) -> dict:
    d = {"id": row.id}
    if hasattr(row, "student_id"):
        d["student_id"] = getattr(row, "student_id", "") or ""
    for c in _cols(table):
        d[c] = getattr(row, c)
    return d


def _all(db: Session, table: str) -> list:
    return db.query(_model(table)).order_by(_model(table).id).all()


def _apply(row, payload: dict, table: str):
    for c in _cols(table):
        if c in payload:
            v = payload[c]
            setattr(row, c, "" if v is None else str(v))
    if hasattr(row, "student_id") and "student_id" in payload:
        setattr(row, "student_id", "" if payload["student_id"] is None else str(payload["student_id"]))


RELATED_STUDENT_TABLES = ["academic", "behavior", "attendance", "parents", "comms", "duties"]


def _next_student_ids(db: Session, count: int = 1) -> list[str]:
    """生成后续 count 个连续唯一的学生业务编号 STU0001, STU0002..."""
    stus = db.query(models.Student.student_id).filter(models.Student.student_id.like("STU%")).all()
    max_num = 0
    for (sid,) in stus:
        if sid and sid.startswith("STU"):
            try:
                num = int(sid[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    if max_num == 0:
        max_id = db.query(models.Student.id).order_by(models.Student.id.desc()).first()
        max_num = max_id[0] if max_id else 0
    return [f"STU{max_num + 1 + i:04d}" for i in range(count)]


def _lookup_student_id(db: Session, student_name: str, klass: str = None) -> str:
    """根据姓名（及可选班级）查询学生的 student_id"""
    if not student_name:
        return ""
    q = db.query(models.Student).filter(models.Student.姓名 == student_name)
    if klass:
        stu_in_class = q.filter(models.Student.班级 == klass).first()
        if stu_in_class and stu_in_class.student_id:
            return stu_in_class.student_id
    stu = q.first()
    return stu.student_id if (stu and stu.student_id) else ""


def _cascade_student_updates(
    db: Session,
    student_row: models.Student,
    old_name: str,
    new_name: str,
    old_class: str,
    new_class: str,
):
    """学生改名或转班时，级联同步 6 张关联子表（成绩、表现、考勤、家长、沟通、值日）"""
    sid = getattr(student_row, "student_id", "") or ""
    for t_name in RELATED_STUDENT_TABLES:
        M = models.MODELS[t_name]
        # 1. 改名级联
        if old_name and new_name and old_name != new_name:
            if sid:
                cond = or_(M.student_id == sid, M.学生 == old_name)
            else:
                cond = (M.学生 == old_name)
            rows = db.query(M).filter(cond).all()
            for r in rows:
                r.学生 = new_name
                if sid and not getattr(r, "student_id", None):
                    r.student_id = sid

        # 2. 班级变更级联（针对含班级字段的表，如 academic, behavior）
        if old_class and new_class and old_class != new_class and hasattr(M, "班级"):
            curr_name = new_name or old_name
            if sid:
                cond = or_(M.student_id == sid, M.学生 == curr_name)
            else:
                cond = (M.学生 == curr_name)
            rows = db.query(M).filter(cond).all()
            for r in rows:
                r.班级 = new_class
                if sid and not getattr(r, "student_id", None):
                    r.student_id = sid


def _find_natural_dup(db: Session, table: str, payload: dict):
    """按 NATURAL_KEY 查重，查到返回已存在的行（补交不重复写）。"""
    keys = enums.NATURAL_KEY.get(table)
    if not keys:
        return None
    q = db.query(_model(table))
    for k in keys:
        q = q.filter(getattr(_model(table), k) == payload.get(k, ""))
    return q.first()


def active_roster(db: Session, klass: str) -> list[dict]:
    """当前班在册学生（不含已离班），按学号数值序。"""
    rows = db.query(models.Student).filter(models.Student.班级 == klass).all()
    out = [r for r in rows if not text_startswith(r.标签, scoring.LEFT_MARK)]
    out.sort(key=lambda s: _num(s.学号))
    return [_to_dict(s, "students") for s in out]


def _num(v) -> float:
    n = scoring._to_num(v)
    return n if n is not None else float("inf")


def text_startswith(v, prefix: str) -> bool:
    return scoring.text_of(v).startswith(prefix)


# ---------- 表结构说明 ----------
@router.get("/tables")
def list_tables():
    return {
        table: {"columns": cols, "natural_key": enums.NATURAL_KEY.get(table)}
        for table, cols in enums.TABLE_COLUMNS.items()
    }


# ---------- 通用 CRUD（程序化注册） ----------
def _register_crud(table: str):
    Model = _model(table)
    cols = _cols(table)
    valid_keys = set(cols) | {"id", "student_id"}

    def list_rows(request: Request, db: Session = Depends(get_db)):
        q = db.query(Model)
        for c in cols:
            val = request.query_params.get(c)
            if val is not None:
                q = q.filter(getattr(Model, c) == val)
            # 模糊查询：{列名}_like 参数，例如 ?姓名_like=张 → 姓名包含「张」
            like_val = request.query_params.get(f"{c}_like")
            if like_val is not None and like_val != "":
                q = q.filter(getattr(Model, c).contains(like_val))
        if hasattr(Model, "student_id"):
            sid_val = request.query_params.get("student_id")
            if sid_val is not None:
                q = q.filter(Model.student_id == sid_val)
        # 通用模糊搜索：?q=关键字 在所有列上做 OR 匹配（如学生表可同时搜姓名/学号/业务ID）
        kw = request.query_params.get("q")
        if kw:
            search_cols = list(cols)
            if hasattr(Model, "student_id"):
                search_cols.append("student_id")
            q = q.filter(or_(*[getattr(Model, c).contains(kw) for c in search_cols]))
        return [_to_dict(r, table) for r in q.order_by(Model.id).all()]

    def get_row(row_id: int, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        return _to_dict(row, table)

    def create_row(payload: dict, db: Session = Depends(get_db)):
        unknown = [k for k in payload if k not in valid_keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        existing = _find_natural_dup(db, table, payload)
        if existing:
            return _to_dict(existing, table)
        row = Model()
        _apply(row, payload, table)
        if table == "students":
            if not getattr(row, "student_id", None):
                row.student_id = _next_student_ids(db, 1)[0]
        elif table in RELATED_STUDENT_TABLES:
            if not getattr(row, "student_id", None) and getattr(row, "学生", None):
                row.student_id = _lookup_student_id(db, row.学生, getattr(row, "班级", None))
        db.add(row)
        db.commit()
        db.refresh(row)
        return _to_dict(row, table)

    def update_row(row_id: int, payload: dict, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        unknown = [k for k in payload if k not in valid_keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        old_name = getattr(row, "姓名", None)
        old_class = getattr(row, "班级", None)
        _apply(row, payload, table)
        if table == "students":
            new_name = getattr(row, "姓名", None)
            new_class = getattr(row, "班级", None)
            if (old_name and new_name and old_name != new_name) or (old_class and new_class and old_class != new_class):
                _cascade_student_updates(db, row, old_name, new_name, old_class, new_class)
        db.commit()
        db.refresh(row)
        return _to_dict(row, table)

    def delete_row(row_id: int, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        db.delete(row)
        db.commit()
        return {"ok": True}

    def batch_delete(payload: dict, db: Session = Depends(get_db)):
        """批量删除：payload = {"ids": [1,2,3]}"""
        ids = payload.get("ids") or []
        if not ids:
            raise HTTPException(status_code=422, detail="ids 不能为空")
        rows = db.query(Model).filter(Model.id.in_(ids)).all()
        for r in rows:
            db.delete(r)
        db.commit()
        return {"ok": True, "deleted": len(rows)}

    def batch_update(payload: dict, db: Session = Depends(get_db)):
        """批量修改：payload = {"ids": [1,2,3], "updates": {"班级": "八10班"}}"""
        ids = payload.get("ids") or []
        updates = payload.get("updates") or {}
        if not ids or not updates:
            raise HTTPException(status_code=422, detail="ids 和 updates 不能为空")
        unknown = [k for k in updates if k not in valid_keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        rows = db.query(Model).filter(Model.id.in_(ids)).all()
        for r in rows:
            old_name = getattr(r, "姓名", None)
            old_class = getattr(r, "班级", None)
            _apply(r, updates, table)
            if table == "students":
                new_name = getattr(r, "姓名", None)
                new_class = getattr(r, "班级", None)
                if (old_name and new_name and old_name != new_name) or (old_class and new_class and old_class != new_class):
                    _cascade_student_updates(db, r, old_name, new_name, old_class, new_class)
        db.commit()
        return {"ok": True, "updated": len(rows)}

    def batch_create(payload: dict, db: Session = Depends(get_db)):
        """批量新增：payload = {"rows": [{...}, {...}]}"""
        records = payload.get("rows") or []
        if not records:
            raise HTTPException(status_code=422, detail="rows 不能为空")
        added = []
        if table == "students":
            next_ids = _next_student_ids(db, len(records))
            for i, rec in enumerate(records):
                row = Model()
                _apply(row, rec, table)
                if not getattr(row, "student_id", None):
                    row.student_id = next_ids[i]
                db.add(row)
                added.append(row)
        else:
            for rec in records:
                row = Model()
                _apply(row, rec, table)
                if table in RELATED_STUDENT_TABLES and not getattr(row, "student_id", None) and getattr(row, "学生", None):
                    row.student_id = _lookup_student_id(db, row.学生, getattr(row, "班级", None))
                db.add(row)
                added.append(row)
        db.commit()
        return {"ok": True, "created": len(added)}

    router.add_api_route(f"/tables/{table}", list_rows, methods=["GET"], name=f"list_{table}")
    router.add_api_route(f"/tables/{table}/{{row_id}}", get_row, methods=["GET"], name=f"get_{table}")
    router.add_api_route(f"/tables/{table}", create_row, methods=["POST"], name=f"create_{table}")
    router.add_api_route(f"/tables/{table}/{{row_id}}", update_row, methods=["PUT"], name=f"update_{table}")
    router.add_api_route(f"/tables/{table}/{{row_id}}", delete_row, methods=["DELETE"], name=f"delete_{table}")
    router.add_api_route(f"/tables/{table}/batch-create", batch_create, methods=["POST"], name=f"batch_create_{table}")
    router.add_api_route(f"/tables/{table}/batch-delete", batch_delete, methods=["POST"], name=f"batch_delete_{table}")
    router.add_api_route(f"/tables/{table}/batch-update", batch_update, methods=["POST"], name=f"batch_update_{table}")


for _t in enums.TABLE_COLUMNS:
    _register_crud(_t)


# ---------- 报表接口 ----------
def _rows(db: Session, table: str) -> list[dict]:
    return [_to_dict(r, table) for r in _all(db, table)]


@router.get("/report/summary")
def report_summary(
    db: Session = Depends(get_db),
    今天: str = Query(default="", description="今天日期 YYYY-MM-DD，用于本周表现统计"),
    班级: str = Query(default="", description="要统计的班级，空则取第一个有学生的班"),
):
    students = _rows(db, "students")
    klass = 班级 or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    o = {
        "items": _rows(db, "items"),
        "academic": _rows(db, "academic"),
        "behavior": _rows(db, "behavior"),
        "attendance": _rows(db, "attendance"),
        "roster": roster,
        "今天": 今天,
    }
    return {"班级": klass, **scoring.summary_overview(o)}


@router.get("/report/exam/{item_name}")
def report_exam(
    item_name: str,
    db: Session = Depends(get_db),
    班级: str = Query(default=""),
    优: float = Query(default=85),
    及: float = Query(default=60),
    低: float = Query(default=40),
):
    items = _rows(db, "items")
    item = next((it for it in items if scoring.text_of(it.get("项目名")) == item_name), None)
    if not item:
        raise HTTPException(status_code=404, detail=f"项目不存在: {item_name}")
    students = _rows(db, "students")
    klass = 班级 or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    records = _rows(db, "academic")
    stats = scoring.report_stats(item, records, roster, {"优": 优, "及": 及, "低": 低})
    prev = scoring.prev_exam(items, records, roster, item_name)
    prev_stats = None
    if prev:
        prev_item = next((it for it in items if scoring.text_of(it.get("项目名")) == prev), None)
        if prev_item:
            prev_snap = scoring.latest_valid_scores(prev_item, records, roster)
            cur_snap = stats["快照"]
            deltas = scoring.delta_scores(cur_snap, prev_snap)
            prev_stats = {
                "项目": prev,
                "统计": scoring.report_stats(prev_item, records, roster),
                "进退步": scoring.delta_overview(deltas),
                "名次": scoring.rank_scores([{"姓名": w, "分数": stats["快照"]["按学生"][w]["分"]} for w in stats["快照"]["按学生"]]),
            }
    return {"项目": item_name, "统计": stats, "上次考试": prev_stats}


@router.get("/report/matrix")
def report_matrix(
    db: Session = Depends(get_db),
    班级: str = Query(default=""),
    项目: str = Query(default=""),
    起: str = Query(default=""),
):
    students = _rows(db, "students")
    klass = 班级 or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    opts = {}
    if 项目:
        opts["项目"] = 项目
    if 起:
        opts["起"] = 起
    return scoring.build_matrix(roster, _rows(db, "academic"), _rows(db, "items"), opts)


@router.post("/academic/batch-upsert")
def batch_upsert_academic(
    payload: dict,
    db: Session = Depends(get_db),
):
    """批量录入/更新考试成绩（以 (班级, 项目, 日期, 学生) 幂等查重入库）。
    如果项目名在 items 表中不存在，自动创建（满分/学科等取 payload 中的值或默认值）。
    """
    klass = payload.get("班级", "").strip()
    item_name = payload.get("项目", "").strip()
    exam_date = payload.get("日期", "").strip()
    records = payload.get("records") or []

    if not klass or not item_name or not exam_date:
        raise HTTPException(status_code=422, detail="班级、项目和日期不能为空")

    # 自动创建项目（如果不存在）
    ItemModel = _model("items")
    existing_item = db.query(ItemModel).filter(ItemModel.项目名 == item_name).first()
    item_created = False
    if not existing_item:
        new_item = ItemModel(
            项目名=item_name,
            类型="学业",
            计分制="分数",
            满分=str(payload.get("满分", 100)),
            类别=payload.get("类别", "单元"),
            学科=payload.get("学科", "地理"),
            周期="学期",
            权重="1",
        )
        db.add(new_item)
        db.flush()
        item_created = True

    AcademicModel = _model("academic")
    updated_count = 0
    created_count = 0

    for r in records:
        stu = str(r.get("学生", "")).strip()
        val = str(r.get("结果", "")).strip()
        status = str(r.get("状态", "完成")).strip()
        note = str(r.get("备注", "")).strip()
        if not stu:
            continue

        sid = _lookup_student_id(db, stu, klass)
        existing = (
            db.query(AcademicModel)
            .filter(
                AcademicModel.班级 == klass,
                AcademicModel.项目 == item_name,
                AcademicModel.日期 == exam_date,
                AcademicModel.学生 == stu,
            )
            .first()
        )
        if existing:
            existing.结果 = val
            existing.状态 = status
            existing.备注 = note
            if sid and not getattr(existing, "student_id", None):
                existing.student_id = sid
            updated_count += 1
        else:
            row = AcademicModel(
                student_id=sid,
                班级=klass,
                项目=item_name,
                日期=exam_date,
                学生=stu,
                结果=val,
                状态=status,
                备注=note,
            )
            db.add(row)
            created_count += 1

    db.commit()
    return {
        "ok": True,
        "班级": klass,
        "项目": item_name,
        "日期": exam_date,
        "新增": created_count,
        "更新": updated_count,
        "总录入": created_count + updated_count,
        "项目自动创建": item_created,
    }


@router.get("/report/items-summary")
def report_items_summary(
    db: Session = Depends(get_db),
    班级: str = Query(default=""),
):
    """每个项目的汇总（按计分制分叉），供「汇总」页直接消费。"""
    students = _rows(db, "students")
    klass = 班级 or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    items = _rows(db, "items")
    academic = _rows(db, "academic")
    out = []
    for it in items:
        if scoring.item_disabled(it):
            continue
        agg = scoring.aggregate_item(it, academic, roster)
        agg["计分制"] = scoring.score_kind(it)
        agg["类型"] = scoring.text_of(it.get("类型"))
        agg["学科"] = scoring.text_of(it.get("学科"))
        out.append(agg)
    return {"班级": klass, "项目汇总": out}


@router.get("/report/behavior-week")
def report_behavior_week(
    db: Session = Depends(get_db),
    班级: str = Query(default=""),
    weekStart: str = Query(default=""),
    按小计: bool = Query(default=False),
):
    students = _rows(db, "students")
    klass = 班级 or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    records = _rows(db, "behavior")
    table = scoring.week_table(records, roster, weekStart, 按小计)
    agg = scoring.aggregate_behavior(records, roster)
    return {"周表": table, "周聚合": agg}


@router.get("/report/contact-book")
def report_contact_book(
    db: Session = Depends(get_db),
    班级: str = Query(default=""),
    keyword: str = Query(default=""),
):
    students = _rows(db, "students")
    klass = 班级 or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    return scoring.contact_book(roster, _rows(db, "parents"), keyword)


@router.get("/vault/export")
def vault_export(db: Session = Depends(get_db)):
    """数据保险箱：导出全量快照。"""
    out = {}
    for table in enums.TABLE_COLUMNS:
        out[table] = _rows(db, table)
    return out


@router.post("/vault/import")
def vault_import(payload: dict, db: Session = Depends(get_db)):
    """数据保险箱：全量覆盖导入。"""
    for table, model in models.MODELS.items():
        db.query(model).delete()
        for row in payload.get(table, []):
            inst = model()
            for col in enums.TABLE_COLUMNS[table]:
                setattr(inst, col, "" if row.get(col) is None else str(row.get(col)))
            db.add(inst)
    db.commit()
    return {"ok": True, "tables": {t: len(payload.get(t, [])) for t in enums.TABLE_COLUMNS}}


@router.post("/import/parents")
def import_parents(
    payload: dict,
    db: Session = Depends(get_db),
):
    """家长通讯录批量导入，返回对上/名册外/坏行/已有/没登记，不落库。"""
    students = _rows(db, "students")
    klass = payload.get("班级") or (students[0]["班级"] if students else "")
    roster = active_roster(db, klass)
    return scoring.parent_import_plan(payload.get("文本", ""), roster, _rows(db, "parents"))


@router.post("/import/students")
def import_students(payload: dict, db: Session = Depends(get_db)):
    """学生 CSV 批量导入。

    - CSV 首行为表头，支持列：班级、姓名、学号、小组、标签（缺省列为空）。
    - 兼容英文表头：class/name/number(学号)/group/tag。
    - 也可只有一列姓名（无表头时按每行一个姓名处理）。
    - 自然键 (班级, 姓名) 去重：已存在的跳过。
    - payload: {"csv": "...", "班级": "八4班"}（班级可缺省，取当前班）。
    """
    import csv
    import io

    csv_text = (payload.get("csv") or "").strip()
    if not csv_text:
        raise HTTPException(status_code=422, detail="CSV 内容为空")

    students = _rows(db, "students")
    default_klass = payload.get("班级") or (students[0]["班级"] if students else "")
    if not default_klass:
        raise HTTPException(status_code=422, detail="请指定班级")

    # 去 BOM；全角逗号转半角
    if csv_text.startswith("﻿"):
        csv_text = csv_text[1:]
    csv_text = csv_text.replace("，", ",")

    rows = list(csv.reader(io.StringIO(csv_text)))
    rows = [r for r in rows if any((c or "").strip() for c in r)]
    if not rows:
        raise HTTPException(status_code=422, detail="CSV 无有效数据行")

    # 列名映射（中文优先，兼容英文）
    alias = {
        "班级": "班级", "class": "班级",
        "姓名": "姓名", "name": "姓名",
        "学号": "学号", "number": "学号", "no": "学号", "id": "学号",
        "小组": "小组", "group": "小组",
        "标签": "标签", "tag": "标签",
    }
    header = [(c or "").strip() for c in rows[0]]
    mapped = [alias.get(h.lower()) for h in header]

    has_header = any(m is not None for m in mapped)
    if has_header:
        data_rows = rows[1:]
    else:
        # 无表头：单列姓名 或 姓名,学号
        mapped = ["姓名"] + ["学号"] * (len(header) - 1)
        data_rows = rows

    added, skipped_dup, skipped_bad = [], [], []
    for i, r in enumerate(data_rows, start=2):
        rec = {"班级": default_klass, "姓名": "", "学号": "", "小组": "", "标签": ""}
        for j, col in enumerate(mapped):
            if col and j < len(r):
                rec[col] = (r[j] or "").strip()
        name = rec["姓名"]
        if not name:
            skipped_bad.append({"行": i, "原因": "姓名为空"})
            continue
        if _find_natural_dup(db, "students", rec):
            skipped_dup.append({"姓名": name, "班级": rec["班级"]})
            continue
        row = models.Student()
        _apply(row, rec, "students")
        if not getattr(row, "student_id", None):
            row.student_id = _next_student_ids(db, 1)[0]
        db.add(row)
        db.commit()
        db.refresh(row)
        added.append(_to_dict(row, "students"))

    return {
        "班级": default_klass,
        "新增": added,
        "已存在跳过": skipped_dup,
        "无效行": skipped_bad,
        "统计": {
            "总行数": len(data_rows),
            "新增": len(added),
            "已存在": len(skipped_dup),
            "无效": len(skipped_bad),
        },
    }


# ---------- 每日晨间寄语接口 ----------
try:
    from dotenv import load_dotenv
    _root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
    if os.path.exists(_root_env):
        load_dotenv(_root_env)
    load_dotenv()
except Exception:
    pass

DEFAULT_AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
DEFAULT_AI_KEY = os.environ.get("AI_API_KEY", os.environ.get("DASHSCOPE_API_KEY", ""))
DEFAULT_AI_MODEL = os.environ.get("AI_MODEL", "qwen-flash")


def _safe_date_str(date: str) -> str:
    """校验日期必须是合法的 YYYY-MM-DD，非法则回退为今天。

    避免任意字符串被直接拼进缓存文件名，受安排前可无限制造成新文件、把磁盘写满的 DoS 风险。
    """
    if date:
        try:
            datetime.date.fromisoformat(date)
            return date
        except ValueError:
            pass
    return datetime.date.today().isoformat()


def _allowed_ai_hosts() -> set[str]:
    """AI 域名白名单：默认只允许 DEFAULT_AI_BASE_URL 自带的域名，可用 AI_ALLOWED_HOSTS 环境变量（逗号分隔）追加。

    防止 ai_base_url 被通过 POST /api/settings 改成任意地址后，发起 SSRF 探测内网/云主机元数据接口。
    """
    hosts: set[str] = set()
    default_host = urllib.parse.urlparse(DEFAULT_AI_BASE_URL).hostname
    if default_host:
        hosts.add(default_host.lower())
    for h in os.environ.get("AI_ALLOWED_HOSTS", "").split(","):
        h = h.strip().lower()
        if h:
            hosts.add(h)
    return hosts


ALLOWED_AI_HOSTS = _allowed_ai_hosts()


def _is_allowed_ai_base_url(base_url: str) -> bool:
    try:
        host = (urllib.parse.urlparse(base_url).hostname or "").lower()
    except ValueError:
        return False
    if not host:
        return False
    return any(host == h or host.endswith("." + h) for h in ALLOWED_AI_HOSTS)

EDUCATIONAL_QUOTES = [
    "晨光微露，心向阳光，愿每个孩子都如春芽般，在爱与期待中悄然生长。",
    "教育的本质意味着，一棵树摇动另一棵树，一朵云推动另一朵云，一个灵魂唤醒另一个灵魂。",
    "学贵得师，亦贵得友。愿您今天的课堂充满思考的火花与纯真的笑脸。",
    "爱是教育的灵魂，没有爱就没有教育。用心灌溉，静待每一朵花开。",
    "捧着一颗心来，不带半根草去。老师的每一分付出，都在孩子心中生根发芽。",
    "教育不是注满一桶水，而是点燃一把火。愿今天的教学充满灵感与温度。",
    "晨光里，你的一句叮咛，正悄悄点亮孩子眼中的星。",
    "知之者不如好之者，好之者不如乐之者。愿您的启发带给学生探索世界的渴望。",
    "温和而坚定，严格且包容。用心陪伴每一个独特的生命拔节成长。",
]


def _call_daily_greeting(db: Session, teacher_name: str = "崔老师") -> str:
    # 优先从环境变量取密钥，其次检查本地数据库（如有）
    api_key_row = db.query(models.AppSetting).filter(models.AppSetting.key == "ai_api_key").first()
    base_url_row = db.query(models.AppSetting).filter(models.AppSetting.key == "ai_base_url").first()
    model_row = db.query(models.AppSetting).filter(models.AppSetting.key == "ai_model").first()

    api_key = (api_key_row.value if api_key_row and api_key_row.value else DEFAULT_AI_KEY).strip()
    base_url = (base_url_row.value if base_url_row and base_url_row.value else DEFAULT_AI_BASE_URL).strip().rstrip("/")
    model = (model_row.value if model_row and model_row.value else DEFAULT_AI_MODEL).strip()

    if api_key and base_url and not _is_allowed_ai_base_url(base_url):
        print(f"Blocked disallowed AI base_url (possible SSRF attempt): {base_url}")
    elif api_key and base_url:
        import urllib.request
        url = f"{base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        data = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        f"你是一位富有温度与教育智慧的资深教育导师。请为中学教师{teacher_name}写一句清晨寄语或每日勉励。"
                        "要求：富有教育情怀与诗意，亲切温暖，给人力量与信心；不要任何开场白、前缀或标号，直接输出正文，字数在40字以内。"
                    ),
                },
                {"role": "user", "content": "请写一句今日晨间寄语。"},
            ],
            "temperature": 0.85,
        }
        req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"))
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                text = body.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if text.startswith(("“", '"')) and text.endswith(("”", '"')):
                    text = text[1:-1]
                if text:
                    return text
        except Exception as e:
            print(f"Daily greeting generation error: {e}")

    import random
    return random.choice(EDUCATIONAL_QUOTES)


@router.get("/daily-greeting")
@router.get("/ai/greeting")
def get_daily_greeting(
    db: Session = Depends(get_db),
    date: str = Query(default=""),
    force: bool = Query(default=False),
    theme: str = Query(default="auto"),
):
    today_str = _safe_date_str(date)
    resolved_theme = resolve_theme_by_date(today_str) if (not theme or theme == "auto") else theme
    if resolved_theme not in THEMES:
        resolved_theme = "warm"

    cache_key = f"daily_greeting_{today_str}"
    card_url = f"/api/daily-greeting/card?date={today_str}&theme={resolved_theme}"

    if not force:
        cached = db.query(models.AppSetting).filter(models.AppSetting.key == cache_key).first()
        if cached and cached.value:
            try:
                data = json.loads(cached.value)
                data["cached"] = True
                data["card_url"] = card_url
                data["theme"] = resolved_theme
                return data
            except Exception:
                return {
                    "quote": cached.value,
                    "date": today_str,
                    "cached": True,
                    "card_url": card_url,
                    "theme": resolved_theme,
                }

    teacher_row = db.query(models.AppSetting).filter(models.AppSetting.key == "称呼").first()
    teacher_name = teacher_row.value if teacher_row and teacher_row.value else "崔老师"
    quote = _call_daily_greeting(db, teacher_name)

    # 后端自动预渲染超清晨间寄语海报并缓存
    try:
        get_or_generate_card_path(
            quote=quote,
            date_str=today_str,
            teacher_name=teacher_name,
            theme=resolved_theme,
            force=force,
        )
    except Exception as e:
        print(f"Pre-generating card failed: {e}")

    result = {
        "quote": quote,
        "date": today_str,
        "cached": False,
        "card_url": card_url,
        "theme": resolved_theme,
    }

    val = json.dumps(result, ensure_ascii=False)
    cache_row = db.query(models.AppSetting).filter(models.AppSetting.key == cache_key).first()
    if not cache_row:
        cache_row = models.AppSetting(key=cache_key, value=val)
        db.add(cache_row)
    else:
        cache_row.value = val
    db.commit()

    return result


@router.get("/daily-greeting/card")
def get_daily_greeting_card(
    db: Session = Depends(get_db),
    date: str = Query(default=""),
    force: bool = Query(default=False),
    theme: str = Query(default="auto"),
):
    today_str = _safe_date_str(date)
    resolved_theme = resolve_theme_by_date(today_str) if (not theme or theme == "auto") else theme
    if resolved_theme not in THEMES:
        resolved_theme = "warm"

    greeting_info = get_daily_greeting(db=db, date=today_str, force=False, theme=resolved_theme)
    quote = greeting_info.get("quote", "晨光微露，心向阳光。")

    teacher_row = db.query(models.AppSetting).filter(models.AppSetting.key == "称呼").first()
    teacher_name = teacher_row.value if teacher_row and teacher_row.value else "崔老师"

    card_path = get_or_generate_card_path(
        quote=quote,
        date_str=today_str,
        teacher_name=teacher_name,
        theme=resolved_theme,
        force=force,
    )
    return FileResponse(card_path, media_type="image/png", filename=f"daily_quote_{today_str}_{resolved_theme}.png")



# ---------- 系统配置持久化（称呼、学期、作息等） ----------
# 显式白名单：杜绝使用关键词黑名单带来的漏过滤隐患，绝不向前端暴露任何 AI 私钥、Token 与内部状态
ALLOWED_SETTING_KEYS = {"称呼", "学期", "periods", "notification_schedule", "greeting_theme"}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(models.AppSetting).filter(models.AppSetting.key.in_(ALLOWED_SETTING_KEYS)).all()
    res = {}
    for r in rows:
        try:
            res[r.key] = json.loads(r.value)
        except Exception:
            res[r.key] = r.value

    # 默认值保障
    if "称呼" not in res:
        res["称呼"] = "崔老师"
    if "学期" not in res:
        res["学期"] = ""
    return res


@router.post("/settings")
def update_settings(payload: dict, db: Session = Depends(get_db)):
    for k, v in payload.items():
        # 仅允许写入白名单内的业务配置，彻底封死通过该接口篡改 ai_base_url 发起 SSRF 的可能
        if k not in ALLOWED_SETTING_KEYS:
            continue
        val = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
        row = db.query(models.AppSetting).filter(models.AppSetting.key == k).first()
        if not row:
            row = models.AppSetting(key=k, value=val)
            db.add(row)
        else:
            row.value = val
    db.commit()
    return {"ok": True}

