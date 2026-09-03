"""计分 / 汇总 / 报表纯函数。

1:1 翻译自原单文件应用 <==PURE-LOGIC-END== 之前的纯逻辑段，
业务语义与数值结果完全一致，只把 JS 语法换成 Python。
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
    s = text_of(item.get("计分制") if isinstance(item, dict) else item)
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
    raw = item_or_full.get("满分") if isinstance(item_or_full, dict) else item_or_full
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
    return {
        "日期": text_of(o.get("日期")),
        "班级": text_of(o.get("班级")),
        "学生": text_of(o.get("学生")),
        "项目": text_of(item.get("项目名") or o.get("项目")),
        "结果": o.get("结果"),
        "状态": text_of(o.get("状态")) or result_to_status(item, o.get("结果")),
        "备注": text_of(o.get("备注")),
    }


def retest_pass(rec):
    """补测通过销项：结果转过关、状态转完成，备注保留。"""
    out = dict(rec)
    out["结果"] = "过关"
    out["状态"] = "完成"
    return out


def pending_retests(rows, klass=None, active_student_names=None):
    """待补测清单（可按班级筛），按日期从早到晚。"""
    has_roster = active_student_names is not None
    out = [
        r for r in (rows or [])
        if text_of(r.get("状态")) == "待补测"
        and (not klass or text_of(r.get("班级")) == klass)
        and (not has_roster or text_of(r.get("学生")) in active_student_names)
    ]
    out.sort(key=lambda r: text_of(r.get("日期")))
    return out


# ---------- 最新有效分（一次考试每个学生取最晚那条有效记录） ----------
def latest_valid_scores(item, records, roster):
    name = text_of(item.get("项目名") if isinstance(item, dict) else item)
    names = [text_of(s.get("姓名")) for s in (roster or []) if text_of(s.get("姓名"))]
    full = exam_full_score(item)

    latest_rows = {}
    for r in (records or []):
        who, d = text_of(r.get("学生")), text_of(r.get("日期"))
        if text_of(r.get("项目")) != name or who not in names:
            continue
        if who not in latest_rows or d >= latest_rows[who]["日期"]:
            latest_rows[who] = {"行": r, "日期": d}

    by_student = {}
    for who in names:
        picked = latest_rows.get(who)
        if not picked:
            continue
        score = parse_exam_score(picked["行"].get("结果"), full)
        if score is None:
            continue
        by_student[who] = {"学生": who, "分": score, "日期": picked["日期"]}

    scores = [by_student[w] for w in names if w in by_student]
    latest = ""
    for row in scores:
        if row["日期"] > latest:
            latest = row["日期"]
    return {"名册": names, "成绩": scores, "按学生": by_student, "最新日期": latest, "满分": full}


# ---------- 单项目汇总（按计分制分叉） ----------
def aggregate_item(item, records, roster):
    name = text_of(item.get("项目名") if isinstance(item, dict) else item)
    kind = score_kind(item)
    names = [text_of(s.get("姓名")) for s in (roster or [])]
    rows = [
        r for r in (records or [])
        if text_of(r.get("项目")) == name
        and (not names or text_of(r.get("学生")) in names)
    ]

    if kind == "分数":
        line = pass_line(item)
        snapshot = latest_valid_scores(item, records, roster)
        nums = [row["分"] for row in snapshot["成绩"]]
        low = [row["学生"] for row in snapshot["成绩"] if row["分"] < line]
        s = sum(nums)
        return {
            "kind": "分数", "项目": name, "人数": len(nums),
            "平均": round1(s / len(nums)) if nums else 0,
            "最高": max(nums) if nums else 0,
            "最低": min(nums) if nums else 0,
            "及格线": line,
            "及格率": round1((len(nums) - len(low)) / len(nums) * 100) if nums else 0,
            "未及格": low,
        }

    if kind == "等第":
        dist = {}
        for r in rows:
            g = text_of(r.get("结果")) or "未评"
            dist[g] = dist.get(g, 0) + 1
        return {"kind": "等第", "项目": name, "人数": len(rows), "分布": dist}

    # 打钩 / 过关：完成率 + 未完成名单
    done = {}
    retest = 0
    for r in rows:
        who = text_of(r.get("学生"))
        if kind == "过关":
            if text_of(r.get("结果")) == "过关":
                done[who] = True
        else:
            done[who] = True
        if text_of(r.get("状态")) == "待补测":
            retest += 1
    base = names if names else list(done.keys())
    missing = [n for n in base if n not in done]
    return {
        "kind": "完成", "项目": name,
        "应到人数": len(base),
        "完成人数": len(base) - len(missing),
        "完成率": round1((len(base) - len(missing)) / len(base) * 100) if base else 0,
        "未完成": missing,
        "待补测": retest,
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
    b = a + timedelta(days=6)
    return f"{a.month}/{a.day}-{b.month}/{b.day}"


# ---------- 表现周统计 ----------
def aggregate_behavior(records, roster):
    """表现记录按周加减总分：一行一个学生，一列一周。"""
    names = [text_of(s.get("姓名")) for s in (roster or [])]
    weeks = {}
    by_stu = {}
    for r in (records or []):
        who = text_of(r.get("学生"))
        if names and who not in names:
            continue
        wk = week_key(r.get("日期"))
        if not wk:
            continue
        weeks[wk] = True
        by_stu.setdefault(who, {})
        by_stu[who][wk] = by_stu[who].get(wk, 0) + (_to_num(r.get("分值")) or 0)

    week_list = sorted(weeks.keys())
    base = names if names else list(by_stu.keys())
    rows = []
    for who in base:
        per = {}
        s = 0
        for w in week_list:
            v = by_stu.get(who, {}).get(w, 0)
            per[w] = v
            s += v
        rows.append({"学生": who, "周分": per, "合计": s})
    return {"周列表": week_list, "行": rows}


def week_table(records, roster, week_start, sort_by_subtotal=False):
    """表现周表：一行一学生，加分次数/减分次数/本周小计。"""
    names = [text_of(s.get("姓名")) for s in (roster or [])]
    by = {}
    count = 0
    for r in (records or []):
        if week_key(r.get("日期")) != text_of(week_start):
            continue
        who = text_of(r.get("学生"))
        if names and who not in names:
            continue
        v = _to_num(r.get("分值")) or 0
        o = by.setdefault(who, {"加次": 0, "减次": 0, "小计": 0})
        if v > 0:
            o["加次"] += 1
        elif v < 0:
            o["减次"] += 1
        o["小计"] += v
        count += 1

    rows = []
    for n in names:
        o = by.get(n, {"加次": 0, "减次": 0, "小计": 0})
        rows.append({"学生": n, "加次": o["加次"], "减次": o["减次"], "小计": o["小计"]})
    if sort_by_subtotal:
        rows.sort(key=lambda r: r["小计"], reverse=True)

    max_p = max_m = 0
    add_most = minus_most = ""
    for r in rows:
        if r["加次"] > max_p:
            max_p, add_most = r["加次"], r["学生"]
        if r["减次"] > max_m:
            max_m, minus_most = r["减次"], r["学生"]
    return {"行": rows, "加最多": add_most, "减最多": minus_most, "笔数": count}


# ---------- 花名册矩阵 ----------
def matrix_cell(item, rec):
    """一个格子怎么显示。"""
    if not rec:
        return {"文字": "", "色调": "none", "待补测": False}
    kind = score_kind(item)
    v = text_of(rec.get("结果"))
    retest = text_of(rec.get("状态")) == "待补测"
    if kind == "分数":
        n = parse_exam_score(rec.get("结果"), item)
        if n is None:
            return {"文字": "", "色调": "none", "待补测": retest}
        return {"文字": str(n), "色调": "bad" if n < pass_line(item) else "ok", "待补测": retest}
    if kind == "过关":
        return {"文字": v, "色调": "ok" if v == "过关" else "warn", "待补测": retest}
    if kind == "等第":
        return {"文字": v, "色调": "ok", "待补测": retest}
    return {"文字": "✓", "色调": "ok", "待补测": retest}


def build_matrix(students, records, items, opts=None):
    """花名册矩阵：一行一个学生，一列一个检查点（项目＋日期）。"""
    opts = opts or {}
    by_name = {text_of(it.get("项目名")): it for it in (items or [])}
    names = [text_of(s.get("姓名")) for s in (students or [])]
    rows = [
        r for r in (records or [])
        if (not names or text_of(r.get("学生")) in names)
        and (not opts.get("项目") or text_of(r.get("项目")) == opts["项目"])
        and (not opts.get("起") or text_of(r.get("日期")) >= opts["起"])
    ]

    col_map = {}
    cols = []
    cell_index = {}
    for r in rows:
        key = f"{text_of(r.get('项目'))}@{text_of(r.get('日期'))}"
        if key not in col_map:
            col_map[key] = {
                "key": key, "项目": text_of(r.get("项目")), "日期": text_of(r.get("日期")),
                "kind": score_kind(by_name.get(text_of(r.get("项目")), {})),
            }
            cols.append(col_map[key])
        cell_index[f"{text_of(r.get('学生'))}|{key}"] = r

    cols.sort(key=lambda c: (c["日期"], c["项目"]))

    out = []
    for who in names:
        cells = {}
        for c in cols:
            cells[c["key"]] = matrix_cell(by_name.get(c["项目"], {}), cell_index.get(f"{who}|{c['key']}"))
        out.append({"学生": who, "格子": cells})
    return {"列": cols, "行": out}


# ---------- 报表：分数段 / 名次 / 统计 ----------
def score_bands(nums, full_score):
    """按满分占比分五段统计人数。"""
    full = exam_full_score(full_score)
    valid = [n for n in (parse_exam_score(x, full) for x in (nums or [])) if n is not None]
    return [
        {"段": label, "人数": sum(1 for n in valid if lo <= n / full < hi)}
        for label, lo, hi in SCORE_BANDS
    ]


def rank_scores(pairs):
    """一次考试的名次：同分并列、下一名跳过（95,95,87 → 1,1,3）。"""
    sorted_pairs = sorted((pairs or []), key=lambda p: p.get("分数", 0), reverse=True)
    out = {}
    last_score = None
    last_rank = 0
    for i, p in enumerate(sorted_pairs):
        rank = last_rank if p.get("分数") == last_score else (i + 1)
        out[text_of(p.get("姓名"))] = rank
        last_score = p.get("分数")
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
    nums = [row["分"] for row in snapshot["成绩"]]
    recorded = {row["学生"]: True for row in snapshot["成绩"]}
    miss = [w for w in snapshot["名册"] if w not in recorded]

    s = sum(nums)
    you_n = sum(1 for n in nums if n >= you_line)
    ji_n = sum(1 for n in nums if n >= ji_line)
    di_n = sum(1 for n in nums if n < di_line)

    def rate(n):
        return round1(n / len(nums) * 100) if nums else 0

    return {
        "应录": len(snapshot["名册"]), "实录": len(nums), "缺考": miss,
        "平均": round1(s / len(nums)) if nums else 0,
        "最高": max(nums) if nums else 0,
        "最低": min(nums) if nums else 0,
        "满分": full,
        "优秀线分": you_line, "及格线分": ji_line, "低分线分": di_line,
        "优秀数": you_n, "及格数": ji_n, "低分数": di_n,
        "优秀率": rate(you_n), "及格率": rate(ji_n), "低分率": rate(di_n),
        "分段": score_bands(nums, full), "最新日期": snapshot["最新日期"], "快照": snapshot,
    }


def prev_exam(items, records, roster, cur_name):
    """上一次分数类考试是哪场：当前考试没入分就当它最新。"""
    latest = {}
    for item in (items or []):
        if score_kind(item) != "分数" or text_of(item.get("类型")) == "表现":
            continue
        snap = latest_valid_scores(item, records, roster)
        if snap["最新日期"]:
            latest[text_of(item.get("项目名"))] = snap["最新日期"]
    cur_date = latest.get(text_of(cur_name), "9999-99-99")
    best, best_date = "", ""
    for item in (items or []):
        n = text_of(item.get("项目名"))
        if n == text_of(cur_name) or n not in latest:
            continue
        if latest[n] < cur_date and latest[n] > best_date:
            best, best_date = n, latest[n]
    return best


def delta_scores(current_snapshot, previous_snapshot):
    """进退步：这次和上次都有分的孩子，Δ=这次-上次。"""
    cur = (current_snapshot or {}).get("按学生", {})
    prev = (previous_snapshot or {}).get("按学生", {})
    return {who: cur[who]["分"] - prev[who]["分"] for who in cur if who in prev}


def delta_overview(deltas):
    """进退步概览：进步/退步/持平人数，最大进步和最大退步各挑一个。"""
    up = down = flat = 0
    max_up = max_down = None
    for who, v in (deltas or {}).items():
        if v > 0:
            up += 1
            if not max_up or v > max_up["Δ"]:
                max_up = {"学生": who, "Δ": v}
        elif v < 0:
            down += 1
            if not max_down or v < max_down["Δ"]:
                max_down = {"学生": who, "Δ": v}
        else:
            flat += 1
    return {"进步": up, "退步": down, "持平": flat, "最大进步": max_up, "最大退步": max_down}


# ---------- 考勤 ----------
def attendance_row(o):
    """考勤只记异常：没选人、没选状态、或选了全勤/正常，都不落行。"""
    who = text_of(o.get("学生") if isinstance(o, dict) else o)
    st = text_of(o.get("状态") if isinstance(o, dict) else "")
    if not who or not st:
        return None
    if st in ("全勤", "正常"):
        return None
    return {"日期": text_of(o.get("日期")), "学生": who, "状态": st, "备注": text_of(o.get("备注"))}


# ---------- 项目停用 / 影响 ----------
def item_disabled(item):
    return text_of(item.get("类别") if isinstance(item, dict) else item).startswith(DISABLED_MARK)


def disable_item_row(item):
    out = dict(item)
    orig = text_of(out.get("类别"))
    out["类别"] = (DISABLED_MARK + "|" + orig) if orig else DISABLED_MARK
    return out


def enable_item_row(item):
    out = dict(item)
    c = text_of(out.get("类别"))
    if c.startswith(DISABLED_MARK):
        c = c[len(DISABLED_MARK):]
        if c.startswith("|"):
            c = c[1:]
        out["类别"] = c
    return out


def item_impact(name, academic, behavior):
    """删除项目前先数清楚要连带删掉多少条历史。"""
    n = text_of(name)
    a = sum(1 for r in (academic or []) if text_of(r.get("项目")) == n)
    b = sum(1 for r in (behavior or []) if text_of(r.get("项目")) == n)
    return {"学业": a, "表现": b, "总": a + b}


# ---------- 家长通讯录 ----------
def parent_import_plan(text, roster, existing):
    """家长通讯录批量导入：「学生名 称谓 电话」或「学生名 电话」。"""
    names = [text_of(s.get("姓名")) for s in (roster or [])]
    has_phone = {f"{text_of(r.get('学生'))}|{text_of(r.get('电话'))}": 1 for r in (existing or [])}
    exist_stu = {text_of(r.get("学生")): 1 for r in (existing or [])}
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
        row = {"学生": name, "称谓": relation, "电话": phone}
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
    """家校通讯录：一个孩子的家长合并到他名下，没登记的也占一行。"""
    kw = text_of(keyword)
    by = {}
    for r in (parents or []):
        by.setdefault(text_of(r.get("学生")), []).append(r)
    out = [{"姓名": text_of(s.get("姓名")), "家长": by.get(text_of(s.get("姓名")), [])} for s in (roster or [])]
    if not kw:
        return out
    return [
        row for row in out
        if kw in row["姓名"]
        or any(kw in text_of(p.get("称谓")) or kw in text_of(p.get("电话")) for p in row["家长"])
    ]


# ---------- 汇总概览 ----------
def latest_roster_exam(items, records, roster, thresholds=None):
    """当前班最新考试：从当前名册的有效最新分中选，避免全局残留记录改写去向。"""
    latest, latest_date = None, ""
    for item in (items or []):
        if score_kind(item) != "分数" or text_of(item.get("类型")) == "表现":
            continue
        stats = report_stats(item, records, roster, thresholds)
        if not stats["实录"] or not stats["最新日期"] or stats["最新日期"] <= latest_date:
            continue
        latest_date = stats["最新日期"]
        latest = {"项目": item, "名": text_of(item.get("项目名")), "统计": stats}
    return latest


def summary_overview(o):
    """汇总概览行：考试均分及格率、各打钩/过关项目完成率、本周表现加减、考勤异常。"""
    items = o.get("items") or []
    academic = o.get("academic") or []
    roster = o.get("roster") or []
    behavior = o.get("behavior") or []
    thresholds = o.get("阈值") or DEFAULT_REPORT_THRESHOLDS

    latest_exam = latest_roster_exam(items, academic, roster, thresholds)
    exam = (
        {"名": latest_exam["名"], "均分": latest_exam["统计"]["平均"], "及格率": latest_exam["统计"]["及格率"]}
        if latest_exam else None
    )

    complete = []
    for it in items:
        if item_disabled(it):
            continue
        k = score_kind(it)
        if (k not in ("打钩", "过关")) or text_of(it.get("类型")) == "表现":
            continue
        a = aggregate_item(it, academic, roster)
        if not a["应到人数"]:
            continue
        complete.append({"项目": text_of(it.get("项目名")), "完成率": a["完成率"]})

    wk = week_key(o.get("今天"))
    add = sub = 0
    roster_names = [text_of(s.get("姓名")) for s in roster if text_of(s.get("姓名"))]
    for r in behavior:
        if week_key(r.get("日期")) != wk or text_of(r.get("学生")) not in roster_names:
            continue
        v = _to_num(r.get("分值")) or 0
        if v > 0:
            add += v
        elif v < 0:
            sub += -v

    # 考勤异常（系统核对行不算异常）
    attendance = o.get("attendance")
    attendance_abnormal = 0
    if attendance is not None:
        for r in attendance:
            if text_of(r.get("状态")) not in ("", "正常", "全勤", "系统核对"):
                attendance_abnormal += 1

    return {
        "考试": exam,
        "完成率": complete,
        "表现": {"本周加分": add, "本周减分": sub},
        "考勤": {"异常": attendance_abnormal} if attendance is not None else None,
    }
