/**
 * miniprogram/utils/config/car-rules.js
 * 03·购车用车规则配置中心
 * 覆盖车辆购置税新政、排量车船税基准表、法定交强险、商业险估算模型与油电能耗基准
 */

// 1. 车船税排量阶梯基准配置表 (按发动机排量与动力类型)
const VEHICLE_TAX_TIERS = [
  { id: 't1', maxDisplacement: 1.0, label: '1.0L (含) 以下', annualTax: 180 },
  { id: 't2', maxDisplacement: 1.6, label: '1.0L ~ 1.6L (含)', annualTax: 360 }, // 主流家用车
  { id: 't3', maxDisplacement: 2.0, label: '1.6L ~ 2.0L (含)', annualTax: 420 },
  { id: 't4', maxDisplacement: 2.5, label: '2.0L ~ 2.5L (含)', annualTax: 720 },
  { id: 't5', maxDisplacement: 3.0, label: '2.5L ~ 3.0L (含)', annualTax: 1800 },
  { id: 't6', maxDisplacement: 4.0, label: '3.0L ~ 4.0L (含)', annualTax: 3000 },
  { id: 't7', maxDisplacement: Infinity, label: '4.0L 以上', annualTax: 4500 }
];

// 2. 购置税政策配置
const PURCHASE_TAX_CONFIG = {
  vatRate: 0.13, // 汽车销售增值税税率 13%
  fuelTaxRate: 0.10, // 燃油车法定购置税率 10%
  // 新能源政策 (财政部公告2023年第10号)
  nevCurrentPolicy: {
    year: 2026,
    maxExemptionAmount: 30000, // 免税限额最高 30,000 元 (对应发票价 33.9 万元内全免)
    discountRate: 0 // 0 表示全免 (在限额内)
  }
};

// 3. 法定交强险标准 (家用小客车)
const COMPULSORY_INSURANCE = {
  under6Seats: 950, // 6座以下 950元/年
  over6Seats: 1100  // 6座及以上 1100元/年
};

// 4. 商业险基准预估参数 (车损 + 三者300万 + 司乘险)
const COMMERCIAL_INSURANCE_PRESETS = {
  baseAmount: 1200, // 基础固定险种
  carLossRate: 0.012 // 车损险随车价系数 1.2%
};

// 5. 能耗与用车常态基准参数
const RUNNING_COST_PRESETS = {
  // 燃油车
  fuel: {
    defaultConsumptionPer100Km: 7.5, // 7.5L / 100km
    price92: 7.80, // 92# 汽油基准价 (元/L)
    price95: 8.35, // 95# 汽油基准价 (元/L)
    annualMaintenanceCost: 1500, // 年均保养 (机油机滤等)
    annualInsuranceAvg: 4200 // 年均保险
  },
  // 纯电动车
  electric: {
    defaultConsumptionPer100Km: 14.5, // 14.5 kWh / 100km
    homeElectricityPrice: 0.35, // 家充谷电 (元/度)
    publicElectricityPrice: 1.30, // 公用快充桩加权 (元/度)
    defaultHomeRatio: 0.7, // 默认 70% 家充 + 30% 公桩
    annualMaintenanceCost: 500, // 电车年均保养 (空滤、刹车油、电池健康检测)
    annualInsuranceAvg: 5200 // 电车车险普遍略高
  },
  // 公共通用费用
  common: {
    defaultAnnualMileage: 15000, // 默认年行驶里程 15,000 公里
    annualParkingHighway: 3000 // 停车与高速通行费
  }
};

// 6. 二手车保值率衰减模型参数
const DEPRECIATION_RATES = {
  firstYearRate: 0.18, // 第1年折旧率 18%
  annualSubsequentRate: 0.08, // 随后每年折旧率 8%
  minResidualRate: 0.20 // 最低残值率下限保底 20%
};

module.exports = {
  VEHICLE_TAX_TIERS,
  PURCHASE_TAX_CONFIG,
  COMPULSORY_INSURANCE,
  COMMERCIAL_INSURANCE_PRESETS,
  RUNNING_COST_PRESETS,
  DEPRECIATION_RATES
};
