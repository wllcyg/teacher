// pages/index/index.js
Page({
  data: {},

  onLoad() {},

  onSearchFocus() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none',
      duration: 1500
    });
  },

  navigateToResult(e) {
    const type = e.currentTarget.dataset.type || 'salary';
    const url = `/pages/result/result?type=${type}`;
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[Index] navigateTo failed, trying redirectTo:', err);
        wx.redirectTo({ url });
      }
    });
  },

  navigateToPrepayment() {
    const url = '/pages/prepayment/prepayment';
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[Index] navigateTo prepayment failed:', err);
        wx.redirectTo({ url });
      }
    });
  },

  navigateToCompare() {
    const url = '/pages/compare/compare';
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[Index] navigateTo compare failed:', err);
        wx.redirectTo({ url });
      }
    });
  },

  navigateToPoster() {
    const url = '/pages/poster/poster';
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[Index] navigateTo poster failed:', err);
        wx.redirectTo({ url });
      }
    });
  },

  navigateToFeatured() {
    const url = '/pages/featured/featured';
    wx.navigateTo({
      url,
      fail: (err) => {
        console.warn('[Index] navigateTo featured failed:', err);
        wx.redirectTo({ url });
      }
    });
  },

  showAITip() {
    wx.switchTab({
      url: '/pages/ai/ai'
    });
  }
});
