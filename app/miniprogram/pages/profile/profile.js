const app = getApp();

Page({
  data: {
    openid: '',
    userInfo: {
      nickName: '读者',
      avatarUrl: '' 
    },
    stats: {
      readCount: 0,
      readTime: '0.0',
      days: 1
    }
  },
  
  async onLoad() {
    wx.showLoading({ title: '加载中' });
    try {
      // 统一通过云函数处理登录和获取信息
      const res = await wx.cloud.callFunction({ 
        name: 'login',
        data: { envMode: app.globalData.mode }
      });
      
      if (res.result && res.result.success) {
        const { openid, userInfo } = res.result;
        this.setData({ 
          openid,
          'userInfo.nickName': userInfo.nickName || '读者',
          'userInfo.avatarUrl': userInfo.avatarUrl || ''
        });
      }
    } catch (err) {
      console.error('获取用户信息失败', err);
    }
    wx.hideLoading();
  },

  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    wx.showLoading({ title: '上传中' });
    try {
      // 提取后缀名
      const ext = avatarUrl.match(/\.([^.]+)$/)?.[1] || 'jpeg';
      const cloudPath = `avatars/${this.data.openid}-${Date.now()}.${ext}`;
      
      // 上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: avatarUrl
      });
      
      this.setData({ 'userInfo.avatarUrl': uploadRes.fileID });
      this.saveUserInfo();
    } catch (err) {
      console.error('上传头像失败', err);
      wx.showToast({ title: '上传失败', icon: 'error' });
    }
    wx.hideLoading();
  },

  onNicknameChange(e) {
    const { value } = e.detail;
    this.setData({ 'userInfo.nickName': value });
    this.saveUserInfo();
  },

  onNicknameBlur(e) {
    const { value } = e.detail;
    this.setData({ 'userInfo.nickName': value });
    this.saveUserInfo();
  },

  async saveUserInfo() {
    if (!this.data.openid) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          action: 'update',
          envMode: app.globalData.mode,
          userInfo: {
            nickName: this.data.userInfo.nickName,
            avatarUrl: this.data.userInfo.avatarUrl
          }
        }
      });
      if (res.result && res.result.success) {
        console.log('保存用户信息成功');
      } else {
        console.error('保存用户信息失败:', res.result?.error);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存用户信息网络异常', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    wx.showToast({
      title: '点击了 ' + type,
      icon: 'none'
    });
  }
})
