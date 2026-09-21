// pages/compare/compare.js
const { calcAnnualBonus } = require('../../utils/calculators/salary.js');
const { BONUS_BLIND_ZONES, CITY_SOCIAL_CONFIG } = require('../../utils/config/tax-social.js');

Page({
  data: {
    annualBonus: 50000,
    monthlySalary: 15000,
    cityKey: 'beijing',
    cityName: '北京',
    specialDeduction: 2000,

    // 快捷选项
    bonusPresets: [30000, 36000, 50000, 100000, 144000],

    // 计算结果
    result: null,

    // 防抖计时器
    calcTimer: null
  },

  onLoad(options) {
    if (options.bonus) {
      this.setData({ annualBonus: Number(options.bonus) || 50000 });
    }
    if (options.salary) {
      this.setData({ monthlySalary: Number(options.salary) || 15000 });
    }
    if (options.city) {
      this.setData({ cityKey: options.city });
    }
    this.runCalculation();
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  debounceCalculation(immediate = false) {
    if (this.data.calcTimer) {
      clearTimeout(this.data.calcTimer);
    }
    if (immediate) {
      this.runCalculation();
    } else {
      const timer = setTimeout(() => {
        this.runCalculation();
      }, 350);
      this.setData({ calcTimer: timer });
    }
  },

  // 1. 输入年终奖
  onBonusInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ annualBonus: val });
    this.debounceCalculation();
  },

  // 快捷选择年终奖
  selectBonusPreset(e) {
    const val = Number(e.currentTarget.dataset.val) || 50000;
    this.setData({ annualBonus: val });
    this.debounceCalculation(true);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  // 2. 输入平时月薪
  onSalaryInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ monthlySalary: val });
    this.debounceCalculation();
  },

  // 3. 一键采用避坑安全金额
  applySafeAmount(e) {
    const safeAmount = Number(e.currentTarget.dataset.amount);
    if (safeAmount) {
      this.setData({ annualBonus: safeAmount });
      this.debounceCalculation(true);
      wx.showToast({
        title: `已调整为安全金额 ¥${safeAmount}`,
        icon: 'none'
      });
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
    }
  },

  // 执行计算
  runCalculation() {
    const { annualBonus, monthlySalary, cityKey, specialDeduction } = this.data;
    const res = calcAnnualBonus({
      annualBonus,
      monthlySalary,
      cityKey,
      specialDeduction
    });

    // 格式化看板数字拆分
    let diffInteger = '0';
    let diffDecimal = '.00';
    if (res && res.formatDiffTax) {
      const parts = res.formatDiffTax.split('.');
      diffInteger = parts[0] || '0';
      diffDecimal = parts[1] ? '.' + parts[1] : '.00';
    }

    this.setData({
      result: res,
      diffInteger,
      diffDecimal
    });
  },

  navigateToPoster() {
    wx.navigateTo({
      url: '/pages/poster/poster'
    });
  }
});
