// components/calc-mortgage/calc-mortgage.js
const { calcMortgage } = require('../../utils/calculators/mortgage.js');
const { LPR_CONFIG, FUND_RATE_CONFIG } = require('../../utils/config/mortgage-lpr.js');

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
    loanType: 'commercial', // commercial | fund | combination
    commercialAmount: 100,  // 万元
    fundAmount: 50,         // 万元
    years: 30,              // 贷款年限
    repaymentType: 'equal_installment', // equal_installment | equal_principal
    commercialRate: 3.10,   // 最新 LPR 3.10%
    fundRate: 2.85,         // 首套公积金 2.85%
    latestLprRate: 3.10,
    mortgageResult: null,
    showSchedulePopup: false,
    calcTimer: null
  },

  lifetimes: {
    attached() {
      if (this.properties.initialOptions) {
        this.initFromOptions(this.properties.initialOptions);
      } else {
        this.runCalculation(false);
      }
    }
  },

  methods: {
    initFromOptions(opts) {
      const updates = {};
      if (opts.loanType) updates.loanType = opts.loanType;
      if (opts.commercialAmount) updates.commercialAmount = Number(opts.commercialAmount) || 100;
      if (opts.fundAmount) updates.fundAmount = Number(opts.fundAmount) || 50;
      if (opts.years) updates.years = Number(opts.years) || 30;
      if (opts.rate) updates.commercialRate = Number(opts.rate) || 3.10;
      this.setData(updates, () => {
        this.runCalculation(false);
      });
    },

    onLoanTypeChange(e) {
      const loanType = e.currentTarget.dataset.type;
      this.setData({ loanType });
      this.debounceCalculation(true);
    },

    onCommAmountInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ commercialAmount: val });
      this.debounceCalculation(false);
    },

    onFundAmountInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ fundAmount: val });
      this.debounceCalculation(false);
    },

    onConfirmInput() {
      wx.hideKeyboard();
      this.debounceCalculation(true);
    },

    onBlurInput() {
      this.debounceCalculation(false);
    },

    selectYears(e) {
      const years = Number(e.currentTarget.dataset.years) || 30;
      this.setData({ years });
      this.debounceCalculation(true);
    },

    onCommRateInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ commercialRate: val });
      this.debounceCalculation(false);
    },

    fillLatestLPR() {
      this.setData({ commercialRate: this.data.latestLprRate });
      this.debounceCalculation(true);
      wx.showToast({ title: '已同步最新LPR 3.10%', icon: 'none' });
    },

    onRepaymentTypeChange(e) {
      const repaymentType = e.currentTarget.dataset.type;
      this.setData({ repaymentType });
      this.debounceCalculation(true);
    },

    debounceCalculation(immediate = false) {
      if (this.data.calcTimer) {
        clearTimeout(this.data.calcTimer);
      }
      if (immediate) {
        this.runCalculation(true);
      } else {
        const timer = setTimeout(() => {
          this.runCalculation(false);
        }, 400);
        this.setData({ calcTimer: timer });
      }
    },

    runCalculation(withLoading = false) {
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
    }
  }
});
