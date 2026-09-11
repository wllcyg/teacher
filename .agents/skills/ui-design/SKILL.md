---
name: ui-design
description: 腾讯云官方高保真 UI 设计与界面原型规范。严格执行「设计先行 (Design Specification First)」、拒绝陈词滥调的通用 AI 审美、严禁 Emoji 充当 Icon、强制使用专业矢量图标系统与特色配色排版。
alwaysApply: false
---

# UI Design Rules (高保真设计先行与界面规范)

## 一、 核心准则：设计先行 (Design Specification First)

在编写任何界面代码（Vue/WXML/CSS/TSX）前，必须先在脑海中或计划中确定 **Design Specification**：
1. **Purpose Statement (定位)**：明确本界面的用户与核心交互动线；
2. **Aesthetic Direction (审美方向)**：确定具体风格（如 Editorial、Warm Refined、Clean Light），拒绝含糊的“简约现代”；
3. **Color Palette (色彩体系)**：定义具体的 Hex 色值，使用主导色 + 鲜明点缀色；
4. **Professional Icons (专业图标)**：严禁使用 Emoji（🚀、⭐ 等）代替功能图标，必须使用专业矢量图标库（如 `@nutui/icons-vue-taro` / Heroicons / Lucide）。

---

## 二、 界面美学与避坑指南

### 1. 严禁的反模式 (Anti-Patterns)
- ❌ 严禁烂大街的紫粉渐变（`violet-to-fuchsia`）；
- ❌ 严禁纯居中死板堆叠；
- ❌ 严禁使用 Emoji 字符作为按钮或菜单图标；
- ❌ 严禁全白无层级。

### 2. 推荐的高级实践
- ✅ 温暖克制、带有质感的背景底色与层次分割；
- ✅ 使用统一图标系统，保持线宽与风格一致；
- ✅ 卡片带有轻盈微阴影与柔和圆角；
- ✅ 空状态精心设计插画底衬与清晰行动引导。
