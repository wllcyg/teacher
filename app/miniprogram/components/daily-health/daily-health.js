const {
  calcBMI,
  calcPregnancy,
  calcAnniversary,
  calcWeddingBudget
} = require('../../utils/calculators/daily.js');

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    initialTool: {
      type: String,
      value: 'bmi',
      observer(val) {
        if (val && val !== this.data.subTool) {
          this.setData({ subTool: val });
          this.calculate();
        }
      }
    }
  },

  data: {
    subTool: 'bmi', // bmi | pregnancy | anniversary | wedding

    // BMI
    bmiHeight: 172,
    bmiWeight: 65,
    bmiResult: null,

    // 孕期预产期
    lmpDate: '2026-03-01',
    pregnancyResult: null,
    showPregnancyMilestonePopup: false,

    // 纪念日
    annivDate: '2022-05-20',
    annivResult: null,

    // 婚礼预算
    weddingBudget: 150000,
    weddingResult: null
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

    // BMI 输入
    onBmiHeightInput(e) {
      const val = Number(e.detail.value) || 170;
      this.setData({ bmiHeight: val });
      this.debounceCalculate();
    },

    onBmiWeightInput(e) {
      const val = Number(e.detail.value) || 60;
      this.setData({ bmiWeight: val });
      this.debounceCalculate();
    },

    // 孕期输入
    onLmpDateChange(e) {
      const val = e.detail.value;
      this.setData({ lmpDate: val });
      this.calculate();
    },

    togglePregnancyMilestonePopup() {
      this.setData({ showPregnancyMilestonePopup: !this.data.showPregnancyMilestonePopup });
    },

    // 纪念日输入
    onAnnivDateChange(e) {
      const val = e.detail.value;
      this.setData({ annivDate: val });
      this.calculate();
    },

    // 婚礼预算输入
    onWeddingBudgetInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ weddingBudget: val });
      this.debounceCalculate();
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
        bmiHeight,
        bmiWeight,
        lmpDate,
        annivDate,
        weddingBudget
      } = this.data;

      if (subTool === 'bmi') {
        const bmiResult = calcBMI({
          heightCm: bmiHeight,
          weightKg: bmiWeight
        });
        this.setData({ bmiResult });
      } else if (subTool === 'pregnancy') {
        const pregnancyResult = calcPregnancy({
          lastMenstrualDate: lmpDate
        });
        this.setData({ pregnancyResult });
      } else if (subTool === 'anniversary') {
        const annivResult = calcAnniversary({
          anniversaryDate: annivDate
        });
        this.setData({ annivResult });
      } else if (subTool === 'wedding') {
        const weddingResult = calcWeddingBudget({
          totalBudget: weddingBudget
        });
        this.setData({ weddingResult });
      }
    }
  }
});
