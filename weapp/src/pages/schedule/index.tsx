import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Button, Input, Picker } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { listTable, createRow, updateRow, deleteRow } from '../../services/cloudApi'
import { WEEKDAYS, DEFAULT_PERIODS, getCurrentPeriod, hhmmToMinutes } from '../../utils/periods'
import { triggerHaptic } from '../../utils/haptics'
import { useAppStore } from '../../stores'
import { AppIcon } from '../../components/AppIcon'
import './index.less'

export default function SchedulePage() {
  const { classes } = useAppStore()
  const [scheduleData, setScheduleData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  // 默认选中今天星期
  const todayDay = useMemo(() => {
    const d = new Date().getDay()
    return (d >= 1 && d <= 5) ? WEEKDAYS[d - 1] : '周一'
  }, [])
  const [selectedDay, setSelectedDay] = useState<string>(todayDay)

  // 调课编辑弹窗状态
  const [editModal, setEditModal] = useState<{
    open: boolean
    periodN: number
    weekday: string
    currentId?: any
    subject: string
    className: string
  }>({
    open: false,
    periodN: 1,
    weekday: '周一',
    subject: '地理',
    className: '八3班',
  })

  const fetchSchedule = async () => {
    setLoading(true)
    try {
      const data = await listTable('schedule')
      setScheduleData(data)
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [])

  usePullDownRefresh(() => {
    fetchSchedule()
  })

  // 按 (星期-节次) 构造 Map
  const scheduleMap = useMemo(() => {
    const map = new Map<string, any>()
    scheduleData.forEach((item) => {
      const pStr = String(item.节次).replace(/[^0-9]/g, '')
      const key = `${item.星期}-${pStr}`
      map.set(key, item)
    })
    return map
  }, [scheduleData])

  // 获取当前正在进行的节次
  const currentPeriodItem = useMemo(() => getCurrentPeriod(), [])

  // 打开编辑/调课弹窗
  const handleOpenEdit = (weekday: string, periodN: number) => {
    triggerHaptic('light')
    const key = `${weekday}-${periodN}`
    const existing = scheduleMap.get(key)
    setEditModal({
      open: true,
      periodN,
      weekday,
      currentId: existing ? (existing.id || existing._id) : undefined,
      subject: existing ? (existing.科目 || '地理') : '地理',
      className: existing ? (existing.班级 || '八3班') : '八3班',
    })
  }

  // 保存排课/调课
  const handleSaveEdit = async () => {
    triggerHaptic('medium')
    const { weekday, periodN, currentId, subject, className } = editModal
    if (currentId) {
      // 更新现有
      await updateRow('schedule', currentId, {
        科目: subject,
        班级: className,
        星期: weekday,
        节次: String(periodN),
      })
      setScheduleData(scheduleData.map(s =>
        (s.id === currentId || s._id === currentId)
          ? { ...s, 科目: subject, 班级: className }
          : s
      ))
    } else {
      // 新增排课
      const created = await createRow('schedule', {
        科目: subject,
        班级: className,
        星期: weekday,
        节次: String(periodN),
      })
      setScheduleData([...scheduleData, created])
    }
    setEditModal(prev => ({ ...prev, open: false }))
    Taro.showToast({ title: '排课已保存', icon: 'success' })
  }

  // 清空本节课
  const handleClearPeriod = async () => {
    if (!editModal.currentId) {
      setEditModal(prev => ({ ...prev, open: false }))
      return
    }
    triggerHaptic('heavy')
    await deleteRow('schedule', editModal.currentId)
    setScheduleData(scheduleData.filter(s => s.id !== editModal.currentId && s._id !== editModal.currentId))
    setEditModal(prev => ({ ...prev, open: false }))
    Taro.showToast({ title: '已清空该节课', icon: 'none' })
  }

  return (
    <View className="page-container schedule-page">
      {/* 顶部视图切换与作息表入口 */}
      <View className="card top-controls flex-between">
        <View className="view-toggle flex-row">
          <View
            className={`toggle-tab btn-active ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('light')
              setViewMode('day')
            }}
          >
            单日视图
          </View>
          <View
            className={`toggle-tab btn-active ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('light')
              setViewMode('week')
            }}
          >
            整周网格
          </View>
        </View>

        <Button
          className="btn-periods btn-active flex-center"
          onClick={() => {
            triggerHaptic('light')
            Taro.navigateTo({ url: '/pages/periods/index' })
          }}
        >
          <AppIcon name="clock" size={13} color="#2563EB" />
          <Text style={{ marginLeft: '6rpx' }}>作息时间表</Text>
        </Button>
      </View>

      {/* 单日视图：星期切换条 */}
      {viewMode === 'day' && (
        <View className="card weekday-bar flex-row">
          {WEEKDAYS.map((w) => {
            const isSelected = selectedDay === w
            const isToday = todayDay === w
            return (
              <View
                key={w}
                className={`weekday-item btn-active flex-center ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('light')
                  setSelectedDay(w)
                }}
              >
                <Text className="w-name">{w}</Text>
                {isToday && <View className="today-dot" />}
              </View>
            )
          })}
        </View>
      )}

      {/* 单日节次流视图 */}
      {viewMode === 'day' && (
        <View className="day-schedule-list">
          {DEFAULT_PERIODS.map((p) => {
            const key = `${selectedDay}-${p.n}`
            const lesson = scheduleMap.get(key)
            const isCurrent = (todayDay === selectedDay) && (currentPeriodItem?.n === p.n)

            return (
              <View
                key={p.n}
                className={`card period-card ${isCurrent ? 'current-period' : ''} ${lesson ? 'has-lesson' : 'empty-lesson'}`}
                onClick={() => handleOpenEdit(selectedDay, p.n)}
              >
                <View className="period-time-col">
                  <Text className="period-n">第 {p.n} 节</Text>
                  <Text className="period-time">{p.time}</Text>
                  {isCurrent && <Text className="current-badge">正在上课</Text>}
                </View>

                <View className="period-content-col">
                  {lesson ? (
                    <View className="lesson-box">
                      <View className="flex-row">
                        <Text className="lesson-subject">{lesson.科目 || '课程'}</Text>
                        <Text className="lesson-class badge badge-primary">{lesson.班级}</Text>
                      </View>
                      <Text className="lesson-hint">点击可调课或修改</Text>
                    </View>
                  ) : (
                    <View className="no-lesson-box flex-between">
                      <Text className="no-lesson-text">无课安排 (空闲)</Text>
                      <Text className="btn-add-lesson">+ 排课</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* 整周网格视图 */}
      {viewMode === 'week' && (
        <View className="card week-grid-card">
          <View className="week-grid-header">
            <View className="grid-cell time-header">节次</View>
            {WEEKDAYS.map(w => (
              <View key={w} className={`grid-cell day-header ${w === todayDay ? 'is-today' : ''}`}>
                {w}
              </View>
            ))}
          </View>
          <View className="week-grid-body">
            {DEFAULT_PERIODS.slice(0, 8).map(p => (
              <View key={p.n} className="grid-row">
                <View className="grid-cell time-cell">
                  <Text className="cell-n">{p.n}</Text>
                  <Text className="cell-start">{p.start}</Text>
                </View>
                {WEEKDAYS.map(w => {
                  const lesson = scheduleMap.get(`${w}-${p.n}`)
                  return (
                    <View
                      key={w}
                      className={`grid-cell lesson-cell btn-active ${lesson ? 'active' : ''}`}
                      onClick={() => handleOpenEdit(w, p.n)}
                    >
                      {lesson ? (
                        <>
                          <Text className="grid-subject">{lesson.科目}</Text>
                          <Text className="grid-class">{lesson.班级}</Text>
                        </>
                      ) : (
                        <Text className="grid-empty">-</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 快速调课/排课弹窗 */}
      {editModal.open && (
        <View className="modal-mask flex-center">
          <View className="modal-box card">
            <Text className="modal-title">
              {editModal.weekday} 第 {editModal.periodN} 节 排课调课
            </Text>
            <View className="form-item">
              <Text className="form-label">科目名称</Text>
              <Input
                className="form-input"
                value={editModal.subject}
                placeholder="如: 地理"
                onInput={(e) => setEditModal(prev => ({ ...prev, subject: e.detail.value }))}
              />
            </View>
            <View className="form-item">
              <Text className="form-label">任教班级</Text>
              <Picker
                mode="selector"
                range={classes}
                value={classes.indexOf(editModal.className)}
                onChange={(e) => {
                  const idx = Number(e.detail.value)
                  setEditModal(prev => ({ ...prev, className: classes[idx] }))
                }}
              >
                <View className="picker-value-box flex-between">
                  <Text>{editModal.className}</Text>
                  <Text style={{ color: '#94A3B8' }}>切换 ▼</Text>
                </View>
              </Picker>
            </View>

            <View className="modal-actions flex-row">
              {editModal.currentId && (
                <Button className="btn-clear" onClick={handleClearPeriod}>清空本节</Button>
              )}
              <Button className="btn-cancel" onClick={() => setEditModal(prev => ({ ...prev, open: false }))}>
                取消
              </Button>
              <Button className="btn-confirm" onClick={handleSaveEdit}>保存</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
