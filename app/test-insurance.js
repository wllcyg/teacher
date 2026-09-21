// test-insurance.js
const assert = require('assert');
const {
  calcCriticalIllness,
  calcLifeInsurance,
  calcMedicalReimburse
} = require('./miniprogram/utils/calculators/insurance.js');

console.log('>>> 开始保险测算模块 3 项核心算法单元验证...\n');

// 1. 重疾险保额测算
const illnessRes = calcCriticalIllness({
  annualIncome: 200000,
  treatmentCost: 300000,
  rehabYears: 3,
  debtBalance: 600000,
  existingCoverage: 200000,
  liquidAssets: 100000
});
console.log(`[1. 重疾保额] 基础保额: ${illnessRes.basicCoverageWan}万 充裕保额: ${illnessRes.comfortCoverageWan}万 保费区间: ${illnessRes.formatPremiumRange}`);
assert(illnessRes.basicCoverage > 0, '基础重疾保额应大于0');
assert(illnessRes.comfortCoverage > illnessRes.basicCoverage, '充裕版应高于基础版');
assert(illnessRes.incomeLossCompensation === 600000, '3年年薪补偿应为60万');

// 2. 寿险保额测算
const lifeRes = calcLifeInsurance({
  annualIncome: 180000,
  dutyYears: 20,
  totalDebt: 800000,
  childEducationFund: 300000,
  parentCareFund: 100000,
  annualLivingExpense: 80000,
  bufferYears: 5,
  netLiquidAssets: 100000,
  modelType: 'needs'
});
console.log(`[2. 寿险保额] 遗属需求建议: ${lifeRes.recommendedAmountWan}万 (收入损失法: ${lifeRes.incomeModelAmountWan}万)`);
assert(lifeRes.recommendedAmount > 0, '建议保额应大于0');
assert(lifeRes.familyLivingBuffer === 400000, '5年生活缓冲金应为40万');

// 3. 社保医保 vs 商业百万医疗险对比
const medicalRes = calcMedicalReimburse({
  totalCost: 500000,
  inScopeRatio: 0.6,
  socialReimburseRatio: 0.8,
  socialCap: 300000,
  commercialDeductible: 10000,
  commercialRatio: 1.0
});
console.log(`[3. 医疗报销对比] 总花费: ¥${medicalRes.formatTotalCost} 仅社保自付: ¥${medicalRes.formatOnlySocialSelfPay} 社保+商保自付: ¥${medicalRes.formatWithCommercialSelfPay} 省下: ¥${medicalRes.formatSavedAmount}`);
assert(medicalRes.socialReimbursed === 240000, '30万目录内报80%应为24万');
assert(medicalRes.onlySocialSelfPay === 260000, '仅社保自付应为26万');
assert(medicalRes.withCommercialSelfPay === 10000, '免赔额后自付应仅为1万免赔额');
assert(medicalRes.savedAmount === 250000, '百万医疗险为用户减负25万');

console.log('\n>>> 全部 3 项保险测算算法 100% 验证通过！');
