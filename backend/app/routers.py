"""通用 CRUD + 报表查询接口。

- 通用 CRUD：为 10 张表各生成 列表/详情/新建/更新/删除 五个标准端点。
- 报表接口：把 scoring 层的纯函数包装成 REST，供前端直接消费。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import enums, models, scoring
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
        # 通用模糊搜索：?q=关键字 在所有列上做 OR 匹配（如学生表可同时搜姓名/学号）
        kw = request.query_params.get("q")
        if kw:
            q = q.filter(or_(*[getattr(Model, c).contains(kw) for c in cols]))
        return [_to_dict(r, table) for r in q.order_by(Model.id).all()]

    def get_row(row_id: int, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        return _to_dict(row, table)

    def create_row(payload: dict, db: Session = Depends(get_db)):
        unknown = [k for k in payload if k not in cols]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        existing = _find_natural_dup(db, table, payload)
        if existing:
            return _to_dict(existing, table)
        row = Model()
        _apply(row, payload, table)
        db.add(row)
        db.commit()
        db.refresh(row)
        return _to_dict(row, table)

    def update_row(row_id: int, payload: dict, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        unknown = [k for k in payload if k not in cols]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        _apply(row, payload, table)
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

    router.add_api_route(f"/tables/{table}", list_rows, methods=["GET"], name=f"list_{table}")
    router.add_api_route(f"/tables/{table}/{{row_id}}", get_row, methods=["GET"], name=f"get_{table}")
    router.add_api_route(f"/tables/{table}", create_row, methods=["POST"], name=f"create_{table}")
    router.add_api_route(f"/tables/{table}/{{row_id}}", update_row, methods=["PUT"], name=f"update_{table}")
    router.add_api_route(f"/tables/{table}/{{row_id}}", delete_row, methods=["DELETE"], name=f"delete_{table}")
    router.add_api_route(f"/tables/{table}/batch-delete", batch_delete, methods=["POST"], name=f"batch_delete_{table}")


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
