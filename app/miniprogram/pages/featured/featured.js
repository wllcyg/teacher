Page({
  data: {},
  onLoad() {},

  goToCompare() {
    wx.navigateTo({
      url: '/pages/compare/compare',
    });
  },

  goToResult(e) {
    const type = e.currentTarget.dataset.type || 'mortgage';
    wx.navigateTo({
      url: `/pages/result/result?type=${type}`,
    });
  }
});
