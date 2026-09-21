// pages/poster/poster.js
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

  onSaveImage() {
    wx.showLoading({ title: '海报生成中...' });
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '已保存至相册',
        icon: 'success',
        duration: 2000
      });
    }, 800);
  },

  onShareAppMessage() {
    return {
      title: '这是我的 2026 年度财务总结账单，快来测算你的吧！',
      path: '/pages/index/index'
    };
  }
});
