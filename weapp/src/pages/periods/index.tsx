import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DEFAULT_PERIODS, getCurrentPeriod, PeriodItem } from '../../utils/periods'
import { triggerHaptic } from '../../utils/haptics'
import { AppIcon } from '../../components/AppIcon'
import './index.less'

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<PeriodItem[]>(DEFAULT_PERIODS)
  const [currentP, setCurrentP] = useState<PeriodItem | null>(null)
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      const s = String(now.getSeconds()).padStart(2, '0')
      setCurrentTimeStr(`${h}:${m}:${s}`)
      setCurrentP(getCurrentPeriod(`${h}:${m}`))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // 分类时段
  const morningList = periods.slice(0, 4)
  const afternoonList = periods.slice(4, 8)
  const eveningList = periods.slice(8, 11)

  const renderSection = (title: string, list: PeriodItem[], tagColor: string) => (
    <View className="card section-card">
      <View className="flex-between section-header">
        <Text className="section-title">{title}</Text>
        <Text className="badge" style={{ backgroundColor: `${tagColor}15`, color: tagColor }}>
          {list.length} 节
        </Text>
      </View>
      <View className="period-items-list">
        {list.map((p) => {
          const isCurrent = currentP?.n === p.n
          return (
            <View
              key={p.n}
              className={`period-row flex-between btn-active ${isCurrent ? 'is-active' : ''}`}
              onClick={() => {
                triggerHaptic('light')
                Taro.showToast({
                  title: `第${p.n}节: ${p.start} ~ ${p.end}`,
                  icon: 'none',
                })
              }}
            >
              <View className="flex-row">
                <View className={`num-tag flex-center ${isCurrent ? 'active' : ''}`}>
                  <Text>{p.n}</Text>
                </View>
                <View className="time-info">
                  <Text className="period-label">第 {p.n} 节课</Text>
                  <Text className="period-span">{p.start} - {p.end}</Text>
                </View>
              </View>

              {isCurrent ? (
                <View className="active-pill flex-center">
                  <Text className="pulse-dot" />
                  <Text className="active-text">正在进行</Text>
                </View>
              ) : (
                <Text className="duration-text">40 分钟</Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )

  return (
    <View className="page-container periods-page">
      {/* 顶部当前时间指示看板 */}
      <View className="card time-board-card flex-between">
        <View>
          <Text className="board-sub">当前校准时间</Text>
          <Text className="board-time">{currentTimeStr || '--:--:--'}</Text>
        </View>
        <View className="current-status-box">
          {currentP ? (
            <View className="status-badge on-duty flex-center">
              <AppIcon name="bell" size={13} color="#93C5FD" />
              <Text className="status-text" style={{ marginLeft: '8rpx' }}>正在上第 {currentP.n} 节课</Text>
            </View>
          ) : (
            <View className="status-badge off-duty flex-center">
              <AppIcon name="clock" size={13} color="#CBD5E1" />
              <Text className="status-text" style={{ marginLeft: '8rpx' }}>当前处于课间/课外</Text>
            </View>
          )}
        </View>
      </View>

      {/* 上午时段 */}
      {renderSection('上午教学时段', morningList, '#2563EB')}

      {/* 下午时段 */}
      {renderSection('下午教学时段', afternoonList, '#D97706')}

      {/* 晚自习时段 */}
      {renderSection('晚自习辅导时段', eveningList, '#7C3AED')}
    </View>
  )
}
