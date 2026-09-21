/**
 * miniprogram/utils/config/finance-rates.js
 * 储蓄理财模块金融基准配置中心
 * 汇集国有大行最新挂牌存款利率、大额存单、国债、通胀率与 FIRE 自由测算基准
 */

// 1. 最新银行挂牌存款利率 (国有大行参考，单位: %)
const BANK_DEPOSIT_RATES = {
  current: { name: '活期存款', rate: 0.10, termMonths: 0 },
  term3M: { name: '定期 3个月', rate: 0.80, termMonths: 3 },
  term6M: { name: '定期 半年', rate: 1.00, termMonths: 6 },
  term1Y: { name: '定期 1年', rate: 1.10, termMonths: 12 },
  term2Y: { name: '定期 2年', rate: 1.20, termMonths: 24 },
  term3Y: { name: '定期 3年', rate: 1.50, termMonths: 36 },
  term5Y: { name: '定期 5年', rate: 1.55, termMonths: 60 }
};

// 2. 大额存单与储蓄国债参考利率 (%)
const LARGE_CD_RATES = {
  cd1Y: { name: '大额存单 1年期', rate: 1.45, minAmount: 200000 },
  cd2Y: { name: '大额存单 2年期', rate: 1.65, minAmount: 200000 },
  cd3Y: { name: '大额存单 3年期', rate: 1.90, minAmount: 200000 },
  treasury3Y: { name: '储蓄国债 3年期', rate: 1.93, minAmount: 100 },
  treasury5Y: { name: '储蓄国债 5年期', rate: 2.00, minAmount: 100 }
};

// 3. 通货膨胀率历史与预测参考档位 (%)
const INFLATION_PRESETS = [
  { label: '低通胀 (1.5%)', rate: 1.5, desc: '经济温和复苏，物价稳定' },
  { label: '温和通胀 (2.5%)', rate: 2.5, desc: '长期历史中枢水平 (推荐)' },
  { label: '中高通胀 (3.5%)', rate: 3.5, desc: '货币宽松期或大宗商品周期' },
  { label: '高通胀 (5.0%)', rate: 5.0, desc: '生活成本较快攀升压力' }
];

// 4. 定投历史参考收益率档位 (%)
const AIP_EXPECTED_RETURNS = [
  { label: '低风险固收+ (3.5%)', rate: 3.5, desc: '纯债/货币增强组合' },
  { label: '平衡配置 (6.0%)', rate: 6.0, desc: '股债 50:50 稳健配置' },
  { label: '宽基指数基金 (8.0%)', rate: 8.0, desc: '沪深300/中证500长期年化 (推荐)' },
  { label: '进取权益基金 (10.0%)', rate: 10.0, desc: '偏股混合/优质成长组合' }
];

// 5. FIRE 财务自由提现率标准与预设支出
const FIRE_CONFIG = {
  // 安全提现率 (Safe Withdrawal Rate)
  ruleTypes: {
    classic: { name: '经典 FIRE', swr: 4.0, multiplier: 25, desc: '国际通用的 4% 原则，满足 30+ 年生活' },
    lean: { name: '瘦 FIRE (极简)', swr: 5.0, multiplier: 20, desc: '维持极简日常基本开销，更早达成' },
    fat: { name: '肥 FIRE (富足)', swr: 3.0, multiplier: 33.3, desc: '高品质生活与宽裕旅行预算，抗周期强' },
    coast: { name: '海岸 FIRE', swr: 4.0, desc: '前期攒够本金后不再追加，本金复利到退休' }
  },
  // 推荐月支出参考 (元/月)
  monthlyExpensePresets: [
    { label: '极简生活 (¥4,000/月)', value: 4000 },
    { label: '舒适生活 (¥8,000/月)', value: 8000 },
    { label: '品质中产 (¥15,000/月)', value: 15000 },
    { label: '宽裕富足 (¥25,000/月)', value: 25000 }
  ]
};

module.exports = {
  BANK_DEPOSIT_RATES,
  LARGE_CD_RATES,
  INFLATION_PRESETS,
  AIP_EXPECTED_RETURNS,
  FIRE_CONFIG
};
