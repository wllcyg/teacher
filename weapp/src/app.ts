import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Taro from '@tarojs/taro'

import '@nutui/nutui-taro/dist/style.css'
import './app.less'

const App = createApp({
  onLaunch() {
    if (process.env.TARO_ENV === 'weapp') {
      if (!Taro.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      } else {
        Taro.cloud.init({
          env: 'teacher-d4g74wc9be2d5b1f5',
          traceUser: true,
        })
      }
    }
  },
  onShow(options) {
  },
  // 入口组件不需要实现 render 方法，即使实现了也会被 taro 所覆盖
})

App.use(createPinia())

export default App
