import { Component, PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
import { CLOUD_ENV, DB_SCHEMA } from './services/env'
import { initTestDataIfEmpty } from './services/cloudApi'
import { TEST_SEED_DATA } from './services/seedData'
import './app.less'

class App extends Component<PropsWithChildren> {
  componentDidMount() {
    if (process.env.TARO_ENV === 'weapp') {
      if (!Taro.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用微信云能力')
      } else {
        Taro.cloud.init({
          env: CLOUD_ENV,
          traceUser: true,
        })
        console.log(`[CloudBase] 微信云开发已连接，环境 ID: ${CLOUD_ENV}，数据隔离分区: ${DB_SCHEMA}`)
      }

      // 测试环境自动注入隔离测试种子数据（生产环境绝对跳过）
      if (DB_SCHEMA === 'test') {
        initTestDataIfEmpty(TEST_SEED_DATA)
      }
    }
  }

  render() {
    return this.props.children
  }
}

export default App
