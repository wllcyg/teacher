/**
 * miniprogram/utils/config/tax-social.js
 * 02·工资个税与社保公积金基准配置中心
 * 覆盖国家税务总局个人所得税税率表、专项附加扣除新规、全国主要城市社保公积金基数标准及年终奖盲区数据
 */

// 1. 年度综合所得超额累进个税税率表 (综合所得 7 级)
const ANNUAL_TAX_RATES = [
  { min: 0, max: 36000, rate: 0.03, quickDeduction: 0 },
  { min: 36000, max: 144000, rate: 0.10, quickDeduction: 2520 },
  { min: 144000, max: 300000, rate: 0.20, quickDeduction: 16920 },
  { min: 300000, max: 420000, rate: 0.25, quickDeduction: 31920 },
  { min: 420000, max: 660000, rate: 0.30, quickDeduction: 52920 },
  { min: 660000, max: 960000, rate: 0.35, quickDeduction: 85920 },
  { min: 960000, max: Infinity, rate: 0.45, quickDeduction: 181920 }
];

// 2. 年终奖单独计税按月换算税率表 (应纳税所得额 = 年终奖 / 12)
const MONTHLY_TAX_RATES = [
  { min: 0, max: 3000, rate: 0.03, quickDeduction: 0 },
  { min: 3000, max: 12000, rate: 0.10, quickDeduction: 210 },
  { min: 12000, max: 25000, rate: 0.20, quickDeduction: 1410 },
  { min: 25000, max: 35000, rate: 0.25, quickDeduction: 2660 },
  { min: 35000, max: 55000, rate: 0.30, quickDeduction: 4410 },
  { min: 55000, max: 80000, rate: 0.35, quickDeduction: 7160 },
  { min: 80000, max: Infinity, rate: 0.45, quickDeduction: 15160 }
];

// 3. 年终奖 6 大临界点及税率盲区区间 (多发 1 元，税后少拿千元至万元)
const BONUS_BLIND_ZONES = [
  {
    threshold: 36000,
    blindMin: 36000.01,
    blindMax: 38566.67,
    diffAtThreshold: 2310.10,
    safeAmount: 36000,
    tip: '发 36,001 元税后比 36,000 元少拿约 2,310 元'
  },
  {
    threshold: 144000,
    blindMin: 144000.01,
    blindMax: 160500.00,
    diffAtThreshold: 13200.20,
    safeAmount: 144000,
    tip: '发 144,001 元税后比 144,000 元少拿约 13,200 元'
  },
  {
    threshold: 300000,
    blindMin: 300000.01,
    blindMax: 318333.33,
    diffAtThreshold: 13750.25,
    safeAmount: 300000,
    tip: '发 300,001 元税后比 300,000 元少拿约 13,750 元'
  },
  {
    threshold: 420000,
    blindMin: 420000.01,
    blindMax: 447500.00,
    diffAtThreshold: 19250.30,
    safeAmount: 420000,
    tip: '发 420,001 元税后比 420,000 元少拿约 19,250 元'
  },
  {
    threshold: 660000,
    blindMin: 660000.01,
    blindMax: 706538.46,
    diffAtThreshold: 30250.35,
    safeAmount: 660000,
    tip: '发 660,001 元税后比 660,000 元少拿约 30,250 元'
  },
  {
    threshold: 960000,
    blindMin: 960000.01,
    blindMax: 1120000.00,
    diffAtThreshold: 88000.45,
    safeAmount: 960000,
    tip: '发 960,001 元税后比 960,000 元少拿约 88,000 元'
  }
];

// 4. 专项附加扣除标准 (2024~2026 最新标准)
const SPECIAL_DEDUCTIONS_CONFIG = {
  babyCare: {
    name: '3岁以下婴幼儿照护',
    unit: '元/月/孩',
    defaultAmount: 2000
  },
  childEducation: {
    name: '子女教育',
    unit: '元/月/孩',
    defaultAmount: 2000
  },
  elderlyCare: {
    name: '赡养老人',
    onlyChild: 3000,     // 独生子女 3000元/月
    nonOnlyChildMax: 1500 // 非独生子女分摊，每人最高1500元/月
  },
  housingLoan: {
    name: '住房贷款利息',
    unit: '元/月',
    defaultAmount: 1000
  },
  housingRent: {
    name: '住房租金',
    tier1: 1500, // 直辖市、省会、计划单列市
    tier2: 1100, // 市辖区户籍人口超过100万的城市
    tier3: 800   // 市辖区户籍人口不超过100万的城市
  },
  continuingEducation: {
    name: '继续教育',
    degree: 400,     // 学历继续教育 400元/月 (最长48个月)
    vocational: 3600 // 职业资格 3600元/年
  },
  medicalExpense: {
    name: '大病医疗',
    threshold: 15000, // 起扣线 15000元/年
    maxDeduction: 80000 // 最高扣除限额 80000元/年
  }
};

// 5. 全国主要城市社保公积金基准参数
const CITY_SOCIAL_CONFIG = {
  beijing: {
    cityName: '北京',
    avgSalary: 11297, // 社平基准参考
    socialMin: 6326,  // 社保下限
    socialMax: 35283, // 社保上限 (社平300%)
    fundMin: 2420,    // 公积金下限
    fundMax: 35283,   // 公积金上限
    rentDeduction: 1500, // 租金扣除标准
    rates: {
      pension: { personal: 0.08, company: 0.16 },       // 养老
      medical: { personal: 0.02, company: 0.098, personalExtra: 3 }, // 医疗 (大病附加3元)
      unemployment: { personal: 0.005, company: 0.005 }, // 失业
      injury: { personal: 0, company: 0.004 },          // 工伤 (浮动基准)
      maternity: { personal: 0, company: 0 },           // 生育 (合并入医疗)
      fund: { personal: 0.12, company: 0.12 }           // 公积金 (默认12%，可选5%~12%)
    }
  },
  shanghai: {
    cityName: '上海',
    avgSalary: 12183,
    socialMin: 7384,
    socialMax: 36921,
    fundMin: 2690,
    fundMax: 36921,
    rentDeduction: 1500,
    rates: {
      pension: { personal: 0.08, company: 0.16 },
      medical: { personal: 0.02, company: 0.10 },
      unemployment: { personal: 0.005, company: 0.005 },
      injury: { personal: 0, company: 0.0026 },
      maternity: { personal: 0, company: 0 },
      fund: { personal: 0.07, company: 0.07 } // 上海公积金常规7% (补充公积金最高5%)
    }
  },
  guangzhou: {
    cityName: '广州',
    avgSalary: 10449,
    socialMin: 5284,
    socialMax: 26421,
    fundMin: 2300,
    fundMax: 38082,
    rentDeduction: 1500,
    rates: {
      pension: { personal: 0.08, company: 0.15 },
      medical: { personal: 0.02, company: 0.055 },
      unemployment: { personal: 0.002, company: 0.008 },
      injury: { personal: 0, company: 0.002 },
      maternity: { personal: 0, company: 0 },
      fund: { personal: 0.12, company: 0.12 }
    }
  },
  shenzhen: {
    cityName: '深圳',
    avgSalary: 11620,
    socialMin: 3523, // 养老下限执行深圳最低工资/社保规范
    socialMax: 35160,
    fundMin: 2360,
    fundMax: 35160,
    rentDeduction: 1500,
    rates: {
      pension: { personal: 0.08, company: 0.15 },
      medical: { personal: 0.02, company: 0.06 }, // 一档医疗
      unemployment: { personal: 0.003, company: 0.007 },
      injury: { personal: 0, company: 0.0017 },
      maternity: { personal: 0, company: 0 },
      fund: { personal: 0.12, company: 0.12 }
    }
  },
  hangzhou: {
    cityName: '杭州',
    avgSalary: 9811,
    socialMin: 4462,
    socialMax: 24060,
    fundMin: 2280,
    fundMax: 38390,
    rentDeduction: 1500,
    rates: {
      pension: { personal: 0.08, company: 0.16 },
      medical: { personal: 0.02, company: 0.095 },
      unemployment: { personal: 0.005, company: 0.005 },
      injury: { personal: 0, company: 0.002 },
      maternity: { personal: 0, company: 0 },
      fund: { personal: 0.12, company: 0.12 }
    }
  },
  chengdu: {
    cityName: '成都',
    avgSalary: 8466,
    socialMin: 4246,
    socialMax: 22536,
    fundMin: 2100,
    fundMax: 29353,
    rentDeduction: 1500,
    rates: {
      pension: { personal: 0.08, company: 0.16 },
      medical: { personal: 0.02, company: 0.075 },
      unemployment: { personal: 0.004, company: 0.006 },
      injury: { personal: 0, company: 0.002 },
      maternity: { personal: 0, company: 0 },
      fund: { personal: 0.12, company: 0.12 }
    }
  },
  general: {
    cityName: '其他城市 (通用基准)',
    avgSalary: 8000,
    socialMin: 3800,
    socialMax: 22000,
    fundMin: 2000,
    fundMax: 25000,
    rentDeduction: 1100,
    rates: {
      pension: { personal: 0.08, company: 0.16 },
      medical: { personal: 0.02, company: 0.08 },
      unemployment: { personal: 0.005, company: 0.005 },
      injury: { personal: 0, company: 0.004 },
      maternity: { personal: 0, company: 0 },
      fund: { personal: 0.12, company: 0.12 }
    }
  }
};

// 个税起征减除费用基准 (元/月)
const TAX_EXEMPTION_PER_MONTH = 5000;

// 国家法定月平均计薪天数
const STATUTORY_WORKING_DAYS = 21.75;

module.exports = {
  ANNUAL_TAX_RATES,
  MONTHLY_TAX_RATES,
  BONUS_BLIND_ZONES,
  SPECIAL_DEDUCTIONS_CONFIG,
  CITY_SOCIAL_CONFIG,
  TAX_EXEMPTION_PER_MONTH,
  STATUTORY_WORKING_DAYS
};
