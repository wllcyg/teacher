/**
 * miniprogram/utils/calculators/car.js
 * 03·购车用车模块高精度纯函数算法引擎
 * 涵盖：车贷实际年化综合利率 (IRR) 反解、新能源与燃油车购置税新政、全包落地总价、排量车船税、二手车残值与油电成本对比
 */
const math = require('../math.js');
const {
  VEHICLE_TAX_TIERS,
  PURCHASE_TAX_CONFIG,
  COMPULSORY_INSURANCE,
  COMMERCIAL_INSURANCE_PRESETS,
  RUNNING_COST_PRESETS,
  DEPRECIATION_RATES
} = require('../config/car-rules.js');

/**
 * 1. 牛顿-拉夫逊数值迭代法求解车贷真实综合年化利率 (IRR)
 * 揭露 4S 店名义 0 息但收取高额金融服务费的实际真实年化成本
 * @param {number} netPrincipal 实际到手净本金 = 贷款额 - 金融服务费 - 垫付杂费 (元)
 * @param {number} monthlyPayment 每月实际还款月供 (元)
 * @param {number} totalPeriods 总还款期数 (月)
 * @returns {number} 真实年化综合利率百分比 (如 7.25 代表 7.25%)
 */
function solveCarLoanIRR(netPrincipal, monthlyPayment, totalPeriods) {
  const P = Number(netPrincipal) || 0;
  const M = Number(monthlyPayment) || 0;
  const n = Number(totalPeriods) || 0;

  if (P <= 0 || M <= 0 || n <= 0) return 0;

  // 总还款额小于本金 (如完全无息且无服务费)
  if (M * n <= P) return 0;

  // 初始月利率估计值 (粗估法)
  let r = (M * n - P) / (P * n);
  if (r <= 0) r = 0.005;

  // 牛顿法迭代 30 次足以达到 1e-7 高精度收敛
  for (let i = 0; i < 35; i++) {
    // f(r) = P - M * (1 - (1+r)^(-n)) / r
    const factor = Math.pow(1 + r, -n);
    const f = P - (M * (1 - factor)) / r;

    // f'(r) = M * (1 - (1+r)^(-n) - n * r * (1+r)^(-n-1)) / (r^2)
    const fPrime = (M * (1 - factor - n * r * Math.pow(1 + r, -n - 1))) / (r * r);

    if (Math.abs(fPrime) < 1e-12) break;

    const nextR = r - f / fPrime;
    if (Math.abs(nextR - r) < 1e-7) {
      r = nextR;
      break;
    }
    r = nextR;
    if (r <= 0) r = 0.0001; // 防止越界
  }

  // 年化 IRR = 月利率 * 12 * 100
  const annualIRR = math.round(r * 12 * 100, 2);
  return annualIRR;
}

/**
 * 2. 车辆购置税计算器
 * 严格执行国家新能源汽车 2024~2026 免税限额政策 (最高免 3 万元)
 * @param {Object} options
 * @param {number} options.carPrice 裸车发票价格 (含 13% 增值税，元)
 * @param {string} [options.powerType='fuel'] 'fuel'(燃油) | 'electric'(纯电) | 'phev'(插混/增程)
 */
function calcPurchaseTax(options = {}) {
  const price = Math.max(0, Number(options.carPrice) || 0);
  const powerType = options.powerType || 'fuel';
  const cfg = PURCHASE_TAX_CONFIG;

  // 不含税价格 = 发票价 / (1 + 13%)
  const priceExclVat = math.round(price / (1 + cfg.vatRate), 2);
  // 法定基准应纳税额 = 不含税价 * 10%
  const statutoryTax = math.round(priceExclVat * cfg.fuelTaxRate, 2);

  let actualTax = 0;
  let taxExemption = 0;
  let policyDesc = '';

  if (powerType === 'fuel') {
    actualTax = statutoryTax;
    taxExemption = 0;
    policyDesc = '燃油车按法定税率 10% 正常计征';
  } else {
    // 新能源车 (纯电/插混/增程): 享受最高 30,000 元免征限额 (对应车价约 33.9 万元)
    const maxExemption = cfg.nevCurrentPolicy.maxExemptionAmount;
    if (statutoryTax <= maxExemption) {
      actualTax = 0;
      taxExemption = statutoryTax;
      policyDesc = `新能源车享受全额免征购置税 (节省 ¥${math.formatMoney(taxExemption)})`;
    } else {
      actualTax = math.round(statutoryTax - maxExemption, 2);
      taxExemption = maxExemption;
      policyDesc = `车价超 33.9 万元，按新政享受最高 ¥30,000 免税限额，超额部分实缴 ¥${math.formatMoney(actualTax)}`;
    }
  }

  return {
    carPrice: price,
    formatCarPrice: math.formatMoney(price),
    priceExclVat,
    statutoryTax,
    actualTax,
    formatActualTax: math.formatMoney(actualTax),
    taxExemption,
    formatTaxExemption: math.formatMoney(taxExemption),
    policyDesc,
    powerType
  };
}

/**
 * 3. 车船税阶梯计算器
 * @param {Object} options
 * @param {string} [options.powerType='fuel'] 'fuel' | 'electric' | 'phev'
 * @param {number} [options.displacement=1.5] 发动机排量 (升 L)
 */
function calcVehicleAndVesselTax(options = {}) {
  const powerType = options.powerType || 'fuel';
  const displacement = Number(options.displacement) || 1.5;

  if (powerType === 'electric') {
    return {
      tax: 0,
      formatTax: '0.00',
      label: '纯电动汽车免征车船税',
      annualTax: 0
    };
  }

  // 燃油或混动根据排量查表
  for (let i = 0; i < VEHICLE_TAX_TIERS.length; i++) {
    const tier = VEHICLE_TAX_TIERS[i];
    if (displacement <= tier.maxDisplacement) {
      return {
        tax: tier.annualTax,
        formatTax: math.formatMoney(tier.annualTax),
        label: `${tier.label} (${tier.annualTax}元/年)`,
        annualTax: tier.annualTax
      };
    }
  }

  return {
    tax: 4500,
    formatTax: '4,500.00',
    label: '4.0L 以上 (4500元/年)',
    annualTax: 4500
  };
}

/**
 * 4. 落地全包总价计算器 (All-in Cost)
 * 包含裸车价、购置税、车船税、交强险、商业险、4S店杂费
 * @param {Object} options
 * @param {number} options.carPrice 裸车成交价 (元)
 * @param {string} [options.powerType='fuel'] 动力类型
 * @param {number} [options.displacement=1.5] 发动机排量
 * @param {number} [options.seatCount=5] 座位数 (5座 / 7座)
 * @param {number} [options.customInsurance] 自定义商业险预估
 * @param {number} [options.registrationFee=500] 上牌与杂费 (元)
 */
function calcCarLandingPrice(options = {}) {
  const carPrice = Math.max(0, Number(options.carPrice) || 0);
  const powerType = options.powerType || 'fuel';
  const displacement = Number(options.displacement) || 1.5;
  const seatCount = Number(options.seatCount) || 5;
  const regFee = Math.max(0, Number(options.registrationFee) || 500);

  // 1. 购置税
  const purchaseTaxRes = calcPurchaseTax({ carPrice, powerType });
  const purchaseTax = purchaseTaxRes.actualTax;

  // 2. 车船税
  const vehicleTaxRes = calcVehicleAndVesselTax({ powerType, displacement });
  const vehicleTax = vehicleTaxRes.annualTax;

  // 3. 法定交强险
  const compulsoryInsurance = seatCount >= 6 ? COMPULSORY_INSURANCE.over6Seats : COMPULSORY_INSURANCE.under6Seats;

  // 4. 商业车险预估
  let commercialInsurance = 0;
  if (options.customInsurance !== undefined && options.customInsurance !== null) {
    commercialInsurance = Math.max(0, Number(options.customInsurance));
  } else {
    // 经验预估: 基础保费 + 车损险比例
    const insCfg = COMMERCIAL_INSURANCE_PRESETS;
    commercialInsurance = math.round(insCfg.baseAmount + carPrice * insCfg.carLossRate, 2);
  }

  // 落地总价
  const totalLandingPrice = math.round(
    carPrice + purchaseTax + vehicleTax + compulsoryInsurance + commercialInsurance + regFee,
    2
  );

  return {
    carPrice,
    formatCarPrice: math.formatMoney(carPrice),
    purchaseTax,
    formatPurchaseTax: math.formatMoney(purchaseTax),
    vehicleTax,
    formatVehicleTax: math.formatMoney(vehicleTax),
    compulsoryInsurance,
    formatCompulsoryInsurance: math.formatMoney(compulsoryInsurance),
    commercialInsurance,
    formatCommercialInsurance: math.formatMoney(commercialInsurance),
    registrationFee: regFee,
    formatRegistrationFee: math.formatMoney(regFee),
    totalLandingPrice,
    formatTotalLandingPrice: math.formatMoney(totalLandingPrice),
    totalLandingPriceWan: math.round(totalLandingPrice / 10000, 2),
    purchaseTaxRes
  };
}

/**
 * 5. 车贷分期与真实综合年化利率 (IRR) 计算器
 * 诊断 4S 店金融陷阱，揭露 0 息与低息的真实利率
 * @param {Object} options
 * @param {number} options.carPrice 裸车成交总价 (元)
 * @param {number} [options.downPaymentRatio=0.3] 首付比例 (如 0.3 代表 30%)
 * @param {number} [options.totalMonths=36] 贷款期数 (12, 24, 36, 48, 60期)
 * @param {number} [options.nominalAnnualRate=3.5] 名义年费率 / 年利率 (%)
 * @param {number} [options.financeServiceFee=0] 4S 店加收的金融服务费 / 出库费 (元)
 * @param {string} [options.repaymentType='equal_installment'] 'equal_installment' (等额本息)
 */
function calcCarLoan(options = {}) {
  const carPrice = Math.max(0, Number(options.carPrice) || 0);
  const downRatio = Math.max(0.1, Math.min(0.9, Number(options.downPaymentRatio) || 0.3));
  const totalMonths = Number(options.totalMonths) || 36;
  const nominalRate = Math.max(0, Number(options.nominalAnnualRate) || 0);
  const serviceFee = Math.max(0, Number(options.financeServiceFee) || 0);

  // 首付款与贷款本金
  const downPaymentAmount = math.round(carPrice * downRatio, 2);
  const loanPrincipal = math.round(carPrice - downPaymentAmount, 2);

  // 计算等额本息月供
  let monthlyPayment = 0;
  let totalInterest = 0;
  let totalRepayment = 0;

  if (loanPrincipal <= 0) {
    return {
      loanPrincipal: 0,
      downPaymentAmount: 0,
      monthlyPayment: 0,
      totalInterest: 0,
      totalRepayment: 0,
      realAnnualIRR: 0,
      schedule: []
    };
  }

  const monthlyRate = nominalRate / 100 / 12;

  if (monthlyRate === 0) {
    // 0 息情况
    monthlyPayment = math.round(loanPrincipal / totalMonths, 2);
    totalInterest = 0;
    totalRepayment = loanPrincipal;
  } else {
    // 等额本息标准公式: M = P * r * (1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    monthlyPayment = math.round((loanPrincipal * monthlyRate * factor) / (factor - 1), 2);
    totalRepayment = math.round(monthlyPayment * totalMonths, 2);
    totalInterest = math.round(totalRepayment - loanPrincipal, 2);
  }

  // 反解真实综合年化利率 (IRR)
  // 期初实际到手净贷款本金 = 贷款本金 - 4S店金融服务费
  const netPrincipal = math.round(loanPrincipal - serviceFee, 2);
  const realAnnualIRR = solveCarLoanIRR(netPrincipal, monthlyPayment, totalMonths);

  // 4S 店陷阱预警诊断
  let trapWarning = null;
  const irrDiff = math.round(realAnnualIRR - nominalRate, 2);

  if (serviceFee > 0 && irrDiff > 1.0) {
    trapWarning = {
      level: 'danger',
      title: '警惕 4S 店金融服务费陷阱！',
      tip: `宣称名义年利率仅 ${nominalRate}%，但因加收 ¥${math.formatMoney(serviceFee)} 元金融服务费，真实综合年化利率 (IRR) 高达 ${realAnnualIRR}%！相比名义利率上浮了 ${irrDiff}%。建议要求免除服务费或选择银行直贷。`
    };
  } else if (nominalRate === 0 && serviceFee > 0) {
    trapWarning = {
      level: 'warning',
      title: '所谓“0 息贷款”并非真免费！',
      tip: `虽然利息为 0，但一次性收取 ¥${math.formatMoney(serviceFee)} 元服务费，实际相当于年化利率 ${realAnnualIRR}% 的车贷！`
    };
  }

  // 生成逐月分期还款明细
  const schedule = [];
  let remaining = loanPrincipal;
  for (let m = 1; m <= totalMonths; m++) {
    let interest = 0;
    let principal = 0;
    if (monthlyRate === 0) {
      principal = m === totalMonths ? remaining : monthlyPayment;
      interest = 0;
      remaining = math.round(remaining - principal, 2);
    } else {
      interest = math.round(remaining * monthlyRate, 2);
      principal = math.round(monthlyPayment - interest, 2);
      if (m === totalMonths) {
        principal = remaining;
        remaining = 0;
      } else {
        remaining = math.round(remaining - principal, 2);
      }
    }

    schedule.push({
      month: m,
      monthName: `第${m}期`,
      monthlyPayment,
      principal,
      interest,
      remaining: Math.max(0, remaining),
      formatPayment: math.formatMoney(monthlyPayment),
      formatPrincipal: math.formatMoney(principal),
      formatInterest: math.formatMoney(interest),
      formatRemaining: math.formatMoney(Math.max(0, remaining))
    });
  }

  return {
    carPrice,
    downPaymentRatio: downRatio,
    downPaymentAmount,
    formatDownPaymentAmount: math.formatMoney(downPaymentAmount),
    loanPrincipal,
    formatLoanPrincipal: math.formatMoney(loanPrincipal),
    totalMonths,
    nominalAnnualRate: nominalRate,
    financeServiceFee: serviceFee,
    formatFinanceServiceFee: math.formatMoney(serviceFee),
    monthlyPayment,
    formatMonthlyPayment: math.formatMoney(monthlyPayment),
    totalInterest,
    formatTotalInterest: math.formatMoney(totalInterest),
    totalRepayment,
    formatTotalRepayment: math.formatMoney(totalRepayment),
    totalCostWithFee: math.round(totalRepayment + serviceFee, 2),
    formatTotalCostWithFee: math.formatMoney(totalRepayment + serviceFee),
    realAnnualIRR,
    irrDiff,
    trapWarning,
    schedule
  };
}

/**
 * 6. 二手车保值率与残值推演估算器
 * @param {Object} options
 * @param {number} options.carPrice 新车指导/发票价 (元)
 * @param {number} [options.carAgeYears=3] 当前车龄 (年)
 * @param {number} [options.mileageKm=45000] 行驶里程 (公里)
 * @param {string} [options.condition='good'] 车况等级 'excellent'(优秀)|'good'(良好)|'fair'(一般)
 */
function calcCarDepreciation(options = {}) {
  const price = Math.max(0, Number(options.carPrice) || 0);
  const age = Math.max(1, Math.min(10, Number(options.carAgeYears) || 3));
  const mileage = Math.max(0, Number(options.mileageKm) || age * 15000);
  const condition = options.condition || 'good';

  // 车况系数
  const conditionFactors = { excellent: 1.05, good: 1.00, fair: 0.94 };
  const condFactor = conditionFactors[condition] || 1.0;

  // 里程修正 (以年均 1.5 万公里为基准)
  const standardMileage = age * 15000;
  const mileageDiffRatio = (mileage - standardMileage) / 100000; // 每超出10万公里扣约5%
  const mileageFactor = Math.max(0.85, Math.min(1.10, 1 - mileageDiffRatio * 0.05));

  // 生成 1~8 年全生命周期保值率曲线
  const curve = [];
  let currentResidualPrice = 0;
  let currentResidualRate = 0;

  for (let year = 1; year <= 8; year++) {
    // 首年折旧 18%，随后每年折旧 8%
    let baseRate = 1 - DEPRECIATION_RATES.firstYearRate - (year - 1) * DEPRECIATION_RATES.annualSubsequentRate;
    baseRate = Math.max(DEPRECIATION_RATES.minResidualRate, baseRate);

    // 结合里程与车况修正
    let finalRate = math.round(baseRate * (year === age ? condFactor * mileageFactor : 1.0), 4);
    finalRate = Math.max(DEPRECIATION_RATES.minResidualRate, Math.min(1, finalRate));

    const residualPrice = math.round(price * finalRate, 2);

    curve.push({
      year,
      yearName: `第${year}年`,
      residualRatePercent: math.round(finalRate * 100, 1),
      residualPrice,
      formatResidualPrice: math.formatMoney(residualPrice),
      residualPriceWan: math.round(residualPrice / 10000, 2)
    });

    if (year === age) {
      currentResidualPrice = residualPrice;
      currentResidualRate = math.round(finalRate * 100, 1);
    }
  }

  return {
    carPrice: price,
    age,
    mileage,
    condition,
    currentResidualPrice,
    formatCurrentResidualPrice: math.formatMoney(currentResidualPrice),
    currentResidualPriceWan: math.round(currentResidualPrice / 10000, 2),
    currentResidualRate,
    curve
  };
}

/**
 * 7. 用车养车年度成本与“油车 vs 电车”全生命周期对比
 * @param {Object} options
 * @param {number} [options.annualMileage=15000] 年行驶里程 (公里)
 * @param {number} [options.fuelConsumption=7.8] 油车百公里综合油耗 (L/100km)
 * @param {number} [options.fuelPrice=7.80] 汽油单价 (元/L)
 * @param {number} [options.electricConsumption=14.5] 电车百公里电耗 (kWh/100km)
 * @param {number} [options.homeElectricPrice=0.35] 家充谷电单价 (元/度)
 * @param {number} [options.publicElectricPrice=1.30] 公桩快充单价 (元/度)
 * @param {number} [options.homeChargeRatio=0.7] 家充比例 (如 70%)
 * @param {number} [options.fuelCarPrice=150000] 油车购买总价 (元，用于测算回本年限)
 * @param {number} [options.electricCarPrice=165000] 电车购买总价 (元)
 */
function calcFuelVsElectricCost(options = {}) {
  const mileage = Math.max(1000, Number(options.annualMileage) || RUNNING_COST_PRESETS.common.defaultAnnualMileage);
  const fuelConsumption = Number(options.fuelConsumption) || RUNNING_COST_PRESETS.fuel.defaultConsumptionPer100Km;
  const fuelPrice = Number(options.fuelPrice) || RUNNING_COST_PRESETS.fuel.price92;

  const electricConsumption = Number(options.electricConsumption) || RUNNING_COST_PRESETS.electric.defaultConsumptionPer100Km;
  const homePrice = Number(options.homeElectricPrice) || RUNNING_COST_PRESETS.electric.homeElectricityPrice;
  const publicPrice = Number(options.publicElectricPrice) || RUNNING_COST_PRESETS.electric.publicElectricityPrice;
  const homeRatio = Math.max(0, Math.min(1, Number(options.homeChargeRatio) || 0.7));

  // 1. 燃油车年度成本测算
  // 年燃油费 = (里程 / 100) * 百公里油耗 * 油价
  const fuelEnergyCost = math.round((mileage / 100) * fuelConsumption * fuelPrice, 2);
  const fuelInsurance = RUNNING_COST_PRESETS.fuel.annualInsuranceAvg;
  const fuelMaintenance = RUNNING_COST_PRESETS.fuel.annualMaintenanceCost;
  const parkingAndHighway = RUNNING_COST_PRESETS.common.annualParkingHighway;
  const fuelTotalAnnualCost = math.round(fuelEnergyCost + fuelInsurance + fuelMaintenance + parkingAndHighway, 2);
  const fuelCostPerKm = math.round(fuelTotalAnnualCost / mileage, 2);

  // 2. 纯电动车年度成本测算
  // 加权电价
  const avgElectricPrice = math.round(homePrice * homeRatio + publicPrice * (1 - homeRatio), 3);
  const electricEnergyCost = math.round((mileage / 100) * electricConsumption * avgElectricPrice, 2);
  const electricInsurance = RUNNING_COST_PRESETS.electric.annualInsuranceAvg;
  const electricMaintenance = RUNNING_COST_PRESETS.electric.annualMaintenanceCost;
  const electricTotalAnnualCost = math.round(electricEnergyCost + electricInsurance + electricMaintenance + parkingAndHighway, 2);
  const electricCostPerKm = math.round(electricTotalAnnualCost / mileage, 2);

  // 3. 差额与省钱分析
  const annualEnergySaved = math.round(fuelEnergyCost - electricEnergyCost, 2);
  const annualTotalSaved = math.round(fuelTotalAnnualCost - electricTotalAnnualCost, 2);

  // 回本周期测算 (车价溢价 / 每年养车总结余)
  const fuelCarPrice = Number(options.fuelCarPrice) || 150000;
  const electricCarPrice = Number(options.electricCarPrice) || 165000;
  const priceGap = electricCarPrice - fuelCarPrice;

  let breakevenYears = 0;
  let breakevenDesc = '';

  if (priceGap <= 0) {
    breakevenDesc = '电车车价已低于或等于油车，买车即省，首年即可完全收回成本！';
  } else if (annualTotalSaved <= 0) {
    breakevenDesc = '当前行驶里程较少，电车保险增量抵消了能耗优势，短期难以收回差价。';
  } else {
    breakevenYears = math.round(priceGap / annualTotalSaved, 1);
    const breakevenKm = math.round(breakevenYears * mileage, 0);
    breakevenDesc = `电车比油车贵 ¥${math.formatMoney(priceGap)}，按每年省 ¥${math.formatMoney(annualTotalSaved)} 计算，预计开 ${breakevenYears} 年 (约 ${breakevenKm} 公里) 即可靠省下的油费完全回本！`;
  }

  return {
    annualMileage: mileage,
    // 油车数据
    fuelCar: {
      energyCost: fuelEnergyCost,
      formatEnergyCost: math.formatMoney(fuelEnergyCost),
      insuranceCost: fuelInsurance,
      maintenanceCost: fuelMaintenance,
      totalAnnualCost: fuelTotalAnnualCost,
      formatTotalAnnualCost: math.formatMoney(fuelTotalAnnualCost),
      costPerKm: fuelCostPerKm
    },
    // 电车数据
    electricCar: {
      energyCost: electricEnergyCost,
      formatEnergyCost: math.formatMoney(electricEnergyCost),
      insuranceCost: electricInsurance,
      maintenanceCost: electricMaintenance,
      totalAnnualCost: electricTotalAnnualCost,
      formatTotalAnnualCost: math.formatMoney(electricTotalAnnualCost),
      costPerKm: electricCostPerKm,
      avgElectricPrice
    },
    // 综合对比
    annualEnergySaved,
    formatAnnualEnergySaved: math.formatMoney(annualEnergySaved),
    annualTotalSaved,
    formatAnnualTotalSaved: math.formatMoney(annualTotalSaved),
    save5Years: math.round(annualTotalSaved * 5, 2),
    formatSave5Years: math.formatMoney(annualTotalSaved * 5),
    breakevenYears,
    breakevenDesc
  };
}

module.exports = {
  solveCarLoanIRR,
  calcPurchaseTax,
  calcVehicleAndVesselTax,
  calcCarLandingPrice,
  calcCarLoan,
  calcCarDepreciation,
  calcFuelVsElectricCost
};
