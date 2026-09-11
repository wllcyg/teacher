---
name: miniprogram-development
description: 微信小程序全栈开发神级规范与最佳实践。涵盖项目架构、目录组织、微信免登（通过 openid 自动识别）、Icons8 极轻量图标系统、wx.cloud 云能力及微信开发者工具 CLI 联调规范。
alwaysApply: false
---

# WeChat Mini Program Development Rules (微信小程序开发全栈规范)

## 一、 核心使用契约 (Activation Contract)

在进行任何微信小程序页面、组件、云开发（CloudBase）以及打包部署任务时，必须遵循本规范：
- 小程序页面与组件开发；
- 整合 CloudBase 云能力（云数据库、云函数、云存储）；
- 微信生态免登与用户身份处理；
- 微信开发者工具预览、调试与发布规范。

---

## 二、 关键开发规约

### 1. 身份认证特性（核心原则）
- **微信端天然免登**：严禁开发传统的“账号密码注册/登录表单”！
- **身份标识获取**：在云函数中，通过 `cloud.getWXContext().OPENID` 获取用户唯一身份，以此进行数据隔离与权限校验。

### 2. 图标与素材推荐 (Icons8 规范)
- 当需要 TabBar 图标或轻量素材时，推荐使用 **Icons8 参数化 URL**：
  - URL 格式：`https://img.icons8.com/{style}/{size}/{color}/{icon-name}.png`
  - 参数规范：
    - `style`: `ios`（线性线框）或 `ios-filled`（实心填充）
    - `size`: `100`（100px，文件通常 < 3KB）
    - `color`: 六位十六进制色值（如未选为灰 `8E8E93`，激活为蓝 `2563EB`）
    - `icon-name`: 图标名称（如 `student`、`settings`、`check`）

### 3. AI 大模型原生接入规范
微信基础库 3.7.1+ 原生支持 AI 文本生成：
```javascript
const model = wx.cloud.extend.AI.createModel("deepseek");
const res = await model.streamText({
  data: {
    model: "deepseek-v3",
    messages: [
      { role: "system", content: "你是一位资深教师..." },
      { role: "user", content: userInput }
    ]
  }
});
for await (let str of res.textStream) {
  console.log(str);
}
```

### 4. 开发者工具联调指引
- 确保 `project.config.json` 或 `project.private.config.json` 配置了正确的 `appid`。
- 本地可通过 CLI 快速打开开发者工具：
  - Windows: `"C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" open --project "项目路径"`

### 5. 事件绑定黄金法则（核心规约）
- **必须全面强制使用 `@tap`，严禁使用 `@click`**：
  - 微信小程序底层的原生点击事件是 `bindtap`，在 Taro Vue 3 中，使用 `@tap` 会直接映射为小程序的原生 `bindtap`，响应最快、最可靠；
  - 严禁在模板中写 `@click`！因为 `@click` 会触发 Taro 的跨端合成点击判定逻辑（依赖 touchstart/touchend 时间差和移动距离计算），在复杂卡片嵌套、图标组件或模拟器鼠标点击时极其容易被误判丢失，导致“点击没有任何反应”！
- **微信开发者工具设置规范**：
  - 必须**取消勾选「启用代码自动热重载」**：Taro 的 Vite watch 已经在本地提供真正的增量热编译，若勾选微信自带的热重载，会导致二次冲突并破坏 Vue 响应式实例与事件监听器；
  - 必须**取消勾选「将 JS 编译成 ES5」**：Taro 已自带标准打包降级，防止双重转译。
