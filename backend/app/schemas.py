"""Pydantic 请求/响应 schema。

所有表都是同构的「中文列名 → 字符串」结构，因此用通用 dict 承载，
在 router 层按 enums.TABLE_COLUMNS 做键校验，避免为 10 张表各写一套近乎相同的 schema。
"""
from typing import Dict

# 新建/更新时传入的字段（键必须是该表的合法列名）
RowPayload = Dict[str, str]
