// pages/result/result.js
const { calcMortgage, calcPrepayment } = require('../../utils/calculators/mortgage.js');
const { LPR_CONFIG, FUND_RATE_CONFIG } = require('../../utils/config/mortgage-lpr.js');
const {
  calcSalaryMonthlyTax,
  calcSalaryReverse,
  calcSocialSecurity,
  calcSpecialDeductions,
  calcOvertimePay,
  calcSeverancePay
} = require('../../utils/calculators/salary.js');
const {
  CITY_SOCIAL_CONFIG,
  SPECIAL_DEDUCTIONS_CONFIG
} = require('../../utils/config/tax-social.js');
const {
  calcCarLoan,
  calcPurchaseTax,
  calcVehicleAndVesselTax,
  calcCarLandingPrice,
  calcCarDepreciation,
  calcFuelVsElectricCost
} = require('../../utils/calculators/car.js');
const math = require('../../utils/math.js');

Page({
  data: {
    type: 'mortgage', // mortgage | salary | fund | car | car_loan
    
    // ================= 1. 房贷部分状态 =================
    loanType: 'commercial', // commercial | fund | combination
    commercialAmount: 100,  // 万元
    fundAmount: 50,         // 万元
    years: 30,              // 贷款年限 (年)
    commercialRate: 3.10,   // 商贷利率 (%)
    fundRate: 2.85,         // 公积金利率 (%)
    repaymentType: 'equal_installment', // equal_installment | equal_principal
    mortgageResult: null,
    showSchedulePopup: false,
    latestLprRate: LPR_CONFIG.lpr5Year,
    latestFundRate: FUND_RATE_CONFIG.firstHome.over5Years,

    // ================= 2. 工资个税部分状态 =================
    salaryMode: 'forward', // forward (税前算税后) | reverse (税后倒推税前)
    preTaxSalary: 10000,   // 税前月薪 (默认1万)
    targetNetSalary: 8000, // 目标税后月薪 (倒推用)
    selectedCityKey: 'beijing', // 城市标识
    cityList: [
      { key: 'beijing', name: '北京' },
      { key: 'shanghai', name: '上海' },
      { key: 'guangzhou', name: '广州' },
      { key: 'shenzhen', name: '深圳' },
      { key: 'hangzhou', name: '杭州' },
      { key: 'chengdu', name: '成都' },
      { key: 'general', name: '其他城市' }
    ],
    isCustomSocial: false,
    customFundRatePercent: 12,
    babyCareCount: 0,
    childEduCount: 0,
    hasParents: 1,
    isOnlyChild: true,
    housingDeductionType: 'loan',
    rentTier: 1,
    continuingEduType: 'none',
    specialDeductionSummary: null,
    salaryResult: null,
    reverseResult: null,
    showSalarySchedulePopup: false,
    showSocialDetailPopup: false,
    showSpecialDeductionPopup: false,
    activeSubTool: 'none',
    overtimeWorkdayHours: 10,
    overtimeWeekendHours: 8,
    overtimeHolidayHours: 0,
    overtimeResult: null,
    severanceYears: 3.5,
    severanceIsNPlusOne: true,
    severanceResult: null,

    // ================= 3. 购车用车部分状态 =================
    carTab: 'landing', // 'landing'(落地与贷款) | 'running'(油电对比)
    carPowerType: 'fuel', // 'fuel'(燃油) | 'electric'(纯电) | 'phev'(插混)
    carPrice: 150000, // 裸车成交价 (元，默认15万)
    carPriceWan: 15,
    carDisplacement: 1.5, // 排量
    carSeatCount: 5, // 座位
    buyWay: 'loan', // 'full'(全款) | 'loan'(分期贷款)
    downPaymentRatio: 0.3, // 首付 30%
    carLoanMonths: 36, // 分期 36 期
    nominalRate: 3.0, // 名义年费率 (%)
    financeServiceFee: 3000, // 4S 店金融服务费 (元)
    
    // 养车对比输入
    annualMileage: 15000, // 年里程 (公里)
    fuelCarPrice: 150000,
    electricCarPrice: 165000,

    // 计算结果
    landingResult: null,
    carLoanResult: null,
    runningCostResult: null,
    depreciationResult: null,
    showCarSchedulePopup: false,
    showDepreciationPopup: false,

    // 防抖计时器
    calcTimer: null
  },

  onLoad(options) {
    const rawType = options.type || 'mortgage';
    let type = rawType;
    if (type === 'fund') {
      type = 'salary';
    } else if (type === 'car_loan') {
      type = 'car';
    }
    
    this.setData({ type }, () => {
      if (type === 'mortgage') {
        this.runMortgageCalculation();
      } else if (type === 'salary') {
        this.updateSpecialDeductionsAndRecalc();
        if (rawType === 'fund') {
          this.setData({ showSocialDetailPopup: true });
        }
      } else if (type === 'car') {
        this.runCarCalculation();
      }
    });
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  debounceCalculation(immediate = false, mode = 'mortgage') {
    if (this.data.calcTimer) {
      clearTimeout(this.data.calcTimer);
    }

    if (immediate) {
      if (mode === 'mortgage') this.runMortgageCalculation(true);
      else if (mode === 'salary') this.runSalaryCalculation(true);
      else if (mode === 'car') this.runCarCalculation(true);
    } else {
      const timer = setTimeout(() => {
        if (mode === 'mortgage') this.runMortgageCalculation(false);
        else if (mode === 'salary') this.runSalaryCalculation(false);
        else if (mode === 'car') this.runCarCalculation(false);
      }, 400);
      this.setData({ calcTimer: timer });
    }
  },

  // ================= 房贷事件处理器 =================
  onLoanTypeChange(e) {
    const loanType = e.currentTarget.dataset.type;
    this.setData({ loanType });
    this.debounceCalculation(true, 'mortgage');
  },

  onCommAmountInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ commercialAmount: val });
    this.debounceCalculation(false, 'mortgage');
  },

  onFundAmountInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ fundAmount: val });
    this.debounceCalculation(false, 'mortgage');
  },

  onConfirmInput() {
    wx.hideKeyboard();
    const { type } = this.data;
    if (type === 'mortgage') this.debounceCalculation(true, 'mortgage');
    else if (type === 'salary') this.debounceCalculation(true, 'salary');
    else if (type === 'car') this.debounceCalculation(true, 'car');
  },

  onBlurInput() {
    const { type } = this.data;
    if (type === 'mortgage') this.debounceCalculation(false, 'mortgage');
    else if (type === 'salary') this.debounceCalculation(false, 'salary');
    else if (type === 'car') this.debounceCalculation(false, 'car');
  },

  selectYears(e) {
    const years = Number(e.currentTarget.dataset.years) || 30;
    this.setData({ years });
    this.debounceCalculation(true, 'mortgage');
  },

  onCommRateInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ commercialRate: val });
    this.debounceCalculation(false, 'mortgage');
  },

  fillLatestLPR() {
    this.setData({ commercialRate: this.data.latestLprRate });
    this.debounceCalculation(true, 'mortgage');
    wx.showToast({ title: '已同步最新LPR 3.10%', icon: 'none' });
  },

  onRepaymentTypeChange(e) {
    const repaymentType = e.currentTarget.dataset.type;
    this.setData({ repaymentType });
    this.debounceCalculation(true, 'mortgage');
  },

  runMortgageCalculation(withLoading = false) {
    if (withLoading) {
      wx.showLoading({ title: '正在精准测算...', mask: false });
    }

    const {
      loanType,
      commercialAmount,
      commercialRate,
      fundAmount,
      fundRate,
      years,
      repaymentType
    } = this.data;

    const res = calcMortgage({
      loanType,
      commercialAmount,
      commercialRate,
      fundAmount,
      fundRate,
      years,
      repaymentType
    });

    if (withLoading) {
      setTimeout(() => {
        wx.hideLoading();
        this.setData({ mortgageResult: res });
      }, 150);
    } else {
      this.setData({ mortgageResult: res });
    }
  },

  toggleSchedulePopup() {
    this.setData({ showSchedulePopup: !this.data.showSchedulePopup });
  },

  // ================= 工资个税事件处理器 =================
  onSalaryModeChange(e) {
    const salaryMode = e.currentTarget.dataset.mode;
    this.setData({ salaryMode });
    this.runSalaryCalculation(true);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  onPreTaxSalaryInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ preTaxSalary: val });
    this.debounceCalculation(false, 'salary');
  },

  selectSalaryPreset(e) {
    const val = Number(e.currentTarget.dataset.val) || 10000;
    this.setData({ preTaxSalary: val });
    this.debounceCalculation(true, 'salary');
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  onTargetNetInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ targetNetSalary: val });
    this.debounceCalculation(false, 'salary');
  },

  selectCity(e) {
    const cityKey = e.currentTarget.dataset.key;
    this.setData({ selectedCityKey: cityKey });
    this.runSalaryCalculation(true);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  selectFundRate(e) {
    const ratePercent = Number(e.currentTarget.dataset.rate) || 12;
    this.setData({ customFundRatePercent: ratePercent });
    this.runSalaryCalculation(true);
  },

  toggleSpecialDeductionPopup() {
    this.setData({
      showSpecialDeductionPopup: !this.data.showSpecialDeductionPopup
    });
  },

  toggleSocialDetailPopup() {
    this.setData({
      showSocialDetailPopup: !this.data.showSocialDetailPopup
    });
  },

  toggleSalarySchedulePopup() {
    this.setData({
      showSalarySchedulePopup: !this.data.showSalarySchedulePopup
    });
  },

  changeSpecialCount(e) {
    const field = e.currentTarget.dataset.field;
    const delta = Number(e.currentTarget.dataset.delta);
    const cur = this.data[field] || 0;
    const nextVal = Math.max(0, cur + delta);
    this.setData({ [field]: nextVal });
    this.updateSpecialDeductionsAndRecalc();
  },

  toggleOnlyChild(e) {
    const val = e.currentTarget.dataset.val === 'true';
    this.setData({ isOnlyChild: val });
    this.updateSpecialDeductionsAndRecalc();
  },

  selectHousingType(e) {
    const val = e.currentTarget.dataset.type;
    this.setData({ housingDeductionType: val });
    this.updateSpecialDeductionsAndRecalc();
  },

  updateSpecialDeductionsAndRecalc() {
    const {
      babyCareCount,
      childEduCount,
      hasParents,
      isOnlyChild,
      housingDeductionType,
      rentTier,
      continuingEduType
    } = this.data;

    const specialSummary = calcSpecialDeductions({
      babyCareCount,
      childEduCount,
      hasParents,
      isOnlyChild,
      housingDeductionType,
      rentTier,
      continuingEduType
    });

    this.setData({ specialDeductionSummary: specialSummary }, () => {
      this.runSalaryCalculation(false);
    });
  },

  runSalaryCalculation(withLoading = false) {
    if (withLoading) {
      wx.showLoading({ title: '正在精准测算...', mask: false });
    }

    const {
      salaryMode,
      preTaxSalary,
      targetNetSalary,
      selectedCityKey,
      customFundRatePercent,
      specialDeductionSummary
    } = this.data;

    const specialDeduction = specialDeductionSummary ? specialDeductionSummary.monthlyTotal : 0;
    const customFundRate = customFundRatePercent / 100;

    if (salaryMode === 'forward') {
      const res = calcSalaryMonthlyTax({
        monthlySalary: preTaxSalary,
        cityKey: selectedCityKey,
        specialDeduction,
        customFundRate
      });

      if (withLoading) {
        setTimeout(() => {
          wx.hideLoading();
          this.setData({ salaryResult: res });
        }, 120);
      } else {
        this.setData({ salaryResult: res });
      }
    } else {
      const revRes = calcSalaryReverse({
        targetAfterTax: targetNetSalary,
        cityKey: selectedCityKey,
        specialDeduction
      });

      if (withLoading) {
        setTimeout(() => {
          wx.hideLoading();
          this.setData({
            reverseResult: revRes,
            salaryResult: revRes.detail
          });
        }, 120);
      } else {
        this.setData({
          reverseResult: revRes,
          salaryResult: revRes.detail
        });
      }
    }
  },

  openSubTool(e) {
    const tool = e.currentTarget.dataset.tool;
    this.setData({ activeSubTool: tool });
    if (tool === 'overtime') {
      this.runOvertimeCalc();
    } else if (tool === 'severance') {
      this.runSeveranceCalc();
    }
  },

  closeSubTool() {
    this.setData({ activeSubTool: 'none' });
  },

  onOvertimeHoursInput(e) {
    const field = e.currentTarget.dataset.field;
    const val = Number(e.detail.value) || 0;
    this.setData({ [field]: val }, () => {
      this.runOvertimeCalc();
    });
  },

  runOvertimeCalc() {
    const res = calcOvertimePay({
      monthlySalary: this.data.preTaxSalary,
      workdayHours: this.data.overtimeWorkdayHours,
      weekendHours: this.data.overtimeWeekendHours,
      holidayHours: this.data.overtimeHolidayHours
    });
    this.setData({ overtimeResult: res });
  },

  onSeveranceInput(e) {
    const field = e.currentTarget.dataset.field;
    const val = Number(e.detail.value) || 0;
    this.setData({ [field]: val }, () => {
      this.runSeveranceCalc();
    });
  },

  toggleNPlusOne() {
    this.setData({
      severanceIsNPlusOne: !this.data.severanceIsNPlusOne
    }, () => {
      this.runSeveranceCalc();
    });
  },

  runSeveranceCalc() {
    const res = calcSeverancePay({
      avgSalary: this.data.preTaxSalary,
      workYears: this.data.severanceYears,
      cityKey: this.data.selectedCityKey,
      isNPlusOne: this.data.severanceIsNPlusOne
    });
    this.setData({ severanceResult: res });
  },

  // ================= 3. 购车用车事件处理器 =================
  // 切换购车大模块 Tab (落地与贷款 / 油电养车)
  onCarTabChange(e) {
    const carTab = e.currentTarget.dataset.tab;
    this.setData({ carTab });
    this.runCarCalculation(true);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 切换动力类型 (燃油 / 纯电 / 插混)
  onPowerTypeChange(e) {
    const carPowerType = e.currentTarget.dataset.power;
    this.setData({ carPowerType });
    this.runCarCalculation(true);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 输入裸车价格 (万元换算)
  onCarPriceInput(e) {
    const valWan = Number(e.detail.value) || 0;
    const carPrice = math.round(valWan * 10000, 2);
    this.setData({ carPrice, carPriceWan: valWan });
    this.debounceCalculation(false, 'car');
  },

  // 快捷车价预设
  selectCarPricePreset(e) {
    const valWan = Number(e.currentTarget.dataset.val) || 15;
    const carPrice = valWan * 10000;
    this.setData({ carPrice, carPriceWan: valWan });
    this.debounceCalculation(true, 'car');
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 切换全款 / 分期
  onBuyWayChange(e) {
    const buyWay = e.currentTarget.dataset.way;
    this.setData({ buyWay });
    this.debounceCalculation(true, 'car');
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 选择首付比例
  selectDownPaymentRatio(e) {
    const downPaymentRatio = Number(e.currentTarget.dataset.ratio) || 0.3;
    this.setData({ downPaymentRatio });
    this.debounceCalculation(true, 'car');
  },

  // 选择分期期数
  selectCarLoanMonths(e) {
    const carLoanMonths = Number(e.currentTarget.dataset.months) || 36;
    this.setData({ carLoanMonths });
    this.debounceCalculation(true, 'car');
  },

  // 输入名义年利率
  onNominalRateInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ nominalRate: val });
    this.debounceCalculation(false, 'car');
  },

  // 输入金融服务费
  onFinanceFeeInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ financeServiceFee: val });
    this.debounceCalculation(false, 'car');
  },

  // 输入年行驶里程
  onAnnualMileageInput(e) {
    const val = Number(e.detail.value) || 15000;
    this.setData({ annualMileage: val });
    this.debounceCalculation(false, 'car');
  },

  // 展开车贷账单明细
  toggleCarSchedulePopup() {
    this.setData({ showCarSchedulePopup: !this.data.showCarSchedulePopup });
  },

  // 展开二手车保值率折旧抽屉
  toggleDepreciationPopup() {
    this.setData({ showDepreciationPopup: !this.data.showDepreciationPopup });
  },

  // 执行购车用车全套综合计算
  runCarCalculation(withLoading = false) {
    if (withLoading) {
      wx.showLoading({ title: '正在精准测算...', mask: false });
    }

    const {
      carPrice,
      carPowerType,
      carDisplacement,
      carSeatCount,
      downPaymentRatio,
      carLoanMonths,
      nominalRate,
      financeServiceFee,
      annualMileage
    } = this.data;

    // 1. 全包落地价计算
    const landingRes = calcCarLandingPrice({
      carPrice,
      powerType: carPowerType,
      displacement: carDisplacement,
      seatCount: carSeatCount
    });

    // 2. 车贷分期与真实 IRR 计算
    const loanRes = calcCarLoan({
      carPrice,
      downPaymentRatio,
      totalMonths: carLoanMonths,
      nominalAnnualRate: nominalRate,
      financeServiceFee
    });

    // 3. 油电用车成本对比
    const runningRes = calcFuelVsElectricCost({
      annualMileage,
      fuelCarPrice: carPrice,
      electricCarPrice: math.round(carPrice * 1.1, 0)
    });

    // 4. 二手车保值率折旧推演
    const deprRes = calcCarDepreciation({
      carPrice,
      carAgeYears: 3,
      mileageKm: annualMileage * 3
    });

    if (withLoading) {
      setTimeout(() => {
        wx.hideLoading();
        this.setData({
          landingResult: landingRes,
          carLoanResult: loanRes,
          runningCostResult: runningRes,
          depreciationResult: deprRes
        });
      }, 120);
    } else {
      this.setData({
        landingResult: landingRes,
        carLoanResult: loanRes,
        runningCostResult: runningRes,
        depreciationResult: deprRes
      });
    }
  },

  // 跳转年终奖对比
  goToCompare() {
    wx.navigateTo({
      url: `/pages/compare/compare?salary=${this.data.preTaxSalary}&city=${this.data.selectedCityKey}`
    });
  },

  // 跳转生成海报
  goToPoster() {
    wx.navigateTo({
      url: '/pages/poster/poster'
    });
  }
});
