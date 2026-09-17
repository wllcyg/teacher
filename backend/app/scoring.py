"""计分 / 汇总 / 报表纯函数（全链路支持英文属性与中文向前兼容）。
"""

import re
from datetime import date, datetime, timedelta

from .enums import SCORE_BANDS

DEFAULT_REPORT_THRESHOLDS = {"优": 85, "及": 60, "低": 40}
DISABLED_MARK = "已停用"
LEFT_MARK = "（系统）已离班"

_NUM_RE = re.compile(r"^(?:\d+(?:\.\d*)?|\.\d+)$")


# ---------- 基础工具 ----------
def text_of(v) -> str:
    if v is None:
        return ""
    return str(v).strip()


def fld(d, *keys):
    """安全从字典中提取多个候选 key 中的首个有效值（支持英文优先与中文兜底）。"""
    if not isinstance(d, dict):
        return ""
    for k in keys:
        if k in d and d[k] is not None and d[k] != "":
            return d[k]
    return ""


def round1(n) -> float:
    return round(n * 10) / 10


def pad2(n) -> str:
    return ("0" + str(n)) if n < 10 else str(n)


def _to_num(v):
    """把字符串/数值安全转成 float；非法返回 None。"""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = text_of(v)
    if s and _NUM_RE.match(s):
        return float(s)
    return None


# ---------- 计分制判定 ----------
def score_kind(item) -> str:
    """项目按计分制归类：分数 / 等第 / 过关 / 打钩 / 加减分（认不出的一律当打钩）。"""
    raw = fld(item, "scoring_type", "计分制") if isinstance(item, dict) else item
    s = text_of(raw)
    if "分数" in s:
        return "分数"
    if "等第" in s:
        return "等第"
    if "过关" in s:
        return "过关"
    if "加减" in s:
        return "加减分"
    return "打钩"


def validate_item_combination(type_, kind):
    """项目类型和计分制必须对得上。"""
    t = text_of(type_)
    k = text_of(kind)
    if t == "表现" and k != "加减分":
        return {"ok": False, "error": "表现项目只能用「加减分」，请改一下「怎么记」。"}
    if t == "学业" and k == "加减分":
        return {"ok": False, "error": "学业项目不能用「加减分」，请选打钩、过关、等第或分数。"}
    return {"ok": True, "error": ""}


# ---------- 满分 / 成绩解析 ----------
def exam_full_score(item_or_full) -> float:
    """考试满分：满分缺失/非法回落 100。"""
    raw = fld(item_or_full, "full_score", "满分") if isinstance(item_or_full, dict) else item_or_full
    full = _to_num(raw)
    return full if (full is not None and full > 0) else 100.0


def parse_exam_score(raw, item_or_full):
    """成绩只认有限的 0..满分，非法返回 None。"""
    if isinstance(raw, bool) or raw is None:
        return None
    score = _to_num(raw)
    full = exam_full_score(item_or_full)
    if score is None or not (0 <= score <= full):
        return None
    return score


def pass_line(item) -> float:
    """及格线＝满分的六成；满分没填就按 100 分算。"""
    return round1(exam_full_score(item) * 0.6)


def result_to_status(item, result) -> str:
    """过关类记「未过」，状态自动落成待补测；其余都是完成。"""
    if score_kind(item) == "过关" and text_of(result) == "未过":
        return "待补测"
    return "完成"


# ---------- 学业记录 ----------
def build_academic_record(o):
    item = o.get("item") or {}
    item_n = fld(item, "item_name", "项目名") or fld(o, "item_name", "项目")
    res = fld(o, "score", "结果")
    st = fld(o, "status", "状态")
    return {
        "date": text_of(fld(o, "date", "日期")),
        "class_name": text_of(fld(o, "class_name", "班级")),
        "student_name": text_of(fld(o, "student_name", "学生")),
        "item_name": text_of(item_n),
        "score": res,
        "status": text_of(st) or result_to_status(item, res),
        "notes": text_of(fld(o, "notes", "备注")),
    }


def retest_pass(rec):
    """补测通过销项：结果转过关、状态转完成，备注保留。"""
    out = dict(rec)
    if "score" in out:
        out["score"] = "过关"
    if "结果" in out:
        out["结果"] = "过关"
    if "status" in out:
        out["status"] = "完成"
    if "状态" in out:
        out["状态"] = "完成"
    return out


def pending_retests(rows, klass=None, active_student_names=None):
    """待补测清单（可按班级筛），按日期从早到晚。"""
    has_roster = active_student_names is not None
    out = [
        r for r in (rows or [])
        if text_of(fld(r, "status", "状态")) == "待补测"
        and (not klass or text_of(fld(r, "class_name", "班级")) == klass)
        and (not has_roster or text_of(fld(r, "student_name", "学生")) in active_student_names)
    ]
    out.sort(key=lambda r: text_of(fld(r, "date", "日期")))
    return out


# ---------- 最新有效分（一次考试每个学生取最晚那条有效记录） ----------
def latest_valid_scores(item, records, roster):
    name = text_of(fld(item, "item_name", "项目名") if isinstance(item, dict) else item)
    names = [text_of(fld(s, "name", "姓名")) for s in (roster or []) if text_of(fld(s, "name", "姓名"))]
    full = exam_full_score(item)

    latest_rows = {}
    for r in (records or []):
        who = text_of(fld(r, "student_name", "学生"))
        d = text_of(fld(r, "date", "日期"))
        item_n = text_of(fld(r, "item_name", "项目"))
        if item_n != name or who not in names:
            continue
        if who not in latest_rows or d >= latest_rows[who]["date"]:
            latest_rows[who] = {"row": r, "date": d}

    by_student = {}
    for who in names:
        picked = latest_rows.get(who)
        if not picked:
            continue
        score = parse_exam_score(fld(picked["row"], "score", "结果"), full)
        if score is None:
            continue
        by_student[who] = {"student_name": who, "学生": who, "score": score, "分": score, "date": picked["date"], "日期": picked["date"]}

    scores = [by_student[w] for w in names if w in by_student]
    latest = ""
    for row in scores:
        if row["date"] > latest:
            latest = row["date"]
    return {"名册": names, "roster": names, "成绩": scores, "scores": scores, "按学生": by_student, "by_student": by_student, "最新日期": latest, "latest_date": latest, "满分": full, "full_score": full}


# ---------- 单项目汇总（按计分制分叉） ----------
def aggregate_item(item, records, roster):
    name = text_of(fld(item, "item_name", "项目名") if isinstance(item, dict) else item)
    kind = score_kind(item)
    names = [text_of(fld(s, "name", "姓名")) for s in (roster or []) if text_of(fld(s, "name", "姓名"))]
    rows = [
        r for r in (records or [])
        if text_of(fld(r, "item_name", "项目")) == name
        and (not names or text_of(fld(r, "student_name", "学生")) in names)
    ]

    if kind == "分数":
        line = pass_line(item)
        snapshot = latest_valid_scores(item, records, roster)
        nums = [row["score"] for row in snapshot["scores"]]
        low = [row["student_name"] for row in snapshot["scores"] if row["score"] < line]
        s = sum(nums)
        return {
            "kind": "分数", "item_name": name, "项目": name, "total_count": len(nums), "人数": len(nums),
            "average": round1(s / len(nums)) if nums else 0, "平均": round1(s / len(nums)) if nums else 0,
            "max": max(nums) if nums else 0, "最高": max(nums) if nums else 0,
            "min": min(nums) if nums else 0, "最低": min(nums) if nums else 0,
            "pass_line": line, "及格线": line,
            "pass_rate": round1((len(nums) - len(low)) / len(nums) * 100) if nums else 0, "及格率": round1((len(nums) - len(low)) / len(nums) * 100) if nums else 0,
            "not_passed": low, "未及格": low,
        }

    if kind == "等第":
        dist = {}
        for r in rows:
            g = text_of(fld(r, "score", "结果")) or "未评"
            dist[g] = dist.get(g, 0) + 1
        return {"kind": "等第", "item_name": name, "项目": name, "total_count": len(rows), "人数": len(rows), "distribution": dist, "分布": dist}

    # 打钩 / 过关：完成率 + 未完成名单
    done = {}
    retest = 0
    for r in rows:
        who = text_of(fld(r, "student_name", "学生"))
        res = text_of(fld(r, "score", "结果"))
        st = text_of(fld(r, "status", "状态"))
        if kind == "过关":
            if res == "过关":
                done[who] = True
        else:
            done[who] = True
        if st == "待补测":
            retest += 1
    base = names if names else list(done.keys())
    missing = [n for n in base if n not in done]
    return {
        "kind": "完成", "item_name": name, "项目": name,
        "should_count": len(base), "应到人数": len(base),
        "done_count": len(base) - len(missing), "完成人数": len(base) - len(missing),
        "done_rate": round1((len(base) - len(missing)) / len(base) * 100) if base else 0, "完成率": round1((len(base) - len(missing)) / len(base) * 100) if base else 0,
        "missing": missing, "未完成": missing,
        "pending_retest": retest, "待补测": retest,
    }


# ---------- 星期 / 周 ----------
def week_key(date_str) -> str:
    """一周从周一起算（周日归上一周），返回那一周周一的日期当标签。"""
    try:
        d = datetime.strptime(text_of(date_str)[:10], "%Y-%m-%d").date()
    except (ValueError, IndexError):
        return ""
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def week_shift(week_start, n) -> str:
    try:
        d = datetime.strptime(text_of(week_start)[:10], "%Y-%m-%d").date()
    except (ValueError, IndexError):
        return text_of(week_start)
    d = d + timedelta(days=n * 7)
    return d.isoformat()


def week_label(week_start) -> str:
    try:
        a = datetime.strptime(text_of(week_start)[:10], "%Y-%m-%d").date()
    except (ValueError, IndexError):
        return ""
    b = a + timedelta(days=4)
    return f"{a.month}.{a.day}–{b.month}.{b.day}"


def format_iso_date(d: date) -> str:
    return f"{d.year}-{pad2(d.month)}-{pad2(d.day)}"


# ---------- 表现加减分 ----------
def behavior_total(rows, student_name=None):
    """表现总分求和（可指定单个学生）。"""
    t = 0
    for r in (rows or []):
        who = text_of(fld(r, "student_name", "学生"))
        if student_name and who != student_name:
            continue
        v = _to_num(fld(r, "score", "分值"))
        if v is not None:
            t += int(v)
    return t


def weekly_behavior_overview(rows, roster, target_week=None):
    """单周表现大盘：每个孩子净分、加分、减分、按周汇总。"""
    target = target_week or week_key(date.today().isoformat())
    names = [text_of(fld(s, "name", "姓名")) for s in (roster or []) if text_of(fld(s, "name", "姓名"))]

    by_student = {who: {"net": 0, "add": 0, "sub": 0, "净分": 0, "加分": 0, "扣分": 0} for who in names}
    for r in (rows or []):
        who = text_of(fld(r, "student_name", "学生"))
        if who not in by_student:
            continue
        wk = week_key(fld(r, "date", "日期"))
        if wk != target:
            continue
        v = _to_num(fld(r, "score", "分值")) or 0
        v = int(v)
        if v > 0:
            by_student[who]["add"] += v
            by_student[who]["加分"] += v
        elif v < 0:
            by_student[who]["sub"] += -v
            by_student[who]["扣分"] += -v
        by_student[who]["net"] += v
        by_student[who]["净分"] += v

    arr = [{"name": w, "姓名": w, **by_student[w]} for w in names]
    arr.sort(key=lambda a: (-a["net"], -a["add"]))
    return {"week": target, "周": target, "by_student": arr, "按学生": arr}


# ---------- 考试分段 / 名次 / 报表 ----------
def score_bands(scores, full=100.0):
    full = full or 100.0
    out = []
    for label, lo, hi in SCORE_BANDS:
        lo_score = round1(full * lo)
        hi_score = round1(full * hi)
        c = sum(1 for s in scores if lo_score <= s < hi_score or (hi > 1.0 and s == full))
        out.append({"label": label, "count": c, "人数": c, "rate": round1(c / len(scores) * 100) if scores else 0})
    return out


def rank_scores(pairs):
    pairs_sorted = sorted(
        pairs,
        key=lambda p: (-(p.get("score") if "score" in p else (p.get("分数") if "分数" in p else 0))),
    )
    out = {}
    last_score, last_rank = None, 0
    for idx, p in enumerate(pairs_sorted):
        sc = p.get("score") if "score" in p else p.get("分数")
        rank = (idx + 1) if (sc != last_score) else last_rank
        n = text_of(fld(p, "name", "姓名"))
        out[n] = rank
        last_score = sc
        last_rank = rank
    return out


def report_stats(item, records, roster, thresholds=None, shared_snapshot=None):
    """单场考试报表统计：优秀/及格/低分三线 + 分段 + 缺考。"""
    thresholds = thresholds or DEFAULT_REPORT_THRESHOLDS
    full = exam_full_score(item)

    def pct(key):
        v = _to_num(thresholds.get(key))
        return v if (v is not None and v == v) else float(DEFAULT_REPORT_THRESHOLDS[key])

    def line(value):
        return round1(full * value / 100)

    you_line = line(pct("优"))
    ji_line = line(pct("及"))
    di_line = line(pct("低"))

    snapshot = shared_snapshot or latest_valid_scores(item, records, roster)
    nums = [row["score"] for row in snapshot["scores"]]
    recorded = {row["student_name"]: True for row in snapshot["scores"]}
    miss = [w for w in snapshot["roster"] if w not in recorded]

    s = sum(nums)
    you_n = sum(1 for n in nums if n >= you_line)
    ji_n = sum(1 for n in nums if n >= ji_line)
    di_n = sum(1 for n in nums if n < di_line)

    def rate(n):
        return round1(n / len(nums) * 100) if nums else 0

    return {
        "should_count": len(snapshot["roster"]), "应录": len(snapshot["roster"]),
        "actual_count": len(nums), "实录": len(nums),
        "absent": miss, "缺考": miss,
        "average": round1(s / len(nums)) if nums else 0, "平均": round1(s / len(nums)) if nums else 0,
        "max": max(nums) if nums else 0, "最高": max(nums) if nums else 0,
        "min": min(nums) if nums else 0, "最低": min(nums) if nums else 0,
        "full_score": full, "满分": full,
        "you_line": you_line, "优秀线分": you_line, "ji_line": ji_line, "及格线分": ji_line, "di_line": di_line, "低分线分": di_line,
        "you_count": you_n, "优秀数": you_n, "ji_count": ji_n, "及格数": ji_n, "di_count": di_n, "低分数": di_n,
        "you_rate": rate(you_n), "优秀率": rate(you_n), "ji_rate": rate(ji_n), "及格率": rate(ji_n), "di_rate": rate(di_n), "低分率": rate(di_n),
        "bands": score_bands(nums, full), "分段": score_bands(nums, full),
        "latest_date": snapshot["latest_date"], "最新日期": snapshot["latest_date"],
        "snapshot": snapshot, "快照": snapshot,
    }


def prev_exam(items, records, roster, cur_name):
    """上一次分数类考试是哪场：当前考试没入分就当它最新。"""
    latest = {}
    for item in (items or []):
        if score_kind(item) != "分数" or text_of(fld(item, "item_type", "类型")) == "表现":
            continue
        snap = latest_valid_scores(item, records, roster)
        item_n = text_of(fld(item, "item_name", "项目名"))
        if snap["latest_date"]:
            latest[item_n] = snap["latest_date"]
    cur_date = latest.get(text_of(cur_name), "9999-99-99")
    best, best_date = "", ""
    for item in (items or []):
        n = text_of(fld(item, "item_name", "项目名"))
        if n == text_of(cur_name) or n not in latest:
            continue
        if latest[n] < cur_date and latest[n] > best_date:
            best, best_date = n, latest[n]
    return best


def delta_scores(current_snapshot, previous_snapshot):
    """进退步：这次和上次都有分的孩子，Δ=这次-上次。"""
    cur = (current_snapshot or {}).get("by_student", {})
    prev = (previous_snapshot or {}).get("by_student", {})
    return {who: cur[who]["score"] - prev[who]["score"] for who in cur if who in prev}


def delta_overview(deltas):
    """进退步概览：进步/退步/持平人数，最大进步和最大退步各挑一个。"""
    up = down = flat = 0
    max_up = max_down = None
    for who, v in (deltas or {}).items():
        if v > 0:
            up += 1
            if not max_up or v > max_up["delta"]:
                max_up = {"student_name": who, "学生": who, "delta": v, "Δ": v}
        elif v < 0:
            down += 1
            if not max_down or v < max_down["delta"]:
                max_down = {"student_name": who, "学生": who, "delta": v, "Δ": v}
        else:
            flat += 1
    return {
        "up": up, "进步": up, "down": down, "退步": down, "flat": flat, "持平": flat,
        "max_up": max_up, "最大进步": max_up, "max_down": max_down, "最大退步": max_down,
    }


def attendance_row(o):
    who = text_of(fld(o, "student_name", "学生"))
    st = text_of(fld(o, "status", "状态"))
    if not who or not st:
        return None
    if st in ("全勤", "正常"):
        return None
    return {
        "date": text_of(fld(o, "date", "日期")),
        "class_name": text_of(fld(o, "class_name", "班级")),
        "student_name": who,
        "status": st,
        "notes": text_of(fld(o, "notes", "备注")),
    }


def item_disabled(item):
    return text_of(fld(item, "category", "类别")).startswith(DISABLED_MARK)


def disable_item_row(item):
    out = dict(item)
    orig = text_of(fld(out, "category", "类别"))
    val = (DISABLED_MARK + "|" + orig) if orig else DISABLED_MARK
    if "category" in out:
        out["category"] = val
    if "类别" in out:
        out["类别"] = val
    return out


def enable_item_row(item):
    out = dict(item)
    c = text_of(fld(out, "category", "类别"))
    if c.startswith(DISABLED_MARK):
        c = c[len(DISABLED_MARK):]
        if c.startswith("|"):
            c = c[1:]
        if "category" in out:
            out["category"] = c
        if "类别" in out:
            out["类别"] = c
    return out


def item_impact(name, academic, behavior):
    n = text_of(name)
    a = sum(1 for r in (academic or []) if text_of(fld(r, "item_name", "项目")) == n)
    b = sum(1 for r in (behavior or []) if text_of(fld(r, "item_name", "项目")) == n)
    return {"academic": a, "学业": a, "behavior": b, "表现": b, "total": a + b, "总": a + b}


def parent_import_plan(text, roster, existing):
    names = [text_of(fld(s, "name", "姓名")) for s in (roster or [])]
    has_phone = {f"{text_of(fld(r, 'student_name', '学生'))}|{text_of(fld(r, 'phone', '电话'))}": 1 for r in (existing or [])}
    exist_stu = {text_of(fld(r, 'student_name', '学生')): 1 for r in (existing or [])}
    matched, outside, bad, dup, got, seen = [], [], [], [], {}, {}

    for line in (text or "").splitlines():
        l = line.strip()
        if not l:
            continue
        ts = [x for x in re.split(r"[\s,，、]+", l) if x]
        name = ts[0] if ts else ""
        if name in ("学生", "姓名", "名字", "电话", "称谓"):
            continue
        phone = ts[-1] if len(ts) >= 2 and re.match(r"^\d{5,}$", ts[-1]) else ""
        if not phone:
            bad.append(l)
            continue
        relation = "".join(ts[1:-1])
        row = {"student_name": name, "学生": name, "relationship": relation, "称谓": relation, "phone": phone, "电话": phone}
        if name not in names:
            outside.append(row)
            continue
        if f"{name}|{phone}" in seen:
            continue
        seen[f"{name}|{phone}"] = 1
        if f"{name}|{phone}" in has_phone:
            dup.append(row)
            continue
        matched.append(row)
        got[name] = 1

    missing = [n for n in names if n not in got and n not in exist_stu]
    return {"对上": matched, "名册外": outside, "坏行": bad, "已有": dup, "没登记": missing}


def contact_book(roster, parents, keyword=""):
    kw = text_of(keyword)
    by = {}
    for r in (parents or []):
        sname = text_of(fld(r, "student_name", "学生"))
        by.setdefault(sname, []).append(r)
    out = []
    for s in (roster or []):
        sname = text_of(fld(s, "name", "姓名"))
        out.append({
            "name": sname,
            "姓名": sname,
            "student_id": fld(s, "student_id"),
            "parents": by.get(sname, []),
            "家长": by.get(sname, []),
        })
    if not kw:
        return out
    return [
        row for row in out
        if kw in row["name"]
        or any(kw in text_of(fld(p, "relationship", "称谓")) or kw in text_of(fld(p, "phone", "电话")) for p in row["parents"])
    ]


def latest_roster_exam(items, records, roster, thresholds=None):
    latest, latest_date = None, ""
    for item in (items or []):
        if score_kind(item) != "分数" or text_of(fld(item, "item_type", "类型")) == "表现":
            continue
        stats = report_stats(item, records, roster, thresholds)
        if not stats["actual_count"] or not stats["latest_date"] or stats["latest_date"] <= latest_date:
            continue
        latest_date = stats["latest_date"]
        latest = {"item": item, "name": text_of(fld(item, "item_name", "项目名")), "stats": stats}
    return latest


def summary_overview(o):
    items = o.get("items") or []
    academic = o.get("academic") or []
    roster = o.get("roster") or []
    behavior = o.get("behavior") or []
    thresholds = o.get("thresholds") or o.get("阈值") or DEFAULT_REPORT_THRESHOLDS

    latest_exam = latest_roster_exam(items, academic, roster, thresholds)
    exam = (
        {
            "name": latest_exam["name"],
            "average": latest_exam["stats"]["average"],
            "pass_rate": latest_exam["stats"]["pass_rate"],
            "均分": latest_exam["stats"]["average"],
            "及格率": latest_exam["stats"]["pass_rate"],
            "名": latest_exam["name"],
        }
        if latest_exam else None
    )

    complete = []
    for it in items:
        if item_disabled(it):
            continue
        k = score_kind(it)
        if (k not in ("打钩", "过关")) or text_of(fld(it, "item_type", "类型")) == "表现":
            continue
        a = aggregate_item(it, academic, roster)
        if not a["should_count"]:
            continue
        iname = text_of(fld(it, "item_name", "项目名"))
        complete.append({
            "item_name": iname,
            "done_rate": a["done_rate"],
            "item": iname,
            "rate": a["done_rate"],
            "项目": iname,
            "完成率": a["done_rate"],
        })

    today_str = fld(o, "today", "今天")
    wk = week_key(today_str)
    add = sub = 0
    roster_names = [text_of(fld(s, "name", "姓名")) for s in roster if text_of(fld(s, "name", "姓名"))]
    for r in behavior:
        if week_key(fld(r, "date", "日期")) != wk or text_of(fld(r, "student_name", "学生")) not in roster_names:
            continue
        v = _to_num(fld(r, "score", "分值")) or 0
        if v > 0:
            add += v
        elif v < 0:
            sub += -v

    attendance = o.get("attendance")
    attendance_abnormal = 0
    if attendance is not None:
        for r in attendance:
            st = text_of(fld(r, "status", "状态"))
            if st not in ("", "正常", "全勤", "系统核对"):
                attendance_abnormal += 1

    return {
        "exam": exam, "考试": exam,
        "completion": complete, "完成率": complete,
        "behavior": {"add": add, "sub": sub, "本周加分": add, "本周减分": sub},
        "attendance": {"abnormal": attendance_abnormal, "异常": attendance_abnormal} if attendance is not None else None,
    }
