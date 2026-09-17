"""通用 CRUD + 报表查询接口。

- 通用 CRUD：为 10 张表各生成 列表/详情/新建/更新/删除 五个标准端点。
- 报表接口：把 scoring 层的纯函数包装成 REST，供前端直接消费。
"""

import datetime
import json
import os
import urllib.parse

from typing import Any
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
    if hasattr(row, "client_id"):
        d["client_id"] = getattr(row, "client_id", "") or ""
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
    if hasattr(row, "client_id") and "client_id" in payload:
        setattr(row, "client_id", "" if payload["client_id"] is None else str(payload["client_id"]))


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
    q = db.query(models.Student).filter(models.Student.name == student_name)
    if klass:
        stu_in_class = q.filter(models.Student.class_name == klass).first()
        if stu_in_class and stu_in_class.student_id:
            return stu_in_class.student_id
    stu = q.first()
    return stu.student_id if (stu and stu.student_id) else ""


def _clean_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if hasattr(v, "default"):
        return str(v.default or "").strip()
    return str(v).strip()


def _resolve_class_info(db: Session, class_id: Any = None, class_name: Any = None) -> tuple[str, str]:
    """根据 class_id 或 class_name 解析出 (class_id, class_name)。若均为空，默认返回首个班级。"""
    c_id = _clean_str(class_id)
    c_name = _clean_str(class_name)

    # 1. 优先根据 class_id 查询
    if c_id:
        ce = db.query(models.ClassEntity).filter(models.ClassEntity.class_id == c_id).first()
        if ce:
            return ce.class_id, ce.name
        ce_by_name = db.query(models.ClassEntity).filter(models.ClassEntity.name == c_id).first()
        if ce_by_name:
            return ce_by_name.class_id, ce_by_name.name

    # 2. 其次根据 class_name 查询
    if c_name:
        ce = db.query(models.ClassEntity).filter(models.ClassEntity.name == c_name).first()
        if ce:
            return ce.class_id, ce.name
        ce_by_id = db.query(models.ClassEntity).filter(models.ClassEntity.class_id == c_name).first()
        if ce_by_id:
            return ce_by_id.class_id, ce_by_id.name

    # 3. 均未传入或查无结果时，兜底取第一班
    first_cls = db.query(models.ClassEntity).order_by(models.ClassEntity.seq.asc(), models.ClassEntity.id.asc()).first()
    if first_cls:
        return first_cls.class_id, first_cls.name
    return "", ""


def _cascade_student_updates(
    db: Session,
    student_row: models.Student,
    old_name: str,
    new_name: str,
    old_class: str,
    new_class: str,
    old_class_id: str = None,
    new_class_id: str = None,
):
    """学生改名或转班时，级联同步 6 张关联子表（成绩、表现、考勤、家长、沟通、值日）"""
    sid = getattr(student_row, "student_id", "") or ""
    resolved_cid, _ = _resolve_class_info(db, class_id=new_class_id, class_name=new_class)
    for t_name in RELATED_STUDENT_TABLES:
        M = models.MODELS[t_name]
        # 1. 改名级联
        if old_name and new_name and old_name != new_name:
            if sid:
                cond = or_(M.student_id == sid, M.student_name == old_name)
            else:
                cond = (M.student_name == old_name)
            rows = db.query(M).filter(cond).all()
            for r in rows:
                r.student_name = new_name
                if sid and not getattr(r, "student_id", None):
                    r.student_id = sid

        # 2. 班级变更级联（针对含班级字段的表，如 academic, behavior）
        class_changed = (old_class and new_class and old_class != new_class) or (old_class_id and new_class_id and old_class_id != new_class_id)
        if class_changed:
            curr_name = new_name or old_name
            if sid:
                cond = or_(M.student_id == sid, M.student_name == curr_name)
            else:
                cond = (M.student_name == curr_name)
            rows = db.query(M).filter(cond).all()
            for r in rows:
                if hasattr(r, "class_name") and new_class:
                    r.class_name = new_class
                if hasattr(r, "class_id") and resolved_cid:
                    r.class_id = resolved_cid
                if sid and not getattr(r, "student_id", None):
                    r.student_id = sid


def _find_natural_dup(db: Session, table: str, payload: dict):
    """按 NATURAL_KEY 查重，查到返回已存在的行（补交不重复写）。"""
    keys = enums.NATURAL_KEY.get(table)
    if not keys:
        return None
    temp_payload = dict(payload)
    # 如果自然键包含 student_id 但传入未带，且带有 student_name/学生 姓名，则自动补齐 student_id 后查重
    stu_name = temp_payload.get("student_name") or temp_payload.get("学生")
    cls_name = temp_payload.get("class_name") or temp_payload.get("班级")
    if "student_id" in keys and not temp_payload.get("student_id") and stu_name:
        temp_payload["student_id"] = _lookup_student_id(db, stu_name, cls_name)

    q = db.query(_model(table))
    for k in keys:
        q = q.filter(getattr(_model(table), k) == temp_payload.get(k, ""))
    return q.first()


def active_roster(db: Session, klass: str) -> list[dict]:
    """当前班在册学生（不含已离班），按学号数值序。
    klass 支持 class_id（如 CLS0001）或 class_name（如 八3班）
    """
    if not klass:
        return []
    rows = db.query(models.Student).filter(
        or_(models.Student.class_id == klass, models.Student.class_name == klass)
    ).all()
    out = [r for r in rows if not text_startswith(r.tags, scoring.LEFT_MARK)]
    out.sort(key=lambda s: _num(s.student_no))
    return [_to_dict(s, "students") for s in out]


def _num(v) -> float:
    n = scoring._to_num(v)
    return n if n is not None else float("inf")


def text_startswith(v, prefix: str) -> bool:
    return scoring.text_of(v).startswith(prefix)


# ---------- 班级列表 ----------
@router.get("/classes")
def get_classes(db: Session = Depends(get_db)):
    """获取所有在册班级列表（包含 class_id, name, grade, seq, sort_order，极速轻量）。"""
    rows = db.query(models.ClassEntity).order_by(models.ClassEntity.seq.asc(), models.ClassEntity.id.asc()).all()
    if not rows:
        sch_classes = [
            r[0] for r in db.query(models.Schedule.class_name).filter(models.Schedule.class_name != "").distinct().all()
        ]
        stu_classes = [
            r[0] for r in db.query(models.Student.class_name).filter(models.Student.class_name != "").distinct().all()
        ]
        classes = sorted(list(set(sch_classes) | set(stu_classes)))
        return [{"id": i + 1, "class_id": f"CLS{i+1:04d}", "name": c, "grade": "", "seq": i + 1, "sort_order": i + 1} for i, c in enumerate(classes)]
    return [
        {
            "id": r.id,
            "class_id": r.class_id,
            "name": r.name,
            "grade": r.grade or "",
            "seq": r.seq or 0,
            "sort_order": r.seq or 0,
        }
        for r in rows
    ]


# ---------- 表结构说明 ----------
@router.get("/tables")
def list_tables():
    return {
        table: {"columns": cols, "natural_key": enums.NATURAL_KEY.get(table)}
        for table, cols in enums.TABLE_COLUMNS.items()
    }


def _sync_class_fields(db: Session, row: Any):
    """自动双向补齐模型的 class_id 与 class_name"""
    has_cid = hasattr(row, "class_id")
    has_cname = hasattr(row, "class_name")
    if not (has_cid and has_cname):
        return
    curr_cid = getattr(row, "class_id", None) or ""
    curr_cname = getattr(row, "class_name", None) or ""
    if curr_cid and not curr_cname:
        _, resolved_name = _resolve_class_info(db, class_id=curr_cid)
        if resolved_name:
            setattr(row, "class_name", resolved_name)
    elif curr_cname and not curr_cid:
        resolved_id, _ = _resolve_class_info(db, class_name=curr_cname)
        if resolved_id:
            setattr(row, "class_id", resolved_id)


def _clean_payload(table: str, payload: dict) -> dict:
    """自动将历史中文键名转为规范英文键名，并丢弃转换前的冗余中文键，提供极强容错与向后兼容性"""
    if not isinstance(payload, dict):
        return payload
    alias_map = enums.COLUMN_ALIASES.get(table, {})
    cleaned = {}
    for k, v in payload.items():
        if k in alias_map:
            norm_k = alias_map[k]
            # 如果英文键尚未传入或为空，使用中文键的值回填
            if norm_k not in cleaned or not cleaned[norm_k]:
                cleaned[norm_k] = v
        else:
            cleaned[k] = v
    return cleaned


# ---------- 通用 CRUD（程序化注册） ----------
def _register_crud(table: str):
    Model = _model(table)
    cols = _cols(table)
    valid_keys = set(cols) | {"id", "student_id", "client_id", "class_id"}

    def list_rows(
        request: Request,
        page: int = Query(default=1, ge=1, description="页码"),
        page_size: int = Query(default=20, ge=1, le=1000, description="每页条数"),
        db: Session = Depends(get_db),
    ):
        q = db.query(Model)
        for c in cols:
            val = request.query_params.get(c)
            if val is not None and val != "":
                q = q.filter(getattr(Model, c) == val)
            gte_val = request.query_params.get(f"{c}_gte")
            if gte_val is not None and gte_val != "":
                q = q.filter(getattr(Model, c) >= gte_val)
            lte_val = request.query_params.get(f"{c}_lte")
            if lte_val is not None and lte_val != "":
                q = q.filter(getattr(Model, c) <= lte_val)
            like_val = request.query_params.get(f"{c}_like")
            if like_val is not None and like_val != "":
                q = q.filter(getattr(Model, c).contains(like_val))
            ne_val = request.query_params.get(f"{c}_ne")
            if ne_val is not None and ne_val != "":
                q = q.filter(getattr(Model, c) != ne_val)
        if hasattr(Model, "class_id"):
            cls_id_val = request.query_params.get("class_id")
            if cls_id_val is not None and cls_id_val != "":
                q = q.filter(Model.class_id == cls_id_val)
        if hasattr(Model, "student_id"):
            sid_val = request.query_params.get("student_id")
            if sid_val is not None:
                q = q.filter(Model.student_id == sid_val)
        if hasattr(Model, "client_id"):
            cid_val = request.query_params.get("client_id")
            if cid_val is not None:
                q = q.filter(Model.client_id == cid_val)
        kw = request.query_params.get("q")
        if kw:
            search_cols = list(cols)
            if hasattr(Model, "student_id"):
                search_cols.append("student_id")
            if hasattr(Model, "class_id"):
                search_cols.append("class_id")
            q = q.filter(or_(*[getattr(Model, c).contains(kw) for c in search_cols]))

        total = q.count()
        # 学生表按学号/id正序，其余流水表按id倒序排列最新记录
        if table in ["students", "schedule", "items", "classes"]:
            q = q.order_by(Model.id.asc())
        else:
            q = q.order_by(Model.id.desc())

        rows = q.offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [_to_dict(r, table) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def get_row(row_id: int, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        return _to_dict(row, table)

    def create_row(payload: dict, db: Session = Depends(get_db)):
        payload = _clean_payload(table, payload)
        unknown = [k for k in payload if k not in valid_keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")

        # 1. client_id 幂等拦截（防止前端弱网连击重复录入）
        cid = payload.get("client_id")
        if cid and hasattr(Model, "client_id"):
            existing_cid = db.query(Model).filter(Model.client_id == cid).first()
            if existing_cid:
                return _to_dict(existing_cid, table)

        # 2. 自然键查重
        existing = _find_natural_dup(db, table, payload)
        if existing:
            if table == "lesson_log":
                try:
                    _apply(existing, payload, table)
                    _sync_class_fields(db, existing)
                    db.commit()
                    db.refresh(existing)
                except Exception:
                    db.rollback()
                    raise
            return _to_dict(existing, table)

        row = Model()
        _apply(row, payload, table)
        _sync_class_fields(db, row)
        if table == "students":
            if not getattr(row, "student_id", None):
                row.student_id = _next_student_ids(db, 1)[0]
        elif table in RELATED_STUDENT_TABLES:
            # 双向补齐 student_id 与姓名
            s_name = getattr(row, "student_name", None) or getattr(row, "学生", None)
            c_name = getattr(row, "class_name", None) or getattr(row, "班级", None)
            if not getattr(row, "student_id", None) and s_name:
                row.student_id = _lookup_student_id(db, s_name, c_name)
            elif getattr(row, "student_id", None) and not s_name:
                stu = db.query(models.Student).filter(models.Student.student_id == row.student_id).first()
                if stu:
                    row.student_name = stu.name
                    if not c_name and hasattr(row, "class_name"):
                        row.class_name = stu.class_name
                        row.class_id = stu.class_id

        try:
            db.add(row)
            db.commit()
            db.refresh(row)
            return _to_dict(row, table)
        except Exception:
            db.rollback()
            raise

    def update_row(row_id: int, payload: dict, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        payload = _clean_payload(table, payload)
        unknown = [k for k in payload if k not in valid_keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        old_name = getattr(row, "name", None)
        old_class = getattr(row, "class_name", None)
        old_class_id = getattr(row, "class_id", None)
        _apply(row, payload, table)
        _sync_class_fields(db, row)
        if table == "students":
            new_name = getattr(row, "name", None)
            new_class = getattr(row, "class_name", None)
            new_class_id = getattr(row, "class_id", None)
            if (old_name and new_name and old_name != new_name) or (old_class and new_class and old_class != new_class) or (old_class_id and new_class_id and old_class_id != new_class_id):
                _cascade_student_updates(db, row, old_name, new_name, old_class, new_class, old_class_id, new_class_id)
        try:
            db.commit()
            db.refresh(row)
            return _to_dict(row, table)
        except Exception:
            db.rollback()
            raise

    def delete_row(row_id: int, db: Session = Depends(get_db)):
        row = db.get(Model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        try:
            db.delete(row)
            db.commit()
            return {"ok": True}
        except Exception:
            db.rollback()
            raise

    def batch_delete(payload: dict, db: Session = Depends(get_db)):
        """批量删除：payload = {"ids": [1,2,3]}"""
        ids = payload.get("ids") or []
        if not ids:
            raise HTTPException(status_code=422, detail="ids 不能为空")
        rows = db.query(Model).filter(Model.id.in_(ids)).all()
        try:
            for r in rows:
                db.delete(r)
            db.commit()
            return {"ok": True, "deleted": len(rows)}
        except Exception:
            db.rollback()
            raise

    def batch_update(payload: dict, db: Session = Depends(get_db)):
        """批量修改：payload = {"ids": [1,2,3], "updates": {"class_name": "八10班"}}"""
        ids = payload.get("ids") or []
        updates = _clean_payload(table, payload.get("updates") or {})
        if not ids or not updates:
            raise HTTPException(status_code=422, detail="ids 和 updates 不能为空")
        unknown = [k for k in updates if k not in valid_keys]
        if unknown:
            raise HTTPException(status_code=422, detail=f"非法字段: {unknown}")
        rows = db.query(Model).filter(Model.id.in_(ids)).all()
        try:
            for r in rows:
                old_name = getattr(r, "name", None)
                old_class = getattr(r, "class_name", None)
                old_class_id = getattr(r, "class_id", None)
                _apply(r, updates, table)
                _sync_class_fields(db, r)
                if table == "students":
                    new_name = getattr(r, "name", None)
                    new_class = getattr(r, "class_name", None)
                    new_class_id = getattr(r, "class_id", None)
                    if (old_name and new_name and old_name != new_name) or (old_class and new_class and old_class != new_class) or (old_class_id and new_class_id and old_class_id != new_class_id):
                        _cascade_student_updates(db, r, old_name, new_name, old_class, new_class, old_class_id, new_class_id)
            db.commit()
            return {"ok": True, "updated": len(rows)}
        except Exception:
            db.rollback()
            raise

    def batch_create(payload: dict, db: Session = Depends(get_db)):
        """批量新增：payload = {"rows": [{...}, {...}]}"""
        records = payload.get("rows") or []
        if not records:
            raise HTTPException(status_code=422, detail="rows 不能为空")
        records = [_clean_payload(table, r) for r in records]
        added = []
        try:
            if table == "students":
                next_ids = _next_student_ids(db, len(records))
                for i, rec in enumerate(records):
                    row = Model()
                    _apply(row, rec, table)
                    _sync_class_fields(db, row)
                    if not getattr(row, "student_id", None):
                        row.student_id = next_ids[i]
                    db.add(row)
                    added.append(row)
            else:
                for rec in records:
                    # 检查单个 client_id 幂等防重
                    cid = rec.get("client_id")
                    if cid and hasattr(Model, "client_id"):
                        if db.query(Model).filter(Model.client_id == cid).first():
                            continue
                    row = Model()
                    _apply(row, rec, table)
                    _sync_class_fields(db, row)
                    s_name = getattr(row, "student_name", None) or getattr(row, "学生", None)
                    c_name = getattr(row, "class_name", None) or getattr(row, "班级", None)
                    if table in RELATED_STUDENT_TABLES and not getattr(row, "student_id", None) and s_name:
                        row.student_id = _lookup_student_id(db, s_name, c_name)
                    db.add(row)
                    added.append(row)
            db.commit()
            return {"ok": True, "created": len(added)}
        except Exception:
            db.rollback()
            raise

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
    today: str = Query(default="", description="今天日期 YYYY-MM-DD，用于本周表现统计"),
    class_id: str = Query(default="", description="班级 ID，如 CLS0001"),
    class_name: str = Query(default="", description="要统计的班级名称，空则取第一个班"),
):
    cid, klass = _resolve_class_info(db, class_id=class_id, class_name=class_name)
    roster = active_roster(db, cid or klass)

    # SQL 下沉：仅查询对应班级的成绩与表现，大幅降低内存与数据库开销
    acad_q = db.query(models.Academic)
    behav_q = db.query(models.Behavior)
    if cid or klass:
        acad_q = acad_q.filter(or_(models.Academic.class_id == cid, models.Academic.class_name == klass))
        behav_q = behav_q.filter(or_(models.Behavior.class_id == cid, models.Behavior.class_name == klass))

    o = {
        "items": _rows(db, "items"),
        "academic": [_to_dict(r, "academic") for r in acad_q.all()],
        "behavior": [_to_dict(r, "behavior") for r in behav_q.all()],
        "attendance": _rows(db, "attendance"),
        "roster": roster,
        "today": today,
        "今天": today,
    }
    return {"class_id": cid, "class_name": klass, "班级": klass, **scoring.summary_overview(o)}


@router.get("/report/exam/{item_name}")
def report_exam(
    item_name: str,
    db: Session = Depends(get_db),
    class_id: str = Query(default=""),
    class_name: str = Query(default=""),
    you: float = Query(default=85, alias="优"),
    ji: float = Query(default=60, alias="及"),
    di: float = Query(default=40, alias="低"),
):
    items = _rows(db, "items")
    item = next((it for it in items if scoring.text_of(it.get("item_name") or it.get("项目名")) == item_name), None)
    if not item:
        raise HTTPException(status_code=404, detail=f"项目不存在: {item_name}")
    cid, klass = _resolve_class_info(db, class_id=class_id, class_name=class_name)
    roster = active_roster(db, cid or klass)

    acad_q = db.query(models.Academic)
    if cid or klass:
        acad_q = acad_q.filter(or_(models.Academic.class_id == cid, models.Academic.class_name == klass))
    records = [_to_dict(r, "academic") for r in acad_q.all()]

    stats = scoring.report_stats(item, records, roster, {"优": you, "及": ji, "低": di})
    prev = scoring.prev_exam(items, records, roster, item_name)
    prev_stats = None
    if prev:
        prev_item = next((it for it in items if scoring.text_of(it.get("item_name") or it.get("项目名")) == prev), None)
        if prev_item:
            prev_snap = scoring.latest_valid_scores(prev_item, records, roster)
            cur_snap = stats["snapshot"]
            deltas = scoring.delta_scores(cur_snap, prev_snap)
            prev_stats = {
                "item_name": prev,
                "stats": scoring.report_stats(prev_item, records, roster),
                "deltas": scoring.delta_overview(deltas),
                "ranks": scoring.rank_scores([{"name": w, "score": stats["snapshot"]["by_student"][w]["score"]} for w in stats["snapshot"]["by_student"]]),
            }
    return {"class_id": cid, "class_name": klass, "item_name": item_name, "stats": stats, "previous_exam": prev_stats}


@router.get("/report/matrix")
def report_matrix(
    db: Session = Depends(get_db),
    class_id: str = Query(default=""),
    class_name: str = Query(default=""),
    item_name: str = Query(default=""),
    date_from: str = Query(default=""),
):
    cid, klass = _resolve_class_info(db, class_id=class_id, class_name=class_name)
    roster = active_roster(db, cid or klass)
    opts = {}
    if item_name:
        opts["item_name"] = item_name
    if date_from:
        opts["date_from"] = date_from

    acad_q = db.query(models.Academic)
    if cid or klass:
        acad_q = acad_q.filter(or_(models.Academic.class_id == cid, models.Academic.class_name == klass))
    if item_name:
        acad_q = acad_q.filter(models.Academic.item_name == item_name)
    if date_from:
        acad_q = acad_q.filter(models.Academic.date >= date_from)
    matrix_records = [_to_dict(r, "academic") for r in acad_q.all()]

    return scoring.build_matrix(roster, matrix_records, _rows(db, "items"), opts)


@router.post("/academic/batch-upsert")
def batch_upsert_academic(
    payload: dict,
    db: Session = Depends(get_db),
):
    """批量录入/更新考试成绩（以 (class_name, item_name, date, student_id/student_name) 幂等查重入库）。
    如果项目名在 items 表中不存在，自动创建（full_score/subject 等取 payload 中的值或默认值）。
    """
    cid_input = (payload.get("class_id") or "").strip()
    cname_input = (payload.get("class_name") or payload.get("班级") or "").strip()
    cid, klass = _resolve_class_info(db, class_id=cid_input, class_name=cname_input)
    item_name = (payload.get("item_name") or payload.get("项目") or "").strip()
    exam_date = (payload.get("date") or payload.get("日期") or "").strip()
    records = payload.get("records") or []

    if not klass or not item_name or not exam_date:
        raise HTTPException(status_code=422, detail="class_id/class_name、item_name 和 date 不能为空")

    try:
        # 自动创建项目（如果不存在）
        ItemModel = _model("items")
        existing_item = db.query(ItemModel).filter(ItemModel.item_name == item_name).first()
        item_created = False
        if not existing_item:
            new_item = ItemModel(
                item_name=item_name,
                item_type="学业",
                scoring_type="分数",
                full_score=str(payload.get("full_score") or payload.get("满分") or 100),
                category=str(payload.get("category") or payload.get("类别") or "单元"),
                subject=str(payload.get("subject") or payload.get("学科") or "地理"),
                cycle="学期",
                weight="1",
            )
            db.add(new_item)
            db.flush()
            item_created = True

        AcademicModel = _model("academic")
        updated_count = 0
        created_count = 0

        for r in records:
            stu = str(r.get("student_name") or r.get("学生") or "").strip()
            val = str(r.get("score") or r.get("结果") or "").strip()
            status = str(r.get("status") or r.get("状态") or "完成").strip()
            note = str(r.get("notes") or r.get("备注") or "").strip()
            client_id = str(r.get("client_id") or "").strip()
            if not stu:
                continue

            sid = _lookup_student_id(db, stu, klass)
            # 优先根据 (class_name, item_name, date, student_id) 查重，无 student_id 时按姓名
            q_exist = db.query(AcademicModel).filter(
                or_(AcademicModel.class_id == cid, AcademicModel.class_name == klass),
                AcademicModel.item_name == item_name,
                AcademicModel.date == exam_date,
            )
            if sid:
                existing = q_exist.filter(or_(AcademicModel.student_id == sid, AcademicModel.student_name == stu)).first()
            else:
                existing = q_exist.filter(AcademicModel.student_name == stu).first()

            if existing:
                existing.score = val
                existing.status = status
                existing.notes = note
                if cid and not getattr(existing, "class_id", None):
                    existing.class_id = cid
                if sid and not getattr(existing, "student_id", None):
                    existing.student_id = sid
                if client_id:
                    existing.client_id = client_id
                updated_count += 1
            else:
                row = AcademicModel(
                    student_id=sid,
                    client_id=client_id,
                    class_id=cid,
                    class_name=klass,
                    item_name=item_name,
                    date=exam_date,
                    student_name=stu,
                    score=val,
                    status=status,
                    notes=note,
                )
                db.add(row)
                created_count += 1

        db.commit()
        return {
            "ok": True,
            "class_id": cid,
            "class_name": klass,
            "item_name": item_name,
            "date": exam_date,
            "created": created_count,
            "updated": updated_count,
            "total_saved": created_count + updated_count,
            "item_created": item_created,
        }
    except Exception:
        db.rollback()
        raise


@router.get("/report/items-summary")
def report_items_summary(
    db: Session = Depends(get_db),
    class_id: str = Query(default=""),
    class_name: str = Query(default=""),
):
    """每个项目的汇总（按计分制分叉），供「汇总」页直接消费。"""
    cid, klass = _resolve_class_info(db, class_id=class_id, class_name=class_name)
    roster = active_roster(db, cid or klass)
    items = _rows(db, "items")
    academic = _rows(db, "academic")
    out = []
    for it in items:
        if scoring.item_disabled(it):
            continue
        agg = scoring.aggregate_item(it, academic, roster)
        agg["scoring_type"] = scoring.score_kind(it)
        agg["计分制"] = scoring.score_kind(it)
        agg["item_type"] = scoring.text_of(it.get("item_type") or it.get("类型"))
        agg["subject"] = scoring.text_of(it.get("subject") or it.get("学科"))
        out.append(agg)
    return {"class_id": cid, "class_name": klass, "班级": klass, "items_summary": out, "项目汇总": out}


@router.get("/report/behavior-week")
def report_behavior_week(
    db: Session = Depends(get_db),
    class_id: str = Query(default=""),
    class_name: str = Query(default=""),
    weekStart: str = Query(default=""),
    subtotal: bool = Query(default=False, alias="按小计"),
):
    cid, klass = _resolve_class_info(db, class_id=class_id, class_name=class_name)
    roster = active_roster(db, cid or klass)
    records = _rows(db, "behavior")
    table = scoring.weekly_behavior_overview(records, roster, weekStart)
    return {"class_id": cid, "class_name": klass, "week_table": table, "周表": table}


@router.get("/report/contact-book")
def report_contact_book(
    db: Session = Depends(get_db),
    class_id: str = Query(default=""),
    class_name: str = Query(default=""),
    keyword: str = Query(default=""),
):
    cid, klass = _resolve_class_info(db, class_id=class_id, class_name=class_name)
    roster = active_roster(db, cid or klass)
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
    klass = (payload.get("class_name") or payload.get("班级") or (students[0]["class_name"] if students and "class_name" in students[0] else ""))
    roster = active_roster(db, klass)
    text_content = payload.get("text") or payload.get("文本") or ""
    return scoring.parent_import_plan(text_content, roster, _rows(db, "parents"))


@router.post("/import/students")
def import_students(payload: dict, db: Session = Depends(get_db)):
    """学生 CSV 批量导入。
    - CSV 首行为表头，兼容英文与中文表头：class_name/name/student_no/group_name/tags 或 班级/姓名/学号/小组/标签。
    - 自然键 (class_name, name) 去重。
    """
    import csv
    import io

    csv_text = (payload.get("csv") or "").strip()
    if not csv_text:
        raise HTTPException(status_code=422, detail="CSV 内容为空")

    students = _rows(db, "students")
    default_klass = payload.get("class_name") or payload.get("班级") or (students[0]["class_name"] if students and "class_name" in students[0] else "")
    if not default_klass:
        raise HTTPException(status_code=422, detail="请指定班级")

    # 去 BOM；全角逗号转半角
    if csv_text.startswith("\ufeff"):
        csv_text = csv_text[1:]
    csv_text = csv_text.replace("，", ",")

    rows = list(csv.reader(io.StringIO(csv_text)))
    rows = [r for r in rows if any((c or "").strip() for c in r)]
    if not rows:
        raise HTTPException(status_code=422, detail="CSV 无有效数据行")

    alias = {
        "班级": "class_name", "class": "class_name", "class_name": "class_name",
        "姓名": "name", "name": "name",
        "学号": "student_no", "number": "student_no", "no": "student_no", "student_no": "student_no",
        "小组": "group_name", "group": "group_name", "group_name": "group_name",
        "标签": "tags", "tag": "tags", "tags": "tags",
    }
    header = [(c or "").strip() for c in rows[0]]
    mapped = [alias.get(h.lower()) for h in header]

    has_header = any(m is not None for m in mapped)
    if has_header:
        data_rows = rows[1:]
    else:
        mapped = ["name"] + ["student_no"] * (len(header) - 1)
        data_rows = rows

    added, skipped_dup, skipped_bad = [], [], []
    for i, r in enumerate(data_rows, start=2):
        rec = {"class_name": default_klass, "name": "", "student_no": "", "group_name": "", "tags": ""}
        for j, col in enumerate(mapped):
            if col and j < len(r):
                rec[col] = (r[j] or "").strip()
        name = rec["name"]
        if not name:
            skipped_bad.append({"row": i, "reason": "姓名为空"})
            continue
        if _find_natural_dup(db, "students", rec):
            skipped_dup.append({"name": name, "class_name": rec["class_name"]})
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
        "class_name": default_klass,
        "班级": default_klass,
        "added": added,
        "新增": added,
        "skipped_dup": skipped_dup,
        "已存在跳过": skipped_dup,
        "skipped_bad": skipped_bad,
        "无效行": skipped_bad,
        "stats": {
            "total_rows": len(data_rows),
            "added_count": len(added),
            "dup_count": len(skipped_dup),
            "bad_count": len(skipped_bad),
        },
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

