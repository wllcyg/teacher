App({
  onLaunch: function () {
    // 自动检测小程序运行环境 (develop: 开发版, trial: 体验版, release: 正式版)
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    const ENV_MODE = envVersion === 'release' ? 'prod' : 'dev';
    
    this.globalData = {
      env: "teacher-d4g74wc9be2d5b1f5",
      mode: ENV_MODE,
      dbPrefix: ENV_MODE === 'prod' ? 'prod_' : 'test_'
    };

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      })
    }
  }
})
