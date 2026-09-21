// components/calc-salary/calc-salary.js
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

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    initialOptions: {
      type: Object,
      value: null,
      observer(val) {
        if (val) this.initFromOptions(val);
      }
    }
  },

  data: {
    salaryMode: 'forward', // forward | reverse
    preTaxSalary: 15000,
    targetNetSalary: 12000,
    cityList: [
      { key: 'beijing', name: '北京' },
      { key: 'shanghai', name: '上海' },
      { key: 'guangzhou', name: '广州' },
      { key: 'shenzhen', name: '深圳' },
      { key: 'hangzhou', name: '杭州' },
      { key: 'chengdu', name: '成都' },
      { key: 'wuhan', name: '武汉' }
    ],
    selectedCityKey: 'beijing',
    customFundRatePercent: 12,

    // 专项扣除
    babyCareCount: 0,
    childEduCount: 0,
    hasParents: true,
    isOnlyChild: true,
    housingDeductionType: 'none',
    rentTier: 'tier1',
    continuingEduType: 'none',
    specialDeductionSummary: null,

    // 结果
    salaryResult: null,
    reverseResult: null,

    // 抽屉
    showSpecialDeductionPopup: false,
    showSocialDetailPopup: false,
    showSalarySchedulePopup: false,

    // 子工具
    activeSubTool: 'none',
    overtimeWorkdayHours: 10,
    overtimeWeekendHours: 8,
    overtimeHolidayHours: 0,
    overtimeResult: null,
    severanceYears: 3,
    severanceLastSalary: 15000,
    severanceIsNPlusOne: true,
    severanceResult: null,

    calcTimer: null
  },

  lifetimes: {
    attached() {
      if (this.properties.initialOptions) {
        this.initFromOptions(this.properties.initialOptions);
      } else {
        this.updateSpecialDeductionsAndRecalc();
      }
    }
  },

  methods: {
    initFromOptions(opts) {
      const updates = {};
      if (opts.salaryMode) updates.salaryMode = opts.salaryMode;
      if (opts.grossSalary) updates.preTaxSalary = Number(opts.grossSalary) || 15000;
      if (opts.city) updates.selectedCityKey = opts.city;
      if (opts.rawType === 'fund') updates.showSocialDetailPopup = true;
      this.setData(updates, () => {
        this.updateSpecialDeductionsAndRecalc();
      });
    },

    onSalaryModeChange(e) {
      const salaryMode = e.currentTarget.dataset.mode;
      this.setData({ salaryMode });
      this.runSalaryCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    },

    onPreTaxSalaryInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ preTaxSalary: val });
      this.debounceCalculation(false);
    },

    selectSalaryPreset(e) {
      const val = Number(e.currentTarget.dataset.val) || 10000;
      this.setData({ preTaxSalary: val });
      this.debounceCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    },

    onTargetNetInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ targetNetSalary: val });
      this.debounceCalculation(false);
    },

    onConfirmInput() {
      wx.hideKeyboard();
      this.debounceCalculation(true);
    },

    onBlurInput() {
      this.debounceCalculation(false);
    },

    selectCity(e) {
      const cityKey = e.currentTarget.dataset.key;
      this.setData({ selectedCityKey: cityKey });
      this.runSalaryCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
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

    debounceCalculation(immediate = false) {
      if (this.data.calcTimer) {
        clearTimeout(this.data.calcTimer);
      }
      if (immediate) {
        this.runSalaryCalculation(true);
      } else {
        const timer = setTimeout(() => {
          this.runSalaryCalculation(false);
        }, 400);
        this.setData({ calcTimer: timer });
      }
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
        years: this.data.severanceYears,
        monthlySalary: this.data.preTaxSalary,
        cityKey: this.data.selectedCityKey,
        isNPlusOne: this.data.severanceIsNPlusOne
      });
      this.setData({ severanceResult: res });
    },

    goToCompare() {
      wx.navigateTo({
        url: '/pages/compare/compare',
        fail: () => {
          wx.redirectTo({ url: '/pages/compare/compare' });
        }
      });
    }
  }
});
