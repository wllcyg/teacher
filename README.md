# 教师工作台（FastAPI + SQLite + React 复刻版）

将原「崔老师的教师工作台」单文件 HTML 应用复刻为前后端分离架构：

- **后端**：FastAPI + SQLAlchemy 2.0 + SQLite（单文件，零部署）
- **前端**：Vite + React 18 + TypeScript + Ant Design 5
- **范围**：10 张数据表、15 个功能页、计分/汇总/报表算法全部保留

## 目录结构

```
teacher-workbench/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI 入口（lifespan 建表+灌数据）
│   │   ├── database.py    # SQLite + SQLAlchemy
│   │   ├── models.py      # 10 张表 Model
│   │   ├── enums.py       # 列定义 / 自然键 / 枚举
│   │   ├── scoring.py     # 计分/汇总/报表纯函数（核心算法）
│   │   ├── routers.py     # 通用 CRUD + 报表接口
│   │   ├── schemas.py     # 请求/响应 schema
│   │   ├── seed.py        # 示例数据灌入
│   │   └── seed_data.json # 从原应用抽取的示例数据
│   ├── scripts/extract_seed.js  # 抽取原应用 seed 数据的脚本
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/           # axios 封装 + 接口定义
    │   ├── store/         # Zustand（称呼/学期持久化）
    │   ├── layout/        # 侧边导航 + 移动端底栏
    │   ├── pages/         # 15 个功能页
    │   ├── hooks.ts       # 班级/名册等共享 hooks
    │   └── nav.tsx        # 导航配置
    └── ...
```

## 快速启动

### 后端

```bash
cd backend
# 使用 uv 安装依赖并启动（uv 会自动创建 .venv 并同步依赖）
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

启动后自动建表并灌入示例数据。接口文档：http://127.0.0.1:8000/docs

### 前端

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173（`/api` 已代理到 8000 端口）。

## 数据模型（10 张表）

| 表 | 中文名 | 列 |
|---|---|---|
| students | 学生表 | 班级、姓名、学号、小组、标签 |
| schedule | 课表 | 星期、节次、班级、科目 |
| items | 项目表 | 项目名、类型、计分制、满分、类别、权重、周期、学科 |
| academic | 学业记录表 | 日期、班级、学生、项目、结果、状态、备注 |
| behavior | 表现记录表 | 日期、班级、学生、项目、分值、备注 |
| todos | 待办表 | 日期、事项、类别、状态 |
| attendance | 考勤表 | 日期、学生、状态、备注 |
| parents | 家长联系表 | 学生、称谓、电话、备注 |
| comms | 沟通记录表 | 日期、学生、对象、方式、内容、结果 |
| duties | 班务表 | 岗位、学生、类型、时间、备注 |

自然键去重：`students(班级,姓名)`、`academic(日期,学生,项目)`、`attendance(日期,学生)`、`todos(日期,事项)`、`duties(岗位,学生,时间)`。

## 核心算法（scoring.py）

- `score_kind`：计分制归类（分数/等第/过关/打钩/加减分）
- `pass_line`：及格线 = 满分 × 60%（缺满分回落 100）
- `latest_valid_scores`：每学生取最晚有效分
- `aggregate_item`：按计分制分叉汇总
- `report_stats`：优秀/及格/低分三线 + 分数段 + 缺考
- `rank_scores`：同分并列名次
- `delta_scores` / `delta_overview`：进退步
- `week_key` / `week_table` / `aggregate_behavior`：按周表现统计
- `build_matrix`：花名册矩阵
- `parent_import_plan` / `contact_book`：家校通讯录

## 与原应用的差异

1. 数据不再走 WorkBuddy 资料库 SDK，改为自建 SQLite + REST API。
2. 移除了离线写队列（后端直连数据库，无断网补交场景）。
3. 「设置」页的称呼/学期改为显式「保存」按钮，修复了原应用关闭面板丢修改的缺陷。
4. 单用户、无登录；如要多人 web 部署需换 PostgreSQL/MySQL 并加认证。
