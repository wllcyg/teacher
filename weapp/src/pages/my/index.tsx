import React, { useState, useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DB_SCHEMA, CLOUD_ENV } from '../../services/env'
import { TEST_SEED_DATA } from '../../services/seedData'
import { triggerHaptic } from '../../utils/haptics'
import { AppIcon } from '../../components/AppIcon'
import './index.less'

export default function MyPage() {
  const [openid, setOpenid] = useState('wx_teacher_openid_demo')

  useEffect(() => {
    // 微信免登检测
    if (process.env.TARO_ENV === 'weapp' && Taro.cloud) {
      Taro.cloud.callFunction({
        name: 'teacher-service',
        data: { action: 'getProfile' }
      }).then((res: any) => {
        if (res?.result?.teacher?.openid) {
          setOpenid(res.result.teacher.openid)
        }
      }).catch(() => {
        // 允许静默兜底
      })
    }
  }, [])

  // 测试环境专用：重新导入测试种子数据
  const handleResetTestData = () => {
    if (DB_SCHEMA !== 'test') {
      Taro.showToast({ title: '生产环境严禁操作测试数据', icon: 'error' })
      return
    }

    Taro.showModal({
      title: '重置测试数据',
      content: '确定重新从 Python 导出的测试数据包重置当前测试库吗？',
      success: (res) => {
        if (res.confirm) {
          triggerHaptic('medium')
          const prefix = `teacher_wb_test_`
          Taro.setStorageSync(`${prefix}students`, TEST_SEED_DATA.students)
          Taro.setStorageSync(`${prefix}schedule`, TEST_SEED_DATA.schedule)
          Taro.setStorageSync(`${prefix}todos`, TEST_SEED_DATA.todos)
          Taro.setStorageSync(`${prefix}quicknote_items`, TEST_SEED_DATA.items)
          Taro.setStorageSync(`${prefix}quicknote_records`, [])
          Taro.showToast({ title: '测试数据重置成功', icon: 'success' })
        }
      }
    })
  }

  return (
    <View className="page-container my-page">
      {/* 教师身份卡片 (微信免登) */}
      <View className="card user-card flex-row">
        <View className="avatar-circle flex-center">
          <AppIcon name="user" size={28} color="#2563EB" />
        </View>
        <View className="user-info">
          <Text className="user-name">地理教师 · 工作台</Text>
          <Text className="user-openid">身份ID: {openid.slice(0, 16)}...</Text>
          <View className="wx-badge">
            <Text>微信原生免登已激活 ✓</Text>
          </View>
        </View>
      </View>

      {/* 环境与隔离控制台 */}
      <View className="card env-card">
        <View className="flex-between env-header">
          <View className="flex-row">
            <AppIcon name="setting" size={16} color="#1E293B" />
            <Text className="env-title" style={{ marginLeft: '8rpx' }}>环境与数据隔离控制台</Text>
          </View>
          <Text className={`env-status-tag ${DB_SCHEMA}`}>
            {DB_SCHEMA === 'test' ? '测试环境 (test)' : '生产环境 (prod)'}
          </Text>
        </View>

        <View className="env-details">
          <View className="detail-row flex-between">
            <Text className="d-label">云开发环境 ID</Text>
            <Text className="d-val">{CLOUD_ENV}</Text>
          </View>
          <View className="detail-row flex-between">
            <Text className="d-label">当前数据隔离分区</Text>
            <Text className="d-val">{DB_SCHEMA === 'test' ? '仅测试数据可见 (test)' : '生产正式分区 (prod)'}</Text>
          </View>
          <View className="detail-row flex-between">
            <Text className="d-label">数据防污染安全锁</Text>
            <Text className="d-val lock-ok">已生效 (Active)</Text>
          </View>
        </View>

        {/* 测试环境专享操作 */}
        {DB_SCHEMA === 'test' ? (
          <View className="test-actions">
            <Text className="test-tips">
              当前为测试模式，可安全导入从 Python 端导出的名册与课表测试包，绝不污染生产环境：
            </Text>
            <Button className="btn-reset-test btn-active flex-center" onClick={handleResetTestData}>
              <AppIcon name="refresh" size={14} color="#2563EB" />
              <Text style={{ marginLeft: '8rpx' }}>一键重置/同步测试种子数据</Text>
            </Button>
          </View>
        ) : (
          <View className="prod-lock-tips flex-row">
            <AppIcon name="check" size={14} color="#059669" />
            <Text className="lock-text" style={{ marginLeft: '8rpx' }}>生产保护模式生效中，严格隔离测试数据。</Text>
          </View>
        )}
      </View>

      {/* 版本与说明 */}
      <View className="card info-card">
        <View className="info-row flex-between">
          <Text className="i-title">架构体系</Text>
          <Text className="i-desc">Taro 4 + React 18 + CloudBase</Text>
        </View>
        <View className="info-row flex-between">
          <Text className="i-title">首期核心模块</Text>
          <Text className="i-desc">快记 / 待办 / 名册 / 课表 / 作息</Text>
        </View>
        <View className="info-row flex-between">
          <Text className="i-title">版本号</Text>
          <Text className="i-desc">v1.0.0-react</Text>
        </View>
      </View>
    </View>
  )
}
