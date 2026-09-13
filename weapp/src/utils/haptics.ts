import Taro from '@tarojs/taro'

/**
 * 原生触感反馈 (遵循 wechat-miniprogram-ui-design 规范)
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.vibrateShort({ type })
    }
  } catch (err) {
    // 忽略不支持设备报错
  }
}
