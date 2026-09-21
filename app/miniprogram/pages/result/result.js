// pages/result/result.js

Page({
  data: {
    type: 'mortgage', // mortgage | salary | car | saving | life
    initialOptions: null,

    // 生活日常模块顶层分段调度
    lifeTab: 'job', // job(职场民生) | renovation(装修建材) | living(公用生活) | health(健康仪式)
    jobSubTool: 'retirement',
    renovSubTool: 'budget',
    livingSubTool: 'utility',
    healthSubTool: 'bmi'
  },

  onLoad(options = {}) {
    const rawType = options.type || 'mortgage';
    let type = rawType;
    if (type === 'fund') {
      type = 'salary';
    } else if (type === 'car_loan') {
      type = 'car';
    } else if (type === 'compound_interest' || type === 'fire_calc' || type === 'fund_invest') {
      type = 'saving';
    } else if (type === 'life' || type === 'daily' || type === 'retirement' || type === 'renovation') {
      type = 'life';
    } else if (type === 'insurance' || type === 'critical_illness' || type === 'life_insurance' || type === 'medical_reimburse') {
      type = 'insurance';
    }

    const updates = {
      type,
      initialOptions: { ...options, rawType }
    };

    if (options.lifeTab) {
      updates.lifeTab = options.lifeTab;
    } else if (rawType === 'retirement') {
      updates.lifeTab = 'job';
      updates.jobSubTool = 'retirement';
    } else if (rawType === 'renovation') {
      updates.lifeTab = 'renovation';
      updates.renovSubTool = 'budget';
    }

    if (options.tool) {
      if (updates.lifeTab === 'job') updates.jobSubTool = options.tool;
      else if (updates.lifeTab === 'renovation') updates.renovSubTool = options.tool;
      else if (updates.lifeTab === 'living') updates.livingSubTool = options.tool;
      else if (updates.lifeTab === 'health') updates.healthSubTool = options.tool;
    }

    this.setData(updates);
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onLifeTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab && tab !== this.data.lifeTab) {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      this.setData({ lifeTab: tab });
    }
  },

  goToPoster() {
    wx.navigateTo({
      url: `/pages/poster/poster?type=${this.data.type}`
    });
  },

  onShareAppMessage() {
    const titles = {
      mortgage: '房贷月供与提前还款测算方案',
      salary: '薪资税后收入与五险一金精算',
      car: '全包购车落地成本与油电能耗对比',
      saving: '储蓄复利定投与FIRE财务自由规划',
      insurance: '重疾保额/寿险责任/医保自费黑洞对比测算',
      life: '生活日常实用测算工具集'
    };
    return {
      title: titles[this.data.type] || '个人财务与生活精算工具箱',
      path: `/pages/result/result?type=${this.data.type}`
    };
  }
});
