const {
  calcElectricityCost,
  calcWaterCost,
  calcExpressFreight,
  calcParkingFee,
  calcDiscountPromotion
} = require('../../utils/calculators/daily.js');

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    initialTool: {
      type: String,
      value: 'utility',
      observer(val) {
        if (val && val !== this.data.subTool) {
          this.setData({ subTool: val });
          this.calculate();
        }
      }
    }
  },

  data: {
    subTool: 'utility', // utility | express | parking | discount

    // 阶梯水电
    elecKwh: 280,
    elecPeriod: 'month',
    waterM3: 180,
    elecResult: null,
    waterResult: null,

    // 快递运费
    expressWeight: 2.5,
    expressLength: 30,
    expressWidth: 20,
    expressHeight: 20,
    expressTemplate: 'standard',
    expressResult: null,

    // 停车费分段
    parkingMinutes: 120,
    parkingTemplate: 'commercial',
    parkingResult: null,

    // 满减折扣
    discountOrigin: 650,
    discountThreshold: 300,
    discountReduction: 50,
    discountShopCoupon: 20,
    discountPlatformCoupon: 10,
    discountResult: null
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

    // 水电输入
    onElecKwhInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ elecKwh: val });
      this.debounceCalculate();
    },

    onWaterM3Input(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ waterM3: val });
      this.debounceCalculate();
    },

    // 快递输入
    onExpressWeightInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ expressWeight: val });
      this.debounceCalculate();
    },

    onExpressTemplateChange(e) {
      const tmpl = e.currentTarget.dataset.tmpl;
      this.setData({ expressTemplate: tmpl });
      this.calculate();
    },

    // 停车输入
    onParkingMinutesInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ parkingMinutes: val });
      this.debounceCalculate();
    },

    onParkingTemplateChange(e) {
      const tmpl = e.currentTarget.dataset.tmpl;
      this.setData({ parkingTemplate: tmpl });
      this.calculate();
    },

    // 满减输入
    onDiscountOriginInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ discountOrigin: val });
      this.debounceCalculate();
    },

    onDiscountShopCouponInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ discountShopCoupon: val });
      this.debounceCalculate();
    },

    onDiscountPlatformCouponInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ discountPlatformCoupon: val });
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
        elecKwh,
        elecPeriod,
        waterM3,
        expressWeight,
        expressLength,
        expressWidth,
        expressHeight,
        expressTemplate,
        parkingMinutes,
        parkingTemplate,
        discountOrigin,
        discountThreshold,
        discountReduction,
        discountShopCoupon,
        discountPlatformCoupon
      } = this.data;

      if (subTool === 'utility') {
        const elecResult = calcElectricityCost({
          kwh: elecKwh,
          period: elecPeriod
        });
        const waterResult = calcWaterCost({
          m3: waterM3
        });
        this.setData({ elecResult, waterResult });
      } else if (subTool === 'express') {
        const expressResult = calcExpressFreight({
          actualWeightKg: expressWeight,
          lengthCm: expressLength,
          widthCm: expressWidth,
          heightCm: expressHeight,
          templateKey: expressTemplate
        });
        this.setData({ expressResult });
      } else if (subTool === 'parking') {
        const parkingResult = calcParkingFee({
          parkingMinutes,
          templateKey: parkingTemplate
        });
        this.setData({ parkingResult });
      } else if (subTool === 'discount') {
        const discountResult = calcDiscountPromotion({
          originTotal: discountOrigin,
          crossShopThreshold: discountThreshold,
          crossShopReduction: discountReduction,
          shopCoupon: discountShopCoupon,
          platformCoupon: discountPlatformCoupon
        });
        this.setData({ discountResult });
      }
    }
  }
});
