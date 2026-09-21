// pages/prepayment/prepayment.js
const { calcMortgageSummary, calcPrepaymentSummary } = require('../../utils/calculators/mortgage.js');
const { LPR_CONFIG } = require('../../utils/config/mortgage-lpr.js');
const math = require('../../utils/math.js');

Page({
  // 实例级防抖定时器 (不放在 data 中以避免序列化开销)
  calcTimer: null,

  data: {
    // 1. 原贷款参数
    originalLoanAmount: 100, // 万元
    annualRate: LPR_CONFIG.lpr5Year, // 3.10%
    originalYears: 30, // 年
    repaymentType: 'equal_installment', // equal_installment | equal_principal

    // 2. 已还情况与提前还款额
    paidYears: 2, // 已还年数
    paidMonthsPart: 0, // 已还月数余数
    prepayAmount: 20, // 提前还款额 (万元)

    // 3. 当前查看的方案对比重点
    activeOption: 'shorten_term', // shorten_term (缩短年限) | reduce_payment (减少月供)

    // 4. 计算结果状态 (赋初始值防真机初次渲染空指针)
    isCalculating: false,
    
    origSummary: {
      origMonthlyPayment: 0,
      remainPrincipalWan: 0,
      remainPrincipalYuan: 0,
      origRemainingInterestWan: 0,
      remainMonths: 0,
      remainYears: 0
    },
    planShorten: {
      savedInterestWan: 0,
      savedYears: 0,
      newRemainPrincipalWan: 0,
      newTotalInterestWan: 0,
      newPlan: {
        newMonthlyPayment: 0,
        newRemainingMonths: 0,
        newTotalInterest: 0
      }
    },
    planReduce: {
      savedInterestWan: 0,
      savedYears: 0,
      newRemainPrincipalWan: 0,
      newTotalInterestWan: 0,
      newPlan: {
        newMonthlyPayment: 0,
        newRemainingMonths: 0,
        newTotalInterest: 0
      }
    }
  },

  onLoad(options) {
    if (options.amount) {
      this.setData({
        originalLoanAmount: Number(options.amount) || 100,
        annualRate: Number(options.rate) || LPR_CONFIG.lpr5Year,
        originalYears: Number(options.years) || 30,
        repaymentType: options.repayment || 'equal_installment'
      });
    }
    this.runPrepaymentCalculation();
  },

  onUnload() {
    if (this.calcTimer) {
      clearTimeout(this.calcTimer);
      this.calcTimer = null;
    }
  },

  // 安全返回，防止多重并发调用
  onBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  // 高性能轻量防抖 (200ms 快速响应)
  debounceCalculation(immediate = false) {
    if (this.calcTimer) {
      clearTimeout(this.calcTimer);
      this.calcTimer = null;
    }

    if (immediate) {
      this.runPrepaymentCalculation();
    } else {
      this.calcTimer = setTimeout(() => {
        this.runPrepaymentCalculation();
      }, 200);
    }
  },

  // 切换还款方式 (等额本息 / 等额本金)
  onRepaymentTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.repaymentType) return;
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}
    this.setData({ repaymentType: type });
    this.debounceCalculation(true);
  },

  // 切换对比查看的重点方案卡片
  onOptionChange(e) {
    const activeOption = e.currentTarget.dataset.option;
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}
    this.setData({ activeOption });
  },

  // 输入原贷款金额
  onOrigAmountInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ originalLoanAmount: val });
    this.debounceCalculation();
  },

  // 输入原贷款利率
  onRateInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ annualRate: val });
    this.debounceCalculation();
  },

  // 输入原贷款年限
  onYearsInput(e) {
    const val = Number(e.detail.value) || 1;
    this.setData({ originalYears: Math.min(30, Math.max(1, val)) });
    this.debounceCalculation();
  },

  // 输入已还年数
  onPaidYearsInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ paidYears: Math.max(0, val) });
    this.debounceCalculation();
  },

  // 输入已还月数
  onPaidMonthsInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ paidMonthsPart: Math.max(0, Math.min(11, val)) });
    this.debounceCalculation();
  },

  // 输入本次提前还款金额
  onPrepayAmountInput(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ prepayAmount: val });
    this.debounceCalculation();
  },

  // 快捷点选提前还款金额
  onQuickPrepay(e) {
    const amount = Number(e.currentTarget.dataset.amount);
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}
    this.setData({ prepayAmount: amount });
    this.debounceCalculation(true);
  },

  // 执行高精度提前还款推演 (极速纯数学推演，< 0.1ms 完成)
  runPrepaymentCalculation() {
    try {
      const origLoanAmountWan = Number(this.data.originalLoanAmount) || 100;
      const rate = Number(this.data.annualRate) || LPR_CONFIG.lpr5Year;
      const years = Number(this.data.originalYears) || 30;
      const totalMonths = math.mul(years, 12);
      
      const totalPaidMonths = math.add(
        math.mul(Number(this.data.paidYears) || 0, 12),
        Number(this.data.paidMonthsPart) || 0
      );
      const mIndex = Math.min(Math.max(0, totalPaidMonths), totalMonths);

      // 1. 原贷款轻量计算 (不生成 360 期大数组，耗时 < 0.1ms)
      const origMortgage = calcMortgageSummary({
        loanType: 'commercial',
        commercialAmount: origLoanAmountWan,
        commercialRate: rate,
        years,
        repaymentType: this.data.repaymentType
      });

      // 2. 方案 A 与方案 B 纯数值闭式推演
      const planShorten = calcPrepaymentSummary({
        originalLoanAmount: origLoanAmountWan,
        annualRate: rate,
        originalYears: years,
        repaymentType: this.data.repaymentType,
        paidMonths: mIndex,
        prepayAmount: Number(this.data.prepayAmount) || 0,
        prepayOption: 'shorten_term'
      });

      const planReduce = calcPrepaymentSummary({
        originalLoanAmount: origLoanAmountWan,
        annualRate: rate,
        originalYears: years,
        repaymentType: this.data.repaymentType,
        paidMonths: mIndex,
        prepayAmount: Number(this.data.prepayAmount) || 0,
        prepayOption: 'reduce_payment'
      });

      const remainPrincipalYuan = planShorten.remainPrincipalBeforePrepay || 0;
      const remainPrincipalWan = math.round(math.div(remainPrincipalYuan, 10000), 2);
      const remainMonths = Math.max(0, totalMonths - mIndex);
      const r = rate / 100 / 12;

      let origRemainingInterest = 0;
      if (this.data.repaymentType === 'equal_installment') {
        origRemainingInterest = Math.max(0, math.sub(math.mul(origMortgage.monthlyPaymentFirst, remainMonths), remainPrincipalYuan));
      } else {
        origRemainingInterest = math.round(math.mul(math.mul(remainPrincipalYuan, r), math.div(remainMonths + 1, 2)), 2);
      }

      const origSummary = {
        origMonthlyPayment: origMortgage.monthlyPaymentFirst,
        remainPrincipalWan,
        remainPrincipalYuan,
        origRemainingInterestWan: math.round(math.div(origRemainingInterest, 10000), 2),
        remainMonths,
        remainYears: math.round(math.div(remainMonths, 12), 1)
      };

      planShorten.newRemainPrincipalWan = math.round(math.div(planShorten.newRemainPrincipal, 10000), 2);
      planShorten.newTotalInterestWan = math.round(math.div(planShorten.newPlan.newTotalInterest, 10000), 2);

      planReduce.newRemainPrincipalWan = math.round(math.div(planReduce.newRemainPrincipal, 10000), 2);
      planReduce.newTotalInterestWan = math.round(math.div(planReduce.newPlan.newTotalInterest, 10000), 2);

      // 直接毫秒级瞬时同步数据，无任何卡顿延迟
      this.setData({
        origSummary,
        planShorten,
        planReduce,
        isCalculating: false
      });
    } catch (error) {
      console.error('[提前还款计算异常]', error);
      this.setData({ isCalculating: false });
      wx.showToast({
        title: '参数计算异常，请检查',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 分享功能
  onShareAppMessage() {
    const savedWan = this.data.planShorten ? this.data.planShorten.savedInterestWan : 0;
    return {
      title: `测算房贷提前还款：最高能省下 ${savedWan} 万元利息！`,
      path: `/pages/prepayment/prepayment?amount=${this.data.originalLoanAmount}&years=${this.data.originalYears}&rate=${this.data.annualRate}&repayment=${this.data.repaymentType}`
    };
  }
});
