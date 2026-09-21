// pages/compare/compare.js
Page({
  data: {},

  onLoad() {},

  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  },

  navigateToPoster() {
    wx.navigateTo({
      url: '/pages/poster/poster'
    });
  }
});
