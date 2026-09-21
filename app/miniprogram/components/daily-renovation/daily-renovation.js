const {
  calcRenovationBudget,
  calcTileUsage,
  calcPaintUsage,
  calcFlooringUsage,
  calcCurtainUsage
} = require('../../utils/calculators/daily.js');

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared'
  },

  properties: {
    initialTool: {
      type: String,
      value: 'budget',
      observer(val) {
        if (val && val !== this.data.subTool) {
          this.setData({ subTool: val });
          this.calculate();
        }
      }
    }
  },

  data: {
    subTool: 'budget', // budget | tile | paint | flooring | curtain

    // 综合预算
    houseArea: 100,
    renovTierKey: 'standard',
    renovCustomPrice: 1600,
    renovBudgetResult: null,

    // 瓷砖用量
    tileArea: 60,
    tileLengthMm: 800,
    tileWidthMm: 800,
    tileLossRate: 8,
    tilePrice: 45,
    tileResult: null,

    // 涂料用量
    paintArea: 120,
    paintCoats: 2,
    paintBucketLiters: 5,
    paintPrice: 350,
    paintResult: null,

    // 地板用量
    floorArea: 40,
    floorMethod: 'straight',
    floorPrice: 180,
    floorResult: null,

    // 窗帘布料
    curtainWinWidth: 3.0,
    curtainWinHeight: 2.6,
    curtainFold: 2.0,
    curtainResult: null
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

    // 预算输入
    onHouseAreaInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ houseArea: val });
      this.debounceCalculate();
    },

    onRenovTierChange(e) {
      const tier = e.currentTarget.dataset.tier;
      this.setData({ renovTierKey: tier });
      this.calculate();
    },

    // 瓷砖输入
    onTileAreaInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ tileArea: val });
      this.debounceCalculate();
    },

    onTileSpecSelect(e) {
      const length = Number(e.currentTarget.dataset.length) || 800;
      const width = Number(e.currentTarget.dataset.width) || 800;
      this.setData({ tileLengthMm: length, tileWidthMm: width });
      this.calculate();
    },

    onTilePriceInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ tilePrice: val });
      this.debounceCalculate();
    },

    // 涂料输入
    onPaintAreaInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ paintArea: val });
      this.debounceCalculate();
    },

    onPaintBucketChange(e) {
      const liters = Number(e.currentTarget.dataset.liters) || 5;
      this.setData({ paintBucketLiters: liters });
      this.calculate();
    },

    // 地板输入
    onFloorAreaInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ floorArea: val });
      this.debounceCalculate();
    },

    onFloorMethodChange(e) {
      const method = e.currentTarget.dataset.method;
      this.setData({ floorMethod: method });
      this.calculate();
    },

    onFloorPriceInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ floorPrice: val });
      this.debounceCalculate();
    },

    // 窗帘输入
    onCurtainWidthInput(e) {
      const val = Number(e.detail.value) || 0;
      this.setData({ curtainWinWidth: val });
      this.debounceCalculate();
    },

    onCurtainFoldChange(e) {
      const fold = Number(e.currentTarget.dataset.fold) || 2.0;
      this.setData({ curtainFold: fold });
      this.calculate();
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
        houseArea,
        renovTierKey,
        renovCustomPrice,
        tileArea,
        tileLengthMm,
        tileWidthMm,
        tileLossRate,
        tilePrice,
        paintArea,
        paintCoats,
        paintBucketLiters,
        paintPrice,
        floorArea,
        floorMethod,
        floorPrice,
        curtainWinWidth,
        curtainWinHeight,
        curtainFold
      } = this.data;

      if (subTool === 'budget') {
        const renovBudgetResult = calcRenovationBudget({
          houseArea,
          tierKey: renovTierKey,
          customPrice: renovCustomPrice
        });
        this.setData({ renovBudgetResult });
      } else if (subTool === 'tile') {
        const tileResult = calcTileUsage({
          area: tileArea,
          tileLengthMm,
          tileWidthMm,
          lossRatePercent: tileLossRate,
          pricePerPiece: tilePrice
        });
        this.setData({ tileResult });
      } else if (subTool === 'paint') {
        const paintResult = calcPaintUsage({
          wallArea: paintArea,
          coats: paintCoats,
          bucketLiters: paintBucketLiters,
          pricePerBucket: paintPrice
        });
        this.setData({ paintResult });
      } else if (subTool === 'flooring') {
        const floorResult = calcFlooringUsage({
          roomArea: floorArea,
          method: floorMethod,
          pricePerSqm: floorPrice
        });
        this.setData({ floorResult });
      } else if (subTool === 'curtain') {
        const curtainResult = calcCurtainUsage({
          windowWidthM: curtainWinWidth,
          windowHeightM: curtainWinHeight,
          foldRatio: curtainFold
        });
        this.setData({ curtainResult });
      }
    }
  }
});
