const {
  calcDelayRetirement,
  calcPensionEstimate,
  calcAnnualLeave,
  calcMaternityAllowance
} = require('../../utils/calculators/daily.js');
const {
  RETIREMENT_REFORM_CONFIG,
  CITY_AVERAGE_WAGE,
  MATERNITY_LEAVE_RULES
} = require('../../utils/config/daily-rules.js');

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    initialTool: {
      type: String,
      value: 'retirement',
      observer(val) {
        if (val && val !== this.data.subTool) {
          this.setData({ subTool: val });
          this.calculate();
        }
      }
    }
  },

  data: {
    subTool: 'retirement', // retirement | pension | leave | maternity
    
    // 延迟退休
    retireBirthYear: 1980,
    retireBirthMonth: 6,
    retireCategoryKey: 'male',
    retireResult: null,

    // 养老金预估
    cityList: [
      { key: 'beijing', name: '北京' },
      { key: 'shanghai', name: '上海' },
      { key: 'guangzhou', name: '广州' },
      { key: 'shenzhen', name: '深圳' },
      { key: 'hangzhou', name: '杭州' },
      { key: 'chengdu', name: '成都' },
      { key: 'general', name: '其他城市' }
    ],
    pensionCityKey: 'beijing',
    pensionWage: 10000,
    pensionContribYears: 25,
    pensionTierRatio: 1.0,
    pensionRetiredAge: 60,
    pensionResult: null,

    // 带薪年假
    leaveWorkYears: 6,
    leaveResult: null,

    // 生育津贴
    maternitySalary: 10000,
    maternityProvince: 'beijing',
    maternityResult: null,

    // 弹窗
    showRetireDetailPopup: false
  },

  lifetimes: {
    attached() {
      if (this.properties.initialTool) {
        this.setData({ subTool: this.properties.initialTool });
      }
      this.calculate();
    }
  },

  methods: {
    onSubToolChange(e) {
      const tool = e.currentTarget.dataset.tool;
      if (tool && tool !== this.data.subTool) {
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
        this.setData({ subTool: tool });
        this.calculate();
      }
    },

    // 延迟退休输入
    onRetireBirthYearInput(e) {
      const val = Number(e.detail.value) || 1980;
      this.setData({ retireBirthYear: val });
      this.debounceCalculate();
    },

    onRetireBirthMonthChange(e) {
      const month = Number(e.currentTarget.dataset.month) || 1;
      this.setData({ retireBirthMonth: month });
      this.calculate();
    },

    onRetireCategoryChange(e) {
      const key = e.currentTarget.dataset.category;
      this.setData({ retireCategoryKey: key });
      this.calculate();
    },

    // 养老金输入
    onPensionCityChange(e) {
      const city = e.currentTarget.dataset.city;
      this.setData({ pensionCityKey: city });
      this.calculate();
    },

    onPensionWageInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ pensionWage: val });
      this.debounceCalculate();
    },

    onPensionContribYearsInput(e) {
      const val = Number(e.detail.value) || 15;
      this.setData({ pensionContribYears: val });
      this.debounceCalculate();
    },

    onPensionTierRatioChange(e) {
      const ratio = Number(e.currentTarget.dataset.ratio) || 1.0;
      this.setData({ pensionTierRatio: ratio });
      this.calculate();
    },

    // 年假输入
    onLeaveWorkYearsInput(e) {
      const val = Number(e.detail.value) || 1;
      this.setData({ leaveWorkYears: val });
      this.debounceCalculate();
    },

    // 生育津贴输入
    onMaternitySalaryInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ maternitySalary: val });
      this.debounceCalculate();
    },

    onMaternityProvChange(e) {
      const prov = e.currentTarget.dataset.prov;
      this.setData({ maternityProvince: prov });
      this.calculate();
    },

    toggleRetireDetailPopup() {
      this.setData({ showRetireDetailPopup: !this.data.showRetireDetailPopup });
    },

    debounceCalculate() {
      if (this.calcTimer) clearTimeout(this.calcTimer);
      this.calcTimer = setTimeout(() => {
        this.calculate();
      }, 350);
    },

    calculate() {
      const {
        subTool,
        retireBirthYear,
        retireBirthMonth,
        retireCategoryKey,
        pensionCityKey,
        pensionWage,
        pensionContribYears,
        pensionTierRatio,
        pensionRetiredAge,
        leaveWorkYears,
        maternitySalary,
        maternityProvince
      } = this.data;

      if (subTool === 'retirement') {
        const retireResult = calcDelayRetirement({
          birthYear: retireBirthYear,
          birthMonth: retireBirthMonth,
          categoryKey: retireCategoryKey
        });
        this.setData({ retireResult });
      } else if (subTool === 'pension') {
        const pensionResult = calcPensionEstimate({
          mode: 'tiered',
          cityKey: pensionCityKey,
          currentWage: pensionWage,
          contribYears: pensionContribYears,
          tierRatio: pensionTierRatio,
          retiredAge: pensionRetiredAge
        });
        this.setData({ pensionResult });
      } else if (subTool === 'leave') {
        const leaveResult = calcAnnualLeave({
          totalWorkYears: leaveWorkYears
        });
        this.setData({ leaveResult });
      } else if (subTool === 'maternity') {
        const maternityResult = calcMaternityAllowance({
          companyAvgSalary: maternitySalary,
          provinceKey: maternityProvince
        });
        this.setData({ maternityResult });
      }
    }
  }
});
