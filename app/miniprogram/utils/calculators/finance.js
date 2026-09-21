/**
 * miniprogram/utils/calculators/finance.js
 * 04·储蓄理财模块高精度纯函数算法引擎
 * 涵盖：存款利息(单利)、定期复利(APY/增益)、基金定投(终值/敏感性)、通用复利(追加/逐年轨迹)、通胀购买力、收益率换算、FIRE财务自由规划
 */
const math = require('../math.js');
const {
  BANK_DEPOSIT_RATES,
  LARGE_CD_RATES,
  INFLATION_PRESETS,
  FIRE_CONFIG
} = require('../config/finance-rates.js');

/**
 * 1. 存款利息计算器 (单利模型)
 * 支持按年/按月/按日计息，支持挂牌与大额存单基准利率
 * @param {Object} options
 * @param {number} options.principal 存款本金 (元)
 * @param {number} options.annualRate 年化利率百分比 (如 1.5 代表 1.5%)
 * @param {string} [options.termType='year'] 计息期限类型: 'year' | 'month' | 'day'
 * @param {number} [options.termValue=1] 期限数值
 */
function calcDepositInterest(options = {}) {
  const principal = Math.max(0, Number(options.principal) || 0);
  const annualRate = Math.max(0, Number(options.annualRate) || 0);
  const termType = options.termType || 'year';
  const termValue = Math.max(0, Number(options.termValue) || 1);

  const rateDecimal = annualRate / 100;
  let termInYears = 0;
  let totalDays = 0;

  if (termType === 'year') {
    termInYears = termValue;
    totalDays = termValue * 365;
  } else if (termType === 'month') {
    termInYears = termValue / 12;
    totalDays = Math.round(termValue * 30.4167);
  } else if (termType === 'day') {
    termInYears = termValue / 365;
    totalDays = termValue;
  }

  // 到期利息 = 本金 * 年利率 * 存期(年)
  const totalInterest = math.round(principal * rateDecimal * termInYears, 2);
  const totalAmount = math.round(principal + totalInterest, 2);
  const dailyInterest = totalDays > 0 ? math.round(totalInterest / totalDays, 2) : 0;
  const yieldPercent = principal > 0 ? math.round((totalInterest / principal) * 100, 2) : 0;

  return {
    principal,
    annualRate,
    termType,
    termValue,
    totalInterest,
    totalAmount,
    dailyInterest,
    yieldPercent,
    principalFormatted: math.formatMoney(principal),
    totalInterestFormatted: math.formatMoney(totalInterest),
    totalAmountFormatted: math.formatMoney(totalAmount),
    dailyInterestFormatted: math.formatMoney(dailyInterest)
  };
}

/**
 * 2. 定期存款复利计算器
 * 公式: A = P * (1 + r/m)^(m * t)
 * @param {Object} options
 * @param {number} options.principal 存款本金 P (元)
 * @param {number} options.annualRate 名义年利率 r (如 3.0 代表 3%)
 * @param {number} options.years 存期年数 t
 * @param {string} [options.compoundFrequency='yearly'] 复利频次: 'daily' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
 */
function calcCompoundDeposit(options = {}) {
  const principal = Math.max(0, Number(options.principal) || 0);
  const annualRate = Math.max(0, Number(options.annualRate) || 0);
  const years = Math.max(0, Number(options.years) || 1);
  const compoundFrequency = options.compoundFrequency || 'yearly';

  const freqMap = {
    daily: 365,
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    yearly: 1
  };
  const m = freqMap[compoundFrequency] || 1;
  const r = annualRate / 100;

  // 复利终值 A = P * (1 + r/m)^(m * t)
  const factor = 1 + r / m;
  const totalPeriods = m * years;
  const totalAmount = principal > 0 ? math.round(principal * math.pow(factor, totalPeriods), 2) : 0;
  const totalInterest = math.round(totalAmount - principal, 2);

  // 单利利息作为对比基准
  const simpleInterest = math.round(principal * r * years, 2);
  const extraGain = math.round(totalInterest - simpleInterest, 2);

  // 实际有效年利率 EAR / APY = ((1 + r/m)^m - 1) * 100%
  const effectiveAnnualRate = r > 0 ? math.round((math.pow(factor, m) - 1) * 100, 3) : 0;

  return {
    principal,
    annualRate,
    years,
    compoundFrequency,
    m,
    totalAmount,
    totalInterest,
    simpleInterest,
    extraGain,
    effectiveAnnualRate,
    totalAmountFormatted: math.formatMoney(totalAmount),
    totalInterestFormatted: math.formatMoney(totalInterest),
    extraGainFormatted: math.formatMoney(extraGain)
  };
}

/**
 * 3. 基金定投计算器 (等额定投复利终值)
 * 支持周定投与月定投，期初与期末模式，以及收益率敏感性阶梯分析
 * @param {Object} options
 * @param {number} options.periodAmount 每期投入金额 (元)
 * @param {string} [options.cycle='month'] 定投周期: 'month' | 'week'
 * @param {number} options.annualRate 预期年化收益率 (%)
 * @param {number} options.years 定投年限 (年)
 * @param {string} [options.timing='end'] 扣款时机: 'end'(期末) | 'begin'(期初)
 */
function calcFundAIP(options = {}) {
  const periodAmount = Math.max(0, Number(options.periodAmount) || 0);
  const cycle = options.cycle || 'month';
  const annualRate = Number(options.annualRate) || 0;
  const years = Math.max(0, Number(options.years) || 1);
  const timing = options.timing || 'end';

  const periodsPerYear = cycle === 'week' ? 52 : 12;
  const totalPeriods = years * periodsPerYear;
  const periodicRate = (annualRate / 100) / periodsPerYear;

  const totalPrincipal = math.round(periodAmount * totalPeriods, 2);
  let finalAsset = 0;

  if (Math.abs(periodicRate) < 1e-9) {
    finalAsset = totalPrincipal;
  } else {
    // FV = P * [((1+r)^n - 1) / r]
    const compFactor = math.pow(1 + periodicRate, totalPeriods);
    let fv = periodAmount * ((compFactor - 1) / periodicRate);
    if (timing === 'begin') {
      fv = fv * (1 + periodicRate);
    }
    finalAsset = math.round(fv, 2);
  }

  const totalProfit = math.round(finalAsset - totalPrincipal, 2);
  const returnRate = totalPrincipal > 0 ? math.round((totalProfit / totalPrincipal) * 100, 2) : 0;

  // 收益率敏感性分析阶梯 (±2%, ±4%)
  const rateSteps = [-4, -2, 0, 2, 4];
  const sensitivityTable = rateSteps.map(step => {
    const testRate = Math.max(-10, annualRate + step);
    const rTest = (testRate / 100) / periodsPerYear;
    let testAsset = 0;
    if (Math.abs(rTest) < 1e-9) {
      testAsset = totalPrincipal;
    } else {
      let fv = periodAmount * ((math.pow(1 + rTest, totalPeriods) - 1) / rTest);
      if (timing === 'begin') fv = fv * (1 + rTest);
      testAsset = math.round(fv, 2);
    }
    const testProfit = math.round(testAsset - totalPrincipal, 2);
    return {
      stepLabel: step === 0 ? '基准预期' : (step > 0 ? `+${step}%` : `${step}%`),
      annualRate: testRate,
      finalAsset: testAsset,
      totalProfit: testProfit,
      finalAssetFormatted: math.formatMoney(testAsset),
      totalProfitFormatted: math.formatMoney(testProfit),
      isBase: step === 0
    };
  });

  return {
    periodAmount,
    cycle,
    annualRate,
    years,
    timing,
    totalPeriods,
    totalPrincipal,
    finalAsset,
    totalProfit,
    returnRate,
    totalPrincipalFormatted: math.formatMoney(totalPrincipal),
    finalAssetFormatted: math.formatMoney(finalAsset),
    totalProfitFormatted: math.formatMoney(totalProfit),
    sensitivityTable
  };
}

/**
 * 4. 通用复利计算器 (含定期追加本金，输出逐年资产增长轨迹)
 * @param {Object} options
 * @param {number} options.initialPrincipal 初始本金 (元)
 * @param {number} [options.regularAmount=0] 每期追加金额 (元)
 * @param {string} [options.regularFrequency='monthly'] 追加频率: 'monthly' | 'yearly' | 'none'
 * @param {number} options.annualRate 年化收益率 (%)
 * @param {number} options.years 投资年限 (年)
 */
function calcUniversalCompound(options = {}) {
  const initialPrincipal = Math.max(0, Number(options.initialPrincipal) || 0);
  const regularAmount = Math.max(0, Number(options.regularAmount) || 0);
  const regularFrequency = options.regularFrequency || 'monthly';
  const annualRate = Math.max(0, Number(options.annualRate) || 0);
  const years = Math.max(1, Math.min(60, Number(options.years) || 1));

  const monthlyRate = (annualRate / 100) / 12;
  const schedule = [];

  let currentBalance = initialPrincipal;
  let cumulativePrincipal = initialPrincipal;

  for (let year = 1; year <= years; year++) {
    const startBalance = currentBalance;
    let yearAddedPrincipal = 0;

    if (regularFrequency === 'yearly') {
      // 每年初追加一次
      yearAddedPrincipal = regularAmount;
      currentBalance += regularAmount;
      cumulativePrincipal += regularAmount;
      // 当年复利滚动 1 年
      currentBalance = currentBalance * (1 + annualRate / 100);
    } else if (regularFrequency === 'monthly') {
      // 每月滚动 12 个月
      for (let m = 0; m < 12; m++) {
        currentBalance += regularAmount;
        yearAddedPrincipal += regularAmount;
        cumulativePrincipal += regularAmount;
        currentBalance = currentBalance * (1 + monthlyRate);
      }
    } else {
      // 不追加，仅本金复利
      currentBalance = currentBalance * (1 + annualRate / 100);
    }

    const endBalance = math.round(currentBalance, 2);
    const yearInterest = math.round(endBalance - startBalance - yearAddedPrincipal, 2);
    const cumulativeInterest = math.round(endBalance - cumulativePrincipal, 2);

    const principalRatio = endBalance > 0 ? math.round((cumulativePrincipal / endBalance) * 100, 1) : 100;
    const interestRatio = endBalance > 0 ? math.round((cumulativeInterest / endBalance) * 100, 1) : 0;

    schedule.push({
      year,
      startBalance: math.round(startBalance, 2),
      yearAddedPrincipal: math.round(yearAddedPrincipal, 2),
      yearInterest,
      endBalance,
      cumulativePrincipal: math.round(cumulativePrincipal, 2),
      cumulativeInterest,
      principalRatio,
      interestRatio,
      endBalanceFormatted: math.formatMoney(endBalance),
      cumulativePrincipalFormatted: math.formatMoney(cumulativePrincipal),
      cumulativeInterestFormatted: math.formatMoney(cumulativeInterest)
    });
  }

  const finalAsset = schedule.length > 0 ? schedule[schedule.length - 1].endBalance : initialPrincipal;
  const totalPrincipal = schedule.length > 0 ? schedule[schedule.length - 1].cumulativePrincipal : initialPrincipal;
  const totalInterest = math.round(finalAsset - totalPrincipal, 2);
  const interestContributionRate = finalAsset > 0 ? math.round((totalInterest / finalAsset) * 100, 1) : 0;

  return {
    initialPrincipal,
    regularAmount,
    regularFrequency,
    annualRate,
    years,
    finalAsset,
    totalPrincipal,
    totalInterest,
    interestContributionRate,
    finalAssetFormatted: math.formatMoney(finalAsset),
    totalPrincipalFormatted: math.formatMoney(totalPrincipal),
    totalInterestFormatted: math.formatMoney(totalInterest),
    schedule
  };
}

/**
 * 5. 通货膨胀与实际购买力计算器
 * @param {Object} options
 * @param {number} options.currentAmount 当前金额 (元)
 * @param {number} options.inflationRate 预计通货膨胀率 (%)
 * @param {number} options.years 时间跨度 (年)
 */
function calcInflation(options = {}) {
  const currentAmount = Math.max(0, Number(options.currentAmount) || 0);
  const inflationRate = Math.max(0, Number(options.inflationRate) || 0);
  const years = Math.max(1, Math.min(50, Number(options.years) || 10));

  const i = inflationRate / 100;
  // 未来等值所需金额 = 当前金额 * (1 + i)^t
  const futureNeededAmount = math.round(currentAmount * math.pow(1 + i, years), 2);
  // 现在资金在未来的实际购买力 = 当前金额 / (1 + i)^t
  const futurePurchasingPower = math.round(currentAmount / math.pow(1 + i, years), 2);
  // 累计贬值幅度 (%)
  const depreciationRate = currentAmount > 0 ? math.round(((currentAmount - futurePurchasingPower) / currentAmount) * 100, 1) : 0;

  // 生成典型年限购买力阶梯表
  const stepYears = [1, 3, 5, 10, 15, 20, 30].filter(y => y <= Math.max(years, 30));
  if (!stepYears.includes(years)) {
    stepYears.push(years);
    stepYears.sort((a, b) => a - b);
  }

  const schedule = stepYears.map(y => {
    const power = math.round(currentAmount / math.pow(1 + i, y), 2);
    const needed = math.round(currentAmount * math.pow(1 + i, y), 2);
    const dropPercent = currentAmount > 0 ? math.round(((currentAmount - power) / currentAmount) * 100, 1) : 0;
    return {
      year: y,
      purchasingPower: power,
      neededAmount: needed,
      dropPercent,
      purchasingPowerFormatted: math.formatMoney(power),
      neededAmountFormatted: math.formatMoney(needed)
    };
  });

  return {
    currentAmount,
    inflationRate,
    years,
    futureNeededAmount,
    futurePurchasingPower,
    depreciationRate,
    futureNeededFormatted: math.formatMoney(futureNeededAmount),
    futurePowerFormatted: math.formatMoney(futurePurchasingPower),
    schedule
  };
}

/**
 * 6. 理财收益率换算计算器
 * @param {Object} options
 * @param {string} options.convertType 'daily_to_annual' | 'annual_to_daily' | 'term_to_annual' | 'actual_profit'
 * @param {number} [options.dailyTenThousand] 日万份收益 (元)
 * @param {number} [options.annualRate] 年化收益率 (%)
 * @param {number} [options.termYield] 封闭期收益率 (%)
 * @param {number} [options.termDays] 封闭天数
 * @param {number} [options.principal] 投资本金 (元)
 */
function calcYieldConvert(options = {}) {
  const type = options.convertType || 'daily_to_annual';
  let result = {};

  if (type === 'daily_to_annual') {
    // 日万份收益 -> 年化收益率 = (日万份 / 10000) * 365 * 100%
    const daily = Number(options.dailyTenThousand) || 0;
    const annualRate = math.round((daily / 10000) * 365 * 100, 3);
    const monthlyRate = math.round(annualRate / 12, 3);
    result = {
      dailyTenThousand: daily,
      annualRate,
      monthlyRate,
      desc: `日万份收益 ¥${daily.toFixed(4)} 相当于年化收益率 ${annualRate}%`
    };
  } else if (type === 'annual_to_daily') {
    // 年化收益率 -> 日万份收益 = (年化 / 100 / 365) * 10000
    const annual = Number(options.annualRate) || 0;
    const daily = math.round((annual / 100 / 365) * 10000, 4);
    result = {
      annualRate: annual,
      dailyTenThousand: daily,
      desc: `年化收益率 ${annual}% 对应每万元每天收益约 ¥${daily.toFixed(4)}`
    };
  } else if (type === 'term_to_annual') {
    // 封闭期收益率 -> 年化收益率 = 封闭期收益率 * (365 / 天数)
    const yieldVal = Number(options.termYield) || 0;
    const days = Math.max(1, Number(options.termDays) || 30);
    const annualRate = math.round(yieldVal * (365 / days), 3);
    result = {
      termYield: yieldVal,
      termDays: days,
      annualRate,
      desc: `${days}天到期收益率 ${yieldVal}% 折合真实年化综合收益率 ${annualRate}%`
    };
  } else if (type === 'actual_profit') {
    // 实际收益 = 本金 * (年化 / 100) * (天数 / 365)
    const p = Math.max(0, Number(options.principal) || 0);
    const annual = Number(options.annualRate) || 0;
    const days = Math.max(1, Number(options.termDays) || 365);
    const profit = math.round(p * (annual / 100) * (days / 365), 2);
    const total = math.round(p + profit, 2);
    result = {
      principal: p,
      annualRate: annual,
      termDays: days,
      profit,
      totalAmount: total,
      profitFormatted: math.formatMoney(profit),
      totalAmountFormatted: math.formatMoney(total),
      desc: `本金 ¥${math.formatMoney(p)} 存放 ${days} 天预期收益 ¥${math.formatMoney(profit)}`
    };
  }

  return result;
}

/**
 * 7. FIRE 提前退休 / 财务自由计算器
 * 融合 4% 法则、通胀调整实际回报率，数值迭代推演达成退休所需年限与年龄
 * @param {Object} options
 * @param {number} options.currentAge 当前年龄 (岁)
 * @param {number} options.currentAssets 当前已有可投资净资产 (元)
 * @param {number} options.monthlyExpense 退休后预期月生活开销 (元)
 * @param {number} [options.monthlyIncome] 当前每月税后总收入 (元)
 * @param {number} [options.currentMonthlyExpense] 当前每月实际开销 (元，默认等于 monthlyExpense)
 * @param {number} [options.expectedReturnRate=6.0] 投资预期年化回报率 (%)
 * @param {number} [options.inflationRate=2.5] 预期长期通胀率 (%)
 * @param {number} [options.swrRate=4.0] 安全提取率 SWR (%, 默认4.0%)
 */
function calcFIRE(options = {}) {
  const currentAge = Math.max(18, Math.min(80, Number(options.currentAge) || 30));
  const currentAssets = Math.max(0, Number(options.currentAssets) || 0);
  const monthlyExpense = Math.max(1000, Number(options.monthlyExpense) || 8000);
  const monthlyIncome = Math.max(0, Number(options.monthlyIncome) || 15000);
  const curExpense = Math.max(0, Number(options.currentMonthlyExpense) || monthlyExpense);
  const expectedReturnRate = Math.max(0, Number(options.expectedReturnRate) || 6.0);
  const inflationRate = Math.max(0, Number(options.inflationRate) || 2.5);
  const swrRate = Math.max(2.0, Math.min(8.0, Number(options.swrRate) || 4.0));

  // 年支出 = 退休后月支出 * 12
  const annualExpense = monthlyExpense * 12;

  // 1. 各标准目标资产规模
  const targetClassic = math.round(annualExpense / 0.04, 0); // 经典 4%
  const targetLean = math.round(annualExpense / 0.05, 0);    // 瘦 FIRE (5%)
  const targetFat = math.round(annualExpense / 0.03, 0);     // 肥 FIRE (3%)
  const targetUser = math.round(annualExpense / (swrRate / 100), 0); // 用户当前提取率设定目标

  // 2. 实际真实投资年回报率 (扣除通胀: (1+R) / (1+i) - 1)
  const realReturnRate = (1 + expectedReturnRate / 100) / (1 + inflationRate / 100) - 1;

  // 3. 每年新增储蓄投入 = max(0, (月收入 - 当前月支出) * 12)
  const annualSavings = Math.max(0, math.round((monthlyIncome - curExpense) * 12, 2));

  // 4. 数值迭代计算达成年限
  let yearsNeeded = 0;
  let fireAge = currentAge;
  let isAchieved = currentAssets >= targetUser;
  let asset = currentAssets;
  const trajectory = [];

  trajectory.push({
    year: 0,
    age: currentAge,
    asset: math.round(asset, 0),
    assetFormatted: math.formatMoney(asset, 0),
    isReached: isAchieved
  });

  if (!isAchieved) {
    let year = 1;
    const maxYears = 70; // 最多推演到 100 岁

    while (year <= maxYears) {
      // 资产年终 = 年初资产 * (1 + 真实回报率) + 每年储蓄
      asset = asset * (1 + realReturnRate) + annualSavings;
      const currentYearAge = currentAge + year;
      const reached = asset >= targetUser;

      trajectory.push({
        year,
        age: currentYearAge,
        asset: math.round(asset, 0),
        assetFormatted: math.formatMoney(asset, 0),
        isReached: reached
      });

      if (reached && !isAchieved) {
        yearsNeeded = year;
        fireAge = currentYearAge;
        isAchieved = true;
        break;
      }
      year++;
    }

    if (!isAchieved) {
      yearsNeeded = -1; // 70年内无法达成
      fireAge = -1;
    }
  }

  // 5. 海岸 FIRE (Coast FIRE) 资金需求: 假定 60 岁退休，现有资金全不追加复利到 60 岁所需本金
  const coastRetireAge = Math.max(currentAge + 1, 60);
  const yearsTo60 = coastRetireAge - currentAge;
  const coastFireAmount = math.round(targetUser / math.pow(1 + Math.max(0.01, realReturnRate), yearsTo60), 0);
  const isCoastFireReached = currentAssets >= coastFireAmount;

  // 6. FIRE 后月均安全被动现金流
  const monthlyPassiveIncome = math.round((targetUser * (swrRate / 100)) / 12, 0);

  return {
    currentAge,
    currentAssets,
    monthlyExpense,
    monthlyIncome,
    annualExpense,
    annualSavings,
    expectedReturnRate,
    inflationRate,
    realReturnRatePercent: math.round(realReturnRate * 100, 2),
    swrRate,
    targetClassic,
    targetLean,
    targetFat,
    targetUser,
    yearsNeeded,
    fireAge,
    isAchieved,
    coastFireAmount,
    coastRetireAge,
    isCoastFireReached,
    monthlyPassiveIncome,
    targetUserFormatted: math.formatMoney(targetUser, 0),
    targetClassicFormatted: math.formatMoney(targetClassic, 0),
    targetLeanFormatted: math.formatMoney(targetLean, 0),
    targetFatFormatted: math.formatMoney(targetFat, 0),
    coastFireAmountFormatted: math.formatMoney(coastFireAmount, 0),
    currentAssetsFormatted: math.formatMoney(currentAssets, 0),
    monthlyPassiveIncomeFormatted: math.formatMoney(monthlyPassiveIncome, 0),
    annualSavingsFormatted: math.formatMoney(annualSavings, 0),
    trajectory
  };
}

module.exports = {
  calcDepositInterest,
  calcCompoundDeposit,
  calcFundAIP,
  calcUniversalCompound,
  calcInflation,
  calcYieldConvert,
  calcFIRE
};
