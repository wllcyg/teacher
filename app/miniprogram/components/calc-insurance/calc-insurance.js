// components/calc-insurance/calc-insurance.js
const {
  calcCriticalIllness,
  calcLifeInsurance,
  calcMedicalReimburse
} = require('../../utils/calculators/insurance.js');
const {
  ILLNESS_COST_BENCHMARKS,
  MEDICAL_REIMBURSE_PRESETS
} = require('../../utils/config/insurance-rules.js');
const math = require('../../utils/math.js');

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
    insuranceTab: 'critical', // critical | life | medical

    // 1. 重疾险状态
    ciIncomeWan: 15,
    ciTreatmentWan: 30,
    ciRehabYears: 3,
    ciDebtWan: 50,
    ciResult: null,

    // 2. 寿险责任状态
    lifeModelType: 'needs', // needs | income
    lifeDebtWan: 80,
    lifeChildFundWan: 30,
    lifeParentFundWan: 10,
    lifeExpenseWan: 8,
    lifeIncomeWan: 18,
    lifeDutyYears: 20,
    lifeResult: null,

    // 3. 医保报销对比状态
    medicalPresetKey: 'severe',
    medicalTotalCost: 300000,
    medicalInScopeRatio: 0.55,
    medicalSocialRatio: 0.75,
    medicalSocialCap: 300000,
    medicalDeductible: 10000,
    medicalResult: null,

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
      if (opts.rawType === 'critical_illness' || opts.tab === 'critical') {
        updates.insuranceTab = 'critical';
      } else if (opts.rawType === 'life_insurance' || opts.tab === 'life') {
        updates.insuranceTab = 'life';
      } else if (opts.rawType === 'medical_reimburse' || opts.tab === 'medical') {
        updates.insuranceTab = 'medical';
      }
      this.setData(updates, () => {
        this.runCalculation(false);
      });
    },

    onTabChange(e) {
      const tab = e.currentTarget.dataset.tab;
      if (tab && tab !== this.data.insuranceTab) {
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
        this.setData({ insuranceTab: tab });
        this.debounceCalculation(true);
      }
    },

    // 1. 重疾险输入
    onCiIncomeInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ ciIncomeWan: val });
      this.debounceCalculation(false);
    },

    selectCiIncomePreset(e) {
      const val = Number(e.currentTarget.dataset.val) || 15;
      this.setData({ ciIncomeWan: val });
      this.debounceCalculation(true);
    },

    onCiTreatmentInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ ciTreatmentWan: val });
      this.debounceCalculation(false);
    },

    selectCiRehabYears(e) {
      const years = Number(e.currentTarget.dataset.years) || 3;
      this.setData({ ciRehabYears: years });
      this.debounceCalculation(true);
    },

    onCiDebtInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ ciDebtWan: val });
      this.debounceCalculation(false);
    },

    // 2. 寿险责任输入
    selectLifeModelType(e) {
      const model = e.currentTarget.dataset.model;
      this.setData({ lifeModelType: model });
      this.debounceCalculation(true);
    },

    onLifeDebtInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ lifeDebtWan: val });
      this.debounceCalculation(false);
    },

    onLifeChildFundInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ lifeChildFundWan: val });
      this.debounceCalculation(false);
    },

    onLifeParentFundInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ lifeParentFundWan: val });
      this.debounceCalculation(false);
    },

    onLifeExpenseInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ lifeExpenseWan: val });
      this.debounceCalculation(false);
    },

    onLifeIncomeInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ lifeIncomeWan: val });
      this.debounceCalculation(false);
    },

    selectLifeDutyYears(e) {
      const years = Number(e.currentTarget.dataset.years) || 20;
      this.setData({ lifeDutyYears: years });
      this.debounceCalculation(true);
    },

    // 3. 医保对比输入
    selectMedicalPreset(e) {
      const key = e.currentTarget.dataset.key;
      const preset = MEDICAL_REIMBURSE_PRESETS[key];
      if (preset) {
        this.setData({
          medicalPresetKey: key,
          medicalTotalCost: preset.defaultTotalCost,
          medicalInScopeRatio: preset.inScopeRatio
        });
        this.debounceCalculation(true);
      }
    },

    onMedicalCostInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ medicalTotalCost: val });
      this.debounceCalculation(false);
    },

    selectInScopeRatio(e) {
      const ratio = Number(e.currentTarget.dataset.ratio) || 0.6;
      this.setData({ medicalInScopeRatio: ratio });
      this.debounceCalculation(true);
    },

    onConfirmInput() {
      wx.hideKeyboard();
      this.debounceCalculation(true);
    },

    onBlurInput() {
      this.debounceCalculation(false);
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
        insuranceTab,
        ciIncomeWan,
        ciTreatmentWan,
        ciRehabYears,
        ciDebtWan,
        lifeIncomeWan,
        lifeDutyYears,
        lifeDebtWan,
        lifeChildFundWan,
        lifeParentFundWan,
        lifeExpenseWan,
        lifeModelType,
        medicalTotalCost,
        medicalInScopeRatio,
        medicalSocialRatio,
        medicalSocialCap,
        medicalDeductible
      } = this.data;

      // 1. 重疾险
      const ciRes = calcCriticalIllness({
        annualIncome: ciIncomeWan * 10000,
        treatmentCost: ciTreatmentWan * 10000,
        rehabYears: ciRehabYears,
        debtBalance: ciDebtWan * 10000
      });

      // 2. 寿险
      const lifeRes = calcLifeInsurance({
        annualIncome: lifeIncomeWan * 10000,
        dutyYears: lifeDutyYears,
        totalDebt: lifeDebtWan * 10000,
        childEducationFund: lifeChildFundWan * 10000,
        parentCareFund: lifeParentFundWan * 10000,
        annualLivingExpense: lifeExpenseWan * 10000,
        modelType: lifeModelType
      });

      // 3. 医保对比
      const medRes = calcMedicalReimburse({
        totalCost: medicalTotalCost,
        inScopeRatio: medicalInScopeRatio,
        socialReimburseRatio: medicalSocialRatio,
        socialCap: medicalSocialCap,
        commercialDeductible: medicalDeductible,
        commercialRatio: 1.0
      });

      const updateData = {
        ciResult: ciRes,
        lifeResult: lifeRes,
        medicalResult: medRes
      };

      if (withLoading) {
        setTimeout(() => {
          wx.hideLoading();
          this.setData(updateData);
        }, 100);
      } else {
        this.setData(updateData);
      }
    }
  }
});
