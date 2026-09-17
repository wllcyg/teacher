# 教师工作台后端迁移至 NestJS 实施计划（方案 A：独立双登录与高内聚模块）

本文档详细规划了将现有 Python FastAPI (`backend/app`) 后端完全迁移并合并到现有 NestJS 项目中的实施方案。
核心目标：**消除 Python 独立运行时和容器的常驻内存开销（预计节省 150MB~250MB 内存），在一个 Node.js 进程中承载两套业务，同时保持教师工作台的绝对独立性与零耦合。**

---

## 一、 核心架构设计（方案 A）

```
NestJS 宿主应用
├── 主系统原模块 (UserModule, OrderModule, etc.) ---> 主数据库 (MySQL/PG)
│   └── [ JwtAuthGuard (主系统守卫) ]
│
└── 教师工作台独立模块 (TeacherModule)              ---> 独立数据源 (teacher.sqlite)
    ├── [ TeacherAuthGuard (教师专属守卫) ]
    ├── 独立接口路径: /api/teacher/* (或保持 /api/*)
    ├── 独立密码与 Token 验签 (TEACHER_APP_PASSWORD)
    └── 独立业务: 11张表CRUD + 成绩评分统计 + 晨间海报生成 + AI对话
```

### 1. 登录鉴权隔离
- **独立口令**：通过环境变量 `TEACHER_APP_PASSWORD`（默认 `123456qw`）和 `TEACHER_SECRET_KEY` 独立配置，不与主系统的用户表混用。
- **独立守卫 (`TeacherAuthGuard`)**：仅挂载在教师工作台 Controller 上。
- **自动顺延续期**：完整保留原 Python 的 `X-New-Token` 响应头机制（有效期 30 天，剩余 7 天内静默续期），前端无感顺延。
- **公开路由白名单**：`/api/teacher/daily-greeting/card` 免登放行。

### 2. 数据层物理隔离
- 使用 TypeORM 多连接（Multiple Connections）或 Prisma 独立实例，继续读写独立的 SQLite 数据库文件（如 `./data/teacher.sqlite`）。
- **零表污染**：绝不在主系统业务库中新建任何教师表，后续随时可无损剥离。

---

## 二、 目录结构设计 (在 NestJS 中新建)

在目标 NestJS 项目的 `src/modules/teacher/` 下创建自闭环目录：

```text
src/modules/teacher/
├── config/
│   └── teacher.config.ts          # 独立环境变量 (密码、Token密钥、AI_KEY)
├── database/
│   └── teacher-database.module.ts # 独立的 SQLite TypeORM 数据源配置
├── entities/                      # 11 张实体表定义
│   ├── student.entity.ts
│   ├── class.entity.ts
│   ├── academic.entity.ts
│   ├── behavior.entity.ts
│   ├── attendance.entity.ts
│   ├── schedule.entity.ts
│   ├── parent.entity.ts
│   ├── comm.entity.ts
│   ├── duty.entity.ts
│   ├── lesson-log.entity.ts
│   ├── todo.entity.ts
│   ├── item.entity.ts
│   └── app-setting.entity.ts
├── guards/
│   └── teacher-auth.guard.ts      # 教师专属守卫
├── auth/
│   ├── teacher-auth.controller.ts # POST /api/teacher/auth/login
│   └── teacher-auth.service.ts    # 密码校验、Token签发与验签
├── services/
│   ├── teacher-crud.service.ts    # 11张表的通用 CRUD 与批量操作
│   ├── teacher-scoring.service.ts # 移植 scoring.py (加权统计、多维雷达分析)
│   ├── teacher-poster.service.ts  # 移植 card_generator.py (基于 canvas 绘图)
│   └── teacher-ai.service.ts      # 移植 AI 对话与 SSE 流式转发
├── controllers/
│   ├── teacher-crud.controller.ts # 业务 CRUD 端点
│   ├── teacher-report.controller.ts # 报表分析端点
│   ├── teacher-card.controller.ts # 晨间日签海报端点
│   └── teacher-ai.controller.ts   # AI 分析接口
└── teacher.module.ts              # 统一入口 Module
```

---

## 三、 详细迁移步骤与时间表

### 阶段 1：基础脚手架与独立数据源配置（预计 2 小时）
1. **安装依赖**：
   - 数据库：`better-sqlite3`（或 `sqlite3`）
   - 图片生成：`@napi-rs/canvas`（轻量、高性能 Rust 绑定 Canvas）
   - AI 流式：`openai` SDK
2. **创建 `TeacherDatabaseModule`**：
   - 配置命名连接 `connectionName: 'teacherConnection'`，指向 `./data/teacher.sqlite`。
   - 自动同步表结构或复用已有 sqlite 文件。

### 阶段 2：独立登录与认证系统（预计 2 小时）
1. **编写 `TeacherAuthService`**：
   - 实现恒定时间密码比对（防时序攻击）；
   - 实现基于 HMAC-SHA256 的 Token 签发、验签与续期。
2. **编写 `TeacherAuthGuard`**：
   - 解析 Header `Authorization: Bearer <token>` 与 query `?token=`；
   - 检查白名单路径；
   - 在 Response Header 注入 `X-New-Token`。
3. **提供 `POST /api/teacher/auth/login` 接口**，并在 CORS 中配置 `exposeHeaders: ['X-New-Token']`。

### 阶段 3：11 张数据模型与通用 CRUD 移植（预计 4 小时）
1. **实体映射**：将 `models.py` 的 11 个表类转换为 TypeORM `@Entity`，保留全部字段名与复合索引（`Index`）。
2. **业务逻辑对齐**：
   - `student_id` 自动递增序列生成逻辑（`STU0001` 等）；
   - 姓名/班级智能反查 `student_id`；
   - 批量导入/导出（Excel/JSON）接口兼容。

### 阶段 4：算法报表与功能服务移植（预计 4 小时）
1. **移植 `scoring.py` -> `teacher-scoring.service.ts`**：
   - 学生总分加权、平均分、排名计算；
   - 德育分扣分项、雷达图维度聚合；
   - 课堂日志与待办状态统计。
   - *(优势：TypeScript 原生数组和对象处理性能优于 Python 动态字典)*。
2. **移植 `card_generator.py` -> `teacher-poster.service.ts`**：
   - 使用 `@napi-rs/canvas` 复刻宋体宣纸质感、双线边框、诗词文本智能断句与印章绘制；
   - 保留按日期生成的本地缓存策略，直接返回 `image/png` Buffer。
3. **移植 AI 助手流式响应**：
   - 基于 NestJS `Observable` / Fastify/Express 的 SSE，直通通义千问（DashScope）API。

### 阶段 5：数据迁移与前端联调（预计 2 小时）
1. **数据平移**：
   - 直接把原项目的 `backend/app/data/teacher.sqlite`（或挂载卷 `backend_data`）文件拷贝到 NestJS 对应目录，免除数据转换。
2. **前端接口路径适配**：
   - 方式 A（前端微调）：在前端 `.env` 中把 `VITE_API_BASE_URL` 改为 `/api/teacher`；
   - 方式 B（后端全兼容）：在 NestJS 中通过局部路由重写，保持原原有 `/api/auth/login` 与 `/api/*` 完全不变。
3. **跨域与暴露头验证**：
   - 确保 `ALLOWED_ORIGINS` 包含前端访问地址，且 `X-New-Token` 正常被前端 Axios 拦截器接收。

---

## 四、 风险评估与应对预案

| 风险点 | 影响程度 | 应对预案 |
| :--- | :--- | :--- |
| **海报绘制阻塞主线程** | 低 ~ 中 | `@napi-rs/canvas` 底层由 Rust 编写，性能高于原生 Node Canvas。同时有本地日缓存机制，生成一次后直接走静态缓存返回，不消耗 CPU。 |
| **前端 Token 续期失效** | 中 | 必须在 NestJS 主入口 `main.ts` 的 CORS 配置中明确声明 `exposedHeaders: ['X-New-Token']`。 |
| **两套登录路由冲突** | 无 | 主系统登录通常在 `/api/auth/login` 或 `/auth/login`；教师模块明确定义独立前缀（如 `/api/teacher/auth/login`），物理级防冲突。 |

---

## 五、 验收标准

1. **资源监控验收**：停止原有 Python 容器后，服务器总内存占用下降 150MB 以上，无残留僵尸进程。
2. **功能全量验收**：
   - 教师端使用独立密码成功登录，并拿到专属 Token；
   - 学生列表、成绩录入、德育记录 CRUD 响应正常；
   - 晨间日签海报可在免登状态下秒级加载；
   - AI 对话能流式打字输出；
   - 主系统原有的业务和登录完全不受任何影响。
