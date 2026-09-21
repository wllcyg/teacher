/**
 * app/test-finance.js
 * 储蓄理财模块 7 大算法纯函数验证测试脚本
 */
const assert = require('assert');
const {
  calcDepositInterest,
  calcCompoundDeposit,
  calcFundAIP,
  calcUniversalCompound,
  calcInflation,
  calcYieldConvert,
  calcFIRE
} = require('./miniprogram/utils/calculators/finance.js');

console.log('>>> 开始储蓄理财算法全面验证...\n');

// 1. 验证存款利息计算器 (单利)
{
  // 10万元存 3 年定期，年利率 1.50%
  const res = calcDepositInterest({
    principal: 100000,
    annualRate: 1.50,
    termType: 'year',
    termValue: 3
  });
  console.log('[1. 存款利息]', res.totalAmountFormatted, '利息:', res.totalInterestFormatted);
  assert.strictEqual(res.totalInterest, 4500);
  assert.strictEqual(res.totalAmount, 104500);
  assert.strictEqual(res.yieldPercent, 4.5);

  // 按月计息: 10万 6 个月，年化 1.00%
  const resMonth = calcDepositInterest({
    principal: 100000,
    annualRate: 1.00,
    termType: 'month',
    termValue: 6
  });
  assert.strictEqual(resMonth.totalInterest, 500);
  assert.strictEqual(resMonth.totalAmount, 100500);
}

// 2. 验证定期存款复利计算器
{
  // 10万元，名义年化 3.0%，存 5 年，按月复利 (m=12)
  const res = calcCompoundDeposit({
    principal: 100000,
    annualRate: 3.0,
    years: 5,
    compoundFrequency: 'monthly'
  });
  console.log('[2. 定期复利]', '本息:', res.totalAmountFormatted, '复利多赚:', res.extraGainFormatted, '有效年利率:', res.effectiveAnnualRate + '%');
  assert(res.totalAmount > 116000); // 100000 * (1 + 0.03/12)^60 = 116161.68
  assert.strictEqual(res.simpleInterest, 15000);
  assert(res.extraGain > 1100);
  assert(res.effectiveAnnualRate > 3.04);
}

// 3. 验证基金定投计算器 (等额定投复利终值)
{
  // 每月定投 1000 元，年化 8.0%，定投 10 年 (120期)
  const res = calcFundAIP({
    periodAmount: 1000,
    cycle: 'month',
    annualRate: 8.0,
    years: 10,
    timing: 'end'
  });
  console.log('[3. 基金定投]', '总本金:', res.totalPrincipalFormatted, '终值:', res.finalAssetFormatted, '总收益:', res.totalProfitFormatted);
  assert.strictEqual(res.totalPrincipal, 120000);
  assert(res.finalAsset > 180000); // 1000 * ((1+0.08/12)^120 - 1)/(0.08/12) ≈ 182946.04
  assert(res.sensitivityTable.length === 5);
}

// 4. 验证通用复利计算器 (含定期追加与逐年增长表)
{
  // 初始本金 5 万，每月追加 2000 元，年化 6.0%，投 5 年
  const res = calcUniversalCompound({
    initialPrincipal: 50000,
    regularAmount: 2000,
    regularFrequency: 'monthly',
    annualRate: 6.0,
    years: 5
  });
  console.log('[4. 通用复利追加]', '终值:', res.finalAssetFormatted, '累计本金:', res.totalPrincipalFormatted, '累计利息:', res.totalInterestFormatted);
  assert.strictEqual(res.schedule.length, 5);
  assert.strictEqual(res.totalPrincipal, 50000 + 2000 * 60); // 170000
  assert(res.finalAsset > 195000);
  assert(res.schedule[4].endBalance === res.finalAsset);
}

// 5. 验证通货膨胀与实际购买力计算器
{
  // 100 万元，预计通胀率 2.5%，20 年后
  const res = calcInflation({
    currentAmount: 1000000,
    inflationRate: 2.5,
    years: 20
  });
  console.log('[5. 通货膨胀]', '未来等值所需:', res.futureNeededFormatted, '当前资金购买力:', res.futurePowerFormatted, '缩水率:', res.depreciationRate + '%');
  assert(res.futureNeededAmount > 1600000); // 100万 * 1.025^20 ≈ 1638616.44
  assert(res.futurePurchasingPower < 620000); // 100万 / 1.025^20 ≈ 610270.94
  assert.strictEqual(res.depreciationRate, 39.0);
}

// 6. 验证理财收益率换算计算器
{
  // 日万份收益 0.65 -> 年化
  const res1 = calcYieldConvert({
    convertType: 'daily_to_annual',
    dailyTenThousand: 0.65
  });
  console.log('[6.1 日万份转年化]', res1.desc);
  assert.strictEqual(res1.annualRate, 2.373);

  // 90天封闭期收益率 0.95% -> 年化
  const res2 = calcYieldConvert({
    convertType: 'term_to_annual',
    termYield: 0.95,
    termDays: 90
  });
  console.log('[6.2 封闭期转年化]', res2.desc);
  assert(res2.annualRate > 3.8);

  // 10万本金，年化 3.5%，存 180 天实际收益
  const res3 = calcYieldConvert({
    convertType: 'actual_profit',
    principal: 100000,
    annualRate: 3.5,
    termDays: 180
  });
  console.log('[6.3 实际收益]', res3.desc);
  assert.strictEqual(res3.profit, 1726.03);
}

// 7. 验证 FIRE 财务自由提前退休计算器
{
  // 30岁，现有存款 20万，月收入 15000，月支出 6000 (年储蓄 (15000-6000)*12 = 108000)，预期回报率 6%，通胀 2.5%
  const res = calcFIRE({
    currentAge: 30,
    currentAssets: 200000,
    monthlyIncome: 15000,
    monthlyExpense: 6000,
    currentMonthlyExpense: 6000,
    expectedReturnRate: 6.0,
    inflationRate: 2.5,
    swrRate: 4.0
  });
  console.log('[7. FIRE 财务自由]', '经典目标资产:', res.targetClassicFormatted, '年储蓄:', res.annualSavingsFormatted, '达成年龄:', res.fireAge, '岁, 需耗时:', res.yearsNeeded, '年');
  assert.strictEqual(res.targetClassic, 6000 * 12 * 25); // 1,800,000
  assert.strictEqual(res.targetLean, 6000 * 12 * 20);    // 1,440,000
  assert.strictEqual(res.targetFat, Math.round((6000 * 12) / 0.03));   // 2,400,000
  assert(res.yearsNeeded > 5 && res.yearsNeeded < 20);
  assert(res.fireAge === 30 + res.yearsNeeded);
  assert(res.monthlyPassiveIncome === 6000);
  assert(res.trajectory.length > 0);
}

console.log('\n>>> 全部 7 项储蓄理财算法断言 100% 验证通过！');
