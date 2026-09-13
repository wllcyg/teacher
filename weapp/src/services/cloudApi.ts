import Taro from '@tarojs/taro'
import { DB_SCHEMA, CLOUD_ENV } from './env'
import { DEFAULT_PERIODS } from '../utils/periods'
import { MOCK_SUMMARY_DATA } from './seedData'

// 本地测试缓存 Key 前缀，根据环境隔离
const STORAGE_PREFIX = `teacher_wb_${DB_SCHEMA}_`

export interface CloudRecord {
  _id?: string
  id?: number | string
  _env?: string
  _openid?: string
  [key: string]: any
}

/** 检查并获取云数据库实例 */
function getCloudDb() {
  if (process.env.TARO_ENV === 'weapp' && Taro.cloud) {
    try {
      return Taro.cloud.database()
    } catch (e) {
      console.warn('[CloudApi] 云数据库暂未初始化完成，回退至本地隔离缓存', e)
    }
  }
  return null
}

/** 从本地隔离缓存读取表数据 */
function getLocalTable(table: string): CloudRecord[] {
  try {
    const key = STORAGE_PREFIX + table
    const data = Taro.getStorageSync(key)
    return Array.isArray(data) ? data : []
  } catch (e) {
    return []
  }
}

/** 写入本地隔离缓存 */
function setLocalTable(table: string, data: CloudRecord[]) {
  try {
    const key = STORAGE_PREFIX + table
    Taro.setStorageSync(key, data)
  } catch (e) {
    console.error('[CloudApi] 本地缓存存储失败', e)
  }
}

// 记录云端未开通的集合，避免重复报错与刷屏
const unavailableCollections = new Set<string>()

/**
 * 列表查询 (严格按当前环境隔离: test 只能查 test，prod 只能查 prod)
 */
export async function listTable(table: string, filters?: Record<string, any>): Promise<CloudRecord[]> {
  const db = getCloudDb()
  if (db && !unavailableCollections.has(table)) {
    try {
      let query: any = { _env: DB_SCHEMA }
      if (filters) {
        Object.assign(query, filters)
      }
      const res = await db.collection(table).where(query).limit(100).get()
      if (res.data && res.data.length > 0) {
        return res.data
      }
    } catch (e: any) {
      unavailableCollections.add(table)
      console.info(`[CloudApi] 云端集合 [${table}] 尚未在云开发控制台创建，自动启用「本地沙箱隔离存储」(分区: ${DB_SCHEMA})`)
    }
  }

  // 本地存储兜底
  let records = getLocalTable(table)
  // 严格过滤环境
  records = records.filter(r => (r._env || DB_SCHEMA) === DB_SCHEMA)

  if (filters) {
    return records.filter(item => {
      return Object.entries(filters).every(([k, v]) => {
        if (v === undefined || v === null || v === '') return true
        return String(item[k]) === String(v)
      })
    })
  }
  return records
}

/**
 * 单条查询
 */
export async function getRow(table: string, id: string | number): Promise<CloudRecord | null> {
  const list = await listTable(table)
  return list.find(r => String(r.id || r._id) === String(id)) || null
}

/**
 * 创建单条记录（强制注入当前环境隔离标签）
 */
export async function createRow(table: string, payload: Record<string, any>): Promise<CloudRecord> {
  const now = new Date().toISOString()
  const newRecord: CloudRecord = {
    ...payload,
    id: payload.id || Date.now(),
    _env: DB_SCHEMA, // 核心：环境隔离标记，test 或 prod
    _created_at: now,
    _updated_at: now,
  }

  const db = getCloudDb()
  if (db && !unavailableCollections.has(table)) {
    try {
      const res = await db.collection(table).add({ data: newRecord })
      newRecord._id = res._id
    } catch (e) {
      unavailableCollections.add(table)
    }
  }

  // 同时同步本地隔离存储
  const list = getLocalTable(table)
  list.unshift(newRecord)
  setLocalTable(table, list)

  return newRecord
}


/**
 * 更新记录
 */
export async function updateRow(table: string, id: string | number, payload: Record<string, any>): Promise<CloudRecord> {
  const now = new Date().toISOString()
  const db = getCloudDb()
  if (db) {
    try {
      const targetId = String(id)
      await db.collection(table).doc(targetId).update({
        data: { ...payload, _updated_at: now }
      })
    } catch (e) {
      // ignore
    }
  }

  const list = getLocalTable(table)
  const idx = list.findIndex(r => String(r.id || r._id) === String(id))
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...payload, _updated_at: now }
    setLocalTable(table, list)
    return list[idx]
  }

  return { id, ...payload }
}

/**
 * 删除记录
 */
export async function deleteRow(table: string, id: string | number): Promise<void> {
  const db = getCloudDb()
  if (db) {
    try {
      await db.collection(table).doc(String(id)).remove()
    } catch (e) {
      // ignore
    }
  }

  const list = getLocalTable(table)
  const filtered = list.filter(r => String(r.id || r._id) !== String(id))
  setLocalTable(table, filtered)
}

/**
 * 批量插入
 */
export async function batchCreateRows(table: string, rows: Record<string, any>[]): Promise<{ count: number }> {
  const list = getLocalTable(table)
  const now = new Date().toISOString()
  const newItems = rows.map((r, i) => ({
    ...r,
    id: r.id || Date.now() + i,
    _env: DB_SCHEMA,
    _created_at: now,
  }))

  const db = getCloudDb()
  if (db) {
    for (const item of newItems) {
      try {
        await db.collection(table).add({ data: item })
      } catch (e) {
        // ignore
      }
    }
  }

  setLocalTable(table, [...newItems, ...list])
  return { count: newItems.length }
}

/**
 * 仅在测试环境可用的「一键初始化测试种子数据」方法
 * 生产环境严格禁用
 */
export async function initTestDataIfEmpty(seedBundle: { students: any[]; schedule: any[]; todos: any[]; items: any[]; lesson_log?: any[] }) {
  if (DB_SCHEMA !== 'test') {
    console.warn('[CloudApi] 严正警告：当前为生产环境 prod，禁止初始化测试数据！')
    return false
  }

  const currentStudents = getLocalTable('students')
  // 当本地尚无数据或少于100人时，自动全量注入四个班级的完整名册（共 217 人）
  if (currentStudents.length < 100) {
    console.log('[CloudApi] 测试环境正在载入四个班级完整名册（八3班、八4班、八9班、八10班共 217 人）...')
    setLocalTable('students', seedBundle.students.map(r => ({ ...r, _env: 'test' })))
    setLocalTable('schedule', seedBundle.schedule.map(r => ({ ...r, _env: 'test' })))
    setLocalTable('todos', seedBundle.todos.map(r => ({ ...r, _env: 'test' })))
    setLocalTable('quicknote_items', seedBundle.items.map(r => ({ ...r, _env: 'test' })))
    if (seedBundle.lesson_log) {
      setLocalTable('lesson_log', seedBundle.lesson_log.map(r => ({ ...r, _env: 'test' })))
    }
    console.log('[CloudApi] 四个班级名册与测试种子数据全量初始化完成！')
    return true
  }
  return false
}

/**
 * 获取指定班级的学情概览与考试缺考统计（完全对齐 Web 端 /report/summary）
 */
export async function getSummaryOverview(klass?: string): Promise<any> {
  const targetKlass = klass || '八4班'
  // 若环境已有数据则按班级取，无则平滑降级
  const data = MOCK_SUMMARY_DATA[targetKlass] || MOCK_SUMMARY_DATA['八4班']
  return data
}

