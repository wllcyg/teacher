/**
 * miniprogram/utils/config/mortgage-lpr.js
 * 央行最新基准利率 (LPR)、公积金利率与全国主要城市公积金政策基准
 */

// 2026年现行央行贷款市场报价利率 (LPR)
const LPR_CONFIG = {
  version: '2026.01',
  lpr1Year: 3.10,        // 1年期 LPR
  lpr5Year: 3.10,        // 5年期以上 LPR (房贷核心参考基准)
  updateTime: '2026-01-20'
};

// 全国现行住房公积金贷款基准利率
const FUND_RATE_CONFIG = {
  firstHome: {
    within5Years: 2.35,  // 5年期及以下 (首套)
    over5Years: 2.85     // 5年期以上 (首套)
  },
  secondHome: {
    within5Years: 2.775, // 5年期及以下 (二套)
    over5Years: 3.325    // 5年期以上 (二套)
  }
};

// 重点城市公积金贷款最高额度上限 (万元)
const CITY_FUND_LIMITS = {
  '北京': { single: 120, couple: 120, maxMultiple: 20 },
  '上海': { single: 80, couple: 160, maxMultiple: 15 },
  '广州': { single: 80, couple: 130, maxMultiple: 20 },
  '深圳': { single: 60, couple: 110, maxMultiple: 14 },
  '杭州': { single: 100, couple: 100, maxMultiple: 15 },
  '成都': { single: 60, couple: 100, maxMultiple: 20 },
  '南京': { single: 50, couple: 100, maxMultiple: 15 },
  '武汉': { single: 90, couple: 120, maxMultiple: 20 },
  '通用': { single: 80, couple: 120, maxMultiple: 15 }
};

// 契税现行政策（以 140㎡ 为分界线的新政）
const DEED_TAX_RATES = {
  firstHome: {
    belowOrEqual140: 0.01,  // 首套且 ≤140㎡: 1.0%
    above140: 0.015         // 首套且 >140㎡: 1.5%
  },
  secondHome: {
    belowOrEqual140: 0.01,  // 二套且 ≤140㎡: 1.0%
    above140: 0.02          // 二套且 >140㎡: 2.0%
  },
  thirdHome: 0.03           // 三套及以上: 3.0%
};

module.exports = {
  LPR_CONFIG,
  FUND_RATE_CONFIG,
  CITY_FUND_LIMITS,
  DEED_TAX_RATES
};
