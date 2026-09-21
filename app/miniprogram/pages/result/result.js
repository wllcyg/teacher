// pages/result/result.js
Page({
  data: {
    calcType: 'salary'
  },

  onLoad(options) {
    if (options.type) {
      this.setData({ calcType: options.type });
    }
  },

  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  },

  navigateToCompare() {
    wx.navigateTo({
      url: '/pages/compare/compare'
    });
  },

  navigateToPoster() {
    wx.navigateTo({
      url: '/pages/poster/poster'
    });
  }
});
