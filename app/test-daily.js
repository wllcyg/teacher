/**
 * app/test-daily.js
 * 生活日常模块 23 项纯函数算法极限测试套件
 */

const assert = require('assert');
const {
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
  // 3. 健康生活
  calcBMI,
  calcPregnancy,
  calcAnniversary,
  calcWeddingBudget,
  // 4. 公用事业
  calcElectricityCost,
  calcWaterCost,
  calcExpressFreight,
  calcParkingFee,
  calcDiscountPromotion
} = require('./miniprogram/utils/calculators/daily.js');

console.log('>>> 开始生活日常模块 23 项算法全面验证...\n');

// -------------------------------------------------------------
// 1. 装修建材组
// -------------------------------------------------------------
{
  // 1.1 装修综合预算: 100㎡ 舒适精装 (1600元/㎡)
  const res = calcRenovationBudget({ houseArea: 100, tierKey: 'standard' });
  console.log('[1.1 装修预算]', res.totalBudgetFormatted, '主材:', res.breakdown[0].amount);
  assert.strictEqual(res.totalBudget, 160000);
  assert.strictEqual(res.totalBudgetWan, 16);
  assert.strictEqual(res.breakdown[0].amount, 76800); // 48%
  assert.strictEqual(res.breakdown[1].amount, 48000); // 30%
}

{
  // 1.2 瓷砖用量: 50㎡，800x800砖，损耗8%，每箱3片
  const res = calcTileUsage({ area: 50, tileLengthMm: 800, tileWidthMm: 800, lossRatePercent: 8, pcsPerBox: 3 });
  console.log('[1.2 瓷砖用量]', '理论片数:', res.theoreticalPieces, '实际需购:', res.actualPieces, '箱数:', res.boxes);
  assert.strictEqual(res.singleTileArea, 0.64);
  assert(res.actualPieces >= 84);
  assert.strictEqual(res.boxes * 3, res.totalBoughtPieces);
}

{
  // 1.3 墙面涂料: 120㎡，刷2遍，涂刷率12，5L/桶
  const res = calcPaintUsage({ wallArea: 120, coats: 2, coverageRate: 12, bucketLiters: 5 });
  console.log('[1.3 墙面涂料]', '涂刷面积:', res.totalAreaToPaint, '升数:', res.litersNeeded, '桶数:', res.bucketsNeeded);
  assert.strictEqual(res.totalAreaToPaint, 240);
  assert.strictEqual(res.litersNeeded, 20);
  assert.strictEqual(res.bucketsNeeded, 4);
}

{
  // 1.4 地板用量: 30㎡，平铺 (5%损耗)
  const res = calcFlooringUsage({ roomArea: 30, floorLengthMm: 1215, floorWidthMm: 195, method: 'straight' });
  console.log('[1.4 地板用量]', '需购片数:', res.actualPieces, '整箱数:', res.boxes);
  assert(res.actualPieces > 120);
  assert(res.boxes > 0);
}

{
  // 1.5 壁纸用量: 周长15m，层高2.8m，幅宽0.53m，卷长10m
  const res = calcWallpaperUsage({ roomPerimeter: 15, ceilingHeight: 2.8, rollWidthM: 0.53, rollLengthM: 10 });
  console.log('[1.5 壁纸用量]', '总条数:', res.totalStripsNeeded, '卷数:', res.rollsNeeded);
  assert.strictEqual(res.stripsPerRoll, 3);
  assert.strictEqual(res.totalStripsNeeded, 29);
  assert.strictEqual(res.rollsNeeded, 10);
}

{
  // 1.6 窗帘布料: 窗宽3m，褶皱2倍
  const res = calcCurtainUsage({ windowWidthM: 3.0, windowHeightM: 2.6, foldRatio: 2.0 });
  console.log('[1.6 窗帘布料]', '成品宽:', res.finishedWidth, '购买米数:', res.fabricMetersNeeded);
  assert.strictEqual(res.finishedWidth, 6.0);
  assert.strictEqual(res.fabricMetersNeeded, 6.3);
}

// -------------------------------------------------------------
// 2. 职场民生组
// -------------------------------------------------------------
{
  // 2.1 日期相差
  const res = calcDateDiff({ startDate: '2026-01-01', endDate: '2026-01-15' });
  console.log('[2.1 日期相差]', res.summaryText);
  assert.strictEqual(res.naturalDays, 14);
  assert.strictEqual(res.fullWeeks, 2);
  assert.strictEqual(res.workDays, 10);
}

{
  // 2.2 周岁与年龄
  const res = calcAgeAndZodiac({ birthDate: '1995-05-20', targetDate: '2026-09-21' });
  console.log('[2.2 周岁年龄]', '实岁:', res.age, '虚岁:', res.nominalAge, '生肖:', res.zodiac, '星座:', res.constellation);
  assert.strictEqual(res.age, 31);
  assert.strictEqual(res.nominalAge, 32);
  assert.strictEqual(res.zodiac, '猪');
  assert.strictEqual(res.constellation, '金牛座');
}

{
  // 2.3 渐进式延迟退休 (男职工，1970年1月出生，原60岁退休时间为2030年1月)
  // 2030年1月距离2025年1月 = 60个月，每4个月延1个月 -> floor(60/4) + 1 = 16个月
  const res = calcDelayRetirement({ birthYear: 1970, birthMonth: 1, categoryKey: 'male' });
  console.log('[2.3 延迟退休]', res.summary);
  assert.strictEqual(res.originalRetireYear, 2030);
  assert.strictEqual(res.delayMonths, 16);
  assert.strictEqual(res.actualRetireYear, 2031);
  assert.strictEqual(res.actualRetireMonth, 5);
  assert.strictEqual(res.actualAgeYears, 61);
  assert.strictEqual(res.actualAgeMonths, 4);

  // 女职工女干部 (1965年1月出生，原55岁退休时间 2020年1月 < 2025年1月，不延迟)
  const resOld = calcDelayRetirement({ birthYear: 1965, birthMonth: 1, categoryKey: 'femaleCadre' });
  assert.strictEqual(resOld.delayMonths, 0);

  // 女工人 (1980年1月出生，原50岁退休 2030年1月，每2个月延1个月，上限60个月)
  const resWorker = calcDelayRetirement({ birthYear: 1980, birthMonth: 1, categoryKey: 'femaleWorker' });
  assert.strictEqual(resWorker.delayMonths, 31); // floor(60/2) + 1 = 31
}

{
  // 2.4 工龄与连续工龄
  const res = calcWorkAge({
    periods: [
      { startDate: '2020-01-01', endDate: '2021-12-31' }, // 2年 = 731天
      { startDate: '2022-01-01', endDate: '2023-12-31' }  // 2年 = 730天
    ]
  });
  console.log('[2.4 累计工龄]', res.summary);
  assert.strictEqual(res.fullYears, 4);
}

{
  // 2.5 年休假天数
  const res1 = calcAnnualLeave({ totalWorkYears: 5 });
  const res2 = calcAnnualLeave({ totalWorkYears: 12 });
  const res3 = calcAnnualLeave({ totalWorkYears: 25 });
  console.log('[2.5 年休假]', '5年工龄:', res1.standardDays, '天; 12年工龄:', res2.standardDays, '天; 25年工龄:', res3.standardDays, '天');
  assert.strictEqual(res1.standardDays, 5);
  assert.strictEqual(res2.standardDays, 10);
  assert.strictEqual(res3.standardDays, 15);
}

{
  // 2.6 社保最低年限
  const res = calcSocialMinYears({ currentPaidYears: 12, retireYear: 2035 });
  console.log('[2.6 社保门槛]', '2035年门槛:', res.requiredYears, '年;', res.statusText);
  assert.strictEqual(res.requiredYears, 18); // 15 + (2035-2030+1)*0.5 = 18
  assert.strictEqual(res.isSatisfied, false);
  assert.strictEqual(res.gapYears, 6);
}

{
  // 2.7 职工养老金预估
  const res = calcPensionEstimate({
    mode: 'tiered',
    cityKey: 'beijing',
    contribYears: 30,
    currentWage: 12000,
    tierRatio: 1.0,
    retiredAge: 60
  });
  console.log('[2.7 养老金预估]', '月发:', res.totalMonthlyPensionFormatted, '替代率:', res.replacementRate + '%', '回本:', res.paybackYears + '年');
  assert(res.totalMonthlyPension > 4000);
  assert(res.basePension > 3000);
}

{
  // 2.8 女职工生育津贴
  const res = calcMaternityAllowance({ companyAvgSalary: 12000, provinceKey: 'beijing' });
  console.log('[2.8 生育津贴]', res.totalAllowanceFormatted, '天数:', res.totalDays);
  assert.strictEqual(res.totalDays, 158); // 98 + 60
  assert.strictEqual(res.dailyAllowance, 400);
  assert.strictEqual(res.totalAllowance, 63200);
}

// -------------------------------------------------------------
// 3. 健康生活与家庭仪式组
// -------------------------------------------------------------
{
  // 3.1 BMI
  const res = calcBMI({ heightCm: 175, weightKg: 68 });
  console.log('[3.1 BMI健康]', 'BMI:', res.bmi, '级别:', res.levelLabel, '建议:', res.diffAdvice);
  assert.strictEqual(res.bmi, 22.2);
  assert.strictEqual(res.level, 'normal');
}

{
  // 3.2 孕期预产期
  const res = calcPregnancy({ lastMenstrualDate: '2026-01-01', targetDate: '2026-06-01' });
  console.log('[3.2 预产期]', '预产日:', res.dueDateString, '阶段:', res.trimester, '进度:', res.progressPercent + '%');
  assert.strictEqual(res.dueYear, 2026);
  assert.strictEqual(res.dueMonth, 10);
  assert.strictEqual(res.dueDay, 8);
  assert(res.currentWeek > 20);
}

{
  // 3.3 纪念日
  const res = calcAnniversary({ anniversaryDate: '2020-01-01', targetDate: '2026-01-01' });
  console.log('[3.3 纪念日]', '相守天数:', res.daysPassed, '下个百天:', res.nextHundredDays, '婚礼阶段:', res.nextWeddingMilestone.name);
  assert(res.daysPassed >= 2191);
  assert.strictEqual(res.nextWeddingMilestone.name, '锡婚 (10年)');
}

{
  // 3.4 婚礼预算
  const res = calcWeddingBudget({ totalBudget: 200000 });
  console.log('[3.4 婚礼预算]', res.totalBudgetFormatted, '婚宴酒席:', res.items[0].amountFormatted);
  assert.strictEqual(res.totalBudgetWan, 20);
  assert.strictEqual(res.items[0].amount, 90000); // 45%
  assert.strictEqual(res.items[1].amount, 30000); // 15%
}

// -------------------------------------------------------------
// 4. 公用事业与生活消费组
// -------------------------------------------------------------
{
  // 4.1 阶梯电费: 月用电 300 度 (一档 240度@0.50, 二档 60度@0.55)
  const res = calcElectricityCost({ kwh: 300, period: 'month' });
  console.log('[4.1 阶梯电费]', '总电费:', res.totalCostFormatted, '均价:', res.avgUnitPrice);
  assert.strictEqual(res.totalCost, 120 + 33); // 153
}

{
  // 4.2 阶梯水费: 200m³ (一阶梯 180m³@5, 二阶梯 20m³@7)
  const res = calcWaterCost({ m3: 200 });
  console.log('[4.2 阶梯水费]', '总水费:', res.totalCostFormatted);
  assert.strictEqual(res.totalCost, 900 + 140); // 1040
}

{
  // 4.3 快递运费: 实际 2kg, 尺寸 30x30x30 (体积重 = 27000/6000 = 4.5kg)
  const res = calcExpressFreight({ actualWeightKg: 2, lengthCm: 30, widthCm: 30, heightCm: 30, templateKey: 'standard' });
  console.log('[4.3 快递运费]', '计费重量:', res.chargeWeightKg + 'kg', '运费:', res.freightFormatted);
  assert.strictEqual(res.chargeWeightKg, 4.5);
  // 首重1kg(10元) + 续重4kg(4*4=16元) = 26元
  assert.strictEqual(res.freight, 26);
}

{
  // 4.4 停车费: 停车 90 分钟 (超15分免费，计费2小时，首小时10元+第2小时6元 = 16元)
  const res = calcParkingFee({ parkingMinutes: 90, templateKey: 'commercial' });
  console.log('[4.4 停车费]', res.totalFeeFormatted, '计费小时:', res.billableHours);
  assert.strictEqual(res.billableHours, 2);
  assert.strictEqual(res.totalFee, 16);
}

{
  // 4.5 满减促销: 原价 850 元，每满 300 减 50，店铺券 20，平台红包 10
  // 满减次数 2 次 -> 减 100，总减 130，实付 720
  const res = calcDiscountPromotion({ originTotal: 850, crossShopThreshold: 300, crossShopReduction: 50, shopCoupon: 20, platformCoupon: 10 });
  console.log('[4.5 满减促销]', '原价:', res.originTotal, '实付:', res.finalPayFormatted, '折扣:', res.discountRateText);
  assert.strictEqual(res.totalDiscount, 130);
  assert.strictEqual(res.finalPay, 720);
  assert.strictEqual(res.discountRate, 8.5);
}

console.log('\n>>> 全部 23 项生活日常算法 100% 验证通过！');
