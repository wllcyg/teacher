// components/calc-car/calc-car.js
const {
  calcCarLoan,
  calcPurchaseTax,
  calcVehicleAndVesselTax,
  calcCarLandingPrice,
  calcCarDepreciation,
  calcFuelVsElectricCost
} = require('../../utils/calculators/car.js');
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
    carTab: 'landing', // landing | running
    carPrice: 150000,
    carPriceWan: 15,
    carPowerType: 'fuel', // fuel | electric | phev
    carDisplacement: 1.5,
    carSeatCount: 5,
    buyWay: 'loan', // loan | full
    downPaymentRatio: 0.3,
    carLoanMonths: 36,
    nominalRate: 3.0,
    financeServiceFee: 3000,
    annualMileage: 15000,

    landingResult: null,
    carLoanResult: null,
    runningCostResult: null,
    depreciationResult: null,

    showCarSchedulePopup: false,
    showDepreciationPopup: false,
    calcTimer: null
  },

  lifetimes: {
    attached() {
      if (this.properties.initialOptions) {
        this.initFromOptions(this.properties.initialOptions);
      } else {
        this.runCarCalculation(false);
      }
    }
  },

  methods: {
    initFromOptions(opts) {
      const updates = {};
      if (opts.tab === 'running' || opts.carTab === 'running') updates.carTab = 'running';
      if (opts.price) {
        const p = Number(opts.price) || 150000;
        updates.carPrice = p;
        updates.carPriceWan = math.round(p / 10000, 1);
      }
      this.setData(updates, () => {
        this.runCarCalculation(false);
      });
    },

    onCarTabChange(e) {
      const carTab = e.currentTarget.dataset.tab;
      this.setData({ carTab });
      this.runCarCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    },

    onPowerTypeChange(e) {
      const carPowerType = e.currentTarget.dataset.power;
      this.setData({ carPowerType });
      this.runCarCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    },

    onCarPriceInput(e) {
      const valWan = Number(e.detail.value) || 0;
      const carPrice = math.round(valWan * 10000, 2);
      this.setData({ carPrice, carPriceWan: valWan });
      this.debounceCalculation(false);
    },

    selectCarPricePreset(e) {
      const valWan = Number(e.currentTarget.dataset.val) || 15;
      const carPrice = valWan * 10000;
      this.setData({ carPrice, carPriceWan: valWan });
      this.debounceCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    },

    onBuyWayChange(e) {
      const buyWay = e.currentTarget.dataset.way;
      this.setData({ buyWay });
      this.debounceCalculation(true);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    },

    selectDownPaymentRatio(e) {
      const downPaymentRatio = Number(e.currentTarget.dataset.ratio) || 0.3;
      this.setData({ downPaymentRatio });
      this.debounceCalculation(true);
    },

    selectCarLoanMonths(e) {
      const carLoanMonths = Number(e.currentTarget.dataset.months) || 36;
      this.setData({ carLoanMonths });
      this.debounceCalculation(true);
    },

    onNominalRateInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ nominalRate: val });
      this.debounceCalculation(false);
    },

    onFinanceFeeInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ financeServiceFee: val });
      this.debounceCalculation(false);
    },

    onAnnualMileageInput(e) {
      const val = Number(e.detail.value) || 15000;
      this.setData({ annualMileage: val });
      this.debounceCalculation(false);
    },

    selectAnnualMileagePreset(e) {
      const val = Number(e.currentTarget.dataset.value) || 15000;
      this.setData({ annualMileage: val });
      this.debounceCalculation(true);
    },

    onConfirmInput() {
      wx.hideKeyboard();
      this.debounceCalculation(true);
    },

    onBlurInput() {
      this.debounceCalculation(false);
    },

    toggleCarSchedulePopup() {
      this.setData({ showCarSchedulePopup: !this.data.showCarSchedulePopup });
    },

    toggleDepreciationPopup() {
      this.setData({ showDepreciationPopup: !this.data.showDepreciationPopup });
    },

    debounceCalculation(immediate = false) {
      if (this.data.calcTimer) {
        clearTimeout(this.data.calcTimer);
      }
      if (immediate) {
        this.runCarCalculation(true);
      } else {
        const timer = setTimeout(() => {
          this.runCarCalculation(false);
        }, 400);
        this.setData({ calcTimer: timer });
      }
    },

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
    }
  }
});
