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
    wx.navigateTo({
      url: `/pages/result/result?type=${type}`
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
  },

  navigateToFeatured() {
    wx.navigateTo({
      url: '/pages/featured/featured'
    });
  },

  showAITip() {
    wx.switchTab({
      url: '/pages/ai/ai'
    });
  }
});
