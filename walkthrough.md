# 08 · 保险测算模块与全模块组件化重构报告

## 一、 保险测算模块落地概要 (Insurance Calculation Suite)

依据 [08_保险测算模块实现计划.md](file:///Users/moliang/Desktop/coder/teacher/app/plans/08_%E4%BF%9D%E9%99%A9%E6%B5%8B%E7%AE%97%E6%A8%A1%E5%9D%97%E5%AE%9E%E7%8E%B0%E8%AE%A1%E5%88%92.md) 与 PRD 针对市面空白品类的重点规划，完整构建了**去销售化、中立客观的家庭科学保险精算系统**。

### 核心子工具与算法功能清单

1. **重疾险合理保额测算器 (`calcCriticalIllness`)**：
   - **需求法数学模型**：$\text{建议保额} = \text{前沿医疗靶向药自费} + (\text{年收入} \times \text{康复停工年数}) + (\text{个人负债} \times \text{兜底比}) - \text{已有保障抵扣}$；
   - 输出基础版保额下限、充裕版保额推荐值；
   - 给出符合家庭财务安全的双十原则年保费黄金区间（年收入 4%~8%），防范保费倒挂。
2. **寿险责任规划计算器 (`calcLifeInsurance`)**：
   - **双模型支持**：
     - **模型 A：遗属需求法（精准推荐）**：全面核算房贷车贷负债余额、子女直至独立教育金、父母赡养医疗应急金与 3~5 年家庭日常开销生活过渡缓冲金；
     - **模型 B：生命价值法（收入损失法）**：年薪 × 核心家庭抚养责任年限；
   - 输出定期寿险（高杠杆保至60岁）优选建议与负债覆盖率分析。
3. **社保医保 vs 百万医疗险报销对比计算器 (`calcMedicalReimburse`)**：
   - 真实剖析**医保自费黑洞**（进口特药、靶向药、质子重离子及社保目录外自费耗材）；
   - 动态推演**仅有社保时的个人高额自付**对比**社保 + 百万医疗险后的极低自付（仅免赔额）**；
   - 视觉呈现直观的费用构成拆解条与减负比例，量化商保挽回损失。

---

## 二、 组件化架构与文件组织

按照项目最新的组件化标准，保险模块完全独立封装在 [components/calc-insurance/](file:///Users/moliang/Desktop/coder/teacher/app/miniprogram/components/calc-insurance/)，不侵入主页面：

```
miniprogram/
├── utils/
│   ├── config/insurance-rules.js          # 重疾平均治疗费、医保目录预设与保费合理比例
│   └── calculators/insurance.js           # 3 大保险算法高精度纯函数
├── components/calc-insurance/             # 保险测算业务组件
│   ├── calc-insurance.json
│   ├── calc-insurance.wxml                # 纯白大卡片、指标网格与对比柱状图
│   ├── calc-insurance.wxss                # 医疗报销三色进度条样式
│   └── calc-insurance.js                  # 自驱动计算与参数响应
└── pages/
    ├── index/                             # 首页增加「重疾保额」横滑芯片与保险分类卡片直达
    └── result/                            # 纯净 Master-Detail 容器挂载
```

---

## 三、 全模块一步到位组件化架构成效汇总

结合上一阶段的一步到位重构，`pages/result/` 现已彻底成为百行以内的纯净容器页，所有 5 大核心模块全部下沉为独立业务组件：

| 模块名称 | 承接组件 | 说明 |
| :--- | :--- | :--- |
| **房贷测算** | `calc-mortgage` | 商业/公积金/组合贷、还款方式、月供计划表抽屉 |
| **工资个税** | `calc-salary` | 正算/倒推、五险一金、7项专项扣除、加班与离职补偿抽屉 |
| **购车用车** | `calc-car` | 全包落地总价、车贷分期真实IRR、油电能耗对比、保值率折旧抽屉 |
| **储蓄理财** | `calc-saving` | 复利追加、定投敏感性、大额存单、FIRE自由、通胀购买力 |
| **保险测算** | `calc-insurance` | 重疾合理保额、寿险责任规划、医保 vs 百万医疗报销对比 |
| **生活日常** | `daily-job` / `daily-renovation` / `daily-living` / `daily-health` | 23 项日常生活、职场与健康仪式工具 |

- **`pages/result/result.wxml`**：由原 2,455 行降至 **84 行**；
- **`pages/result/result.js`**：由原 1,199 行降至 **93 行**；
- 架构清晰，各模块互不耦合，性能与可维护性全面提升。

---

## 四、 自动化质量验证结果

1. **测试套件运行**：
   - 运行：`node app/test-insurance.js && node app/test-daily.js && node app/test-finance.js`
   - 结果：全部 3 项保险算法、23 项生活日常算法与 7 项储蓄理财算法 **100% 验证通过**。
2. **静态语法检查**：
   - 对全部新增组件及页面文件执行 `node -c` 语法检查，无任何语法错误。
