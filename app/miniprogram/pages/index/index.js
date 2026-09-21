// pages/index/index.js
import { getCollection, callCloudFunction, CURRENT_ENV } from '../../utils/db';

Page({
  data: {
    currentEnv: CURRENT_ENV,
  },

  onLoad() {
    console.log('[Index Page] 运行环境:', this.data.currentEnv);
  },
});
