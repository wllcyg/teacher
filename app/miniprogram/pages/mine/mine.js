Page({
  data: {},

  onLoad() {},

  goToResult(e) {
    const type = e.currentTarget.dataset.type || 'mortgage';
    wx.navigateTo({
      url: `/pages/result/result?type=${type}`,
    });
  },

  goToCompare() {
    wx.navigateTo({
      url: '/pages/compare/compare',
    });
  },

  goToPoster() {
    wx.navigateTo({
      url: '/pages/poster/poster',
    });
  },

  showDisclaimer() {
    wx.showModal({
      title: '算法与政策说明',
      content: '本小程序计算器结果依据国家现行税收法规、各省市公积金管理办法及央行 LPR 利率模型得出，测算结果仅供参考决策，请以实际办理结果为准。',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});
