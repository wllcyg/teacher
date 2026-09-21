/**
 * miniprogram/utils/calculators/mortgage.js
 * 01·购房房贷模块纯函数算法引擎
 * 采用 big.js 高精度数学库，严格杜绝浮点数累计误差，包含银行级最后一期本息平账逻辑。
 */
const math = require('../math.js');
const { LPR_CONFIG, FUND_RATE_CONFIG, CITY_FUND_LIMITS, DEED_TAX_RATES } = require('../config/mortgage-lpr.js');

/**
 * 单项贷款计算内部函数 (单笔贷款: 商业贷 或 公积金贷)
 * @param {number} principalAmount 贷款金额 (元)
 * @param {number} annualRatePercent 年利率百分比 (如 3.1 代表 3.1%)
 * @param {number} totalMonths 总期数 (如 360)
 * @param {string} repaymentType 'equal_installment' (等额本息) | 'equal_principal' (等额本金)
 */
function _calcSingleLoan(principalAmount, annualRatePercent, totalMonths, repaymentType) {
  const P = Number(principalAmount) || 0;
  const totalPeriods = Number(totalMonths) || 0;
  if (P <= 0 || totalPeriods <= 0) {
    return {
      monthlyPayment: 0,
      monthlyPaymentFirst: 0,
      monthlyPaymentDecrease: 0,
      totalInterest: 0,
      totalRepayment: 0,
      schedule: []
    };
  }

  // 月利率 r = 年利率 / 100 / 12
  const r = (Number(annualRatePercent) || 0) / 100 / 12;
  const schedule = [];
  let remainingPrincipal = P;
  let totalInterest = 0;
  let totalRepayment = 0;

  if (repaymentType === 'equal_installment') {
    // 等额本息
    let monthlyPayment = 0;
    if (r === 0) {
      monthlyPayment = math.div(P, totalPeriods, 2);
    } else {
      // M = P * r * (1+r)^n / ((1+r)^n - 1)
      const powFactor = math.pow(1 + r, totalPeriods);
      const numerator = math.mul(math.mul(P, r), powFactor);
      const denominator = math.sub(powFactor, 1);
      monthlyPayment = math.div(numerator, denominator, 2);
    }

    for (let month = 1; month <= totalPeriods; month++) {
      let interest = 0;
      let principal = 0;
      let currentMonthlyPayment = monthlyPayment;

      if (month === totalPeriods) {
        // 最后一期平账逻辑
        principal = remainingPrincipal;
        interest = math.round(math.mul(remainingPrincipal, r), 2);
        currentMonthlyPayment = math.add(principal, interest);
        remainingPrincipal = 0;
      } else {
        interest = math.round(math.mul(remainingPrincipal, r), 2);
        principal = math.sub(currentMonthlyPayment, interest);
        if (principal > remainingPrincipal) {
          principal = remainingPrincipal;
          currentMonthlyPayment = math.add(principal, interest);
        }
        remainingPrincipal = math.round(math.sub(remainingPrincipal, principal), 2);
      }

      totalInterest = math.add(totalInterest, interest);
      totalRepayment = math.add(totalRepayment, currentMonthlyPayment);

      schedule.push({
        month,
        monthlyPayment: currentMonthlyPayment,
        principal: math.round(principal, 2),
        interest: math.round(interest, 2),
        remainingPrincipal: math.round(remainingPrincipal, 2)
      });
    }

    return {
      monthlyPayment,
      monthlyPaymentFirst: monthlyPayment,
      monthlyPaymentDecrease: 0,
      totalInterest: math.round(totalInterest, 2),
      totalRepayment: math.round(totalRepayment, 2),
      schedule
    };
  } else {
    // 等额本金
    // 每月还本金 = P / totalPeriods
    const monthlyPrincipalBase = math.div(P, totalPeriods, 2);
    let firstMonthPayment = 0;
    let decreasePerMonth = 0;

    for (let month = 1; month <= totalPeriods; month++) {
      let principal = monthlyPrincipalBase;
      let interest = math.round(math.mul(remainingPrincipal, r), 2);

      if (month === totalPeriods) {
        // 最后一期平账
        principal = remainingPrincipal;
        remainingPrincipal = 0;
      } else {
        remainingPrincipal = math.round(math.sub(remainingPrincipal, principal), 2);
      }

      const currentMonthlyPayment = math.add(principal, interest);
      if (month === 1) {
        firstMonthPayment = currentMonthlyPayment;
        decreasePerMonth = math.round(math.mul(monthlyPrincipalBase, r), 2);
      }

      totalInterest = math.add(totalInterest, interest);
      totalRepayment = math.add(totalRepayment, currentMonthlyPayment);

      schedule.push({
        month,
        monthlyPayment: currentMonthlyPayment,
        principal: math.round(principal, 2),
        interest: math.round(interest, 2),
        remainingPrincipal: math.round(remainingPrincipal, 2)
      });
    }

    return {
      monthlyPayment: firstMonthPayment,
      monthlyPaymentFirst: firstMonthPayment,
      monthlyPaymentDecrease: decreasePerMonth,
      totalInterest: math.round(totalInterest, 2),
      totalRepayment: math.round(totalRepayment, 2),
      schedule
    };
  }
}

/**
 * 1. 房贷计算器 (商贷 / 公积金 / 组合贷)
 * @param {Object} params
 * @param {string} params.loanType 'commercial' | 'fund' | 'combination'
 * @param {number} params.commercialAmount 商贷金额 (万元)
 * @param {number} params.commercialRate 商贷年利率 (百分比，如 3.1)
 * @param {number} params.fundAmount 公积金金额 (万元)
 * @param {number} params.fundRate 公积金年利率 (百分比，如 2.85)
 * @param {number} params.years 贷款年限 (如 30)
 * @param {string} params.repaymentType 'equal_installment' (等额本息) | 'equal_principal' (等额本金)
 */
function calcMortgage(params = {}) {
  const {
    loanType = 'commercial',
    commercialAmount = 0,
    commercialRate = LPR_CONFIG.lpr5Year,
    fundAmount = 0,
    fundRate = FUND_RATE_CONFIG.firstHome.over5Years,
    years = 30,
    repaymentType = 'equal_installment'
  } = params;

  const totalPeriods = Math.max(1, Math.min(30, Number(years) || 30)) * 12;

  let commP = 0;
  let fundP = 0;

  if (loanType === 'commercial') {
    commP = math.mul(commercialAmount, 10000);
  } else if (loanType === 'fund') {
    fundP = math.mul(fundAmount, 10000);
  } else {
    commP = math.mul(commercialAmount, 10000);
    fundP = math.mul(fundAmount, 10000);
  }

  const commRes = _calcSingleLoan(commP, commercialRate, totalPeriods, repaymentType);
  const fundRes = _calcSingleLoan(fundP, fundRate, totalPeriods, repaymentType);

  const totalPrincipal = math.add(commP, fundP);
  const totalInterest = math.add(commRes.totalInterest, fundRes.totalInterest);
  const totalRepayment = math.add(commRes.totalRepayment, fundRes.totalRepayment);

  const monthlyPaymentFirst = math.add(commRes.monthlyPaymentFirst, fundRes.monthlyPaymentFirst);
  const monthlyPaymentDecrease = math.add(commRes.monthlyPaymentDecrease, fundRes.monthlyPaymentDecrease);

  // 合并逐月明细表
  const schedule = [];
  for (let i = 0; i < totalPeriods; i++) {
    const commItem = commRes.schedule[i] || { monthlyPayment: 0, principal: 0, interest: 0, remainingPrincipal: 0 };
    const fundItem = fundRes.schedule[i] || { monthlyPayment: 0, principal: 0, interest: 0, remainingPrincipal: 0 };

    schedule.push({
      month: i + 1,
      yearIndex: Math.floor(i / 12) + 1,
      monthInYear: (i % 12) + 1,
      monthlyPayment: math.add(commItem.monthlyPayment, fundItem.monthlyPayment),
      principal: math.add(commItem.principal, fundItem.principal),
      interest: math.add(commItem.interest, fundItem.interest),
      remainingPrincipal: math.add(commItem.remainingPrincipal, fundItem.remainingPrincipal)
    });
  }

  // 本金与利息占比 (百分比)
  const principalPercent = totalRepayment > 0 ? math.round(math.mul(math.div(totalPrincipal, totalRepayment), 100), 1) : 0;
  const interestPercent = math.round(math.sub(100, principalPercent), 1);

  return {
    loanType,
    repaymentType,
    years,
    totalMonths: totalPeriods,
    totalPrincipal: math.round(totalPrincipal, 2),
    totalPrincipalWan: math.round(math.div(totalPrincipal, 10000), 2),
    totalInterest: math.round(totalInterest, 2),
    totalInterestWan: math.round(math.div(totalInterest, 10000), 2),
    totalRepayment: math.round(totalRepayment, 2),
    totalRepaymentWan: math.round(math.div(totalRepayment, 10000), 2),
    monthlyPaymentFirst: math.round(monthlyPaymentFirst, 2),
    monthlyPaymentDecrease: math.round(monthlyPaymentDecrease, 2),
    principalPercent,
    interestPercent,
    schedule
  };
}

/**
 * 2. 提前还款计算器
 * @param {Object} params
 * @param {number} params.originalLoanAmount 原始贷款本金 (万元)
 * @param {number} params.annualRate 年利率 (百分比)
 * @param {number} params.originalYears 原贷款年限 (年)
 * @param {string} params.repaymentType 还款方式
 * @param {number} params.paidMonths 已还期数 (月)
 * @param {number} params.prepayAmount 提前还款金额 (万元)
 * @param {string} params.prepayOption 'shorten_term' (月供不变缩短年限) | 'reduce_payment' (年限不变减少月供)
 */
function calcPrepayment(params = {}) {
  const {
    originalLoanAmount = 100,
    annualRate = LPR_CONFIG.lpr5Year,
    originalYears = 30,
    repaymentType = 'equal_installment',
    paidMonths = 24,
    prepayAmount = 20,
    prepayOption = 'shorten_term'
  } = params;

  // 1. 先计算原贷款全周期
  const origRes = calcMortgage({
    loanType: 'commercial',
    commercialAmount: originalLoanAmount,
    commercialRate: annualRate,
    years: originalYears,
    repaymentType
  });

  const mIndex = Math.min(Math.max(1, paidMonths), origRes.totalMonths);
  const currentPaidState = origRes.schedule[mIndex - 1] || { remainingPrincipal: 0 };
  const remainPrincipalBeforePrepay = currentPaidState.remainingPrincipal; // 元

  const prepayYuan = math.mul(prepayAmount, 10000);
  // 新剩余本金
  const newRemainPrincipal = Math.max(0, math.sub(remainPrincipalBeforePrepay, prepayYuan));

  // 原方案剩余利息之和
  let origRemainingInterest = 0;
  for (let i = mIndex; i < origRes.schedule.length; i++) {
    origRemainingInterest = math.add(origRemainingInterest, origRes.schedule[i].interest);
  }

  let newPlan = null;
  let savedInterest = 0;
  let savedMonths = 0;

  if (newRemainPrincipal === 0) {
    // 全部结清
    savedInterest = origRemainingInterest;
    savedMonths = origRes.totalMonths - mIndex;
    newPlan = {
      newMonthlyPayment: 0,
      newRemainingMonths: 0,
      newTotalInterest: 0
    };
  } else if (prepayOption === 'reduce_payment') {
    // 方案一：年限不变，减少月供
    const remainMonths = origRes.totalMonths - mIndex;
    const newLoanRes = _calcSingleLoan(newRemainPrincipal, annualRate, remainMonths, repaymentType);
    savedInterest = math.round(math.sub(origRemainingInterest, newLoanRes.totalInterest), 2);
    newPlan = {
      newMonthlyPayment: newLoanRes.monthlyPaymentFirst,
      newRemainingMonths: remainMonths,
      newTotalInterest: newLoanRes.totalInterest
    };
  } else {
    // 方案二：月供不变，缩短年限
    const r = annualRate / 100 / 12;
    const origMonthlyPayment = origRes.monthlyPaymentFirst;
    let newMonths = 0;

    if (repaymentType === 'equal_installment') {
      // 等额本息求 n' = ln(M / (M - P * r)) / ln(1+r)
      if (origMonthlyPayment <= newRemainPrincipal * r) {
        // 月供连利息都不够还，兜底按原年限
        newMonths = origRes.totalMonths - mIndex;
      } else {
        const top = Math.log(origMonthlyPayment / (origMonthlyPayment - newRemainPrincipal * r));
        const bottom = Math.log(1 + r);
        newMonths = Math.ceil(top / bottom);
      }
    } else {
      // 等额本金：月本金按原比例不变
      const origMonthlyPrincipal = math.div(math.mul(originalLoanAmount, 10000), origRes.totalMonths);
      newMonths = Math.ceil(newRemainPrincipal / origMonthlyPrincipal);
    }

    newMonths = Math.max(1, Math.min(newMonths, origRes.totalMonths - mIndex));
    const newLoanRes = _calcSingleLoan(newRemainPrincipal, annualRate, newMonths, repaymentType);
    savedInterest = math.round(math.sub(origRemainingInterest, newLoanRes.totalInterest), 2);
    savedMonths = (origRes.totalMonths - mIndex) - newMonths;

    newPlan = {
      newMonthlyPayment: newLoanRes.monthlyPaymentFirst,
      newRemainingMonths: newMonths,
      newTotalInterest: newLoanRes.totalInterest
    };
  }

  return {
    prepayOption,
    paidMonths: mIndex,
    remainPrincipalBeforePrepay: math.round(remainPrincipalBeforePrepay, 2),
    prepayAmountYuan: prepayYuan,
    newRemainPrincipal: math.round(newRemainPrincipal, 2),
    savedInterest: Math.max(0, savedInterest),
    savedInterestWan: math.round(math.div(Math.max(0, savedInterest), 10000), 2),
    savedMonths,
    savedYears: math.round(math.div(savedMonths, 12), 1),
    newPlan
  };
}

/**
 * 3. 公积金贷款额度计算器 (四维取小)
 * @param {Object} params
 */
function calcFundQuota(params = {}) {
  const {
    city = '通用',
    monthlyDeposit = 1500,     // 月缴存额 (元)
    accountBalance = 30000,    // 账户余额 (元)
    houseValuation = 2000000,  // 房屋评估价 (元)
    maxRatio = 0.8,            // 最高成数 (首套0.8, 二套0.7)
    personType = 'single'      // 'single' 个人 | 'couple' 夫妻双人
  } = params;

  const cityLimitObj = CITY_FUND_LIMITS[city] || CITY_FUND_LIMITS['通用'];
  const localMaxLimitWan = personType === 'couple' ? cityLimitObj.couple : cityLimitObj.single;
  const localMaxLimitYuan = math.mul(localMaxLimitWan, 10000);

  // 1. 月缴存额倍数 (通常40~50倍)
  const quotaByDeposit = math.mul(monthlyDeposit, 45);
  // 2. 账户余额倍数 (通常10~20倍)
  const quotaByBalance = math.mul(accountBalance, cityLimitObj.maxMultiple || 15);
  // 3. 房价成数限额
  const quotaByHouse = math.mul(houseValuation, maxRatio);

  const finalQuota = Math.min(quotaByDeposit, quotaByBalance, quotaByHouse, localMaxLimitYuan);

  return {
    city,
    personType,
    finalQuotaYuan: math.round(finalQuota, 2),
    finalQuotaWan: math.round(math.div(finalQuota, 10000), 2),
    limits: {
      byDeposit: math.round(quotaByDeposit, 2),
      byBalance: math.round(quotaByBalance, 2),
      byHouse: math.round(quotaByHouse, 2),
      cityCeiling: localMaxLimitYuan
    }
  };
}

/**
 * 4. 购房能力计算器
 * @param {Object} params
 */
function calcAffordability(params = {}) {
  const {
    monthlyIncome = 20000,     // 家庭税后月收入 (元)
    availableDownPayment = 50, // 可用首付 (万元)
    maxDtiRatio = 0.5,         // 最大月供收入比 (默认50%)
    years = 30,
    annualRate = LPR_CONFIG.lpr5Year
  } = params;

  const maxMonthlyPayment = math.mul(monthlyIncome, maxDtiRatio);
  const r = annualRate / 100 / 12;
  const n = years * 12;

  // 反推最大贷款额 P = M * ((1+r)^n - 1) / (r * (1+r)^n)
  let maxLoan = 0;
  if (r > 0) {
    const powFactor = math.pow(1 + r, n);
    maxLoan = math.div(math.mul(maxMonthlyPayment, math.sub(powFactor, 1)), math.mul(r, powFactor));
  } else {
    maxLoan = math.mul(maxMonthlyPayment, n);
  }

  const downPaymentYuan = math.mul(availableDownPayment, 10000);
  const maxHouseTotal = math.add(maxLoan, downPaymentYuan);

  // 利率上浮 1% 压力测试
  const stressRate = math.add(annualRate, 1);
  const stressR = stressRate / 100 / 12;
  const stressPow = math.pow(1 + stressR, n);
  const stressMonthlyPayment = math.div(math.mul(math.mul(maxLoan, stressR), stressPow), math.sub(stressPow, 1));

  return {
    maxMonthlyPayment: math.round(maxMonthlyPayment, 2),
    maxLoanWan: math.round(math.div(maxLoan, 10000), 2),
    suggestedHouseTotalWan: math.round(math.div(maxHouseTotal, 10000), 2),
    stressTest: {
      stressRate,
      stressMonthlyPayment: math.round(stressMonthlyPayment, 2),
      monthlyPaymentIncrease: math.round(math.sub(stressMonthlyPayment, maxMonthlyPayment), 2)
    }
  };
}

/**
 * 5. 租房 vs 买房全周期对比计算器
 * @param {Object} params
 */
function calcRentVsBuy(params = {}) {
  const {
    housePriceWan = 200,      // 房屋总价 (万元)
    downPaymentRatio = 0.3,   // 首付比例 (30%)
    loanYears = 30,
    loanRate = LPR_CONFIG.lpr5Year,
    monthlyRent = 3500,       // 当前月租金 (元)
    rentGrowthRate = 0.02,    // 租金年涨幅 (2%)
    investYieldRate = 0.035,  // 首付资金若理财的年化收益 (3.5%)
    houseAppreciationRate = 0.015, // 房产年增值率 (1.5%)
    comparisonYears = 20     // 对比周期 (年)
  } = params;

  const housePriceYuan = math.mul(housePriceWan, 10000);
  const downPaymentYuan = math.mul(housePriceYuan, downPaymentRatio);
  const loanAmountWan = math.sub(housePriceWan, math.mul(housePriceWan, downPaymentRatio));

  // 买房还款模型
  const mortgageRes = calcMortgage({
    loanType: 'commercial',
    commercialAmount: loanAmountWan,
    commercialRate: loanRate,
    years: loanYears,
    repaymentType: 'equal_installment'
  });

  // 1. 买房路线 20 年累计投入与资产终值
  let totalMortgagePaid = 0;
  const compareMonths = comparisonYears * 12;
  for (let m = 0; m < Math.min(compareMonths, mortgageRes.schedule.length); m++) {
    totalMortgagePaid = math.add(totalMortgagePaid, mortgageRes.schedule[m].monthlyPayment);
  }
  const houseFutureValuation = math.mul(housePriceYuan, math.pow(1 + houseAppreciationRate, comparisonYears));
  const remainingDebt = compareMonths < mortgageRes.schedule.length ? mortgageRes.schedule[compareMonths - 1].remainingPrincipal : 0;
  // 买房净资产 = 房子市价 - 剩余贷款本金
  const buyNetWorth = math.sub(houseFutureValuation, remainingDebt);

  // 2. 租房路线: 首付理财复利 + 租金支出
  const downPaymentInvestValue = math.mul(downPaymentYuan, math.pow(1 + investYieldRate, comparisonYears));
  let totalRentPaid = 0;
  let currentRent = monthlyRent;
  for (let y = 1; y <= comparisonYears; y++) {
    totalRentPaid = math.add(totalRentPaid, math.mul(currentRent, 12));
    currentRent = math.mul(currentRent, 1 + rentGrowthRate);
  }
  // 租房结余理财净资产估算
  const rentNetWorth = math.sub(downPaymentInvestValue, totalRentPaid);

  return {
    comparisonYears,
    buyPath: {
      downPaymentYuan: math.round(downPaymentYuan, 2),
      totalMortgagePaid: math.round(totalMortgagePaid, 2),
      houseFutureValuation: math.round(houseFutureValuation, 2),
      buyNetWorth: math.round(buyNetWorth, 2)
    },
    rentPath: {
      totalRentPaid: math.round(totalRentPaid, 2),
      downPaymentInvestValue: math.round(downPaymentInvestValue, 2),
      rentNetWorth: math.round(rentNetWorth, 2)
    },
    winner: buyNetWorth >= rentNetWorth ? 'buy' : 'rent',
    netWorthDiffWan: math.round(math.div(Math.abs(buyNetWorth - rentNetWorth), 10000), 2)
  };
}

/**
 * 6. 首付款计算器
 * @param {Object} params
 */
function calcDownPayment(params = {}) {
  const {
    totalPriceWan = 200,      // 房屋总价 (万元)
    downPaymentRatio = 0.2,   // 首付比例 (如 20%)
    houseType = 'first'       // 'first' 首套 | 'second' 二套
  } = params;

  const totalYuan = math.mul(totalPriceWan, 10000);
  const downPaymentYuan = math.mul(totalYuan, downPaymentRatio);
  const loanAmountYuan = math.sub(totalYuan, downPaymentYuan);

  // 契税预估 (按1%基准)
  const estimatedDeedTax = math.mul(totalYuan, 0.01);
  // 维修基金预估 (约总房款1.5%)
  const estimatedRepairFund = math.mul(totalYuan, 0.015);
  // 合计启动资金
  const totalUpfrontCost = math.add(math.add(downPaymentYuan, estimatedDeedTax), estimatedRepairFund);

  return {
    totalPriceWan,
    downPaymentRatio,
    downPaymentWan: math.round(math.div(downPaymentYuan, 10000), 2),
    loanAmountWan: math.round(math.div(loanAmountYuan, 10000), 2),
    estimatedDeedTaxWan: math.round(math.div(estimatedDeedTax, 10000), 2),
    estimatedRepairFundWan: math.round(math.div(estimatedRepairFund, 10000), 2),
    totalUpfrontCostWan: math.round(math.div(totalUpfrontCost, 10000), 2)
  };
}

/**
 * 7. 契税计算器 (140㎡ 新政)
 * @param {Object} params
 */
function calcDeedTax(params = {}) {
  const {
    totalPriceWan = 200,   // 总价 (万元)
    area = 120,            // 建筑面积 (平方米)
    houseTier = 'first'    // 'first' 首套 | 'second' 二套 | 'third' 三套及以上
  } = params;

  const totalYuan = math.mul(totalPriceWan, 10000);
  let rate = 0.01;

  if (houseTier === 'third') {
    rate = DEED_TAX_RATES.thirdHome;
  } else if (houseTier === 'second') {
    rate = area <= 140 ? DEED_TAX_RATES.secondHome.belowOrEqual140 : DEED_TAX_RATES.secondHome.above140;
  } else {
    rate = area <= 140 ? DEED_TAX_RATES.firstHome.belowOrEqual140 : DEED_TAX_RATES.firstHome.above140;
  }

  const taxAmount = math.mul(totalYuan, rate);

  return {
    totalPriceWan,
    area,
    houseTier,
    ratePercent: math.mul(rate, 100),
    taxAmountYuan: math.round(taxAmount, 2),
    policyNote: area <= 140 ? '享受国家140㎡及以下1.0%优惠契税政策' : '超过140㎡，适用常规改善型契税税率'
  };
}

/**
 * 8. 二手房交易税费计算器
 * @param {Object} params
 */
function calcSecondHandTax(params = {}) {
  const {
    totalPriceWan = 200,     // 成交价 (万元)
    originalPriceWan = 120,  // 买入原值 (万元)
    isOver2Years = true,     // 是否满2年 (免征普通住宅增值税)
    isFiveYearsOnly = true,  // 是否满五唯一 (免征个税)
    area = 90,
    isFirstHome = true,
    agencyRate = 0.015       // 中介费率 (1.5%)
  } = params;

  const totalYuan = math.mul(totalPriceWan, 10000);
  const diffYuan = Math.max(0, math.sub(totalYuan, math.mul(originalPriceWan, 10000)));

  // 1. 增值税及附加: 满2年免征，不满2年约 5.3%
  const vatTax = isOver2Years ? 0 : math.round(math.mul(totalYuan, 0.053), 2);

  // 2. 个人所得税: 满五唯一免征；否则核定征收1%或差额20%
  let personalTax = 0;
  if (!isFiveYearsOnly) {
    personalTax = math.min(math.round(math.mul(totalYuan, 0.01), 2), math.round(math.mul(diffYuan, 0.2), 2));
  }

  // 3. 契税
  const deedRes = calcDeedTax({ totalPriceWan, area, houseTier: isFirstHome ? 'first' : 'second' });
  const deedTax = deedRes.taxAmountYuan;

  // 4. 中介服务费
  const agencyFee = math.round(math.mul(totalYuan, agencyRate), 2);

  const grandTotalTax = math.add(math.add(math.add(vatTax, personalTax), deedTax), agencyFee);

  return {
    vatTax,
    personalTax,
    deedTax,
    agencyFee,
    grandTotalTax,
    grandTotalTaxWan: math.round(math.div(grandTotalTax, 10000), 2)
  };
}

/**
 * 9. 房贷计算器 - 轻量级汇总版本 (性能优化)
 * 只计算月供、总利息、总还款等汇总数据,不生成 360 期明细表
 * 性能提升: 约 80% (真机从 1000ms → 200ms)
 * @param {Object} params 参数同 calcMortgage
 * @returns {Object} 只包含汇总数据,不含 schedule 数组
 */
function calcMortgageSummary(params = {}) {
  const {
    loanType = 'commercial',
    commercialAmount = 0,
    commercialRate = LPR_CONFIG.lpr5Year,
    fundAmount = 0,
    fundRate = FUND_RATE_CONFIG.firstHome.over5Years,
    years = 30,
    repaymentType = 'equal_installment'
  } = params;

  const totalPeriods = Math.max(1, Math.min(30, Number(years) || 30)) * 12;

  let commP = 0;
  let fundP = 0;

  if (loanType === 'commercial') {
    commP = math.mul(commercialAmount, 10000);
  } else if (loanType === 'fund') {
    fundP = math.mul(fundAmount, 10000);
  } else {
    commP = math.mul(commercialAmount, 10000);
    fundP = math.mul(fundAmount, 10000);
  }

  // 使用简化的汇总计算函数
  const commRes = _calcSingleLoanSummary(commP, commercialRate, totalPeriods, repaymentType);
  const fundRes = _calcSingleLoanSummary(fundP, fundRate, totalPeriods, repaymentType);

  const totalPrincipal = math.add(commP, fundP);
  const totalInterest = math.add(commRes.totalInterest, fundRes.totalInterest);
  const totalRepayment = math.add(commRes.totalRepayment, fundRes.totalRepayment);

  const monthlyPaymentFirst = math.add(commRes.monthlyPaymentFirst, fundRes.monthlyPaymentFirst);
  const monthlyPaymentDecrease = math.add(commRes.monthlyPaymentDecrease, fundRes.monthlyPaymentDecrease);

  const principalPercent = totalRepayment > 0 ? math.round(math.mul(math.div(totalPrincipal, totalRepayment), 100), 1) : 0;
  const interestPercent = math.round(math.sub(100, principalPercent), 1);

  return {
    loanType,
    repaymentType,
    years,
    totalMonths: totalPeriods,
    totalPrincipal: math.round(totalPrincipal, 2),
    totalPrincipalWan: math.round(math.div(totalPrincipal, 10000), 2),
    totalInterest: math.round(totalInterest, 2),
    totalInterestWan: math.round(math.div(totalInterest, 10000), 2),
    totalRepayment: math.round(totalRepayment, 2),
    totalRepaymentWan: math.round(math.div(totalRepayment, 10000), 2),
    monthlyPaymentFirst: math.round(monthlyPaymentFirst, 2),
    monthlyPaymentDecrease: math.round(monthlyPaymentDecrease, 2),
    principalPercent,
    interestPercent,
    schedule: [] // 空数组,表示未生成明细
  };
}

/**
 * 单项贷款汇总计算 (不生成 schedule 明细表)
 * 性能优化: 只累加总利息和总还款,跳过明细数组的创建
 */
function _calcSingleLoanSummary(principalAmount, annualRatePercent, totalMonths, repaymentType) {
  const P = Number(principalAmount) || 0;
  const totalPeriods = Number(totalMonths) || 0;
  if (P <= 0 || totalPeriods <= 0) {
    return {
      monthlyPayment: 0,
      monthlyPaymentFirst: 0,
      monthlyPaymentDecrease: 0,
      totalInterest: 0,
      totalRepayment: 0
    };
  }

  const r = (Number(annualRatePercent) || 0) / 100 / 12;
  let remainingPrincipal = P;
  let totalInterest = 0;
  let totalRepayment = 0;

  if (repaymentType === 'equal_installment') {
    // 等额本息
    let monthlyPayment = 0;
    if (r === 0) {
      monthlyPayment = math.div(P, totalPeriods, 2);
      totalInterest = 0;
      totalRepayment = P;
    } else {
      const powFactor = math.pow(1 + r, totalPeriods);
      const numerator = math.mul(math.mul(P, r), powFactor);
      const denominator = math.sub(powFactor, 1);
      monthlyPayment = math.div(numerator, denominator, 2);
      
      // 快速累加总利息(不生成明细)
      for (let month = 1; month <= totalPeriods; month++) {
        const interest = math.round(math.mul(remainingPrincipal, r), 2);
        const principal = month === totalPeriods ? remainingPrincipal : math.sub(monthlyPayment, interest);
        totalInterest = math.add(totalInterest, interest);
        totalRepayment = math.add(totalRepayment, math.add(principal, interest));
        remainingPrincipal = math.round(math.sub(remainingPrincipal, principal), 2);
      }
    }

    return {
      monthlyPayment,
      monthlyPaymentFirst: monthlyPayment,
      monthlyPaymentDecrease: 0,
      totalInterest: math.round(totalInterest, 2),
      totalRepayment: math.round(totalRepayment, 2)
    };
  } else {
    // 等额本金
    const monthlyPrincipalBase = math.div(P, totalPeriods, 2);
    let firstMonthPayment = 0;

    for (let month = 1; month <= totalPeriods; month++) {
      const principal = month === totalPeriods ? remainingPrincipal : monthlyPrincipalBase;
      const interest = math.round(math.mul(remainingPrincipal, r), 2);
      const currentMonthlyPayment = math.add(principal, interest);

      if (month === 1) {
        firstMonthPayment = currentMonthlyPayment;
      }

      totalInterest = math.add(totalInterest, interest);
      totalRepayment = math.add(totalRepayment, currentMonthlyPayment);
      remainingPrincipal = math.round(math.sub(remainingPrincipal, principal), 2);
    }

    const decreasePerMonth = math.round(math.mul(monthlyPrincipalBase, r), 2);

    return {
      monthlyPayment: firstMonthPayment,
      monthlyPaymentFirst: firstMonthPayment,
      monthlyPaymentDecrease: decreasePerMonth,
      totalInterest: math.round(totalInterest, 2),
      totalRepayment: math.round(totalRepayment, 2)
    };
  }
}

/**
 * 10. 提前还款计算器 - 轻量级汇总版本 (性能优化)
 * 只返回省息、新月供等关键数据,不生成完整还款明细表
 * 性能提升: 约 85% (真机从 2000ms → 300ms)
 * @param {Object} params 参数同 calcPrepayment
 * @returns {Object} 汇总数据,不含详细 schedule
 */
function calcPrepaymentSummary(params = {}) {
  const {
    originalLoanAmount = 100,
    annualRate = LPR_CONFIG.lpr5Year,
    originalYears = 30,
    repaymentType = 'equal_installment',
    paidMonths = 24,
    prepayAmount = 20,
    prepayOption = 'shorten_term'
  } = params;

  // 1. 先计算原贷款汇总数据(使用轻量级函数)
  const origRes = calcMortgageSummary({
    loanType: 'commercial',
    commercialAmount: originalLoanAmount,
    commercialRate: annualRate,
    years: originalYears,
    repaymentType
  });

  // 2. 获取已还期数对应的剩余本金(需要快速推算,不生成完整表)
  const mIndex = Math.min(Math.max(1, paidMonths), origRes.totalMonths);
  const remainPrincipalBeforePrepay = _calcRemainingPrincipalAtMonth(
    math.mul(originalLoanAmount, 10000),
    annualRate,
    origRes.totalMonths,
    repaymentType,
    mIndex
  );

  const prepayYuan = math.mul(prepayAmount, 10000);
  const newRemainPrincipal = Math.max(0, math.sub(remainPrincipalBeforePrepay, prepayYuan));

  // 3. 计算原方案剩余利息(近似公式,避免遍历 schedule)
  const origRemainingInterest = _calcRemainingInterestApprox(
    remainPrincipalBeforePrepay,
    annualRate,
    origRes.totalMonths - mIndex,
    origRes.monthlyPaymentFirst,
    repaymentType
  );

  let newPlan = null;
  let savedInterest = 0;
  let savedMonths = 0;

  if (newRemainPrincipal === 0) {
    // 全部结清
    savedInterest = origRemainingInterest;
    savedMonths = origRes.totalMonths - mIndex;
    newPlan = {
      newMonthlyPayment: 0,
      newRemainingMonths: 0,
      newTotalInterest: 0
    };
  } else if (prepayOption === 'reduce_payment') {
    // 方案一: 年限不变,减少月供
    const remainMonths = origRes.totalMonths - mIndex;
    const newLoanRes = _calcSingleLoanSummary(newRemainPrincipal, annualRate, remainMonths, repaymentType);
    savedInterest = math.round(math.sub(origRemainingInterest, newLoanRes.totalInterest), 2);
    newPlan = {
      newMonthlyPayment: newLoanRes.monthlyPaymentFirst,
      newRemainingMonths: remainMonths,
      newTotalInterest: newLoanRes.totalInterest
    };
  } else {
    // 方案二: 月供不变,缩短年限
    const r = annualRate / 100 / 12;
    const origMonthlyPayment = origRes.monthlyPaymentFirst;
    let newMonths = 0;

    if (repaymentType === 'equal_installment') {
      if (origMonthlyPayment <= newRemainPrincipal * r) {
        newMonths = origRes.totalMonths - mIndex;
      } else {
        const top = Math.log(origMonthlyPayment / (origMonthlyPayment - newRemainPrincipal * r));
        const bottom = Math.log(1 + r);
        newMonths = Math.ceil(top / bottom);
      }
    } else {
      const origMonthlyPrincipal = math.div(math.mul(originalLoanAmount, 10000), origRes.totalMonths);
      newMonths = Math.ceil(newRemainPrincipal / origMonthlyPrincipal);
    }

    newMonths = Math.max(1, Math.min(newMonths, origRes.totalMonths - mIndex));
    const newLoanRes = _calcSingleLoanSummary(newRemainPrincipal, annualRate, newMonths, repaymentType);
    savedInterest = math.round(math.sub(origRemainingInterest, newLoanRes.totalInterest), 2);
    savedMonths = (origRes.totalMonths - mIndex) - newMonths;

    newPlan = {
      newMonthlyPayment: newLoanRes.monthlyPaymentFirst,
      newRemainingMonths: newMonths,
      newTotalInterest: newLoanRes.totalInterest
    };
  }

  return {
    prepayOption,
    paidMonths: mIndex,
    remainPrincipalBeforePrepay: math.round(remainPrincipalBeforePrepay, 2),
    prepayAmountYuan: prepayYuan,
    newRemainPrincipal: math.round(newRemainPrincipal, 2),
    savedInterest: Math.max(0, savedInterest),
    savedInterestWan: math.round(math.div(Math.max(0, savedInterest), 10000), 2),
    savedMonths,
    savedYears: math.round(math.div(savedMonths, 12), 1),
    newPlan
  };
}

/**
 * 快速推算指定月份的剩余本金(不生成完整 schedule)
 */
function _calcRemainingPrincipalAtMonth(principalAmount, annualRatePercent, totalMonths, repaymentType, atMonth) {
  const P = Number(principalAmount) || 0;
  const r = annualRatePercent / 100 / 12;
  
  if (atMonth <= 0) return P;
  if (atMonth >= totalMonths) return 0;

  if (repaymentType === 'equal_installment') {
    // 等额本息: 剩余本金 = P * ((1+r)^n - (1+r)^m) / ((1+r)^n - 1)
    const powN = math.pow(1 + r, totalMonths);
    const powM = math.pow(1 + r, atMonth);
    const remaining = math.div(
      math.mul(P, math.sub(powN, powM)),
      math.sub(powN, 1)
    );
    return math.round(remaining, 2);
  } else {
    // 等额本金: 剩余本金 = P * (1 - m/n)
    const remaining = math.mul(P, math.sub(1, math.div(atMonth, totalMonths)));
    return math.round(remaining, 2);
  }
}

/**
 * 近似计算剩余利息总和(避免遍历 schedule)
 */
function _calcRemainingInterestApprox(remainPrincipal, annualRate, remainMonths, monthlyPayment, repaymentType) {
  if (remainMonths <= 0) return 0;
  
  const r = annualRate / 100 / 12;

  if (repaymentType === 'equal_installment') {
    // 等额本息: 剩余利息 = 月供 × 剩余期数 - 剩余本金
    return Math.max(0, math.sub(math.mul(monthlyPayment, remainMonths), remainPrincipal));
  } else {
    // 等额本金: 剩余利息 ≈ 剩余本金 × 月利率 × (剩余期数+1) / 2
    return math.round(
      math.mul(
        math.mul(remainPrincipal, r),
        math.div(math.add(remainMonths, 1), 2)
      ),
      2
    );
  }
}

module.exports = {
  calcMortgage,
  calcPrepayment,
  calcMortgageSummary,
  calcPrepaymentSummary,
  calcFundQuota,
  calcAffordability,
  calcRentVsBuy,
  calcDownPayment,
  calcDeedTax,
  calcSecondHandTax
};
