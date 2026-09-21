/**
 * miniprogram/utils/calculators/daily.js
 * 05·生活日常模块高精度纯函数算法引擎
 * 涵盖 4 大分组共 23 项高频长尾生活计算器：
 * 1. 装修建材组 (6个): 综合预算、瓷砖用量、墙面涂料、地板用量、壁纸用量、窗帘布料
 * 2. 职场民生与法定权益组 (8个): 日期相差、周岁年龄、渐进式延迟退休、工龄累计、法定年休假、社保最低年限、养老金预估、生育津贴
 * 3. 健康生活与家庭仪式组 (4个): BMI指数、孕期预产期、恋爱结婚纪念日、彩礼婚礼预算
 * 4. 公用事业与生活消费组 (5个): 阶梯电费、阶梯水费、快递运费、停车费分段、满减促销折扣
 */

const math = require('../math.js');
const {
  RETIREMENT_REFORM_CONFIG,
  PENSION_ISSUE_MONTHS,
  CITY_AVERAGE_WAGE,
  RENOVATION_TIERS,
  RENOVATION_PERCENT_BREAKDOWN,
  ELECTRICITY_TIERS,
  WATER_TIERS,
  BMI_CRITERIA,
  MATERNITY_LEAVE_RULES,
  WEDDING_BUDGET_RATIOS,
  PARKING_TEMPLATES,
  EXPRESS_TEMPLATES
} = require('../config/daily-rules.js');

// =================================================================
// 1. 装修建材组 (6个)
// =================================================================

/**
 * 1.1 装修综合预算
 * @param {Object} options
 * @param {number} options.houseArea 建筑面积 (㎡)
 * @param {string} [options.tierKey='standard'] 装修档次: simple | standard | luxury | custom
 * @param {number} [options.customPrice=0] 自定义单价 (元/㎡)
 */
function calcRenovationBudget(options = {}) {
  const houseArea = Math.max(0, Number(options.houseArea) || 0);
  const tierKey = options.tierKey || 'standard';
  const tierConfig = RENOVATION_TIERS[tierKey] || RENOVATION_TIERS.standard;
  const unitPrice = tierKey === 'custom' && Number(options.customPrice) > 0
    ? Number(options.customPrice)
    : tierConfig.price;

  const totalBudget = math.round(houseArea * unitPrice, 2);
  const laborFee = math.round(totalBudget * RENOVATION_PERCENT_BREAKDOWN.labor, 2);
  const mainMaterialFee = math.round(totalBudget * RENOVATION_PERCENT_BREAKDOWN.mainMaterial, 2);
  const auxiliaryFee = math.round(totalBudget * RENOVATION_PERCENT_BREAKDOWN.auxiliary, 2);
  const designMgmtFee = math.round(totalBudget - laborFee - mainMaterialFee - auxiliaryFee, 2);

  return {
    houseArea,
    tierKey,
    tierName: tierKey === 'custom' ? '自定义单价档' : tierConfig.name,
    unitPrice,
    totalBudget,
    totalBudgetFormatted: math.formatMoney(totalBudget),
    totalBudgetWan: math.round(totalBudget / 10000, 2),
    breakdown: [
      { name: '主材费用 (48%)', amount: mainMaterialFee, percent: 48, desc: '瓷砖、地板、卫浴洁具、定制橱柜门等' },
      { name: '施工人工 (30%)', amount: laborFee, percent: 30, desc: '拆改、水电工、泥瓦工、木工、油漆工工费' },
      { name: '辅料费用 (14%)', amount: auxiliaryFee, percent: 14, desc: '电线管材、水泥黄沙、腻子石膏、防水涂料' },
      { name: '设计与监理 (8%)', amount: designMgmtFee, percent: 8, desc: '设计方案出图、第三方工程节点监理' }
    ]
  };
}

/**
 * 1.2 瓷砖用量计算器
 * @param {Object} options
 * @param {number} options.area 铺贴总面积 (㎡)
 * @param {number} [options.tileLengthMm=800] 单片砖长度 (mm)
 * @param {number} [options.tileWidthMm=800] 单片砖宽度 (mm)
 * @param {number} [options.lossRatePercent=8] 损耗率百分比 (通常 5%~10%)
 * @param {number} [options.pcsPerBox=3] 每箱片数
 * @param {number} [options.pricePerPiece=0] 单片瓷砖价格 (元)
 */
function calcTileUsage(options = {}) {
  const area = Math.max(0, Number(options.area) || 0);
  const tileLengthMm = Math.max(1, Number(options.tileLengthMm) || 800);
  const tileWidthMm = Math.max(1, Number(options.tileWidthMm) || 800);
  const lossRatePercent = Math.max(0, Number(options.lossRatePercent) || 8);
  const pcsPerBox = Math.max(1, Number(options.pcsPerBox) || 3);
  const pricePerPiece = Math.max(0, Number(options.pricePerPiece) || 0);

  const singleArea = (tileLengthMm / 1000) * (tileWidthMm / 1000);
  const theoreticalPieces = singleArea > 0 ? area / singleArea : 0;
  const actualPieces = Math.ceil(theoreticalPieces * (1 + lossRatePercent / 100));
  const boxes = Math.ceil(actualPieces / pcsPerBox);
  const totalBoughtPieces = boxes * pcsPerBox;
  const extraBackupPieces = totalBoughtPieces - actualPieces;
  const totalCost = math.round(actualPieces * pricePerPiece, 2);

  return {
    area,
    singleTileArea: math.round(singleArea, 4),
    lossRatePercent,
    theoreticalPieces: math.round(theoreticalPieces, 1),
    actualPieces,
    boxes,
    pcsPerBox,
    totalBoughtPieces,
    extraBackupPieces,
    pricePerPiece,
    totalCost,
    totalCostFormatted: math.formatMoney(totalCost)
  };
}

/**
 * 1.3 墙面乳胶漆涂料用量
 * @param {Object} options
 * @param {number} options.wallArea 涂刷墙面与顶面净面积 (㎡)
 * @param {number} [options.coats=2] 涂刷遍数 (默认底漆1遍+面漆2遍，面漆通常2遍)
 * @param {number} [options.coverageRate=12] 理论涂刷率 (㎡/L/遍，主流约 11~13)
 * @param {number} [options.bucketLiters=5] 包装规格 (L/桶，如5L或18L)
 * @param {number} [options.pricePerBucket=0] 每桶价格 (元)
 */
function calcPaintUsage(options = {}) {
  const wallArea = Math.max(0, Number(options.wallArea) || 0);
  const coats = Math.max(1, Number(options.coats) || 2);
  const coverageRate = Math.max(1, Number(options.coverageRate) || 12);
  const bucketLiters = Math.max(0.5, Number(options.bucketLiters) || 5);
  const pricePerBucket = Math.max(0, Number(options.pricePerBucket) || 0);

  const totalAreaToPaint = wallArea * coats;
  const litersNeeded = math.round(totalAreaToPaint / coverageRate, 1);
  const bucketsNeeded = Math.ceil(litersNeeded / bucketLiters);
  const totalCost = math.round(bucketsNeeded * pricePerBucket, 2);

  return {
    wallArea,
    coats,
    totalAreaToPaint,
    litersNeeded,
    bucketLiters,
    bucketsNeeded,
    totalCost,
    totalCostFormatted: math.formatMoney(totalCost)
  };
}

/**
 * 1.4 地板用量计算器
 * @param {Object} options
 * @param {number} options.roomArea 铺设地面面积 (㎡)
 * @param {number} [options.floorLengthMm=1215] 单片地板长度 (mm)
 * @param {number} [options.floorWidthMm=195] 单片地板宽度 (mm)
 * @param {string} [options.method='straight'] 铺贴方式: straight(平铺5%损耗) | herringbone(人字拼10%损耗)
 * @param {number} [options.pcsPerBox=8] 每箱片数
 * @param {number} [options.pricePerSqm=0] 每平米单价 (元/㎡)
 */
function calcFlooringUsage(options = {}) {
  const roomArea = Math.max(0, Number(options.roomArea) || 0);
  const floorLengthMm = Math.max(1, Number(options.floorLengthMm) || 1215);
  const floorWidthMm = Math.max(1, Number(options.floorWidthMm) || 195);
  const method = options.method || 'straight';
  const lossRate = method === 'herringbone' ? 10 : 5;
  const pcsPerBox = Math.max(1, Number(options.pcsPerBox) || 8);
  const pricePerSqm = Math.max(0, Number(options.pricePerSqm) || 0);

  const singleArea = (floorLengthMm / 1000) * (floorWidthMm / 1000);
  const theoreticalPieces = singleArea > 0 ? roomArea / singleArea : 0;
  const actualPieces = Math.ceil(theoreticalPieces * (1 + lossRate / 100));
  const boxes = Math.ceil(actualPieces / pcsPerBox);
  const actualTotalArea = math.round(actualPieces * singleArea, 2);
  const totalCost = math.round(actualTotalArea * pricePerSqm, 2);

  return {
    roomArea,
    singleArea: math.round(singleArea, 4),
    method,
    methodName: method === 'herringbone' ? '人字拼/鱼骨拼 (10%损耗)' : '经典平铺工字拼 (5%损耗)',
    lossRate,
    actualPieces,
    boxes,
    pcsPerBox,
    actualTotalArea,
    totalCost,
    totalCostFormatted: math.formatMoney(totalCost)
  };
}

/**
 * 1.5 壁纸用量计算器
 * @param {Object} options
 * @param {number} options.roomPerimeter 房间周长 (m) 剔除门窗宽度
 * @param {number} options.ceilingHeight 房间净层高 (m)
 * @param {number} [options.rollWidthM=0.53] 壁纸幅宽 (m，标准多为 0.53m 或 1.06m)
 * @param {number} [options.rollLengthM=10.0] 每卷长度 (m，标准多为 10m)
 * @param {number} [options.patternRepeatM=0] 对花高度损耗 (m，素色通常为 0，花纹通常 0.1~0.3m)
 */
function calcWallpaperUsage(options = {}) {
  const roomPerimeter = Math.max(0, Number(options.roomPerimeter) || 0);
  const ceilingHeight = Math.max(0, Number(options.ceilingHeight) || 2.8);
  const rollWidthM = Math.max(0.1, Number(options.rollWidthM) || 0.53);
  const rollLengthM = Math.max(1, Number(options.rollLengthM) || 10.0);
  const patternRepeatM = Math.max(0, Number(options.patternRepeatM) || 0);

  // 单卷可出裁剪条数 = 卷长 / (层高 + 对花损耗)
  const singleCutHeight = ceilingHeight + patternRepeatM;
  const stripsPerRoll = Math.max(1, Math.floor(rollLengthM / singleCutHeight));
  // 房间需要总条数 = 周长 / 幅宽
  const totalStripsNeeded = Math.ceil(roomPerimeter / rollWidthM);
  // 所需卷数 = 总条数 / 单卷条数
  const rollsNeeded = Math.ceil(totalStripsNeeded / stripsPerRoll);

  return {
    roomPerimeter,
    ceilingHeight,
    rollWidthM,
    rollLengthM,
    stripsPerRoll,
    totalStripsNeeded,
    rollsNeeded
  };
}

/**
 * 1.6 窗帘布料用量计算器
 * @param {Object} options
 * @param {number} options.windowWidthM 窗户或导轨净宽度 (m)
 * @param {number} options.windowHeightM 窗帘离地高度 (m)
 * @param {number} [options.foldRatio=2.0] 褶皱倍数 (常规 2.0 倍，奢华 2.5 倍)
 * @param {number} [options.fabricWidthM=2.8] 布料门幅规格 (m，定高通常 2.8m，定宽通常 1.4m)
 * @param {string} [options.fabricType='fixedHeight'] 定高还是定宽: fixedHeight (定高2.8m买宽度) | fixedWidth (定宽1.4m买高度拼幅)
 */
function calcCurtainUsage(options = {}) {
  const windowWidthM = Math.max(0, Number(options.windowWidthM) || 0);
  const windowHeightM = Math.max(0, Number(options.windowHeightM) || 2.5);
  const foldRatio = Math.max(1.5, Number(options.foldRatio) || 2.0);
  const fabricType = options.fabricType || 'fixedHeight';
  const fabricWidthM = Math.max(1.0, Number(options.fabricWidthM) || 2.8);

  const finishedWidth = windowWidthM * foldRatio;
  let fabricMetersNeeded = 0;

  if (fabricType === 'fixedHeight') {
    // 定高买宽度：购买米数直接等于褶皱后总宽度 + 卷边余量 (两边各加 0.15m)
    fabricMetersNeeded = math.round(finishedWidth + 0.3, 1);
  } else {
    // 定宽买高度拼幅：需要幅数 = 总宽 / 门幅，每幅长度 = 窗高 + 上下折边 (0.3m)
    const panels = Math.ceil(finishedWidth / fabricWidthM);
    fabricMetersNeeded = math.round(panels * (windowHeightM + 0.3), 1);
  }

  return {
    windowWidthM,
    windowHeightM,
    foldRatio,
    fabricType,
    finishedWidth: math.round(finishedWidth, 1),
    fabricMetersNeeded
  };
}

// =================================================================
// 2. 职场民生与法定权益组 (8个)
// =================================================================

/**
 * 2.1 日期相差计算器
 * @param {Object} options
 * @param {string|Date} options.startDate 起始日期 'YYYY-MM-DD'
 * @param {string|Date} options.endDate 结束日期 'YYYY-MM-DD'
 */
function calcDateDiff(options = {}) {
  const start = new Date(options.startDate);
  const end = new Date(options.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: '日期格式无效' };
  }

  const isReverse = end < start;
  const d1 = isReverse ? end : start;
  const d2 = isReverse ? start : end;

  const msDiff = d2.getTime() - d1.getTime();
  const naturalDays = Math.round(msDiff / (1000 * 60 * 60 * 24));
  const fullWeeks = Math.floor(naturalDays / 7);
  const remainingDays = naturalDays % 7;

  // 统计工作日 (周一至周五)
  let workDays = 0;
  let cur = new Date(d1.getTime());
  while (cur < d2) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return {
    isReverse,
    naturalDays,
    fullWeeks,
    remainingDays,
    workDays,
    weekendDays: naturalDays - workDays,
    summaryText: `${naturalDays} 天 (约 ${fullWeeks} 周 ${remainingDays} 天，含 ${workDays} 个工作日)`
  };
}

/**
 * 2.2 周岁与年龄精确计算器
 * @param {Object} options
 * @param {string|Date} options.birthDate 出生日期 'YYYY-MM-DD'
 * @param {string|Date} [options.targetDate] 目标基准日期 (默认今天)
 */
function calcAgeAndZodiac(options = {}) {
  const birth = new Date(options.birthDate);
  const target = options.targetDate ? new Date(options.targetDate) : new Date();
  if (isNaN(birth.getTime())) {
    return { error: '出生日期格式无效' };
  }

  const birthYear = birth.getFullYear();
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();

  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth();
  const targetDay = target.getDate();

  // 1. 周岁 (满整年才算一岁)
  let age = targetYear - birthYear;
  if (targetMonth < birthMonth || (targetMonth === birthMonth && targetDay < birthDay)) {
    age--;
  }
  age = Math.max(0, age);

  // 2. 虚岁 (出生即1岁，每过一个公历/农历新年+1)
  const nominalAge = targetYear - birthYear + 1;

  // 3. 累计出生天数
  const daysLived = Math.floor((target.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));

  // 4. 十二生肖 (以1900年鼠年为基准)
  const ZODIAC_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const zodiac = ZODIAC_ANIMALS[(birthYear - 1900) % 12];

  // 5. 十二星座
  const m = birthMonth + 1;
  const d = birthDay;
  let constellation = '';
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) constellation = '白羊座';
  else if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) constellation = '金牛座';
  else if ((m === 5 && d >= 21) || (m === 6 && d <= 21)) constellation = '双子座';
  else if ((m === 6 && d >= 22) || (m === 7 && d <= 22)) constellation = '巨蟹座';
  else if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) constellation = '狮子座';
  else if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) constellation = '处女座';
  else if ((m === 9 && d >= 23) || (m === 10 && d <= 23)) constellation = '天秤座';
  else if ((m === 10 && d >= 24) || (m === 11 && d <= 22)) constellation = '天蝎座';
  else if ((m === 11 && d >= 23) || (m === 12 && d <= 21)) constellation = '射手座';
  else if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) constellation = '摩羯座';
  else if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) constellation = '水瓶座';
  else constellation = '双鱼座';

  // 6. 下次生日倒计时天数
  let nextBirthday = new Date(targetYear, birthMonth, birthDay);
  if (nextBirthday < target) {
    nextBirthday = new Date(targetYear + 1, birthMonth, birthDay);
  }
  const daysToNextBirthday = Math.ceil((nextBirthday.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  return {
    age,
    nominalAge,
    daysLived: Math.max(0, daysLived),
    zodiac,
    constellation,
    daysToNextBirthday
  };
}

/**
 * 2.3 渐进式延迟退休法定年龄计算器 (2025年新政全国权威基准)
 * 依据全国人大常委会2024年审议决定，2025年1月1日起正式实施
 * @param {Object} options
 * @param {number} options.birthYear 出生年份 (如 1975)
 * @param {number} options.birthMonth 出生月份 (1-12)
 * @param {string} [options.categoryKey='male'] 人群分类: male(男职工) | femaleCadre(女干部55岁) | femaleWorker(女工人50岁)
 */
function calcDelayRetirement(options = {}) {
  const birthYear = Number(options.birthYear) || 1980;
  const birthMonth = Number(options.birthMonth) || 1;
  const categoryKey = options.categoryKey || 'male';
  const cat = RETIREMENT_REFORM_CONFIG.categories[categoryKey] || RETIREMENT_REFORM_CONFIG.categories.male;

  const originalAge = cat.originalAge;
  const maxDelayMonths = cat.maxDelayMonths;
  const delayInterval = cat.delayIntervalMonths;

  // 原政策本应退休年份与月份
  const originalRetireYear = birthYear + originalAge;
  const originalRetireMonth = birthMonth;

  // 改革启动时间：2025年1月
  const reformStartTotalMonths = 2025 * 12 + 1;
  const originalRetireTotalMonths = originalRetireYear * 12 + originalRetireMonth;

  // 距离改革起点的月数
  const monthsDiff = originalRetireTotalMonths - reformStartTotalMonths;

  let delayMonths = 0;
  if (monthsDiff >= 0) {
    // 改革实施后达到原退休年龄，每 delayInterval 个月延迟 1 个月
    delayMonths = Math.min(maxDelayMonths, Math.floor(monthsDiff / delayInterval) + 1);
  }

  // 实际退休总月数
  const actualRetireTotalMonths = originalRetireTotalMonths + delayMonths;
  const actualRetireYear = Math.floor((actualRetireTotalMonths - 1) / 12);
  const actualRetireMonth = ((actualRetireTotalMonths - 1) % 12) + 1;

  // 实际退休年龄 (岁 + 月)
  const actualAgeYears = originalAge + Math.floor(delayMonths / 12);
  const actualAgeMonths = delayMonths % 12;
  const actualAgeDecimal = math.round(originalAge + delayMonths / 12, 2);

  // 倒算领取养老金年数 (假设人均预期寿命 80 岁)
  const expectedLifeYears = 80;
  const pensionReceiveYears = Math.max(0, math.round(expectedLifeYears - actualAgeDecimal, 1));

  return {
    categoryKey,
    categoryName: cat.name,
    originalAge,
    targetAge: cat.targetAge,
    originalRetireYear,
    originalRetireMonth,
    delayMonths,
    delayYearsPart: Math.floor(delayMonths / 12),
    delayMonthsPart: delayMonths % 12,
    actualRetireYear,
    actualRetireMonth,
    actualAgeYears,
    actualAgeMonths,
    actualAgeDecimal,
    pensionReceiveYears,
    summary: `法定退休时间：${actualRetireYear} 年 ${actualRetireMonth} 月 (实际 ${actualAgeYears} 岁 ${actualAgeMonths} 个月，较原政策延迟 ${delayMonths} 个月)`
  };
}

/**
 * 2.4 工龄与连续工龄计算器
 * @param {Object} options
 * @param {Array<{ startDate: string, endDate: string }>} options.periods 多段工作经历
 */
function calcWorkAge(options = {}) {
  const periods = Array.isArray(options.periods) ? options.periods : [];
  let totalDays = 0;

  periods.forEach(p => {
    if (p.startDate && p.endDate) {
      const s = new Date(p.startDate);
      const e = new Date(p.endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        totalDays += Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
  });

  const totalYears = math.round(totalDays / 365, 1);
  const fullYears = Math.floor(totalDays / 365);
  const remainingMonths = Math.floor((totalDays % 365) / 30);
  const remainingDays = Math.round((totalDays % 365) % 30);

  return {
    totalDays,
    totalYears,
    fullYears,
    remainingMonths,
    remainingDays,
    summary: `${fullYears} 年 ${remainingMonths} 个月 ${remainingDays} 天 (累计 ${totalDays} 天)`
  };
}

/**
 * 2.5 法定年休假天数计算器
 * 依据国务院《职工带薪年休假条例》标准：
 * 满 1 年不满 10 年: 5 天
 * 满 10 年不满 20 年: 10 天
 * 满 20 年及以上: 15 天
 * @param {Object} options
 * @param {number} options.totalWorkYears 累计工作总工龄 (年)
 * @param {number} [options.companyWorkDaysInYear] 当年度在现单位剩余日历天数 (用于折算新入职年休假)
 */
function calcAnnualLeave(options = {}) {
  const totalWorkYears = Math.max(0, Number(options.totalWorkYears) || 0);
  let standardDays = 0;

  if (totalWorkYears >= 20) {
    standardDays = 15;
  } else if (totalWorkYears >= 10) {
    standardDays = 10;
  } else if (totalWorkYears >= 1) {
    standardDays = 5;
  } else {
    standardDays = 0;
  }

  // 若提供新单位在职天数，支持按当年度折算
  let convertedDays = standardDays;
  if (options.companyWorkDaysInYear && options.companyWorkDaysInYear > 0 && options.companyWorkDaysInYear < 365) {
    convertedDays = Math.floor((Number(options.companyWorkDaysInYear) / 365) * standardDays);
  }

  return {
    totalWorkYears,
    standardDays,
    convertedDays,
    tierDesc: totalWorkYears < 1 ? '未满1年无带薪年休假' : (totalWorkYears < 10 ? '工龄满1年不满10年 (法定5天)' : (totalWorkYears < 20 ? '工龄满10年不满20年 (法定10天)' : '工龄满20年及以上 (法定15天)'))
  };
}

/**
 * 2.6 社保最低缴费年限达标计算器
 * 渐进式调整：自 2030 年起由 15 年按年逐步提升至 20 年 (每年提升 6 个月)
 * @param {Object} options
 * @param {number} options.currentPaidYears 当前已缴存社保年限 (年)
 * @param {number} options.retireYear 预估退休年份 (如 2035)
 */
function calcSocialMinYears(options = {}) {
  const currentPaidYears = Math.max(0, Number(options.currentPaidYears) || 0);
  const retireYear = Math.max(2025, Number(options.retireYear) || 2030);

  let requiredYears = 15;
  if (retireYear >= 2030) {
    // 2030 年起每年提高 6 个月 (0.5 年)，上限 20 年 (2040 年达到 20 年)
    const extraYears = Math.min(5, (retireYear - 2030 + 1) * 0.5);
    requiredYears = 15 + extraYears;
  }

  const gapYears = Math.max(0, math.round(requiredYears - currentPaidYears, 1));
  const isSatisfied = currentPaidYears >= requiredYears;

  return {
    currentPaidYears,
    retireYear,
    requiredYears,
    gapYears,
    isSatisfied,
    statusText: isSatisfied ? `已满足法定门槛 (超额 ${math.round(currentPaidYears - requiredYears, 1)} 年)` : `尚缺口 ${gapYears} 年 (${Math.round(gapYears * 12)} 个月)`
  };
}

/**
 * 2.7 职工养老金预估测算器 (双模式算法引擎)
 * @param {Object} options
 * @param {string} [options.mode='tiered'] 模式: 'tiered'(档位估算) | 'exact'(精确模式)
 * @param {string} [options.cityKey='general'] 城市标识
 * @param {number} [options.contribYears=25] 累计缴费年限 (年)
 * @param {number} [options.currentWage=8000] 当前月薪资 (元)
 * @param {number} [options.tierRatio=1.0] 档位系数: 0.6(60%最低档) | 1.0(100%均档) | 3.0(300%顶格档)
 * @param {number} [options.retiredAge=60] 退休年龄 (40-70)
 * @param {number} [options.personalBalance=0] 精确模式个人账户储存额
 */
function calcPensionEstimate(options = {}) {
  const mode = options.mode || 'tiered';
  const cityKey = options.cityKey || 'general';
  const cityInfo = CITY_AVERAGE_WAGE[cityKey] || CITY_AVERAGE_WAGE.general;
  const avgWage = cityInfo.wage;

  const contribYears = Math.max(1, Number(options.contribYears) || 25);
  const retiredAge = Math.max(40, Math.min(70, Number(options.retiredAge) || 60));
  const issueMonths = PENSION_ISSUE_MONTHS[retiredAge] || 139;

  let tierRatio = Math.max(0.6, Math.min(3.0, Number(options.tierRatio) || 1.0));
  let personalBalance = Number(options.personalBalance) || 0;
  let currentWage = Number(options.currentWage) || avgWage;

  if (mode === 'tiered') {
    // 档位模式下自动推算个人账户：按当前月工资 * 8% * 12 * 缴费年限 * 复合复利增长估计
    const annualContrib = currentWage * 0.08 * 12;
    personalBalance = math.round(annualContrib * contribYears * 1.35, 2); // 估算历年记账利息
  }

  // 1. 基础养老金 = 社平工资 * (1 + 缴费指数) / 2 * 缴费年限 * 1%
  const basePension = math.round(avgWage * ((1 + tierRatio) / 2) * (contribYears * 0.01), 2);

  // 2. 个人账户养老金 = 个人账户储存额 / 计发月数
  const personalPension = math.round(personalBalance / issueMonths, 2);

  // 3. 预估月养老金总额
  const totalMonthlyPension = math.round(basePension + personalPension, 2);

  // 4. 养老金替代率 (月养老金 / 退休前月薪)
  const replacementRate = currentWage > 0 ? math.round((totalMonthlyPension / currentWage) * 100, 1) : 0;

  // 5. 个人缴费回本年限 = 个人账户总额 / (月养老金 * 12)
  const paybackYears = totalMonthlyPension > 0 ? math.round(personalBalance / (totalMonthlyPension * 12), 1) : 0;

  return {
    mode,
    cityName: cityInfo.name,
    avgWage,
    contribYears,
    retiredAge,
    issueMonths,
    tierRatio,
    basePension,
    personalPension,
    totalMonthlyPension,
    totalMonthlyPensionFormatted: math.formatMoney(totalMonthlyPension),
    replacementRate,
    paybackYears,
    personalBalance,
    personalBalanceFormatted: math.formatMoney(personalBalance)
  };
}

/**
 * 2.8 女职工生育津贴计算器
 * @param {Object} options
 * @param {number} options.companyAvgSalary 用人单位上年度职工月平均缴费工资 (元)
 * @param {string} [options.provinceKey='general'] 省份标识
 * @param {number} [options.customDays=0] 自定义总产假天数
 */
function calcMaternityAllowance(options = {}) {
  const companyAvgSalary = Math.max(0, Number(options.companyAvgSalary) || 0);
  const provinceKey = options.provinceKey || 'general';
  const provConfig = MATERNITY_LEAVE_RULES.provinces[provinceKey] || MATERNITY_LEAVE_RULES.provinces.general;

  const totalDays = Number(options.customDays) > 0 ? Number(options.customDays) : provConfig.totalDays;
  const dailyAllowance = math.round(companyAvgSalary / 30, 2);
  const totalAllowance = math.round(dailyAllowance * totalDays, 2);

  return {
    companyAvgSalary,
    provinceKey,
    provinceName: provConfig.name,
    baseDays: MATERNITY_LEAVE_RULES.nationalBaseDays,
    bonusDays: provConfig.bonusDays,
    totalDays,
    dailyAllowance,
    totalAllowance,
    totalAllowanceFormatted: math.formatMoney(totalAllowance)
  };
}

// =================================================================
// 3. 健康生活与家庭仪式组 (4个)
// =================================================================

/**
 * 3.1 BMI 身体质量指数计算器
 * @param {Object} options
 * @param {number} options.heightCm 身高 (cm)
 * @param {number} options.weightKg 体重 (kg)
 */
function calcBMI(options = {}) {
  const heightCm = Math.max(50, Number(options.heightCm) || 170);
  const weightKg = Math.max(10, Number(options.weightKg) || 65);
  const heightM = heightCm / 100;

  const bmi = math.round(weightKg / (heightM * heightM), 1);

  let criteria = BMI_CRITERIA[0];
  for (let c of BMI_CRITERIA) {
    if (bmi < c.max) {
      criteria = c;
      break;
    }
  }

  // 标准健康体重范围 (BMI 18.5 ~ 23.9)
  const idealMinWeight = math.round(18.5 * heightM * heightM, 1);
  const idealMaxWeight = math.round(23.9 * heightM * heightM, 1);

  let weightDiff = 0;
  let diffAdvice = '';
  if (weightKg < idealMinWeight) {
    weightDiff = math.round(idealMinWeight - weightKg, 1);
    diffAdvice = `距离标准区间还需增重 ${weightDiff} kg`;
  } else if (weightKg > idealMaxWeight) {
    weightDiff = math.round(weightKg - idealMaxWeight, 1);
    diffAdvice = `距离标准健康体重还需减重 ${weightDiff} kg`;
  } else {
    diffAdvice = '体重处于健康黄金区间，继续保持！';
  }

  return {
    heightCm,
    weightKg,
    bmi,
    level: criteria.level,
    levelLabel: criteria.label,
    levelColor: criteria.color,
    tip: criteria.tip,
    idealMinWeight,
    idealMaxWeight,
    diffAdvice
  };
}

/**
 * 3.2 孕期与预产期计算器
 * 末次月经第1天加 280 天 (40周)
 * @param {Object} options
 * @param {string|Date} options.lastMenstrualDate 末次月经第 1 天 'YYYY-MM-DD'
 * @param {string|Date} [options.targetDate] 当前计算基准日期 (默认今天)
 */
function calcPregnancy(options = {}) {
  const lmp = new Date(options.lastMenstrualDate);
  const target = options.targetDate ? new Date(options.targetDate) : new Date();
  if (isNaN(lmp.getTime())) {
    return { error: '末次月经日期无效' };
  }

  // 预产期 = 末次月经第 1 天 + 280 天 (40周)
  const dueDate = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
  const dueYear = dueDate.getFullYear();
  const dueMonth = dueDate.getMonth() + 1;
  const dueDay = dueDate.getDate();

  // 当前已怀孕天数与当前孕周
  const daysPregnant = Math.max(0, Math.floor((target.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24)));
  const currentWeek = Math.floor(daysPregnant / 7);
  const currentDaysInWeek = daysPregnant % 7;
  const daysRemaining = Math.max(0, Math.ceil((dueDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)));

  // 孕期阶段
  let trimester = '早孕期 (1~12周)';
  let progressPercent = math.round((daysPregnant / 280) * 100, 1);
  if (currentWeek >= 28) {
    trimester = '孕晚期 (28~40周)';
  } else if (currentWeek >= 13) {
    trimester = '孕中期 (13~27周)';
  }

  // 产检时间表推荐
  const milestones = [
    { week: 12, title: '早期建档与NT检查', desc: '早孕建卡、胎儿颈后透明带NT厚度筛查' },
    { week: 16, title: '中期唐氏筛查', desc: '母体血清唐筛或无创DNA产前检测' },
    { week: 24, title: '大排畸四维彩超', desc: '系统排查胎儿结构发育与器官形态' },
    { week: 26, title: '妊娠期糖尿病OGTT', desc: '口服葡萄糖耐量试验' },
    { week: 32, title: '胎儿生长超声评估', desc: '监测胎儿体重、胎盘成熟度与羊水' },
    { week: 37, title: '胎心监护与足月待产', desc: '进入足月期，每周胎心监护胎儿宫内储备' }
  ];

  return {
    dueDateString: `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`,
    dueYear,
    dueMonth,
    dueDay,
    daysPregnant,
    currentWeek,
    currentDaysInWeek,
    daysRemaining,
    trimester,
    progressPercent: Math.min(100, progressPercent),
    milestones
  };
}

/**
 * 3.3 恋爱 / 结婚纪念日计算器
 * @param {Object} options
 * @param {string|Date} options.anniversaryDate 纪念日起点日期 'YYYY-MM-DD'
 * @param {string|Date} [options.targetDate] 目标基准日期 (默认今天)
 */
function calcAnniversary(options = {}) {
  const start = new Date(options.anniversaryDate);
  const target = options.targetDate ? new Date(options.targetDate) : new Date();
  if (isNaN(start.getTime())) {
    return { error: '日期格式无效' };
  }

  const daysPassed = Math.max(0, Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const yearsPassed = Math.floor(daysPassed / 365);

  // 下一个整百/整千天里程碑
  const nextHundredDays = (Math.floor(daysPassed / 100) + 1) * 100;
  const daysToNextHundred = nextHundredDays - daysPassed;

  // 婚姻里程碑倒计时
  const milestones = [
    { years: 1, name: '纸婚 (1年)' },
    { years: 3, name: '皮婚 (3年)' },
    { years: 5, name: '木婚 (5年)' },
    { years: 10, name: '锡婚 (10年)' },
    { years: 20, name: '瓷婚 (20年)' },
    { years: 25, name: '银婚 (25年)' },
    { years: 50, name: '金婚 (50年)' }
  ];

  let nextWeddingMilestone = null;
  for (let m of milestones) {
    if (m.years > yearsPassed) {
      const milestoneDate = new Date(start.getFullYear() + m.years, start.getMonth(), start.getDate());
      const daysLeft = Math.ceil((milestoneDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
      nextWeddingMilestone = { name: m.name, daysLeft: Math.max(0, daysLeft) };
      break;
    }
  }

  return {
    daysPassed,
    yearsPassed,
    nextHundredDays,
    daysToNextHundred,
    nextWeddingMilestone
  };
}

/**
 * 3.4 彩礼与婚礼全流程预算计算器
 * @param {Object} options
 * @param {number} options.totalBudget 婚礼总预算 (元)
 */
function calcWeddingBudget(options = {}) {
  const totalBudget = Math.max(0, Number(options.totalBudget) || 150000);

  const items = Object.keys(WEDDING_BUDGET_RATIOS).map(key => {
    const item = WEDDING_BUDGET_RATIOS[key];
    const amount = math.round(totalBudget * item.ratio, 2);
    return {
      key,
      name: item.name,
      ratio: math.round(item.ratio * 100, 0),
      amount,
      amountFormatted: math.formatMoney(amount),
      desc: item.desc
    };
  });

  return {
    totalBudget,
    totalBudgetFormatted: math.formatMoney(totalBudget),
    totalBudgetWan: math.round(totalBudget / 10000, 2),
    items
  };
}

// =================================================================
// 4. 公用事业与生活消费组 (5个)
// =================================================================

/**
 * 4.1 阶梯电费计算器
 * @param {Object} options
 * @param {number} options.kwh 用电度数
 * @param {string} [options.period='month'] 计费周期: month(按月阶梯) | year(按年阶梯)
 */
function calcElectricityCost(options = {}) {
  const kwh = Math.max(0, Number(options.kwh) || 0);
  const period = options.period || 'month';

  const t1Limit = period === 'month' ? 240 : 2880;
  const t2Limit = period === 'month' ? 400 : 4800;

  let t1Kwh = 0;
  let t2Kwh = 0;
  let t3Kwh = 0;

  if (kwh <= t1Limit) {
    t1Kwh = kwh;
  } else if (kwh <= t2Limit) {
    t1Kwh = t1Limit;
    t2Kwh = kwh - t1Limit;
  } else {
    t1Kwh = t1Limit;
    t2Kwh = t2Limit - t1Limit;
    t3Kwh = kwh - t2Limit;
  }

  const t1Cost = math.round(t1Kwh * 0.50, 2);
  const t2Cost = math.round(t2Kwh * 0.55, 2);
  const t3Cost = math.round(t3Kwh * 0.80, 2);
  const totalCost = math.round(t1Cost + t2Cost + t3Cost, 2);
  const avgUnitPrice = kwh > 0 ? math.round(totalCost / kwh, 4) : 0.50;

  return {
    kwh,
    period,
    totalCost,
    totalCostFormatted: math.formatMoney(totalCost),
    avgUnitPrice,
    tiers: [
      { tier: 1, limit: t1Limit, kwh: t1Kwh, price: 0.50, cost: t1Cost },
      { tier: 2, limit: t2Limit, kwh: t2Kwh, price: 0.55, cost: t2Cost },
      { tier: 3, limit: Infinity, kwh: t3Kwh, price: 0.80, cost: t3Cost }
    ]
  };
}

/**
 * 4.2 阶梯水费计算器
 * @param {Object} options
 * @param {number} options.m3 用水量 (立方米/m³)
 * @param {number} [options.sewageFeePerM3=1.36] 污水处理费 (元/m³)
 */
function calcWaterCost(options = {}) {
  const m3 = Math.max(0, Number(options.m3) || 0);
  const sewageFeePerM3 = Math.max(0, Number(options.sewageFeePerM3) || 1.36);

  const t1Limit = 180;
  const t2Limit = 260;

  let t1M3 = 0;
  let t2M3 = 0;
  let t3M3 = 0;

  if (m3 <= t1Limit) {
    t1M3 = m3;
  } else if (m3 <= t2Limit) {
    t1M3 = t1Limit;
    t2M3 = m3 - t1Limit;
  } else {
    t1M3 = t1Limit;
    t2M3 = t2Limit - t1Limit;
    t3M3 = m3 - t2Limit;
  }

  // 基础自来水纯水价 (第一档3.64、第二档5.64、第三档7.64，加上污水费后分别为5、7、9)
  const t1Cost = math.round(t1M3 * 5.00, 2);
  const t2Cost = math.round(t2M3 * 7.00, 2);
  const t3Cost = math.round(t3M3 * 9.00, 2);
  const totalCost = math.round(t1Cost + t2Cost + t3Cost, 2);
  const totalSewageCost = math.round(m3 * sewageFeePerM3, 2);

  return {
    m3,
    totalCost,
    totalCostFormatted: math.formatMoney(totalCost),
    totalSewageCost,
    tiers: [
      { tier: 1, limit: t1Limit, m3: t1M3, price: 5.00, cost: t1Cost },
      { tier: 2, limit: t2Limit, m3: t2M3, price: 7.00, cost: t2Cost },
      { tier: 3, limit: Infinity, m3: t3M3, price: 9.00, cost: t3Cost }
    ]
  };
}

/**
 * 4.3 快递物流费用预估
 * @param {Object} options
 * @param {number} options.actualWeightKg 实际重量 (kg)
 * @param {number} [options.lengthCm=0] 长度 (cm)
 * @param {number} [options.widthCm=0] 宽度 (cm)
 * @param {number} [options.heightCm=0] 高度 (cm)
 * @param {string} [options.templateKey='standard'] 计费模板: standard | sfExpress | heavy
 */
function calcExpressFreight(options = {}) {
  const actualWeightKg = Math.max(0.1, Number(options.actualWeightKg) || 1.0);
  const lengthCm = Math.max(0, Number(options.lengthCm) || 0);
  const widthCm = Math.max(0, Number(options.widthCm) || 0);
  const heightCm = Math.max(0, Number(options.heightCm) || 0);
  const templateKey = options.templateKey || 'standard';
  const tmpl = EXPRESS_TEMPLATES[templateKey] || EXPRESS_TEMPLATES.standard;

  // 体积折算重量 (kg) = (长 * 宽 * 高) / 体积系数(通常6000)
  const volumeWeightKg = math.round((lengthCm * widthCm * heightCm) / tmpl.volumeFactor, 2);
  const chargeWeightKg = Math.max(actualWeightKg, volumeWeightKg);

  // 运费 = 首重价格 + 向上取整(续重重量) * 续重单价
  let freight = tmpl.firstPrice;
  if (chargeWeightKg > tmpl.firstWeight) {
    const extraWeight = Math.ceil(chargeWeightKg - tmpl.firstWeight);
    freight += extraWeight * tmpl.continuePrice;
  }
  freight = math.round(freight, 2);

  return {
    templateName: tmpl.name,
    actualWeightKg,
    volumeWeightKg,
    chargeWeightKg,
    firstWeight: tmpl.firstWeight,
    firstPrice: tmpl.firstPrice,
    continuePrice: tmpl.continuePrice,
    freight,
    freightFormatted: math.formatMoney(freight)
  };
}

/**
 * 4.4 停车费分段计算器
 * @param {Object} options
 * @param {number} options.parkingMinutes 停车时长 (分钟)
 * @param {string} [options.templateKey='commercial'] 场所模板: commercial | office | airport | community
 */
function calcParkingFee(options = {}) {
  const parkingMinutes = Math.max(0, Number(options.parkingMinutes) || 0);
  const templateKey = options.templateKey || 'commercial';
  const tmpl = PARKING_TEMPLATES[templateKey] || PARKING_TEMPLATES.commercial;

  if (parkingMinutes <= tmpl.freeMinutes) {
    return {
      parkingMinutes,
      templateName: tmpl.name,
      isFree: true,
      totalFee: 0,
      totalFeeFormatted: '¥0.00',
      desc: `免费时段内 (未超 ${tmpl.freeMinutes} 分钟)`
    };
  }

  // 计算计费小时数 (不满整小时按整小时或半小时进位，常规向上取整小时)
  const billableHours = Math.ceil(parkingMinutes / 60);
  // 首小时价格 + 剩余小时 * 续小时价格
  let totalFee = tmpl.firstHourPrice;
  if (billableHours > 1) {
    totalFee += (billableHours - 1) * tmpl.nextHourPrice;
  }

  // 昼夜封顶判断 (每24小时)
  const days = Math.floor(parkingMinutes / (24 * 60));
  const remainingHoursInDay = Math.ceil((parkingMinutes % (24 * 60)) / 60);
  let dayFee = tmpl.firstHourPrice;
  if (remainingHoursInDay > 1) {
    dayFee += (remainingHoursInDay - 1) * tmpl.nextHourPrice;
  }
  dayFee = Math.min(tmpl.dailyCap, dayFee);
  totalFee = math.round(days * tmpl.dailyCap + dayFee, 2);

  return {
    parkingMinutes,
    templateName: tmpl.name,
    billableHours,
    isFree: false,
    dailyCap: tmpl.dailyCap,
    totalFee,
    totalFeeFormatted: math.formatMoney(totalFee)
  };
}

/**
 * 4.5 满减促销折扣计算器
 * @param {Object} options
 * @param {number} options.originTotal 商品原价合计 (元)
 * @param {number} [options.crossShopThreshold=300] 跨店满减门槛 (如300)
 * @param {number} [options.crossShopReduction=50] 跨店满减优惠金额 (如50)
 * @param {number} [options.shopCoupon=0] 店铺优惠券 (元)
 * @param {number} [options.platformCoupon=0] 平台品类券/红包 (元)
 */
function calcDiscountPromotion(options = {}) {
  const originTotal = Math.max(0, Number(options.originTotal) || 0);
  const crossShopThreshold = Math.max(1, Number(options.crossShopThreshold) || 300);
  const crossShopReduction = Math.max(0, Number(options.crossShopReduction) || 50);
  const shopCoupon = Math.max(0, Number(options.shopCoupon) || 0);
  const platformCoupon = Math.max(0, Number(options.platformCoupon) || 0);

  // 跨店满减倍数
  const crossShopTimes = Math.floor(originTotal / crossShopThreshold);
  const crossShopDiscount = crossShopTimes * crossShopReduction;

  const totalDiscount = crossShopDiscount + shopCoupon + platformCoupon;
  const finalPay = Math.max(0, math.round(originTotal - totalDiscount, 2));

  // 实际等效折让系数 (例如 8.2 折)
  const discountRate = originTotal > 0 ? math.round((finalPay / originTotal) * 10, 1) : 10;
  const savePercent = originTotal > 0 ? math.round((totalDiscount / originTotal) * 100, 1) : 0;

  return {
    originTotal,
    crossShopDiscount,
    shopCoupon,
    platformCoupon,
    totalDiscount,
    finalPay,
    finalPayFormatted: math.formatMoney(finalPay),
    discountRate,
    discountRateText: `${discountRate} 折`,
    savePercent
  };
}

module.exports = {
  // 1. 装修建材
  calcRenovationBudget,
  calcTileUsage,
  calcPaintUsage,
  calcFlooringUsage,
  calcWallpaperUsage,
  calcCurtainUsage,
  // 2. 职场民生
  calcDateDiff,
  calcAgeAndZodiac,
  calcDelayRetirement,
  calcWorkAge,
  calcAnnualLeave,
  calcSocialMinYears,
  calcPensionEstimate,
  calcMaternityAllowance,
  // 3. 健康生活与家庭仪式
  calcBMI,
  calcPregnancy,
  calcAnniversary,
  calcWeddingBudget,
  // 4. 公用事业与生活消费
  calcElectricityCost,
  calcWaterCost,
  calcExpressFreight,
  calcParkingFee,
  calcDiscountPromotion
};
