import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Input } from '@tarojs/components'
import { listTable, deleteRow } from '../../services/cloudApi'
import { AppIcon } from '../../components/AppIcon'
import { triggerHaptic } from '../../utils/haptics'
import './index.less'

export default function LessonLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [searchKw, setSearchKw] = useState('')
  const [selectedClass, setSelectedClass] = useState('ALL')
  const [classes, setClasses] = useState<string[]>(['八3班', '八4班', '八9班', '八10班'])

  const fetchLogs = useCallback(async () => {
    try {
      const [logList, stuList] = await Promise.all([
        listTable('lesson_log'),
        listTable('students'),
      ])
      setLogs(logList)

      // 提取班级列表
      const allClasses = Array.from(new Set(stuList.map((s: any) => s.班级).filter(Boolean))) as string[]
      if (allClasses.length > 0) {
        setClasses(allClasses)
      }
    } catch (e) {
      console.error('加载课堂笔记失败', e)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useDidShow(() => {
    fetchLogs()
  })

  // 过滤后的笔记
  const filteredLogs = useMemo(() => {
    let list = [...logs]

    if (selectedClass !== 'ALL') {
      list = list.filter((l) => l.班级 === selectedClass)
    }

    if (searchKw.trim()) {
      const kw = searchKw.trim().toLowerCase()
      list = list.filter((l) => {
        const c = (l.内容 || '').toLowerCase()
        const k = (l.班级 || '').toLowerCase()
        const p = (l.节次 || '').toLowerCase()
        return c.includes(kw) || k.includes(kw) || p.includes(kw)
      })
    }

    // 按日期倒序、节次倒序
    return list.sort((a, b) => {
      const dateA = a.日期 || ''
      const dateB = b.日期 || ''
      if (dateA !== dateB) return dateB.localeCompare(dateA)
      return Number(b.节次 || 0) - Number(a.节次 || 0)
    })
  }, [logs, selectedClass, searchKw])

  // 跳转至编辑页面
  const handleGoEdit = (log?: any) => {
    triggerHaptic('light')
    if (log) {
      Taro.navigateTo({
        url: `/pages/lessonlog-edit/index?date=${log.日期}&klass=${encodeURIComponent(log.班级)}&period=${log.节次}&subject=${encodeURIComponent(log.科目 || '地理')}`,
      })
    } else {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      const targetClass = selectedClass !== 'ALL' ? selectedClass : (classes[0] || '八4班')
      Taro.navigateTo({
        url: `/pages/lessonlog-edit/index?date=${y}-${m}-${d}&klass=${encodeURIComponent(targetClass)}&period=1&subject=地理`,
      })
    }
  }

  // 删除笔记
  const handleDeleteLog = (log: any) => {
    triggerHaptic('medium')
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除 ${log.日期} 第${log.节次}节「${log.班级}」的课堂笔记吗？`,
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          const targetId = log.id || log._id
          await deleteRow('lesson_log', targetId)
          triggerHaptic('light')
          Taro.showToast({ title: '已删除课堂笔记', icon: 'success' })
          fetchLogs()
        }
      },
    })
  }

  return (
    <View className="page-container lesson-logs-page">
      {/* 顶部搜索框 */}
      <View className="search-bar flex-row">
        <AppIcon name="search" size={16} color="#94A3B8" />
        <Input
          className="search-input"
          placeholder="搜索教学进度、课后作业、知识点..."
          value={searchKw}
          onInput={(e) => setSearchKw(e.detail.value)}
        />
        {searchKw ? (
          <View className="clear-btn flex-center btn-active" onClick={() => setSearchKw('')}>
            <Text>×</Text>
          </View>
        ) : null}
      </View>

      {/* 班级筛选胶囊 */}
      <View className="class-filter-bar flex-row">
        <View
          className={`filter-chip btn-active ${selectedClass === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('light')
            setSelectedClass('ALL')
          }}
        >
          <Text>全部班级</Text>
        </View>
        {classes.map((cls) => (
          <View
            key={cls}
            className={`filter-chip btn-active ${selectedClass === cls ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('light')
              setSelectedClass(cls)
            }}
          >
            <Text>{cls}</Text>
          </View>
        ))}
      </View>

      {/* 笔记统计与快捷操作 */}
      <View className="list-meta-bar flex-between">
        <Text className="meta-count">共找到 {filteredLogs.length} 条教学笔记</Text>
        <View className="btn-add-note btn-active flex-row" onClick={() => handleGoEdit()}>
          <AppIcon name="book" size={13} color="#FFFFFF" />
          <Text style={{ marginLeft: '6rpx' }}>+ 新增笔记</Text>
        </View>
      </View>

      {/* 笔记列表 */}
      {filteredLogs.length === 0 ? (
        <View className="card empty-card flex-column flex-center">
          <View className="empty-icon-box flex-center">
            <AppIcon name="book" size={32} color="#94A3B8" />
          </View>
          <Text className="empty-title">暂无符合条件的课堂笔记</Text>
          <Text className="empty-desc">每节课后随手记一笔，轻松沉淀班级学情与作业要求</Text>
          <View className="btn-empty-add btn-active flex-row" onClick={() => handleGoEdit()}>
            <AppIcon name="book" size={14} color="#FFFFFF" />
            <Text style={{ marginLeft: '8rpx' }}>记一笔课堂笔记</Text>
          </View>
        </View>
      ) : (
        <View className="logs-list-flow">
          {filteredLogs.map((log) => (
            <View key={log.id || log._id} className="card log-card">
              <View className="flex-between log-card-header">
                <View className="flex-row">
                  <Text className="class-tag">{log.班级}</Text>
                  <Text className="period-tag">第 {log.节次} 节</Text>
                  {log.科目 && <Text className="subject-tag">{log.科目}</Text>}
                </View>
                <Text className="log-date">{log.日期}</Text>
              </View>

              <Text className="log-content">{log.内容}</Text>

              <View className="flex-between log-card-footer">
                <Text className="log-time">
                  {log._updated_at ? `更新于 ${log._updated_at.slice(11, 16)}` : '今日已保存'}
                </Text>
                <View className="actions flex-row">
                  <View
                    className="action-btn edit-btn btn-active flex-row"
                    onClick={() => handleGoEdit(log)}
                  >
                    <AppIcon name="edit" size={13} color="#2563EB" />
                    <Text style={{ marginLeft: '4rpx' }}>编辑</Text>
                  </View>
                  <View
                    className="action-btn del-btn btn-active flex-row"
                    onClick={() => handleDeleteLog(log)}
                  >
                    <AppIcon name="del" size={13} color="#EF4444" />
                    <Text style={{ marginLeft: '4rpx' }}>删除</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
