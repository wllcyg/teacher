# 教师工作台小程序：实时课时雷达与今日课堂笔记模块实现计划

## 概述
将当前小程序的首页（[pages/index/index](file:///Users/moliang/Desktop/coder/teacher/app/miniprogram/pages/index/index.wxml)）完善为与 Web 端 [Today.tsx](file:///Users/moliang/Desktop/coder/teacher/frontend/src/pages/Today.tsx) **业务逻辑 100% 对齐、视觉体验原生高保真** 的教学核心看板。

本模块聚焦实现教师最核心的日常教学闭环：
1. **班级分段快捷切换**：随时切换当前关注班级；
2. **实时正在上课卡片（课时雷达）**：分钟级倒计时、上课进度百分比条、动态呼吸灯状态；
3. **课后即时记录（记课堂）**：随堂记录讲课进度、背诵过关要求，与生产数据 `lesson_log` 打通；
4. **状态联动提示条**：精准呈现「这是今天最后一节课了」或「下一节课预告」；
5. **今日课堂笔记时光清单**：按节次时间线陈列今日备课与上课内容，支持随时回看与编辑。

---

## 页面架构与视觉设计规范 (WeChat Light UI)

```
┌────────────────────────────────────────────────────────┐
│ 1. 顶部班级分段选择器 (Segmented Bar)                    │
│    [ 八4班 ]   [ 八10班 ]   [ 八9班 ]   [ 八3班 ]       │
├────────────────────────────────────────────────────────┤
│ 2. 实时正在上课卡片 (Live Lesson Card) - 渐变紫底        │
│    ● 正在上课  [ 还剩 14 分钟 ]        🕒 20:35-21:20 69%│
│    第11节 八10班 · 地理                                │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━ (紫色动态进度条 69%)       │
│    [ 📖 记课堂 / 已记课堂 ]          [ ✏️ 记一笔 ]        │
├────────────────────────────────────────────────────────┤
│ 3. 提示状态条 (Status Banner)                           │
│    这是今天最后一节课了 / 下一节：第X节 八X班 · 地理       │
├────────────────────────────────────────────────────────┤
│ 4. 今日课堂笔记卡片 (Today's Lesson Notes)               │
│    📖 今日课堂笔记  ( 3条已记 )              全部记录 ➔  │
│    ┌──────────────────────────────────────────────┐    │
│    │ [第7节 · 八9班 · 地理]               ✏️ 编辑   │    │
│    │ 讲第一章第三节                                 │    │
│    ├──────────────────────────────────────────────┤    │
│    │ [第8节 · 八4班 · 地理]               ✏️ 编辑   │    │
│    │ 讲第一章第三节                                 │    │
│    ├──────────────────────────────────────────────┤    │
│    │ [第10节 · 八9班 · 地理]              ✏️ 编辑   │    │
│    │ 背第一章第二节，第三节                         │    │
│    └──────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

---

## 核心算法规格设计 (复刻 Web 端)

### 1. 课时实时命中算法 (`calcCurrentLesson`)
- 获取当前时刻分钟数：`nowMinutes = hour * 60 + minute`；
- 从周排课中提取今日（如 `周一`）的排课清单 `todayLessons`，与 school periods（11 节）对齐；
- 命中判断：找到满足 `startMinutes <= nowMinutes < endMinutes` 的课程作为 `currentLesson`；
- 剩余时间：`remainMinutes = endMinutes - nowMinutes`；
- 上课进度：
  $$\text{progressPct} = \text{Math.round}\left(\frac{\text{nowMinutes} - \text{startMinutes}}{\text{endMinutes} - \text{startMinutes}} \times 100\right)$$
- 动态计时：启动 10 秒微型时钟监听，跨节次时自动无缝切课。

### 2. 课程后续状态推理算法 (`calcNextStatus`)
- 若当前正处于某节课：
  - 在今日课表中查找在此课之后是否还有课；
  - 若无后续排课 $\rightarrow$ 提示 **「这是今天最后一节课了」**；
  - 若有后续排课 $\rightarrow$ 提示 `接下来：第X节 班级·科目 (起止时间)`；
- 若当前未处于上课中：
  - 寻找今天首个尚未结束的课（`endMinutes > nowMinutes`）作为 `nextLesson`；
  - 若今天所有课均已结束 $\rightarrow$ 提示 **「今天的课上完了」**；
  - 若今日整天无课 $\rightarrow$ 提示 **「今天没有排课」**。

### 3. 「记课堂」完成态感知算法 (`isLessonRecorded`)
- 比对 `todayLogs`（今日日志）中是否已存在当前节次和班级的记录；
- 若已记录：按钮呈现绿色轻量态 `[ 已记课堂 ]`，背景为浅绿 `#ECFDF5`，文字 `#059669`；
- 若未记录：按钮呈现标准紫色轮廓态 `[ 记课堂 ]`，文字 `#4F46E5`。

---

## Proposed Changes

### 后端与云数据库层 (CloudBase)

#### [MODIFY] [cloudfunctions/teacher-service/index.js](file:///Users/moliang/Desktop/coder/teacher/app/cloudfunctions/teacher-service/index.js)
- 新增 `getTodayLessonLogs` 动作：根据当前老师 openid 和指定日期查询今日课堂记录列表；
- 新增 `saveLessonLog` 动作：新增或更新某节课的课堂笔记内容（支持输入教学内容、背诵要求等）；
- 新增 `deleteLessonLog` 动作：删除课堂笔记。

#### [NEW] [cloudbase/migrations/20260914210000_create_lesson_logs.sql](file:///Users/moliang/Desktop/coder/teacher/cloudbase/migrations/20260914210000_create_lesson_logs.sql)
- 建立 `public.dev_lesson_logs` 和 `public.prd_lesson_logs` 表，保存日期、班级、节次、教学内容与时间戳。

---

### 小程序前端层 (Mini Program)

#### [MODIFY] [pages/index/index.json](file:///Users/moliang/Desktop/coder/teacher/app/miniprogram/pages/index/index.json)
- 引入 TDesign 必要的 `t-tag`、`t-icon`、`t-button`、`t-popup` 等弹窗与交互组件。

#### [MODIFY] [pages/index/index.wxml](file:///Users/moliang/Desktop/coder/teacher/app/miniprogram/pages/index/index.wxml)
- 构建顶部分段班级栏；
- 构建「正在上课」高保真紫色渐变卡片与动态进度条；
- 构建「这是今天最后一节课了」次级提示卡片；
- 构建「今日课堂笔记」列表卡片（带节次徽标、内容文字与编辑按钮）；
- 构建「记课堂」底部抽屉录入弹窗（输入课次教学内容、备课记录）。

#### [MODIFY] [pages/index/index.wxss](file:///Users/moliang/Desktop/coder/teacher/app/miniprogram/pages/index/index.wxss)
- 严格遵循微信小程序 750rpx 响应式设计：
  - 呼吸脉冲光晕 `@keyframes pulse`；
  - 进度条平滑渐变与过渡动画；
  - 触摸按压态反馈 `:active { transform: scale(0.98); opacity: 0.92; }`；
  - 优雅的边框、背景渐变与徽标配色。

#### [MODIFY] [pages/index/index.js](file:///Users/moliang/Desktop/coder/teacher/app/miniprogram/pages/index/index.js)
- 数据联动与生命周期：
  - `onLoad` & `onShow`：拉取班级列表、作息表、课表与今日课堂笔记；
  - 启动秒级/10秒级时钟计算实时课时与倒计时；
  - 实现班级分段切换联动；
  - 实现「记课堂」弹窗打开、表单提交与静默数据更新；
  - 原生震动触感 `wx.vibrateShort({ type: 'light' })` 融入保存与切换。

---

## 验证与自测计划

1. **时钟算法正确性验证**：
   - 在不同时段（如早读、上课中、课间大课间、晚自习第11节、深夜）验证卡片渲染，确保精准命中「正在上课」或「这是今天最后一节课了」；
   - 验证进度百分比与剩余分钟数的数值准确性。
2. **课堂记录闭环验证**：
   - 在正在上课卡片点击「记课堂」录入文字并保存；
   - 验证按钮状态是否立即无缝变为绿色的「已记课堂」；
   - 验证下方「今日课堂笔记」列表是否立即新增一条并展示「N条已记」。
3. **班级切换联动验证**：
   - 切换顶部「八4班」、「八10班」等标签，验证选中状态及相关联动作。
