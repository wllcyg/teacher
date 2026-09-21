// utils/calculators/insurance.js
const math = require('../math.js');

/**
 * 1. 重疾险合理保额测算器 (需求法数学模型)
 * @param {Object} params
 * @param {number} params.annualIncome - 个人税后年收入 (元)
 * @param {number} params.treatmentCost - 预估治疗与特效药开销 (元，默认30万)
 * @param {number} params.rehabYears - 停工康复过渡年数 (年，默认3年)
 * @param {number} params.debtBalance - 个人承担的家庭负债余额 (元，如房贷/车贷)
 * @param {number} params.existingCoverage - 已有重疾保额 (元)
 * @param {number} params.liquidAssets - 可随时变现的应急金融资产 (元)
 * @returns {Object}
 */
function calcCriticalIllness(params = {}) {
  const annualIncome = Math.max(0, Number(params.annualIncome) || 150000);
  const treatmentCost = Math.max(0, Number(params.treatmentCost) || 300000);
  const rehabYears = Math.max(1, Number(params.rehabYears) || 3);
  const debtBalance = Math.max(0, Number(params.debtBalance) || 0);
  const existingCoverage = Math.max(0, Number(params.existingCoverage) || 0);
  const liquidAssets = Math.max(0, Number(params.liquidAssets) || 0);

  // 1. 收入损失补偿额
  const incomeLossCompensation = math.round(annualIncome * rehabYears, 2);

  // 2. 负债兜底保障额 (基础版按 50% 兜底，充裕版按 100% 覆盖)
  const debtBasicProtection = math.round(debtBalance * 0.5, 2);
  const debtComfortProtection = debtBalance;

  // 3. 基础版保额 (维持基本尊严与现金流防断裂)
  const grossBasic = treatmentCost + incomeLossCompensation + debtBasicProtection;
  const netBasic = Math.max(100000, math.round(grossBasic - existingCoverage - (liquidAssets * 0.5), 2));

  // 4. 充裕版保额 (全额覆盖前沿自费新药与全额负债)
  const grossComfort = math.round(treatmentCost * 1.2 + incomeLossCompensation + debtComfortProtection, 2);
  const netComfort = Math.max(200000, math.round(grossComfort - existingCoverage, 2));

  // 5. 建议保费健康区间 (家庭年收入 5%~8%)
  const minAnnualPremium = math.round(annualIncome * 0.04, 0);
  const maxAnnualPremium = math.round(annualIncome * 0.08, 0);

  // 6. 各维度占比拆解 (以基础需求为基准)
  const totalNeedSum = treatmentCost + incomeLossCompensation + debtBasicProtection || 1;
  const treatmentShare = math.round((treatmentCost / totalNeedSum) * 100, 1);
  const incomeLossShare = math.round((incomeLossCompensation / totalNeedSum) * 100, 1);
  const debtShare = math.round(100 - treatmentShare - incomeLossShare, 1);

  return {
    annualIncome,
    treatmentCost,
    rehabYears,
    debtBalance,
    existingCoverage,
    liquidAssets,

    // 核心结论
    basicCoverage: netBasic,
    comfortCoverage: netComfort,
    basicCoverageWan: math.round(netBasic / 10000, 1),
    comfortCoverageWan: math.round(netComfort / 10000, 1),

    // 构成拆解
    incomeLossCompensation,
    incomeLossCompensationWan: math.round(incomeLossCompensation / 10000, 1),
    debtBasicProtection,
    debtBasicProtectionWan: math.round(debtBasicProtection / 10000, 1),

    // 保费建议
    minAnnualPremium,
    maxAnnualPremium,
    formatPremiumRange: `¥${minAnnualPremium.toLocaleString('zh-CN')} ~ ¥${maxAnnualPremium.toLocaleString('zh-CN')}`,

    // 占比分布
    treatmentShare,
    incomeLossShare,
    debtShare,

    formatBasicWan: (netBasic / 10000).toFixed(1),
    formatComfortWan: (netComfort / 10000).toFixed(1)
  };
}

/**
 * 2. 定期/终身寿险保额测算器 (生命价值法 vs 遗属需求法)
 * @param {Object} params
 * @param {number} params.annualIncome - 个人税后年收入 (元)
 * @param {number} params.dutyYears - 家庭核心抚养责任剩余年数 (年，通常至子女独立或房贷结束，默认20年)
 * @param {number} params.totalDebt - 家庭剩余总负债 (元，如房贷/车贷)
 * @param {number} params.childEducationFund - 子女养育与高等教育总基金 (元)
 * @param {number} params.parentCareFund - 父母养老医疗储备应急金 (元)
 * @param {number} params.annualLivingExpense - 家庭年度日常基本开销 (元)
 * @param {number} params.bufferYears - 遗属生活缓冲年限 (年，推荐 3~5 年)
 * @param {number} params.netLiquidAssets - 现有家庭净流动金融资产 (元)
 * @param {string} params.modelType - 'needs' (遗属需求法，推荐) | 'income' (生命价值/收入损失法)
 * @returns {Object}
 */
function calcLifeInsurance(params = {}) {
  const annualIncome = Math.max(0, Number(params.annualIncome) || 180000);
  const dutyYears = Math.max(1, Number(params.dutyYears) || 20);
  const totalDebt = Math.max(0, Number(params.totalDebt) || 800000);
  const childEducationFund = Math.max(0, Number(params.childEducationFund) || 300000);
  const parentCareFund = Math.max(0, Number(params.parentCareFund) || 100000);
  const annualLivingExpense = Math.max(0, Number(params.annualLivingExpense) || 80000);
  const bufferYears = Math.max(1, Number(params.bufferYears) || 5);
  const netLiquidAssets = Math.max(0, Number(params.netLiquidAssets) || 100000);
  const modelType = params.modelType || 'needs';

  // 模型 A：生命价值/收入损失法
  const incomeModelAmount = math.round(annualIncome * dutyYears, 2);

  // 模型 B：遗属需求分析法 (科学抵御家庭财务坍塌)
  const familyLivingBuffer = math.round(annualLivingExpense * bufferYears, 2);
  const grossNeeds = totalDebt + childEducationFund + parentCareFund + familyLivingBuffer;
  const needsModelAmount = Math.max(100000, math.round(grossNeeds - netLiquidAssets, 2));

  // 推荐采用的需求保额
  const recommendedAmount = modelType === 'income' ? incomeModelAmount : needsModelAmount;

  // 拆解构成
  const sumForShares = totalDebt + childEducationFund + parentCareFund + familyLivingBuffer || 1;
  const debtShare = math.round((totalDebt / sumForShares) * 100, 1);
  const childShare = math.round((childEducationFund / sumForShares) * 100, 1);
  const livingShare = math.round((familyLivingBuffer / sumForShares) * 100, 1);
  const parentShare = math.round(100 - debtShare - childShare - livingShare, 1);

  return {
    annualIncome,
    dutyYears,
    totalDebt,
    childEducationFund,
    parentCareFund,
    annualLivingExpense,
    bufferYears,
    netLiquidAssets,
    modelType,

    incomeModelAmount,
    incomeModelAmountWan: math.round(incomeModelAmount / 10000, 1),

    needsModelAmount,
    needsModelAmountWan: math.round(needsModelAmount / 10000, 1),

    recommendedAmount,
    recommendedAmountWan: math.round(recommendedAmount / 10000, 1),
    formatRecommendedWan: (recommendedAmount / 10000).toFixed(1),

    familyLivingBuffer,
    familyLivingBufferWan: math.round(familyLivingBuffer / 10000, 1),

    debtShare,
    childShare,
    livingShare,
    parentShare
  };
}

/**
 * 3. 社保医保 vs 商业百万医疗险报销对比计算器
 * @param {Object} params
 * @param {number} params.totalCost - 医疗花费总金额 (元)
 * @param {number} params.inScopeRatio - 医保目录内费用占比 (0~1，默认 0.6 即 60%)
 * @param {number} params.socialReimburseRatio - 基本医保报销比例 (0~1，默认 0.75 即 75%)
 * @param {number} params.socialCap - 医保年度累计封顶线 (元，默认 30万)
 * @param {number} params.commercialDeductible - 百万医疗险免赔额 (元，通常1万元)
 * @param {number} params.commercialRatio - 百万医疗险赔付比例 (0~1，通常 1.0 即 100%)
 * @returns {Object}
 */
function calcMedicalReimburse(params = {}) {
  const totalCost = Math.max(0, Number(params.totalCost) || 300000);
  const inScopeRatio = Math.min(1, Math.max(0.1, Number(params.inScopeRatio) || 0.6));
  const socialReimburseRatio = Math.min(1, Math.max(0.3, Number(params.socialReimburseRatio) || 0.75));
  const socialCap = Math.max(10000, Number(params.socialCap) || 300000);
  const commercialDeductible = Math.max(0, Number(params.commercialDeductible) || 10000);
  const commercialRatio = Math.min(1, Math.max(0.5, Number(params.commercialRatio) || 1.0));

  // 1. 目录内与目录外划分
  const inScopeCost = math.round(totalCost * inScopeRatio, 2);
  const outScopeCost = math.round(totalCost - inScopeCost, 2);

  // 2. 医保报销计算 (受目录内限制与封顶线限制)
  const theoreticalSocialReimburse = math.round(inScopeCost * socialReimburseRatio, 2);
  const socialReimbursed = math.round(Math.min(theoreticalSocialReimburse, socialCap), 2);

  // 3. 仅有社保时的个人自付 (全部自费药 + 目录内未报销部分)
  const onlySocialSelfPay = math.round(totalCost - socialReimbursed, 2);

  // 4. 商业百万医疗险报销计算 (无目录限制，报销社保未报部分中超出免赔额的部分)
  const remainingCostAfterSocial = math.round(totalCost - socialReimbursed, 2);
  const eligibleCommercialAmount = Math.max(0, remainingCostAfterSocial - commercialDeductible);
  const commercialReimbursed = math.round(eligibleCommercialAmount * commercialRatio, 2);

  // 5. 拥有「社保+商业百万医疗」后的个人实际自付
  const withCommercialSelfPay = math.round(totalCost - socialReimbursed - commercialReimbursed, 2);

  // 6. 商业险减少个人自付的金额
  const savedAmount = math.round(onlySocialSelfPay - withCommercialSelfPay, 2);
  const reimbursementRatioTotal = totalCost > 0 ? math.round(((socialReimbursed + commercialReimbursed) / totalCost) * 100, 1) : 0;
  const socialReimburseRatioActual = totalCost > 0 ? math.round((socialReimbursed / totalCost) * 100, 1) : 0;

  return {
    totalCost,
    inScopeCost,
    outScopeCost,
    socialReimbursed,
    onlySocialSelfPay,
    commercialReimbursed,
    withCommercialSelfPay,
    savedAmount,

    // 格式化输出
    formatTotalCost: totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    formatSocialReimbursed: socialReimbursed.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    formatOnlySocialSelfPay: onlySocialSelfPay.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    formatCommercialReimbursed: commercialReimbursed.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    formatWithCommercialSelfPay: withCommercialSelfPay.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    formatSavedAmount: savedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),

    reimbursementRatioTotal,
    socialReimburseRatioActual,
    inScopeRatioPercent: math.round(inScopeRatio * 100, 0),
    outScopeRatioPercent: math.round((1 - inScopeRatio) * 100, 0)
  };
}

module.exports = {
  calcCriticalIllness,
  calcLifeInsurance,
  calcMedicalReimburse
};
