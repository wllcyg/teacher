// utils/config/insurance-rules.js

/**
 * 常见重疾平均治疗与康复费用基准 (国家癌症中心与行业白皮书均值)
 */
const ILLNESS_COST_BENCHMARKS = {
  tumor: { name: '恶性肿瘤 (重度)', avgCost: 400000, rehabYears: 3, desc: '含靶向药、免疫治疗及 3 年营养康复' },
  heart: { name: '急性心肌梗死', avgCost: 200000, rehabYears: 2, desc: '含搭桥手术、介入支架及康复' },
  stroke: { name: '严重脑中风后遗症', avgCost: 350000, rehabYears: 5, desc: '长期照护、专人陪护与神经康复' },
  general: { name: '通用重疾综合基准', avgCost: 300000, rehabYears: 3, desc: '全国重疾险理赔大数据综合均值' }
};

/**
 * 百万医疗险与医保报销基准预设
 */
const MEDICAL_REIMBURSE_PRESETS = {
  general: {
    name: '常规住院',
    defaultTotalCost: 80000,
    inScopeRatio: 0.75, // 目录内占比 75%
    desc: '普通单病种手术住院，大部分为医保甲乙类药物'
  },
  severe: {
    name: '重大疾病综合治疗',
    defaultTotalCost: 300000,
    inScopeRatio: 0.55, // 目录内占比 55%
    desc: '涉及部分进口特药、ICU重症监护及自费耗材'
  },
  targeted: {
    name: '肿瘤特药/高精尖技术',
    defaultTotalCost: 600000,
    inScopeRatio: 0.40, // 目录内占比仅 40% (大量自费靶向药与质子重离子)
    desc: '大量社保目录外自费昂贵抗癌靶向药、质子重离子放疗'
  }
};

/**
 * 保费占家庭收入健康安全水位 (双十原则)
 */
const PREMIUM_BUDGET_RATIOS = {
  lean: { ratio: 0.05, label: '经济型 (5%)', desc: '保额够用，杠杆极高，不挤占生活现金流' },
  standard: { ratio: 0.08, label: '标准平衡型 (8%)', desc: '全面覆盖重疾、定期寿险与百万医疗' },
  comfort: { ratio: 0.10, label: '全面充裕型 (10%)', desc: '家庭保费黄金上限，超此比例可能造成还款压力' }
};

module.exports = {
  ILLNESS_COST_BENCHMARKS,
  MEDICAL_REIMBURSE_PRESETS,
  PREMIUM_BUDGET_RATIOS
};
