import Taro from '@tarojs/taro'

// @ts-ignore
const currentSchema = typeof DB_SCHEMA !== 'undefined' ? DB_SCHEMA : 'test'

export interface CallResult<T = any> {
  code: number
  data?: T
  message?: string
}

/**
 * 统一调用教师服务云函数
 */
export async function callTeacherService<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  try {
    const res = await Taro.cloud.callFunction({
      name: 'teacher-service',
      data: {
        action,
        schema: currentSchema,
        ...payload
      }
    })

    const result = res.result as CallResult<T>
    if (!result || result.code !== 0) {
      const msg = result?.message || '请求服务失败'
      Taro.showToast({ title: msg, icon: 'none' })
      throw new Error(msg)
    }

    return result.data as T
  } catch (err: any) {
    console.error(`[callTeacherService error] action=${action}:`, err)
    throw err
  }
}
