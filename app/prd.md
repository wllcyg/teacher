# 教师工作台小程序 · 整体产品与技术架构文档 (PRD)

> **维护说明**：本项目后续所有功能规划、业务需求、数据结构设计与迭代记录均统一沉淀在此文档中。

---

## 一、 项目概况与技术选型

- **产品定位**：面向班主任/任课教师的一体化智能教学工作台，提供学生管理、考勤签到、作业管理、数据统计等高效教学辅助工具。
- **技术栈**：
  - **客户端**：微信小程序原生架构 (WXML / WXSS / JavaScript)
  - **UI 组件库**：腾讯官方 **TDesign Miniprogram** (`tdesign-miniprogram`)
  - **后端及数据**：微信云开发 **CloudBase** (云函数 + 云数据库 + 云存储)

---

## 二、 架构规范与核心机制

### 1. 云环境隔离规范 (单物理环境模式)
- **云环境 ID**：`teacher-d4g74wc9be2d5b1f5`
- **逻辑环境划分**：仅划分两套逻辑环境 —— **`dev`** 与 **`prd`**
  - **`dev` (开发/测试)**：微信开发者工具本地预览、测试版、体验版 (`trial`)
  - **`prd` (正式生产)**：微信公众平台正式发布版 (`release`)
- **数据隔离策略（表名前缀隔离）**：
  - 集合命名规范：`${env}_${baseName}`
  - 例如：学生花名册集合在开发期为 `dev_students`，在线上为 `prd_students`
  - 数据访问工具：统一通过 [utils/db.js](file:///d:/self/teacher/app/miniprogram/utils/db.js) 的 `getCollection()` / `getTableName()` / `callCloudFunction()` 调度，业务代码无感知。

### 2. 代码仓库安全规范
- **AppID 保护**：禁止将真实 AppID 提交至远程 Git 仓库。
  - 公共配置 `project.config.json` 中的 `appid` 恒为空字符串 `""`。
  - 开发者个人 AppID 配置在 `project.private.config.json` 中，并通过 [.gitignore](file:///d:/self/teacher/app/.gitignore) 严格忽略。

---

## 三、 页面路由与导航结构

| 页面路径 | 页面名称 | 页面职责 / 定位 | 当前状态 |
| :--- | :--- | :--- | :--- |
| `pages/index/index` | **首页 (工作台)** | 教师核心业务看板、当前班级切换、快捷入口 | 骨架建设中 |
| `pages/mine/index` | **我的 (个人中心)** | 教师个人档案维护、班级管理入口、环境与系统设置 | 已完成个人资料维护 |
| `pages/class-manage/index` | **班级管理 (二级页)** | 我创建/管理的班级列表、新建班级、编辑班级信息、解散班级 | 已完成 |
| `pages/roster/index` | **学生花名册 (二级页)** | 班级学生档案、拼音字母索引滑动列表、智能批量文本录入 | 已完成 |
| `pages/periods/index` | **作息时间表 (二级页)** | 11节标准教学时段、平铺列表、左滑删除、动态时间段增删 | 已完成 |
| `pages/schedule/index` | **我的任教课表 (二级页)** | 教师个人教学日程、单日/全周双模视图、极速排课、一键整天复制 | 已完成 |

- **TabBar 导航**：采用微信官方原生原生绿 (`#07C160`) 与未选中灰 (`#7A7E83`) 配色。

---

## 四、 核心数据模型与表结构设计

本系统采用 **「班级为管理域容器，学生为核心业务实体」** 的解耦结构：
- **物理表名规则**：开发环境以 `dev_` 为前缀，生产环境以 `prd_` 为前缀。
- **数据访问方式**：小程序端通过 `getCollection('classes')` 或 `getCollection('students')` 自动路由。

### 1. 班级表 (`classes`)
> 集合名：`dev_classes`（开发） / `prd_classes`（生产）  
> 描述：存储教师创建的班级空间元信息，是学生、考勤、作业等数据的顶级管理归属容器。

| 字段名 | 类型 | 必填 | 默认值 | 字段说明 / 业务规则 |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | String | 是 | 自动生成 | 班级唯一 ID（主键） |
| `_openid` | String | 是 | 自动注入 | 创建老师的微信唯一识别码（决定班级所有权） |
| `name` | String | 是 | - | 班级名称（如 `八年级三班`、`初二(3)班`） |
| `grade` | String | 是 | - | 所属年级（如 `七年级`、`八年级`、`高一`） |
| `academic_year` | String | 否 | 当前学年 | 入学年份或当前学年（如 `2024-2025`） |
| `headmaster_name` | String | 否 | - | 班主任姓名 / 教师称呼（如 `张老师`） |
| `subject` | String | 否 | - | 创建教师任教学科（如 `语文`、`数学`） |
| `student_count` | Number | 是 | 0 | 冗余字段：班级当前在读学生总数（增删学生时联动更新） |
| `assistant_teachers` | Array | 否 | `[]` | 协同任课教师列表：`[{ openid, name, subject }]` |
| `is_default` | Boolean | 否 | false | 是否为该教师当前登录后默认展示的班级 |
| `created_at` | Number | 是 | Date.now() | 创建时间戳（毫秒） |
| `updated_at` | Number | 是 | Date.now() | 最后更新时间戳（毫秒） |

- **索引规划**：`_openid`（普通索引，用于快速列出教师的所有班级）。

---

### 2. 学生档案表 (`students`)
> 集合名：`dev_students`（开发） / `prd_students`（生产）  
> 描述：存储班级内的具体学生基础档案，是考勤、作业提交、成绩追踪的基础实体。

| 字段名 | 类型 | 必填 | 默认值 | 字段说明 / 业务规则 |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | String | 是 | 自动生成 | 学生唯一 ID（主键） |
| `class_id` | String | 是 | - | 所属班级 ID（外键，关联 `classes._id`） |
| `name` | String | **是** | - | **学生真实姓名 (业务核心唯一必填项)** |
| `student_no` | String | 否 | `""` | 学号 / 座号（可选，支持手工输入或按名单序号） |
| `gender` | String | 否 | `""` | 性别（`男` / `女`，可选） |
| `parent_name` | String | 否 | `""` | 监护人姓名 / 称呼（可选） |
| `parent_phone` | String | 否 | `""` | 监护人联系手机号（可选，支持一键拨打） |
| `address` | String | 否 | `""` | 家庭住址 / 接送地点（可选） |
| `status` | String | 否 | `active` | 在籍状态：`active`(在读)、`transferred`(转出)、`suspended`(休学) |
| `avatar_url` | String | 否 | `""` | 学生头像链接（可选） |
| `group_name` | String | 否 | `""` | 所属学习小组（如 `一组`、`二组`，可选） |
| `duty` | String | 否 | `""` | 班级职务（仅限 `班长`、`组长`，可选） |
| `remarks` | String | 否 | `""` | 教师私密备忘（健康状况/特殊关注等，可选） |
| `created_at` | Number | 是 | Date.now() | 建档时间戳（毫秒） |
| `updated_at` | Number | 是 | Date.now() | 资料更新时间戳（毫秒） |

- **快速录入支持**：教师可仅凭一份纯姓名文本（甚至每行一个名字）即可一键极速批量建档，其余字段后续按需补充。
- **智能双引擎解析**：支持「本地毫秒级正则引擎 + 腾讯云 CloudBase 原生 AI 大模型深度解析」双引擎，自动提取姓名、小组与职务。
- **索引规划**：
  - `class_id`（单字段索引：用于按班级秒级加载花名册）
  - `class_id` + `created_at`（复合索引：默认按建档先后顺序排序展示）
  - `class_id` + `group_name`（复合索引：支持按学习小组快速筛选与统计）

---

### 3. 教师档案表 (`teachers`)
> 集合名：`dev_teachers`（开发） / `prd_teachers`（生产）  
> 描述：存储教师个人身份档案（微信 OpenID、真实姓名、微信头像、学科、学校等）。

| 字段名 | 类型 | 必填 | 默认值 | 字段说明 / 业务规则 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | UUID | 是 | 自动生成 | 教师唯一 ID（主键） |
| `openid` | String | 是 | 自动识别 | 微信唯一识别码（唯一索引，绑定微信账号） |
| `name` | String | 是 | `""` | 教师姓名 / 教学称呼（如 `张老师`，支持获取微信昵称或修改） |
| `avatar_url` | String | 否 | `""` | 教师头像（支持微信头像选择器及云存储链接） |
| `subject` | String | 否 | `""` | 任教学科（如 `语文`、`数学`） |
| `school` | String | 否 | `""` | 学校名称（选填） |
| `phone` | String | 否 | `""` | 教师联系电话（选填） |
| `created_at` | Number | 是 | Date.now() | 注册时间戳（毫秒） |
| `updated_at` | Number | 是 | Date.now() | 资料更新时间戳（毫秒） |

- **索引规划**：`openid`（唯一索引，保障每位微信老师账号唯一）。

---

### 4. 作息时间表 (`periods`)
> 集合名：`dev_periods`（开发） / `prd_periods`（生产）  
> 描述：存储各节次上下课时间定义，为全系统课程表、随堂考勤打卡提供唯一时间源；当前支持教师单人自治模式，并原生预留 `circle_id`（大组圈子）与 `class_id`（专属班级）字段，后续扩展零阻力。

| 字段名 | 类型 | 必填 | 默认值 | 字段说明 / 业务规则 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | String | 是 | 自动生成 | 节次记录唯一 ID（主键） |
| `owner_openid` | String | 是 | - | 归属教师微信 openid（索引） |
| `circle_id` | String | 否 | NULL | 预留：协同大组/圈子 ID（后续全校/年级组共享同一套作息时挂载） |
| `class_id` | String | 否 | NULL | 预留：专属班级 ID（特殊班级个性化作息时挂载） |
| `n` | Number | 是 | 1 | 节次序号（1, 2, 3... 自动升序排列） |
| `label` | String | 是 | `第 1 节` | 节次显示标签（如 `第 1 节`） |
| `start_time` | String | 是 | `08:20` | 开始时间（`HH:mm` 格式） |
| `end_time` | String | 是 | `09:00` | 结束时间（`HH:mm` 格式） |
| `duration` | Number | 是 | 40 | 单节课分钟时长 |
| `sort_order` | Number | 是 | 1 | 排序权重（按开始时间升序排列） |
| `created_at` | Number | 是 | Date.now() | 创建时间戳（毫秒） |
| `updated_at` | Number | 是 | Date.now() | 更新时间戳（毫秒） |

- **索引规划**：
  - `owner_openid`（快速索引当前老师名下作息）
  - `owner_openid` + `sort_order ASC`（按时间顺序秒级排序返回）
  - `circle_id`（后续大组圈子共享查询预留索引）

---

### 5. 教师任教课表 (`schedules`)
> 集合名：`dev_schedules`（开发） / `prd_schedules`（生产）  
> 描述：存储教师本人的周一至周五教学排课日程，用于随堂考勤、日程看板与教学规划。

| 字段名 | 类型 | 必填 | 默认值 | 字段说明 / 业务规则 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | String | 是 | 自动生成 | 排课唯一 ID（主键） |
| `owner_openid` | String | 是 | - | 归属教师微信 openid |
| `weekday` | String | 是 | `周一` | 星期（`周一` ~ `周五`） |
| `period_n` | Number | 是 | 1 | 对应作息节次（1 ~ 11，联动 `periods`） |
| `class_id` | String | 否 | `""` | 关联班级空间 ID（从教师所建班级列表选择） |
| `class_name` | String | 是 | - | 班级名称（如 `八年级三班`） |
| `subject` | String | 是 | - | 授课科目（默认带入教师任教学科） |
| `classroom` | String | 否 | `""` | 上课教室 / 场馆（如 `主楼302`） |
| `created_at` | Number | 是 | Date.now() | 创建时间戳（毫秒） |
| `updated_at` | Number | 是 | Date.now() | 更新时间戳（毫秒） |

- **约束与索引规划**：
  - `uq_schedules_slot`: `UNIQUE(owner_openid, weekday, period_n)`（同一教师在同一天同一节次天然防重叠）
  - `owner_openid` + `weekday` + `period_n`（复合查询索引）

---

## 五、 核心功能模块规划 (待开发清单)

> 以下功能按优先级排序，开发时在此勾选并补充详细实现方案：

- [x] **1. 班级管理（已完成）**
  - 从【我的】页面进入「我管理的班级」专属空间。
  - 班级创建（支持名称、快捷年级标签初一/初二/初三等）。
  - **学年周期选择器**：摒弃文本随意输入，采用微信原生 Picker 规范时间选择组件，根据自然月智能推算当前默认学年（如 `2026-2027`），提供标准跨年区间滚轮点选，杜绝格式混乱。
  - 页面全局精简为底部常驻唯一定位「+ 创建新班级」大按钮。
  - 班级卡片平铺纯净展示（移除“默认”静态标签，后续统一由首页顶部快捷班级切换器驱动全局上下文）。
  - 卡片集成「学生花名册」直达通道，支持快速编辑班级信息与安全确认解散班级。
  - 数据集合：`dev_classes`/`prd_classes`
- [x] **2. 学生花名册与档案管理（已完成）**
  - **班级联动入库**：班级卡片直达学生花名册（携带 `class_id` 与班级名），所有学生归属强绑定班级空间。
  - **学习小组与职务体系**：支持「一组、二组、三组...」学习小组分类微标；仅支持 **「班长」**（琥珀金高亮）与 **「组长」**（品牌蓝轻量）两类关键学生职务，其余默认为普通学生。
  - **纯净列表与右侧字母索引滑动**：集成 TDesign 官方 `t-indexes` 索引组件；内置轻量级汉字拼音首字母算法（自动兼容百家姓多音字），学生名单按拼音首字母（A-Z）自动分组吸顶展示，右侧配备字母滑竿，支持手指滑动或点选直达，伴随触感微震动；搜索状态下平滑切换为即时匹配视图。列表聚焦于姓名、学号、小组与职务，**不放置呼叫图标**。
  - **双引擎批量录入（本地 0 毫秒 + AI 大模型深度解析）**：
    - **本地极速引擎**：输入即时触发，支持顿号、空格、分号、组名冒号分段、分行组名及职务括号自动识别，0 毫秒给出实时预览芯片与重名预警；
    - **CloudBase AI 原生大模型引擎**：集成腾讯云 AI 网关（混元 Lite 模型），点击「🤖 AI 智能解析」可自动深挖非规范复杂格式（如段落叙述、微信混杂通知、特殊符号分组），结构化提取姓名、组别与职务；敏感 Key 安全保存在服务端 `app_configs` 表中；
    - **原子批量入库**：单次请求一并录入所有学生与小组，无网络多次抖动，录入后原子同步班级人数。
  - 数据集合：`dev_students` / `prd_students`、`dev_app_configs` / `prd_app_configs`
- [x] **3. 作息时间表配置（已完成）**
  - **核心定位**：统一校园节次作息定义中心，驱动全系统课表、考勤打卡与时间基准。
  - **结构平铺化（全日统一流水）**：打破上午/下午/晚自习的强制划分，以整卡片平铺呈现全部节次，直观连贯。
  - **左滑删除交互**：集成 TDesign 官方 `t-swipe-cell` 滑动单元格组件，任意节次向左滑动即可唤出专属红色「删除」动作区，确认后安全移出，并触发原生轻微震动反馈。
  - **动态添加时间段**：提供「+ 添加时间段」操作入口，根据现有最后一节课自动智能顺延推荐起止时间，支持使用原生 `<picker mode="time">` 滚轮精准自定义。
  - **时间轴自适应重排与重编号**：通过核心算法 `normalizePeriods`，在任何节次被微调、新增或删除后，自动按照开始时间升序排列，并对所有节次顺延重新自动编排为「第 1 节、第 2 节……」，杜绝断号与时间倒挂。
  - **持久化与一键重置**：修改后自动持久化至本地缓存；底部配备「恢复标准作息（11节）」防呆重置确认弹窗。
  - 核心工具模块：`utils/periods.js`
- [x] **4. 教师任教课表（已完成）**
  - **定位与纯粹教师视角**：仅聚焦教师本人每周一到周五在哪个班上课、哪节为空闲备课，无需录入全班所有科目，大幅降低教师使用门槛。
  - **单日聚焦与全周总览双模视图**：
    - **单日大卡片流 (Day View, 默认)**：顶部周一至周五横向分段切换，卡片详细展示当前节次、时间段、授课班级、学科标签与教室场馆；空课节次呈现优雅的「空闲备课」虚线卡片，一键点击直达排课。
    - **全周大矩阵 (Week View, 5 天大网格)**：水平横向滑动（`scroll-view`）大网格，左侧常驻节次时间表，右侧 5 天周一至周五紧凑卡片排布，全局课量负荷一览无余，点击任意单元格即可快捷编辑。
  - **极速排课交互**：
    - 点击任意空堂/已有课程即唤出底部排课抽屉（`t-popup`）。
    - 自动锁定星期与节次。
    - **TDesign 官方滚动选择器受控控制 (`t-picker`)**：彻底剔除传统散落胶囊和多余输入框，排课抽屉简化为紧凑优雅的单行卡片。
      - **授课班级**：点击唤起 `t-picker` 官方滚轮选择器，滑轮单选班级，自动绑定 `class_id` 与名称；若未建班级则温和弹窗引导直达班级管理；
      - **授课科目**：点击唤起 `t-picker` 官方滚轮选择器，滑轮单选学科；
      - **上课教室**：单行文本输入（选填）；
    - 全程采用 WeApp 原生/TDesign 专业组件受控，界面整洁高度大幅缩减，手指触控体验流畅。
  - **整天课表一键复制（高频痛点解决）**：
    - 针对教学中“周一的课和周三一样”的排课规律，提供「复制整天课表」能力；
    - 可将源星期的所有课程一键覆盖同步至目标星期，无需逐节重复配置。
  - **云端与数据库设计**：
    - 远端 PostgreSQL 独立建表 `dev_schedules` 与 `prd_schedules`，带 `UNIQUE(owner_openid, weekday, period_n)` 物理防重约束。
    - 云函数 `teacher-service` 提供 `getMySchedule`、`saveScheduleItem`、`batchCopyDaySchedule`、`deleteScheduleItem`、`clearSchedule` 接口，支持多端与多设备换机同步。
  - 数据集合：`dev_schedules` / `prd_schedules`
- [ ] **5. 课堂考勤与学生签到（下一步核心）**
  - 出勤、请假、迟到、旷课状态标记与一键全勤。
  - 数据集合：`dev_attendance` / `prd_attendance`
- [ ] **6. 作业与打卡管理**
  - 发布作业、查看学生提交进度、快速批改提醒。
  - 数据集合：`dev_homework` / `prd_homework`
- [ ] **7. 班级通知与备忘录**
  - 重要通知发布、待办备忘便签。

---

## 六、 开发与迭代变更记录

| 日期 | 版本 | 变更内容概要 | 经办人 |
| :---: | :---: | :--- | :--- |
| 2026-09-14 | v0.1.0 | 初始化项目架构：集成 TDesign、配置单环境 dev/prd 表名前缀隔离工具、完成 AppID 隔离、搭建首页与我的页面双 TabBar 占位。 | AI Assistant & User |
| 2026-09-14 | v0.2.0 | 完成数据模型设计：确立「班级为管理空间、学生为实体」的双表解耦模型，详细定义 `classes` 与 `students` 表结构与索引。 | AI Assistant & User |
| 2026-09-14 | v0.3.0 | 远端建表完成：通过 CloudBase MCP 将 `dev_classes`、`dev_students`、`prd_classes`、`prd_students` 成功部署至远端 PostgreSQL 实例，并建立外键约束与索引。 | AI Assistant & User |
| 2026-09-14 | v0.4.0 | 教师档案模块建表：在远端 PostgreSQL 部署 `dev_teachers` 与 `prd_teachers` 表，支持微信头像昵称持久化及学科教研档案。 | AI Assistant & User |
| 2026-09-14 | v0.5.0 | 升级班级管理信息架构：确立从【我的】进入「班级管理」二级页，支持班级创建、编辑、列表展示与默认班级设置。 | AI Assistant & User |
| 2026-09-14 | v0.6.0 | 落地班级管理全套业务闭环：完成 `pages/class-manage` 页面与 TDesign 高质感 UI，打通后端云函数 `getMyClasses`、`createClass`、`updateClass`、`setDefaultClass`、`deleteClass` 与 PostgreSQL 数据库双向联动。 | AI Assistant & User |
| 2026-09-14 | v0.7.0 | 落地学生花名册与档案管理：完成 `pages/roster` 页面，实现智能文本分词批量录入与单人建档；按规范仅支持「班长」「组长」两项职务，列表聚焦档案查验不设呼叫图标；后端部署 `getStudentsByClass`、`createStudent`、`batchImportStudents`、`updateStudent`、`deleteStudent` 接口并原子同步班级总人数。 | AI Assistant & User |
| 2026-09-14 | v0.8.0 | 落地平铺式作息时间表管理：完成 `utils/periods.js` 与 `pages/periods` 页面，取消三段式划分布局改为全日连贯平铺流；引入 TDesign `t-swipe-cell` 左滑删除时间段；支持「+ 添加时间段」并智能顺延推算推荐时间；支持原生滚轮微调起止时间，内置 `normalizePeriods` 算法实现起止时间自适应升序重排与自动重新编排序号，提供本地持久化与一键恢复标准作息。 | AI Assistant & User |
| 2026-09-14 | v0.9.0 | 落地作息时间表独立表云端持久化：在远端 PostgreSQL 部署 `dev_periods` 与 `prd_periods` 独立表，支持单人自治并原生预留 `circle_id` / `class_id` 扩展能力；`teacher-service` 云函数接入 `getMyPeriods`（空表自动播种11节课）、`saveMyPeriods` 与 `resetMyPeriods`；前端实现本地缓存毫秒级上屏与云端异步双轨同步，彻底解决换机丢失问题。 | AI Assistant & User |
| 2026-09-14 | v0.10.0 | 全面落地教师个人任教课表：建置远端 `dev_schedules` / `prd_schedules` 表与防重约束；云函数接入 `getMySchedule`、`saveScheduleItem`、`batchCopyDaySchedule` 等原子接口；上线 `pages/schedule` 支持单日卡片与全周 5 天大网格双模视图、极速点选班级排课抽屉、一键整天课表批量复制与左滑清空，【我的】页面贴边通栏挂载入口。 | AI Assistant & User |
| 2026-09-14 | v0.11.0 | 落地学生学习小组体系与双引擎花名册录入：1) 远端数据库为 `students` 表增加 `group_name` 字段及 `(class_id, group_name)` 复合索引；2) 新建 `app_configs` 全局配置表安全存储 CloudBase AI 网关配置（包含 Base URL 与 API Key，杜绝前端泄露）；3) 升级 `teacher-service` 云函数接入 `hunyuan-lite` 大模型及启发式降级；4) 花名册前端上线「一组、二组」微标展示与「本地 0 毫秒 + 🤖 AI 智能解析」双引擎，支持复杂文本与分组成员精准结构化批量入库。 | AI Assistant & User |




