/**
 * miniprogram/utils/calculators/salary.js
 * 02·工资个税模块高精度金融级纯函数算法引擎
 * 严格遵循《中华人民共和国个人所得税法》累计预扣法与现行税收政策
 * 依托 big.js 高精度数学库，杜绝 IEEE 754 浮点数精度丢失
 */
const math = require('../math.js');
const {
  ANNUAL_TAX_RATES,
  MONTHLY_TAX_RATES,
  BONUS_BLIND_ZONES,
  SPECIAL_DEDUCTIONS_CONFIG,
  CITY_SOCIAL_CONFIG,
  TAX_EXEMPTION_PER_MONTH,
  STATUTORY_WORKING_DAYS
} = require('../config/tax-social.js');

/**
 * 辅助函数: 根据年度应纳税所得额查综合所得税率表
 * @param {number} taxableIncome 年度应纳税所得额 (元)
 * @returns {{ tax: number, rate: number, quickDeduction: number, level: number }}
 */
function calcAnnualTaxFromTaxable(taxableIncome) {
  const taxable = Math.max(0, Number(taxableIncome) || 0);
  if (taxable <= 0) {
    return { tax: 0, rate: 0, quickDeduction: 0, level: 0 };
  }

  for (let i = 0; i < ANNUAL_TAX_RATES.length; i++) {
    const tier = ANNUAL_TAX_RATES[i];
    if (taxable <= tier.max) {
      // 税额 = 应纳税所得额 * 税率 - 速算扣除数
      const rawTax = math.sub(math.mul(taxable, tier.rate), tier.quickDeduction);
      const tax = Math.max(0, math.round(rawTax, 2));
      return {
        tax,
        rate: tier.rate,
        ratePercent: math.mul(tier.rate, 100),
        quickDeduction: tier.quickDeduction,
        level: i + 1
      };
    }
  }

  // 兜底第 7 级
  const lastTier = ANNUAL_TAX_RATES[ANNUAL_TAX_RATES.length - 1];
  const rawTax = math.sub(math.mul(taxable, lastTier.rate), lastTier.quickDeduction);
  return {
    tax: Math.max(0, math.round(rawTax, 2)),
    rate: lastTier.rate,
    ratePercent: math.mul(lastTier.rate, 100),
    quickDeduction: lastTier.quickDeduction,
    level: 7
  };
}

/**
 * 辅助函数: 根据月度换算应纳税所得额查单独计税月度税率表 (用于年终奖单独计税)
 * @param {number} monthlyTaxable 应纳税所得额 / 12 (元)
 */
function calcMonthlyBonusTaxRate(monthlyTaxable) {
  const taxable = Math.max(0, Number(monthlyTaxable) || 0);
  if (taxable <= 0) {
    return { rate: 0, ratePercent: 0, quickDeduction: 0, level: 0 };
  }

  for (let i = 0; i < MONTHLY_TAX_RATES.length; i++) {
    const tier = MONTHLY_TAX_RATES[i];
    if (taxable <= tier.max) {
      return {
        rate: tier.rate,
        ratePercent: math.mul(tier.rate, 100),
        quickDeduction: tier.quickDeduction,
        level: i + 1
      };
    }
  }

  const last = MONTHLY_TAX_RATES[MONTHLY_TAX_RATES.length - 1];
  return {
    rate: last.rate,
    ratePercent: math.mul(last.rate, 100),
    quickDeduction: last.quickDeduction,
    level: 7
  };
}

/**
 * 1. 五险一金精确计算器
 * @param {Object} options
 * @param {number} options.salary 实际税前月薪 (元)
 * @param {string} [options.cityKey='beijing'] 城市配置标识
 * @param {number} [options.customSocialBase] 自定义社保基数 (未填则根据薪资与上下限自适应)
 * @param {number} [options.customFundBase] 自定义公积金基数
 * @param {number} [options.customFundRate] 自定义公积金个人比例 (如 0.12)
 */
function calcSocialSecurity(options = {}) {
  const salary = Math.max(0, Number(options.salary) || 0);
  const cityKey = options.cityKey || 'beijing';
  const cityCfg = CITY_SOCIAL_CONFIG[cityKey] || CITY_SOCIAL_CONFIG.general;

  // 1. 确定社保缴费基数 (在社保上下限区间内)
  let socialBase = options.customSocialBase !== undefined && options.customSocialBase !== null
    ? Number(options.customSocialBase)
    : salary;
  socialBase = Math.max(cityCfg.socialMin, Math.min(socialBase, cityCfg.socialMax));

  // 2. 确定公积金缴费基数 (在公积金上下限区间内)
  let fundBase = options.customFundBase !== undefined && options.customFundBase !== null
    ? Number(options.customFundBase)
    : salary;
  fundBase = Math.max(cityCfg.fundMin, Math.min(fundBase, cityCfg.fundMax));

  const rates = cityCfg.rates;
  const fundRatePersonal = options.customFundRate !== undefined && options.customFundRate !== null
    ? Number(options.customFundRate)
    : rates.fund.personal;
  const fundRateCompany = fundRatePersonal; // 通常单位与个人缴存比例一致

  // 计算个人承担项
  const personalPension = math.round(math.mul(socialBase, rates.pension.personal), 2);
  const personalMedicalRaw = math.mul(socialBase, rates.medical.personal);
  const personalMedicalExtra = rates.medical.personalExtra || 0;
  const personalMedical = math.round(math.add(personalMedicalRaw, personalMedicalExtra), 2);
  const personalUnemployment = math.round(math.mul(socialBase, rates.unemployment.personal), 2);
  const personalInjury = math.round(math.mul(socialBase, rates.injury.personal), 2);
  const personalMaternity = math.round(math.mul(socialBase, rates.maternity.personal), 2);
  const personalFund = math.round(math.mul(fundBase, fundRatePersonal), 2);

  const personalTotal = math.round(
    personalPension + personalMedical + personalUnemployment + personalInjury + personalMaternity + personalFund,
    2
  );

  // 计算企业承担项
  const companyPension = math.round(math.mul(socialBase, rates.pension.company), 2);
  const companyMedical = math.round(math.mul(socialBase, rates.medical.company), 2);
  const companyUnemployment = math.round(math.mul(socialBase, rates.unemployment.company), 2);
  const companyInjury = math.round(math.mul(socialBase, rates.injury.company), 2);
  const companyMaternity = math.round(math.mul(socialBase, rates.maternity.company), 2);
  const companyFund = math.round(math.mul(fundBase, fundRateCompany), 2);

  const companyTotal = math.round(
    companyPension + companyMedical + companyUnemployment + companyInjury + companyMaternity + companyFund,
    2
  );

  return {
    cityKey,
    cityName: cityCfg.cityName,
    salary,
    socialBase,
    fundBase,
    personal: {
      pension: personalPension,
      medical: personalMedical,
      unemployment: personalUnemployment,
      injury: personalInjury,
      maternity: personalMaternity,
      fund: personalFund,
      total: personalTotal,
      formatTotal: math.formatMoney(personalTotal)
    },
    company: {
      pension: companyPension,
      medical: companyMedical,
      unemployment: companyUnemployment,
      injury: companyInjury,
      maternity: companyMaternity,
      fund: companyFund,
      total: companyTotal,
      formatTotal: math.formatMoney(companyTotal)
    },
    totalBoth: math.round(math.add(personalTotal, companyTotal), 2),
    formatTotalBoth: math.formatMoney(math.add(personalTotal, companyTotal))
  };
}

/**
 * 2. 专项附加扣除汇总计算器 (7项)
 * @param {Object} items
 * @param {number} [items.babyCareCount=0] 3岁以下婴幼儿子女数
 * @param {number} [items.childEduCount=0] 子女教育子女数
 * @param {boolean} [items.isOnlyChild=true] 赡养老人是否为独生子女
 * @param {number} [items.elderlyDeduction] 非独生子女自定义分摊额 (最高1500)
 * @param {number} [items.hasParents=1] 是否有赡养老人家长 (1: 是, 0: 否)
 * @param {string} [items.housingDeductionType='none'] 'loan'(房贷) | 'rent'(房租) | 'none'
 * @param {number} [items.rentTier=1] 住房租金档次 (1: 1500, 2: 1100, 3: 800)
 * @param {string} [items.continuingEduType='none'] 'degree'(学历400) | 'vocational'(技能300按月折算) | 'none'
 * @param {number} [items.annualMedicalExpense=0] 大病医疗年度自付超出1.5万的部分
 */
function calcSpecialDeductions(items = {}) {
  const cfg = SPECIAL_DEDUCTIONS_CONFIG;
  let monthlyTotal = 0;

  // 1. 婴幼儿照护 (2000元/月/孩)
  const babyCount = Math.max(0, Number(items.babyCareCount) || 0);
  const babyDeduction = babyCount * cfg.babyCare.defaultAmount;
  monthlyTotal += babyDeduction;

  // 2. 子女教育 (2000元/月/孩)
  const childCount = Math.max(0, Number(items.childEduCount) || 0);
  const childEduDeduction = childCount * cfg.childEducation.defaultAmount;
  monthlyTotal += childEduDeduction;

  // 3. 赡养老人
  let elderlyDeduction = 0;
  if (items.hasParents !== 0 && items.hasParents !== false) {
    if (items.isOnlyChild !== false) {
      elderlyDeduction = cfg.elderlyCare.onlyChild; // 3000
    } else {
      elderlyDeduction = Math.min(cfg.elderlyCare.nonOnlyChildMax, Math.max(0, Number(items.elderlyDeduction) || 1500));
    }
  }
  monthlyTotal += elderlyDeduction;

  // 4. 住房利息 vs 住房租金 (二者不可兼得)
  let housingDeduction = 0;
  let housingLabel = '无扣除';
  if (items.housingDeductionType === 'loan') {
    housingDeduction = cfg.housingLoan.defaultAmount; // 1000
    housingLabel = '住房贷款利息 (1000元/月)';
  } else if (items.housingDeductionType === 'rent') {
    const tier = Number(items.rentTier) || 1;
    if (tier === 1) housingDeduction = cfg.housingRent.tier1;
    else if (tier === 2) housingDeduction = cfg.housingRent.tier2;
    else housingDeduction = cfg.housingRent.tier3;
    housingLabel = `住房租金 (${housingDeduction}元/月)`;
  }
  monthlyTotal += housingDeduction;

  // 5. 继续教育
  let continuingEduDeduction = 0;
  if (items.continuingEduType === 'degree') {
    continuingEduDeduction = cfg.continuingEducation.degree; // 400元/月
  } else if (items.continuingEduType === 'vocational') {
    continuingEduDeduction = 300; // 3600元/年，月均300元
  }
  monthlyTotal += continuingEduDeduction;

  // 6. 大病医疗 (年均分摊到月，仅供参考)
  const medicalRaw = Math.max(0, Number(items.annualMedicalExpense) || 0);
  const medicalValid = Math.min(cfg.medicalExpense.maxDeduction, Math.max(0, medicalRaw - cfg.medicalExpense.threshold));
  const medicalMonthly = math.round(medicalValid / 12, 2);
  monthlyTotal += medicalMonthly;

  return {
    monthlyTotal: math.round(monthlyTotal, 2),
    annualTotal: math.round(monthlyTotal * 12, 2),
    items: {
      babyDeduction,
      childEduDeduction,
      elderlyDeduction,
      housingDeduction,
      housingLabel,
      continuingEduDeduction,
      medicalMonthly
    }
  };
}

/**
 * 3. 个人所得税月度累计预扣预缴计算器 (国家税总标准算法)
 * 推演 1~12 月全景明细，体现下半年税率跳档效应
 * @param {Object} options
 * @param {number} options.monthlySalary 税前月薪 (元)
 * @param {string} [options.cityKey='beijing'] 城市标识
 * @param {number} [options.specialDeduction=0] 每月专项附加扣除总额 (元)
 * @param {Object} [options.customSocial] 自定义社保计算输入参数
 */
function calcSalaryMonthlyTax(options = {}) {
  const monthlySalary = Math.max(0, Number(options.monthlySalary) || 0);
  const cityKey = options.cityKey || 'beijing';
  const specialDeduction = Math.max(0, Number(options.specialDeduction) || 0);

  // 计算社保公积金
  const socialRes = calcSocialSecurity({
    salary: monthlySalary,
    cityKey,
    customSocialBase: options.customSocialBase,
    customFundBase: options.customFundBase,
    customFundRate: options.customFundRate
  });

  const monthlyPersonalSocial = socialRes.personal.total;
  const monthlyCompanySocial = socialRes.company.total;
  const monthlyExemption = TAX_EXEMPTION_PER_MONTH; // 5000

  const schedule = [];
  let accumulatedTaxPaid = 0;
  let totalAnnualTax = 0;
  let totalAnnualNet = 0;

  for (let m = 1; m <= 12; m++) {
    const accIncome = math.mul(monthlySalary, m);
    const accExemption = math.mul(monthlyExemption, m);
    const accSocial = math.mul(monthlyPersonalSocial, m);
    const accSpecial = math.mul(specialDeduction, m);

    // 累计应纳税所得额 = 累计收入 - 累计免征 - 累计社保 - 累计专项附加扣除
    const rawTaxable = math.sub(math.sub(math.sub(accIncome, accExemption), accSocial), accSpecial);
    const accTaxable = Math.max(0, math.round(rawTaxable, 2));

    // 计算累计应纳税额
    const taxObj = calcAnnualTaxFromTaxable(accTaxable);
    const accTaxLiability = taxObj.tax;

    // 当月实扣税额 = 累计应纳税额 - 截至上月累计已扣税额
    let currentMonthTax = math.sub(accTaxLiability, accumulatedTaxPaid);
    currentMonthTax = Math.max(0, math.round(currentMonthTax, 2));

    // 当月税后实发工资 = 税前 - 个人五险一金 - 当月个税
    const currentNetSalary = math.round(
      math.sub(math.sub(monthlySalary, monthlyPersonalSocial), currentMonthTax),
      2
    );

    // 累计已纳税额递增
    accumulatedTaxPaid = math.round(math.add(accumulatedTaxPaid, currentMonthTax), 2);
    totalAnnualTax = accumulatedTaxPaid;
    totalAnnualNet = math.round(math.add(totalAnnualNet, currentNetSalary), 2);

    schedule.push({
      month: m,
      monthName: `${m}月`,
      monthlySalary,
      currentNetSalary,
      currentMonthTax,
      personalSocial: monthlyPersonalSocial,
      specialDeduction,
      accIncome,
      accTaxable,
      taxRate: taxObj.ratePercent,
      taxLevel: taxObj.level,
      accTaxLiability,
      formatNetSalary: math.formatMoney(currentNetSalary),
      formatTax: math.formatMoney(currentMonthTax)
    });
  }

  // 首月数据 (用户关注最直观的单月)
  const firstMonth = schedule[0];
  const totalAnnualPreTax = math.mul(monthlySalary, 12);
  const totalAnnualCompanyCost = math.round(math.mul(math.add(monthlySalary, monthlyCompanySocial), 12), 2);
  const avgMonthlyNet = math.round(totalAnnualNet / 12, 2);

  return {
    monthlySalary,
    formatMonthlySalary: math.formatMoney(monthlySalary),
    cityKey,
    cityName: socialRes.cityName,
    firstMonth,
    socialRes,
    specialDeduction,
    schedule,
    annualSummary: {
      totalAnnualPreTax,
      formatTotalAnnualPreTax: math.formatMoney(totalAnnualPreTax),
      totalAnnualPersonalSocial: math.round(math.mul(monthlyPersonalSocial, 12), 2),
      formatTotalAnnualPersonalSocial: math.formatMoney(math.mul(monthlyPersonalSocial, 12)),
      totalAnnualCompanySocial: math.round(math.mul(monthlyCompanySocial, 12), 2),
      formatTotalAnnualCompanySocial: math.formatMoney(math.mul(monthlyCompanySocial, 12)),
      totalAnnualTax,
      formatTotalAnnualTax: math.formatMoney(totalAnnualTax),
      totalAnnualNet,
      formatTotalAnnualNet: math.formatMoney(totalAnnualNet),
      avgMonthlyNet,
      formatAvgMonthlyNet: math.formatMoney(avgMonthlyNet),
      totalAnnualCompanyCost,
      formatTotalAnnualCompanyCost: math.formatMoney(totalAnnualCompanyCost)
    }
  };
}

/**
 * 4. 税后工资倒推税前工资 (二分法数值迭代，精确反解)
 * @param {Object} options
 * @param {number} options.targetAfterTax 期望税后到手月薪 (元)
 * @param {string} [options.cityKey='beijing'] 城市标识
 * @param {number} [options.specialDeduction=0] 每月专项附加扣除 (元)
 */
function calcSalaryReverse(options = {}) {
  const targetNet = Math.max(0, Number(options.targetAfterTax) || 0);
  if (targetNet <= 0) {
    return {
      targetNet: 0,
      preTaxSalary: 0,
      formatPreTaxSalary: '0.00',
      socialPersonal: 0,
      tax: 0,
      actualNet: 0,
      diff: 0
    };
  }

  const cityKey = options.cityKey || 'beijing';
  const specialDeduction = Number(options.specialDeduction) || 0;

  // 二分搜索区间设置
  let left = targetNet;
  let right = targetNet * 2.5 + 50000;
  let mid = 0;
  let bestResult = null;

  // 迭代 30 次足以达到分级精度 (误差 < 0.01 元)
  for (let i = 0; i < 30; i++) {
    mid = (left + right) / 2;
    const testCalc = calcSalaryMonthlyTax({
      monthlySalary: mid,
      cityKey,
      specialDeduction
    });
    const net = testCalc.firstMonth.currentNetSalary;
    bestResult = testCalc;

    if (Math.abs(net - targetNet) < 0.01) {
      break;
    }

    if (net < targetNet) {
      left = mid;
    } else {
      right = mid;
    }
  }

  const preTaxSalary = math.round(mid, 2);
  const finalCalc = calcSalaryMonthlyTax({
    monthlySalary: preTaxSalary,
    cityKey,
    specialDeduction
  });

  return {
    targetNet,
    formatTargetNet: math.formatMoney(targetNet),
    preTaxSalary,
    formatPreTaxSalary: math.formatMoney(preTaxSalary),
    socialPersonal: finalCalc.firstMonth.personalSocial,
    tax: finalCalc.firstMonth.currentMonthTax,
    actualNet: finalCalc.firstMonth.currentNetSalary,
    diff: math.round(finalCalc.firstMonth.currentNetSalary - targetNet, 2),
    detail: finalCalc
  };
}

/**
 * 5. 年终奖单独计税 vs 合并计税比对及 6 大盲区预警
 * @param {Object} options
 * @param {number} options.annualBonus 年终奖金额 (元)
 * @param {number} options.monthlySalary 税前平时月薪 (元)
 * @param {string} [options.cityKey='beijing'] 城市
 * @param {number} [options.specialDeduction=0] 专项附加扣除
 */
function calcAnnualBonus(options = {}) {
  const bonus = Math.max(0, Number(options.annualBonus) || 0);
  const monthlySalary = Math.max(0, Number(options.monthlySalary) || 0);
  const cityKey = options.cityKey || 'beijing';
  const specialDeduction = Math.max(0, Number(options.specialDeduction) || 0);

  // 1. 平时 12 个月的常规个税测算
  const regularCalc = calcSalaryMonthlyTax({
    monthlySalary,
    cityKey,
    specialDeduction
  });
  const regularAnnualTax = regularCalc.annualSummary.totalAnnualTax;
  const regularAnnualNet = regularCalc.annualSummary.totalAnnualNet;
  const regularAnnualPreTax = regularCalc.annualSummary.totalAnnualPreTax;
  const regularAnnualSocial = regularCalc.annualSummary.totalAnnualPersonalSocial;

  // 2. 方案 A: 年终奖单独计税
  let bonusTaxA = 0;
  let bonusRateInfo = null;

  // 检查平时收入是否低于起征点 (5000*12 + 社保*12 + 专项扣除*12)
  const annualExemptionTotal = math.mul(TAX_EXEMPTION_PER_MONTH, 12);
  const baseThreshold = math.add(math.add(annualExemptionTotal, regularAnnualSocial), math.mul(specialDeduction, 12));
  let gap = math.sub(baseThreshold, regularAnnualPreTax); // 差额弥补空间

  let bonusTaxableA = bonus;
  if (gap > 0) {
    // 平时扣除未用完，用年终奖弥补差额
    bonusTaxableA = Math.max(0, math.sub(bonus, gap));
  }

  const monthlyDivided = bonusTaxableA / 12;
  bonusRateInfo = calcMonthlyBonusTaxRate(monthlyDivided);
  const rawBonusTaxA = math.sub(math.mul(bonusTaxableA, bonusRateInfo.rate), bonusRateInfo.quickDeduction);
  bonusTaxA = Math.max(0, math.round(rawBonusTaxA, 2));

  const totalTaxA = math.round(math.add(regularAnnualTax, bonusTaxA), 2);
  const totalNetA = math.round(math.sub(math.sub(math.add(regularAnnualPreTax, bonus), regularAnnualSocial), totalTaxA), 2);
  const bonusNetA = math.round(math.sub(bonus, bonusTaxA), 2);

  // 3. 方案 B: 年终奖并入综合所得合并计税
  const totalCombinedPreTax = math.add(regularAnnualPreTax, bonus);
  const combinedTaxable = Math.max(
    0,
    math.sub(math.sub(math.sub(totalCombinedPreTax, annualExemptionTotal), regularAnnualSocial), math.mul(specialDeduction, 12))
  );
  const combinedTaxObj = calcAnnualTaxFromTaxable(combinedTaxable);
  const totalTaxB = combinedTaxObj.tax;
  const bonusTaxB = Math.max(0, math.round(math.sub(totalTaxB, regularAnnualTax), 2));
  const totalNetB = math.round(math.sub(math.sub(totalCombinedPreTax, regularAnnualSocial), totalTaxB), 2);
  const bonusNetB = Math.round(math.sub(bonus, bonusTaxB), 2);

  // 4. 对比决策
  let betterPlan = 'separate';
  let diffTax = math.round(Math.abs(totalTaxA - totalTaxB), 2);
  let adviseText = '';

  if (totalTaxA < totalTaxB) {
    betterPlan = 'separate';
    adviseText = `推荐选择「单独计税」，全年少缴个税 ¥${math.formatMoney(diffTax)}，税后到手更多！`;
  } else if (totalTaxB < totalTaxA) {
    betterPlan = 'combine';
    adviseText = `推荐选择「并入综合计税」，平时免征额未完全使用，合并计税可少缴个税 ¥${math.formatMoney(diffTax)}！`;
  } else {
    betterPlan = 'equal';
    adviseText = '两种计税方式税负完全一致，可任意选择。';
  }

  // 5. 临界点盲区检测 (针对方案 A 单独计税)
  let hitBlindZone = null;
  for (let i = 0; i < BONUS_BLIND_ZONES.length; i++) {
    const bz = BONUS_BLIND_ZONES[i];
    if (bonus >= bz.blindMin && bonus <= bz.blindMax) {
      // 计算安全金额的到手
      const safeBonus = bz.safeAmount;
      const safeMonthly = safeBonus / 12;
      const safeRateInfo = calcMonthlyBonusTaxRate(safeMonthly);
      const safeTax = math.round(math.sub(math.mul(safeBonus, safeRateInfo.rate), safeRateInfo.quickDeduction), 2);
      const safeNet = math.round(safeBonus - safeTax, 2);

      // 当前到手
      const curNet = bonusNetA;
      const lossNet = math.round(safeNet - curNet, 2);

      hitBlindZone = {
        threshold: bz.threshold,
        blindMin: bz.blindMin,
        blindMax: bz.blindMax,
        safeAmount: bz.safeAmount,
        lossNet: lossNet > 0 ? lossNet : 0,
        tip: `年终奖处于税率盲区(${bz.threshold}元临界点)！相比发放${bz.safeAmount}元，你多发了${bonus - bz.safeAmount}元，但税后倒少拿约 ¥${math.formatMoney(lossNet)}元！建议协商改为发放 ¥${bz.safeAmount}元。`
      };
      break;
    }
  }

  return {
    annualBonus: bonus,
    formatAnnualBonus: math.formatMoney(bonus),
    monthlySalary,
    regularAnnualTax,
    // 方案 A
    schemeA: {
      name: '年终奖单独计税',
      bonusTax: bonusTaxA,
      formatBonusTax: math.formatMoney(bonusTaxA),
      bonusNet: bonusNetA,
      formatBonusNet: math.formatMoney(bonusNetA),
      totalTax: totalTaxA,
      formatTotalTax: math.formatMoney(totalTaxA),
      totalNet: totalNetA,
      formatTotalNet: math.formatMoney(totalNetA),
      ratePercent: bonusRateInfo.ratePercent,
      quickDeduction: bonusRateInfo.quickDeduction
    },
    // 方案 B
    schemeB: {
      name: '并入综合所得计税',
      bonusTax: bonusTaxB,
      formatBonusTax: math.formatMoney(bonusTaxB),
      bonusNet: bonusNetB,
      formatBonusNet: math.formatMoney(bonusNetB),
      totalTax: totalTaxB,
      formatTotalTax: math.formatMoney(totalTaxB),
      totalNet: totalNetB,
      formatTotalNet: math.formatMoney(totalNetB),
      ratePercent: combinedTaxObj.ratePercent,
      quickDeduction: combinedTaxObj.quickDeduction
    },
    betterPlan,
    diffTax,
    formatDiffTax: math.formatMoney(diffTax),
    adviseText,
    hitBlindZone
  };
}

/**
 * 6. 加班费法定标准计算器
 * @param {Object} options
 * @param {number} options.monthlySalary 正常月薪 (元)
 * @param {number} [options.workdayHours=0] 工作日延时加班时长 (小时, 1.5倍)
 * @param {number} [options.weekendHours=0] 休息日加班时长 (小时, 2.0倍)
 * @param {number} [options.holidayHours=0] 法定节假日加班时长 (小时, 3.0倍)
 */
function calcOvertimePay(options = {}) {
  const salary = Math.max(0, Number(options.monthlySalary) || 0);
  const workdayHours = Math.max(0, Number(options.workdayHours) || 0);
  const weekendHours = Math.max(0, Number(options.weekendHours) || 0);
  const holidayHours = Math.max(0, Number(options.holidayHours) || 0);

  // 法定基准
  const daySalary = math.div(salary, STATUTORY_WORKING_DAYS, 2);
  const hourSalary = math.div(daySalary, 8, 2);

  const workdayPay = math.round(math.mul(math.mul(hourSalary, 1.5), workdayHours), 2);
  const weekendPay = math.round(math.mul(math.mul(hourSalary, 2.0), weekendHours), 2);
  const holidayPay = math.round(math.mul(math.mul(hourSalary, 3.0), holidayHours), 2);
  const totalOvertimePay = math.round(workdayPay + weekendPay + holidayPay, 2);

  return {
    salary,
    daySalary,
    hourSalary,
    formatHourSalary: math.formatMoney(hourSalary),
    workdayHours,
    workdayPay,
    formatWorkdayPay: math.formatMoney(workdayPay),
    weekendHours,
    weekendPay,
    formatWeekendPay: math.formatMoney(weekendPay),
    holidayHours,
    holidayPay,
    formatHolidayPay: math.formatMoney(holidayPay),
    totalOvertimePay,
    formatTotalOvertimePay: math.formatMoney(totalOvertimePay),
    totalSalaryWithOvertime: math.round(salary + totalOvertimePay, 2),
    formatTotalSalaryWithOvertime: math.formatMoney(salary + totalOvertimePay)
  };
}

/**
 * 7. 离职经济补偿金及个税免税合规测算 (N / N+1 规则)
 * 依据财税[2018]164号文：
 * 补偿金总额在当地上年度职工年平均工资3倍以内部分免征个人所得税；
 * 超过3倍数额部分不并入当年综合所得，单独适用综合所得税率表。
 * @param {Object} options
 * @param {number} options.avgSalary 离职前12个月平均月工资 (元)
 * @param {number} options.workYears 工作年限 (年)
 * @param {string} [options.cityKey='beijing'] 城市
 * @param {boolean} [options.isNPlusOne=false] 是否为 N+1 代通知金方案
 */
function calcSeverancePay(options = {}) {
  const avgSalary = Math.max(0, Number(options.avgSalary) || 0);
  const workYearsRaw = Math.max(0, Number(options.workYears) || 0);
  const cityKey = options.cityKey || 'beijing';
  const isNPlusOne = Boolean(options.isNPlusOne);

  const cityCfg = CITY_SOCIAL_CONFIG[cityKey] || CITY_SOCIAL_CONFIG.general;
  const localAnnualAvgSalary = cityCfg.avgSalary * 12;
  const taxFreeLimit = localAnnualAvgSalary * 3; // 3倍社平免税基准

  // 法定工作月数折算 N:
  // 满1年算1个月；6个月以上不满1年算1年；不满6个月算0.5个月。
  const integerYears = Math.floor(workYearsRaw);
  const remainder = workYearsRaw - integerYears;
  let factorN = integerYears;
  if (remainder >= 0.5) {
    factorN += 1;
  } else if (remainder > 0) {
    factorN += 0.5;
  }

  // 经济补偿金 N 封顶 12 年 (若工资高于社平3倍)
  let cappedBase = avgSalary;
  const monthlyCap = cityCfg.avgSalary * 3;
  let isCapped = false;
  if (avgSalary > monthlyCap) {
    cappedBase = monthlyCap;
    factorN = Math.min(12, factorN);
    isCapped = true;
  }

  // 计算法定经济补偿金 N
  const compensationN = math.round(math.mul(cappedBase, factorN), 2);

  // 若为 N+1，加发 1 个月未提前通知代通知金 (通常以原工资为准)
  const noticePay = isNPlusOne ? avgSalary : 0;
  const totalSeverance = math.round(compensationN + noticePay, 2);

  // 测算个税
  let taxFreeAmount = Math.min(totalSeverance, taxFreeLimit);
  let taxableSeverance = Math.max(0, math.sub(totalSeverance, taxFreeLimit));
  let tax = 0;

  if (taxableSeverance > 0) {
    // 超过3倍部分单独适用综合税率：以超额部分 / 工作年限(最高12)的数额查年度税率表
    const yearsForTax = Math.min(12, Math.max(1, Math.ceil(workYearsRaw)));
    const annualDivided = taxableSeverance / yearsForTax;
    const taxObj = calcAnnualTaxFromTaxable(annualDivided);
    tax = math.round(math.mul(taxObj.tax, yearsForTax), 2);
  }

  const netSeverance = math.round(totalSeverance - tax, 2);

  return {
    avgSalary,
    workYears: workYearsRaw,
    factorN,
    isNPlusOne,
    isCapped,
    monthlyCap,
    compensationN,
    noticePay,
    totalSeverance,
    formatTotalSeverance: math.formatMoney(totalSeverance),
    taxFreeLimit,
    formatTaxFreeLimit: math.formatMoney(taxFreeLimit),
    taxFreeAmount,
    taxableSeverance,
    tax,
    formatTax: math.formatMoney(tax),
    netSeverance,
    formatNetSeverance: math.formatMoney(netSeverance),
    cityName: cityCfg.cityName
  };
}

/**
 * 8. 年度汇算清缴退补税计算器
 * @param {Object} options
 * @param {number} options.annualIncome 全年综合所得收入 (元)
 * @param {number} [options.annualSocial=0] 全年五险一金个人扣缴 (元)
 * @param {number} [options.annualSpecialDeduction=0] 全年专项附加扣除 (元)
 * @param {number} [options.prepaidTax=0] 全年已预扣预缴税额 (元)
 */
function calcAnnualTaxSettlement(options = {}) {
  const income = Math.max(0, Number(options.annualIncome) || 0);
  const social = Math.max(0, Number(options.annualSocial) || 0);
  const special = Math.max(0, Number(options.annualSpecialDeduction) || 0);
  const prepaidTax = Math.max(0, Number(options.prepaidTax) || 0);
  const exemption = TAX_EXEMPTION_PER_MONTH * 12; // 60000

  const rawTaxable = math.sub(math.sub(math.sub(income, exemption), social), special);
  const taxable = Math.max(0, math.round(rawTaxable, 2));

  const taxObj = calcAnnualTaxFromTaxable(taxable);
  const actualAnnualTax = taxObj.tax;

  const diff = math.round(actualAnnualTax - prepaidTax, 2);

  let settlementType = 'none'; // 'refund' (退税) | 'payment' (补税) | 'none' (平齐)
  let isExemptPayment = false; // 是否享受免补税政策
  let tip = '';

  if (diff < 0) {
    settlementType = 'refund';
    const refundAmount = Math.abs(diff);
    tip = `恭喜！年度综合汇算后，预计可申请个人所得税退税 ¥${math.formatMoney(refundAmount)} 元。`;
  } else if (diff > 0) {
    settlementType = 'payment';
    // 国家税总政策：补税金额不超过 400 元，或者年度综合所得收入不超过 12 万元，免予办理汇算补税！
    if (diff <= 400 || income <= 120000) {
      isExemptPayment = true;
      tip = `汇算测算需补税 ¥${math.formatMoney(diff)} 元，但符合国家「补税不超过400元或年收入≤12万」的免办汇算申报政策，依法无需补缴！`;
    } else {
      tip = `汇算测算需补缴个税 ¥${math.formatMoney(diff)} 元，请在次年 3 月 1 日至 6 月 30 日前通过个税 App 完成清缴。`;
    }
  } else {
    tip = '年度预扣预缴个税与年度实际应纳税额完全一致，无需办理退税或补税。';
  }

  return {
    annualIncome: income,
    actualAnnualTax,
    formatActualAnnualTax: math.formatMoney(actualAnnualTax),
    prepaidTax,
    formatPrepaidTax: math.formatMoney(prepaidTax),
    diff,
    settlementType,
    isExemptPayment,
    refundOrPayAmount: Math.abs(diff),
    formatRefundOrPayAmount: math.formatMoney(Math.abs(diff)),
    tip
  };
}

module.exports = {
  calcAnnualTaxFromTaxable,
  calcMonthlyBonusTaxRate,
  calcSocialSecurity,
  calcSpecialDeductions,
  calcSalaryMonthlyTax,
  calcSalaryReverse,
  calcAnnualBonus,
  calcOvertimePay,
  calcSeverancePay,
  calcAnnualTaxSettlement
};
