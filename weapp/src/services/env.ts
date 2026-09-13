/**
 * 运行环境与数据库隔离配置
 * 严格区分测试环境 (test) 与生产环境 (prod)，杜绝测试数据污染正式环境
 */

export const IS_DEV = process.env.NODE_ENV === 'development'

// 云开发环境 ID
export const CLOUD_ENV = process.env.TARO_APP_CLOUD_ENV || 'teacher-d4g74wc9be2d5b1f5'

// 当前数据库隔离 Schema ('test' | 'prod')
export const DB_SCHEMA: 'test' | 'prod' =
  (process.env.TARO_APP_DB_SCHEMA as 'test' | 'prod') || (IS_DEV ? 'test' : 'prod')

console.log(`[EnvConfig] 当前运行环境: ${process.env.NODE_ENV}, 数据隔离分区: ${DB_SCHEMA}, 云环境: ${CLOUD_ENV}`)
