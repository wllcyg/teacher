/**
 * miniprogram/utils/config/daily-rules.js
 * 生活日常模块权威基准配置中心
 * 涵盖：延迟退休改革方案基准表、各省社平工资参考、装修档位均价、公用事业水电阶梯标准、计发月数、
 *       中国成人BMI标准、各省生育假奖励表、婚礼预算参考比例、物流与停车模板等
 */

// 1. 渐进式延迟退休改革基准规则 (根据全国人大常委会 2024 年审议决定，2025年1月1日起正式施行)
const RETIREMENT_REFORM_CONFIG = {
  // 改革实施起点
  startDate: { year: 2025, month: 1 },
  // 人群分类与原法定年龄、目标法定年龄、延迟节奏
  categories: {
    male: {
      name: '男职工',
      originalAge: 60,
      targetAge: 63,
      delayIntervalMonths: 4, // 每4个月延迟1个月
      maxDelayMonths: 36     // 最多延迟36个月 (3年)
    },
    femaleCadre: {
      name: '女干部 / 原55岁退休女职工',
      originalAge: 55,
      targetAge: 58,
      delayIntervalMonths: 4, // 每4个月延迟1个月
      maxDelayMonths: 36     // 最多延迟36个月 (3年)
    },
    femaleWorker: {
      name: '女工人 / 原50岁退休女职工',
      originalAge: 50,
      targetAge: 55,
      delayIntervalMonths: 2, // 每2个月延迟1个月
      maxDelayMonths: 60     // 最多延迟60个月 (5年)
    }
  },
  // 养老保险最低缴费年限渐进调整规则 (从 2030 年起由 15 年按年逐步提升至 20 年)
  minContributionYears: {
    baseYears: 15,
    targetYears: 20,
    startYear: 2030
  }
};

// 2. 养老金个人账户计发月数国家标准 (国发〔2005〕38号)
const PENSION_ISSUE_MONTHS = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
  45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
  50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
  55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
  60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
  65: 101, 70: 56
};

// 3. 全国典型城市社平工资与记账利率参考 (元/月)
const CITY_AVERAGE_WAGE = {
  beijing: { name: '北京', wage: 11500 },
  shanghai: { name: '上海', wage: 12100 },
  guangzhou: { name: '广州', wage: 10500 },
  shenzhen: { name: '深圳', wage: 11200 },
  hangzhou: { name: '杭州', wage: 9800 },
  chengdu: { name: '成都', wage: 8600 },
  wuhan: { name: '武汉', wage: 8300 },
  general: { name: '全国中等城市参考', wage: 7500 }
};

// 4. 装修档位参考单价 (元/㎡，按建筑面积估算)
const RENOVATION_TIERS = {
  simple: { name: '经济简装 (出租/过渡)', price: 900, desc: '基础硬装，环保达标，性价比首选' },
  standard: { name: '舒适精装 (自住刚需)', price: 1600, desc: '品牌主材，全屋定制收纳，主流首选' },
  luxury: { name: '轻奢豪装 (高品质自住)', price: 2600, desc: '一线大牌，智能家居系统，石材/木饰面' }
};

// 装修各分项常规占比
const RENOVATION_PERCENT_BREAKDOWN = {
  labor: 0.30,        // 人工费 30%
  mainMaterial: 0.48, // 主材 48% (瓷砖/地板/卫浴/橱柜门)
  auxiliary: 0.14,    // 辅料 14% (水电管线/水泥黄沙/腻子漆)
  designMgmt: 0.08   // 设计与工程监理 8%
};

// 常见瓷砖规格 (mm)
const TILE_PRESETS = [
  { label: '800 × 800 mm (客厅主流大砖)', length: 800, width: 800, pcsPerBox: 3 },
  { label: '600 × 1200 mm (大板/连纹砖)', length: 1200, width: 600, pcsPerBox: 2 },
  { label: '600 × 600 mm (厨卫通用方砖)', length: 600, width: 600, pcsPerBox: 4 },
  { label: '300 × 600 mm (厨卫经典墙砖)', length: 600, width: 300, pcsPerBox: 8 },
  { label: '300 × 300 mm (卫生间防滑地砖)', length: 300, width: 300, pcsPerBox: 11 }
];

// 5. 阶梯用电基准参考 (第一档平价、第二档提价、第三档高价)
const ELECTRICITY_TIERS = [
  { tier: 1, maxKwhMonth: 240, maxKwhYear: 2880, price: 0.50, desc: '第一档满足基本用电，基准平价' },
  { tier: 2, maxKwhMonth: 400, maxKwhYear: 4800, price: 0.55, desc: '第二档改善型用电，每度加价 0.05 元' },
  { tier: 3, maxKwhMonth: Infinity, maxKwhYear: Infinity, price: 0.80, desc: '第三档高耗能用电，每度加价 0.30 元' }
];

// 6. 阶梯用水基准参考 (含污水处理费)
const WATER_TIERS = [
  { tier: 1, maxM3Year: 180, price: 5.00, desc: '第一阶梯保障基础用水 (5.00元/m³含污水费)' },
  { tier: 2, maxM3Year: 260, price: 7.00, desc: '第二阶梯加收资源调节费 (7.00元/m³)' },
  { tier: 3, maxM3Year: Infinity, price: 9.00, desc: '第三阶梯促进节约用水 (9.00元/m³)' }
];

// 7. 中国成人 BMI 体质判定标准 (依据卫健委/中国成人超重和肥胖预防控制指南)
const BMI_CRITERIA = [
  { max: 18.5, level: 'underweight', label: '体重偏瘦', color: '#3B82F6', tip: '建议适度加强优质蛋白摄入与抗阻力量训练，增强体质。' },
  { max: 24.0, level: 'normal', label: '标准健康', color: '#10B981', tip: '非常棒！身体质量指数处于黄金健康区间，请继续保持健康作息。' },
  { max: 28.0, level: 'overweight', label: '轻度超重', color: '#F59E0B', tip: '需注意饮食热量摄入，适度增加有氧运动与运动频次。' },
  { max: Infinity, level: 'obese', label: '肥胖预警', color: '#EF4444', tip: '建议控制碳水及脂肪摄入，定期监测血压血糖指标，科学减脂。' }
];

// 8. 女职工法定产假天数与各省奖励假标准 (全国基础产假 98 天)
const MATERNITY_LEAVE_RULES = {
  nationalBaseDays: 98,
  provinces: {
    beijing: { name: '北京', bonusDays: 60, totalDays: 158 },
    shanghai: { name: '上海', bonusDays: 60, totalDays: 158 },
    guangdong: { name: '广东', bonusDays: 80, totalDays: 178 },
    zhejiang: { name: '浙江', bonusDays: 60, totalDays: 158 }, // 一孩+60天，二孩三孩+90天
    jiangsu: { name: '江苏', bonusDays: 60, totalDays: 158 },
    sichuan: { name: '四川', bonusDays: 60, totalDays: 158 },
    shandong: { name: '山东', bonusDays: 60, totalDays: 158 },
    general: { name: '全国通用参考', bonusDays: 60, totalDays: 158 }
  }
};

// 9. 婚礼预算全流程常规分布比例
const WEDDING_BUDGET_RATIOS = {
  banquet: { name: '婚宴酒席 (餐饮与酒水)', ratio: 0.45, desc: '占总预算约40%~50%，决定整体规格' },
  planning: { name: '婚庆策划与现场布置', ratio: 0.15, desc: '司仪、现场花艺、灯光舞台、摄影摄像' },
  apparel: { name: '婚纱礼服与婚纱照', ratio: 0.12, desc: '新郎新娘礼服定制/租赁、婚纱摄影' },
  jewelry: { name: '珠宝钻戒与三金五金', ratio: 0.10, desc: '对戒、结婚金饰、彩礼定金' },
  honeymoon: { name: '蜜月旅行与旅拍', ratio: 0.10, desc: '机票酒店、旅行消费与浪漫回忆' },
  favorsMisc: { name: '伴手礼与喜糖杂费', ratio: 0.08, desc: '亲友伴手礼、喜包喜糖、婚车红包' }
};

// 10. 停车费典型模板预设 (首重、续重、封顶)
const PARKING_TEMPLATES = {
  commercial: { name: '核心商圈商场', freeMinutes: 15, firstHourPrice: 10, nextHourPrice: 6, dailyCap: 80 },
  office: { name: '写字楼/园区', freeMinutes: 30, firstHourPrice: 8, nextHourPrice: 4, dailyCap: 60 },
  airport: { name: '机场/高铁站枢纽', freeMinutes: 15, firstHourPrice: 12, nextHourPrice: 8, dailyCap: 100 },
  community: { name: '普通居民区/路侧', freeMinutes: 30, firstHourPrice: 4, nextHourPrice: 2, dailyCap: 30 }
};

// 11. 快递计费常用模板
const EXPRESS_TEMPLATES = {
  sfExpress: { name: '顺丰特快 (航空干线)', firstWeight: 1, firstPrice: 18, continuePrice: 8, volumeFactor: 6000 },
  standard: { name: '普通电商快递 (通达兔)', firstWeight: 1, firstPrice: 10, continuePrice: 4, volumeFactor: 6000 },
  heavy: { name: '大件快运/德邦物流', firstWeight: 5, firstPrice: 35, continuePrice: 3.5, volumeFactor: 6000 }
};

module.exports = {
  RETIREMENT_REFORM_CONFIG,
  PENSION_ISSUE_MONTHS,
  CITY_AVERAGE_WAGE,
  RENOVATION_TIERS,
  RENOVATION_PERCENT_BREAKDOWN,
  TILE_PRESETS,
  ELECTRICITY_TIERS,
  WATER_TIERS,
  BMI_CRITERIA,
  MATERNITY_LEAVE_RULES,
  WEDDING_BUDGET_RATIOS,
  PARKING_TEMPLATES,
  EXPRESS_TEMPLATES
};
