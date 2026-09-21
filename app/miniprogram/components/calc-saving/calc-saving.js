// components/calc-saving/calc-saving.js
const {
  calcDepositInterest,
  calcCompoundDeposit,
  calcFundAIP,
  calcUniversalCompound,
  calcInflation,
  calcYieldConvert,
  calcFIRE
} = require('../../utils/calculators/finance.js');
const {
  BANK_DEPOSIT_RATES,
  LARGE_CD_RATES,
  INFLATION_PRESETS,
  AIP_EXPECTED_RETURNS,
  FIRE_CONFIG
} = require('../../utils/config/finance-rates.js');

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
    savingTab: 'compound', // compound(复利定投) | fire(财务自由) | inflation(通胀评估) | yield(收益率换算)
    
    // 复利与定投子模式
    compoundSubMode: 'universal', // 'universal'(通用复利追加) | 'aip'(基金定投) | 'deposit'(银行存款)
    savingInitialPrincipal: 100000, // 初始本金 10万
    savingRegularAmount: 3000,      // 每期追加 3000元
    savingRegularFreq: 'monthly',   // 'monthly' | 'yearly' | 'none'
    savingAnnualRate: 6.0,          // 预期年化 6.0%
    savingYears: 10,                // 10年
    
    // 定投专属
    aipPeriodAmount: 1500,          // 每期定投
    aipCycle: 'month',              // 'month' | 'week'
    aipTiming: 'end',               // 'end' | 'begin'
    aipRate: 8.0,                   // 指数定投年化 8.0%
    aipYears: 10,
    
    // 存款专属
    depositPrincipal: 100000,
    depositRate: 1.50,              // 定期 3 年 1.50%
    depositTermType: 'year',        // 'year' | 'month' | 'day'
    depositTermValue: 3,
    depositIsCompound: false,       // 是否复利滚存
    depositCompoundFreq: 'monthly',
    
    // FIRE 财务自由
    fireCurrentAge: 30,
    fireCurrentAssets: 300000,      // 当前已有资产 (30万)
    fireMonthlyIncome: 16000,       // 当前月收入 (1.6万)
    fireMonthlyExpense: 7000,       // 退休后预计月支出 (7000元)
    fireCurrentExpense: 7000,       // 当前实际月支出 (7000元)
    fireExpectedReturn: 6.0,        // 预期投资回报率 6.0%
    fireInflation: 2.5,             // 长期通胀率 2.5%
    fireRuleType: 'classic',        // 'classic'(4%) | 'lean'(5%) | 'fat'(3%)
    fireSwrRate: 4.0,
    
    // 通货膨胀
    inflationAmount: 1000000,       // 当前金额 (100万)
    inflationRate: 2.5,             // 预计通胀率 (%)
    inflationYears: 20,             // 时间跨度 (20年)
    
    // 收益率换算
    yieldConvertType: 'daily_to_annual', // 'daily_to_annual' | 'annual_to_daily' | 'term_to_annual' | 'actual_profit'
    yieldDailyValue: 0.65,          // 日万份收益 (元)
    yieldAnnualValue: 2.50,         // 年化收益率 (%)
    yieldTermValue: 1.20,           // 封闭期收益率 (%)
    yieldTermDays: 90,              // 封闭天数
    yieldPrincipal: 50000,          // 试算本金 (元)
    
    // 结果缓存
    compoundResult: null,
    aipResult: null,
    depositResult: null,
    fireResult: null,
    inflationResult: null,
    yieldResult: null,
    
    // 弹窗状态
    showCompoundSchedulePopup: false,
    showFireTrajectoryPopup: false,
    showAipSensitivityPopup: false,
    
    // 预设配置
    bankRates: BANK_DEPOSIT_RATES,
    cdRates: LARGE_CD_RATES,
    inflationPresets: INFLATION_PRESETS,
    aipPresets: AIP_EXPECTED_RETURNS,
    fireRulePresets: FIRE_CONFIG.ruleTypes,
    fireExpensePresets: FIRE_CONFIG.monthlyExpensePresets,

    calcTimer: null
  },

  lifetimes: {
    attached() {
      if (this.properties.initialOptions) {
        this.initFromOptions(this.properties.initialOptions);
      } else {
        this.runSavingCalculation(false);
      }
    }
  },

  methods: {
    initFromOptions(opts) {
      const updates = {};
      if (opts.savingTab) updates.savingTab = opts.savingTab;
      if (opts.rawType === 'compound_interest') {
        updates.savingTab = 'compound';
        updates.compoundSubMode = 'universal';
      } else if (opts.rawType === 'fire_calc') {
        updates.savingTab = 'fire';
      } else if (opts.rawType === 'fund_invest') {
        updates.savingTab = 'compound';
        updates.compoundSubMode = 'aip';
      }
      this.setData(updates, () => {
        this.runSavingCalculation(false);
      });
    },

    onSavingTabChange(e) {
      const savingTab = e.currentTarget.dataset.tab;
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      this.setData({ savingTab });
      this.debounceCalculation(true);
    },

    onCompoundSubModeChange(e) {
      const compoundSubMode = e.currentTarget.dataset.mode;
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      this.setData({ compoundSubMode });
      this.debounceCalculation(true);
    },

    // 通用复利输入
    onSavingPrincipalInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ savingInitialPrincipal: val });
      this.debounceCalculation(false);
    },

    onSavingRegularAmountInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ savingRegularAmount: val });
      this.debounceCalculation(false);
    },

    onSavingRegularFreqChange(e) {
      const freq = e.currentTarget.dataset.freq;
      this.setData({ savingRegularFreq: freq });
      this.debounceCalculation(true);
    },

    onSavingRateInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ savingAnnualRate: val });
      this.debounceCalculation(false);
    },

    onSavingYearsInput(e) {
      const val = Number(e.detail.value) || 1;
      this.setData({ savingYears: val });
      this.debounceCalculation(false);
    },

    // 定投输入
    onAipAmountInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ aipPeriodAmount: val });
      this.debounceCalculation(false);
    },

    onAipCycleChange(e) {
      const cycle = e.currentTarget.dataset.cycle;
      this.setData({ aipCycle: cycle });
      this.debounceCalculation(true);
    },

    onAipTimingChange(e) {
      const timing = e.currentTarget.dataset.timing;
      this.setData({ aipTiming: timing });
      this.debounceCalculation(true);
    },

    onAipRateInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ aipRate: val });
      this.debounceCalculation(false);
    },

    onSelectAipRatePreset(e) {
      const rate = Number(e.currentTarget.dataset.rate) || 8.0;
      this.setData({ aipRate: rate });
      this.debounceCalculation(true);
      wx.showToast({ title: `已设为 ${rate}% 年化`, icon: 'none' });
    },

    onAipYearsInput(e) {
      const val = Number(e.detail.value) || 1;
      this.setData({ aipYears: val });
      this.debounceCalculation(false);
    },

    // 存款单利/复利输入
    onDepositPrincipalInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ depositPrincipal: val });
      this.debounceCalculation(false);
    },

    onDepositRateInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ depositRate: val });
      this.debounceCalculation(false);
    },

    onDepositTermTypeChange(e) {
      const depositTermType = e.currentTarget.dataset.type;
      this.setData({ depositTermType });
      this.debounceCalculation(true);
    },

    onDepositTermValueInput(e) {
      const val = Number(e.detail.value) || 1;
      this.setData({ depositTermValue: val });
      this.debounceCalculation(false);
    },

    onDepositCompoundToggle() {
      this.setData({ depositIsCompound: !this.data.depositIsCompound });
      this.debounceCalculation(true);
    },

    onSelectBankRatePreset(e) {
      const key = e.currentTarget.dataset.key;
      const item = BANK_DEPOSIT_RATES[key];
      if (item) {
        this.setData({
          depositRate: item.rate,
          depositTermType: item.termMonths > 0 ? 'month' : 'year',
          depositTermValue: item.termMonths > 0 ? item.termMonths : 1
        });
        this.debounceCalculation(true);
        wx.showToast({ title: `已匹配${item.name} ${item.rate}%`, icon: 'none' });
      }
    },

    onSelectCdRatePreset(e) {
      const key = e.currentTarget.dataset.key;
      const item = LARGE_CD_RATES[key];
      if (item) {
        this.setData({
          depositRate: item.rate,
          depositPrincipal: Math.max(this.data.depositPrincipal, item.minAmount)
        });
        this.debounceCalculation(true);
        wx.showToast({ title: `已匹配${item.name} ${item.rate}%`, icon: 'none' });
      }
    },

    // FIRE 财务自由输入
    onFireAgeInput(e) {
      const val = Number(e.detail.value) || 30;
      this.setData({ fireCurrentAge: val });
      this.debounceCalculation(false);
    },

    onFireAssetInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ fireCurrentAssets: val });
      this.debounceCalculation(false);
    },

    onFireIncomeInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ fireMonthlyIncome: val });
      this.debounceCalculation(false);
    },

    onFireExpenseInput(e) {
      const val = Number(e.detail.value) || 5000;
      this.setData({ fireMonthlyExpense: val });
      this.debounceCalculation(false);
    },

    onFireCurrentExpenseInput(e) {
      const val = Number(e.detail.value) || 5000;
      this.setData({ fireCurrentExpense: val });
      this.debounceCalculation(false);
    },

    onFireReturnInput(e) {
      const val = Number(e.detail.value) || 6.0;
      this.setData({ fireExpectedReturn: val });
      this.debounceCalculation(false);
    },

    onFireInflationInput(e) {
      const val = Number(e.detail.value) || 2.5;
      this.setData({ fireInflation: val });
      this.debounceCalculation(false);
    },

    onFireRuleSelect(e) {
      const rule = e.currentTarget.dataset.rule;
      const swrMap = { classic: 4.0, lean: 5.0, fat: 3.0 };
      this.setData({
        fireRuleType: rule,
        fireSwrRate: swrMap[rule] || 4.0
      });
      this.debounceCalculation(true);
    },

    onSelectExpensePreset(e) {
      const val = Number(e.currentTarget.dataset.val) || 8000;
      this.setData({
        fireMonthlyExpense: val,
        fireCurrentExpense: val
      });
      this.debounceCalculation(true);
    },

    // 通货膨胀输入
    onInflationAmountInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ inflationAmount: val });
      this.debounceCalculation(false);
    },

    onInflationRateInput(e) {
      const val = Number(e.detail.value) || 2.5;
      this.setData({ inflationRate: val });
      this.debounceCalculation(false);
    },

    onInflationYearsInput(e) {
      const val = Number(e.detail.value) || 10;
      this.setData({ inflationYears: val });
      this.debounceCalculation(false);
    },

    onSelectInflationPreset(e) {
      const rate = Number(e.currentTarget.dataset.rate) || 2.5;
      this.setData({ inflationRate: rate });
      this.debounceCalculation(true);
    },

    // 收益率换算输入
    onYieldTypeChange(e) {
      const yieldConvertType = e.currentTarget.dataset.type;
      this.setData({ yieldConvertType });
      this.debounceCalculation(true);
    },

    onYieldDailyInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ yieldDailyValue: val });
      this.debounceCalculation(false);
    },

    onYieldAnnualInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ yieldAnnualValue: val });
      this.debounceCalculation(false);
    },

    onYieldTermInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ yieldTermValue: val });
      this.debounceCalculation(false);
    },

    onYieldDaysInput(e) {
      const val = Number(e.detail.value) || 30;
      this.setData({ yieldTermDays: val });
      this.debounceCalculation(false);
    },

    onYieldPrincipalInput(e) {
      const val = Number(e.detail.value) || 10000;
      this.setData({ yieldPrincipal: val });
      this.debounceCalculation(false);
    },

    // 弹窗开关
    toggleCompoundSchedulePopup() {
      this.setData({ showCompoundSchedulePopup: !this.data.showCompoundSchedulePopup });
    },

    toggleFireTrajectoryPopup() {
      this.setData({ showFireTrajectoryPopup: !this.data.showFireTrajectoryPopup });
    },

    toggleAipSensitivityPopup() {
      this.setData({ showAipSensitivityPopup: !this.data.showAipSensitivityPopup });
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
        this.runSavingCalculation(true);
      } else {
        const timer = setTimeout(() => {
          this.runSavingCalculation(false);
        }, 400);
        this.setData({ calcTimer: timer });
      }
    },

    // 执行储蓄理财核心运算
    runSavingCalculation(withLoading = false) {
      if (withLoading) {
        wx.showLoading({ title: '正在精准测算...', mask: false });
      }

      const {
        savingInitialPrincipal,
        savingRegularAmount,
        savingRegularFreq,
        savingAnnualRate,
        savingYears,
        aipPeriodAmount,
        aipCycle,
        aipTiming,
        aipRate,
        aipYears,
        depositPrincipal,
        depositRate,
        depositTermType,
        depositTermValue,
        depositIsCompound,
        depositCompoundFreq,
        fireCurrentAge,
        fireCurrentAssets,
        fireMonthlyIncome,
        fireMonthlyExpense,
        fireCurrentExpense,
        fireExpectedReturn,
        fireInflation,
        fireSwrRate,
        inflationAmount,
        inflationRate,
        inflationYears,
        yieldConvertType,
        yieldDailyValue,
        yieldAnnualValue,
        yieldTermValue,
        yieldTermDays,
        yieldPrincipal
      } = this.data;

      // 1. 通用复利追加
      const compoundRes = calcUniversalCompound({
        initialPrincipal: savingInitialPrincipal,
        regularAmount: savingRegularAmount,
        regularFrequency: savingRegularFreq,
        annualRate: savingAnnualRate,
        years: savingYears
      });

      // 2. 基金定投
      const aipRes = calcFundAIP({
        periodAmount: aipPeriodAmount,
        cycle: aipCycle,
        annualRate: aipRate,
        years: aipYears,
        timing: aipTiming
      });

      // 3. 存款单利/复利
      let depositRes = null;
      if (depositIsCompound) {
        let years = depositTermValue;
        if (depositTermType === 'month') years = depositTermValue / 12;
        else if (depositTermType === 'day') years = depositTermValue / 365;
        depositRes = calcCompoundDeposit({
          principal: depositPrincipal,
          annualRate: depositRate,
          years,
          compoundFrequency: depositCompoundFreq
        });
      } else {
        depositRes = calcDepositInterest({
          principal: depositPrincipal,
          annualRate: depositRate,
          termType: depositTermType,
          termValue: depositTermValue
        });
      }

      // 4. FIRE 财务自由
      const fireRes = calcFIRE({
        currentAge: fireCurrentAge,
        currentAssets: fireCurrentAssets,
        monthlyIncome: fireMonthlyIncome,
        monthlyExpense: fireMonthlyExpense,
        currentMonthlyExpense: fireCurrentExpense,
        expectedReturnRate: fireExpectedReturn,
        inflationRate: fireInflation,
        swrRate: fireSwrRate
      });

      // 5. 通货膨胀与购买力
      const inflationRes = calcInflation({
        currentAmount: inflationAmount,
        inflationRate: inflationRate,
        years: inflationYears
      });

      // 6. 收益率换算
      const yieldRes = calcYieldConvert({
        convertType: yieldConvertType,
        dailyTenThousand: yieldDailyValue,
        annualRate: yieldAnnualValue,
        termYield: yieldTermValue,
        termDays: yieldTermDays,
        principal: yieldPrincipal
      });

      const updateData = {
        compoundResult: compoundRes,
        aipResult: aipRes,
        depositResult: depositRes,
        fireResult: fireRes,
        inflationResult: inflationRes,
        yieldResult: yieldRes
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
