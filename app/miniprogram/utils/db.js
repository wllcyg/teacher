/**
 * 云数据库与环境隔离工具模块 (方案 B: 表名前缀隔离)
 * 只区分两套逻辑环境: 'dev' (开发/测试) 与 'prd' (正式线上)
 */

/**
 * 获取当前运行时环境标识
 * @returns {'dev' | 'prd'}
 */
export const getCurrentEnv = () => {
  try {
    const accountInfo = wx.getAccountInfoSync?.();
    const envVersion = accountInfo?.miniProgram?.envVersion;
    // 只有微信官方正式发布版 (release) 为 prd，其余 (develop 开发版 / trial 体验版) 均为 dev
    if (envVersion === 'release') {
      return 'prd';
    }
  } catch (err) {
    console.warn('[db.js] 获取 envVersion 失败，降级为 dev:', err);
  }
  return 'dev';
};

/**
 * 当前环境标识常量
 */
export const CURRENT_ENV = getCurrentEnv();

/**
 * 根据逻辑表名动态获取带环境前缀的真实集合名
 * @param {string} baseName 业务基础表名，如 'students', 'homework', 'attendance'
 * @returns {string} 真实集合名，如 'dev_students' 或 'prd_students'
 */
export const getTableName = (baseName) => {
  const env = getCurrentEnv();
  return `${env}_${baseName}`;
};

/**
 * 快捷获取带前缀的云数据库集合引用
 * @param {string} baseName 业务基础表名
 * @returns {DB.CollectionReference}
 * 
 * 示例:
 * import { getCollection } from '../../utils/db';
 * const res = await getCollection('students').get();
 */
export const getCollection = (baseName) => {
  const realName = getTableName(baseName);
  return wx.cloud.database().collection(realName);
};

/**
 * 统一云函数调用包装（自动注入环境标识）
 * @param {string} name 云函数名称
 * @param {object} data 传递给云函数的参数
 */
export const callCloudFunction = async (name, data = {}) => {
  const env = getCurrentEnv();
  return wx.cloud.callFunction({
    name,
    config: {
      env: 'teacher-d4g74wc9be2d5b1f5',
    },
    data: {
      ...data,
      _env: env, // 透传环境标识给云函数
    },
  });
};
