"""示例数据灌入。

数据来自 scripts/extract_seed.js 从原应用抽取的 app/seed_data.json。
首次启动时建表后调用，把十张表灌成和原应用「试玩模式」一致的示例数据。
"""

import json
import os

from sqlalchemy.orm import Session

from . import models
from .enums import TABLE_COLUMNS

SEED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_data.json")


def load_seed() -> dict:
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _str(v) -> str:
    if v is None:
        return ""
    return str(v)


def seed_if_empty(db: Session) -> dict:
    """各表为空时灌入示例数据，返回每张表写入的行数。"""
    data = load_seed()
    counts = {}

    for table, model in models.MODELS.items():
        if db.query(model).first() is not None:
            continue  # 已有数据，跳过（避免重复灌）
        rows = data.get(table, [])
        for row in rows:
            inst = model()
            for col in TABLE_COLUMNS[table]:
                setattr(inst, col, _str(row.get(col)))
            db.add(inst)
        counts[table] = len(rows)

    db.commit()
    return counts
