---
name: wechat-miniprogram-ui-design
description: 顶尖微信小程序专属 UI/UX 设计与高质感前端开发规范。严格遵循微信官方设计指南 (WeChat Design System)，专精 750rpx 响应式系统、刘海与底部 Home Bar 安全区适配、右侧微信胶囊避让、44px 手指点击热区、原生触感振动反馈 (Haptics) 及单包体积轻量化。编写任何小程序页面时必须遵循。
alwaysApply: false
---

# 微信小程序专属 UI/UX 设计规范 (WeChat Design System)

本规范专为打造**符合微信官方设计哲学、具备媲美原生体验与现代高质感**的微信小程序界面而制定。告别 Web 端 PC 思维，全面适配移动触控与微信生态特性。

---

## 一、 核心设计哲学 (Design Philosophy)

1. **友好与高效 (Friendly & Efficient)**：
   - 遵循微信官方四大准则：**清晰、友好、高效、一致**；
   - **单页面单任务**：界面视觉焦点集中，减少干扰；
   - **触控优先**：所有可点击元素与按钮的热区必须保持在 **至少 44px × 44px (88rpx × 88rpx)**，彻底杜绝小屏幕误触。

2. **移动端安全区与屏幕适配 (Safe Area & Layout)**：
   - **基准分辨率**：严格基于 **750rpx** 移动端自适应体系；
   - **底部 Home Bar 避让**：所有固定底栏（如提交按钮、TabBar、ActionSheet）必须严格包含安全区 padding：
     ```less
     padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
     ```
   - **顶部微信胶囊避让**：如使用自定义导航栏，必须动态获取胶囊高度与状态栏，右侧预留 180rpx 以上避让微信原生胶囊菜单。

---

## 二、 微信小程序专属色彩与排版规范

### 1. 现代浅色层级调色板 (WeChat Light Palette)
* **页面画布背景 (Page Canvas)**：`#F7F8FA`（微信生态经典浅灰底，柔和护眼、衬托卡片）；
* **内容卡片容器 (Card Surface)**：`#FFFFFF`（纯白卡片，结合 16rpx~24rpx 圆角与柔和微阴影）；
* **品牌主色 (Primary Accent)**：`#2563EB`（教育/专业蓝）或 `#07C160`（微信经典绿）；
* **文字阶梯 (Typography Scale)**：
  * **重点标题 / 核心数字**：`36rpx - 40rpx`，字重 600，颜色 `#1E293B`（Slate-800，非死黑）；
  * **正文标题 / 学生姓名**：`30rpx - 32rpx`，字重 500，颜色 `#334155`；
  * **次要文字 / 描述备注**：`26rpx - 28rpx`，颜色 `#64748B`；
  * **微元数据 / 提示徽标**：`22rpx - 24rpx`，颜色 `#94A3B8`。

### 2. 状态与徽标色彩规范 (Micro Badges)
* **👑 组长专属金**：背景 `#FEF3C7`，文字 `#B45309`，边框 `rgba(245, 158, 11, 0.2)`；
* **班主任 / 优秀**：背景 `#ECFDF5`，文字 `#059669`；
* **待办 / 提醒**：背景 `#FEF2F2`，文字 `#DC2626`；
* **普通小组 / 标签**：背景 `#F1F5F9`，文字 `#475569`。

---

## 三、 微信原生触感与动效 (Haptics & Micro-Interactions)

为了让小程序拥有媲美原生 App 的细腻质感，关键交互必须注入**微信原生微触感**：

1. **触控振动反馈 (Haptics)**：
   * 在用户点击「成功保存」、「完成待办」、「切换 Tab」、「勾选组长」等关键交互时，主动调用：
     ```typescript
     import Taro from '@tarojs/taro'
     // 轻微触感震动
     Taro.vibrateShort({ type: 'light' })
     ```
2. **按压反馈 (Active State)**：
   * 所有卡片与按钮必须定义 `:active` 按压微缩放态：
     ```less
     .card-item:active {
       transform: scale(0.98);
       opacity: 0.92;
       transition: all 0.15s ease;
     }
     ```

---

## 四、 页面结构与空状态 (Empty State) 准则

1. **卡片式呼吸感布局**：
   * 页面四周统一留白 `24rpx - 32rpx`；
   * 卡片之间外边距 `16rpx - 24rpx`，严禁贴边无缝挤压。
2. **拒绝冰冷的一行字空状态**：
   * 无学生/无班级时，必须具备：**轻量矢量插画 + 情感化文案（“还没有录入学生哦”）+ 醒目的主要行动按钮（CTA）**。

---

## 五、 性能与轻量化规约 (Performance First)

1. **严禁本地堆放图片**：
   * 微信小程序单包限制 2MB，严禁将大量 png/jpg 打入主包；
   * 全面采用矢量图标组件（`@nutui/icons-vue-taro`）或通过 CDN/Icons8 参数化加载。
2. **列表滚动优化**：
   * 长花名册列表使用页面级滚动或 `scroll-view`，避免单次渲染超过 100 个复杂节点。
