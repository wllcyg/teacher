import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { usePullDownRefresh, useDidShow } from '@tarojs/taro'
import { listTable, updateRow, getSummaryOverview } from '../../services/cloudApi'
import { WEEKDAYS, DEFAULT_PERIODS, getCurrentPeriod, hhmmToMinutes } from '../../utils/periods'
import { triggerHaptic } from '../../utils/haptics'
import { DB_SCHEMA } from '../../services/env'
import { useAppStore } from '../../stores'
import { getRandomQuote } from '../../services/quotes'
import { AppIcon } from '../../components/AppIcon'
import './index.less'

function getGreetingText(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

const POSTER_THEMES = [
  {
    id: 'warm',
    name: '晨曦暖金',
    dot: '#D97706',
    bg: 'linear-gradient(145deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)',
    border: '#FCD34D',
    textColor: '#78350F',
    accentColor: '#B45309',
  },
  {
    id: 'bamboo',
    name: '竹青草木',
    dot: '#16A34A',
    bg: 'linear-gradient(145deg, #F0FDF4 0%, #DCFCE7 50%, #BBF7D0 100%)',
    border: '#86EFAC',
    textColor: '#14532D',
    accentColor: '#15803D',
  },
  {
    id: 'ink',
    name: '水墨素笺',
    dot: '#64748B',
    bg: 'linear-gradient(145deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)',
    border: '#CBD5E1',
    textColor: '#1E293B',
    accentColor: '#475569',
  },
  {
    id: 'indigo',
    name: '暮色静蓝',
    dot: '#0284C7',
    bg: 'linear-gradient(145deg, #F0F9FF 0%, #E0F2FE 50%, #BAE6FD 100%)',
    border: '#7DD3FC',
    textColor: '#0C4A6E',
    accentColor: '#0369A1',
  },
]

export default function IndexPage() {
  const { currentClass, setCurrentClass, classes } = useAppStore()
  const [todos, setTodos] = useState<any[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [lessonLogs, setLessonLogs] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [quoteText, setQuoteText] = useState<string>('晨光微露，心向阳光，愿您和孩子们度过充实美好的一天。')
  const [refreshingQuote, setRefreshingQuote] = useState(false)
  const [posterModalVisible, setPosterModalVisible] = useState(false)
  const [posterTheme, setPosterTheme] = useState('warm')

  // 今日日期与真实星期定义（根据本地时间准确计算）
  const [todayStr, todayWeekday] = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return [`${y}-${m}-${d}`, WEEKDAY_NAMES[now.getDay()]]
  }, [])

  // 加载数据
  const fetchData = async () => {
    try {
      const [tList, sList, stuList, logList, sumData] = await Promise.all([
        listTable('todos'),
        listTable('schedule'),
        listTable('students'),
        listTable('lesson_log', { 日期: todayStr }),
        getSummaryOverview(currentClass),
      ])
      setTodos(tList)
      setSchedule(sList)
      setStudents(stuList)
      setLessonLogs(logList)
      setSummary(sumData)
    } finally {
      Taro.stopPullDownRefresh()
    }
  }

  // 监听班级变动联动学情数据
  useEffect(() => {
    if (currentClass) {
      getSummaryOverview(currentClass).then((res) => setSummary(res))
    }
  }, [currentClass])

  // 学情概览衍生数据
  const absentees = useMemo(() => summary?.缺考名单 || [], [summary])
  const exam = useMemo(() => summary?.考试 || null, [summary])
  const completionRates = useMemo(() => summary?.完成率 || [], [summary])
  const behavior = useMemo(() => summary?.表现 || null, [summary])
  const attendance = useMemo(() => summary?.考勤 || null, [summary])
  const netBehavior = useMemo(() => {
    return (behavior?.本周加分 || 0) - (behavior?.本周减分 || 0)
  }, [behavior])

  const activeThemeObj = useMemo(() => {
    return POSTER_THEMES.find((t) => t.id === posterTheme) || POSTER_THEMES[0]
  }, [posterTheme])

  useEffect(() => {
    fetchData()
  }, [])

  useDidShow(() => {
    fetchData()
  })

  usePullDownRefresh(() => {
    fetchData()
  })

  // 今日课程列表（按节次排序）
  const todayLessons = useMemo(() => {
    return schedule
      .filter((s) => s.星期 === todayWeekday)
      .map((s) => ({
        ...s,
        节次号: parseInt(String(s.节次).replace(/[^0-9]/g, ''), 10) || 0,
      }))
      .sort((a, b) => a.节次号 - b.节次号)
  }, [schedule, todayWeekday])

  // 当前时间（分钟，每 30 秒自动刷新，保证下课时刻实时感知）
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })

  // 下课提醒横幅状态
  const [lessonEndAlert, setLessonEndAlert] = useState<{
    lesson: any
    period: any
    storageKey: string
  } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date()
      setNowMinutes(d.getHours() * 60 + d.getMinutes())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // 1. 正在上的课 (start <= now < end)
  const currentLesson = useMemo(() => {
    return (
      todayLessons.find((l) => {
        const p = DEFAULT_PERIODS.find((x) => x.n === l.节次号)
        if (!p) return false
        return hhmmToMinutes(p.start) <= nowMinutes && nowMinutes < hhmmToMinutes(p.end)
      }) || null
    )
  }, [todayLessons, nowMinutes])

  const currentPeriod = useMemo(() => {
    return currentLesson ? DEFAULT_PERIODS.find((p) => p.n === currentLesson.节次号) : null
  }, [currentLesson])

  // 当前课剩余分钟数
  const remainMinutes = useMemo(() => {
    if (!currentPeriod) return 0
    return Math.max(0, hhmmToMinutes(currentPeriod.end) - nowMinutes)
  }, [currentPeriod, nowMinutes])

  // 当前课进度百分比
  const progressPct = useMemo(() => {
    if (!currentPeriod) return 0
    const total = hhmmToMinutes(currentPeriod.end) - hhmmToMinutes(currentPeriod.start)
    const elapsed = nowMinutes - hhmmToMinutes(currentPeriod.start)
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }, [currentPeriod, nowMinutes])

  // 2. 下一节课
  const nextLesson = useMemo(() => {
    return (
      todayLessons.find((l) => {
        const p = DEFAULT_PERIODS.find((x) => x.n === l.节次号)
        if (!p) return false
        if (currentLesson) {
          return hhmmToMinutes(p.start) > nowMinutes
        }
        return hhmmToMinutes(p.end) > nowMinutes
      }) || null
    )
  }, [todayLessons, nowMinutes, currentLesson])

  const nextPeriod = useMemo(() => {
    return nextLesson ? DEFAULT_PERIODS.find((p) => p.n === nextLesson.节次号) : null
  }, [nextLesson])

  // 3. 刚上完的上一节课（已结束的课中离当前时间最近的一节）
  const lastLesson = useMemo(() => {
    const finished = todayLessons.filter((l) => {
      const p = DEFAULT_PERIODS.find((x) => x.n === l.节次号)
      return p && hhmmToMinutes(p.end) <= nowMinutes
    })
    return finished.length > 0 ? finished[finished.length - 1] : null
  }, [todayLessons, nowMinutes])

  // 核心调度：检测是否有刚下课但未记笔记的课程（下课 0 ~ 30 分钟内智能提示，当天该节课仅提醒一次）
  useEffect(() => {
    if (todayLessons.length === 0) return

    for (const l of todayLessons) {
      const p = DEFAULT_PERIODS.find((x) => x.n === l.节次号)
      if (!p) continue

      const endMinutes = hhmmToMinutes(p.end)
      const diffAfter = nowMinutes - endMinutes

      // 下课 0 ~ 30 分钟内
      if (diffAfter >= 0 && diffAfter <= 30) {
        const recorded = lessonLogs.some(
          (log) => String(log.节次) === String(l.节次号) && log.班级 === l.班级
        )
        if (recorded) continue

        const storageKey = `notified_lesson_end_${todayStr}_${l.节次号}_${l.班级}`
        const alreadyNotified = Taro.getStorageSync(storageKey)
        if (!alreadyNotified) {
          triggerHaptic('medium')
          setLessonEndAlert({
            lesson: l,
            period: p,
            storageKey,
          })
          break
        }
      }
    }
  }, [todayLessons, lessonLogs, nowMinutes, todayStr])

  // 判断某节课是否已记笔记
  const isLessonRecorded = useCallback(
    (periodNum: number, klass: string) => {
      return lessonLogs.some(
        (log) => String(log.节次) === String(periodNum) && log.班级 === klass
      )
    },
    [lessonLogs]
  )

  // 跳转至记课堂新页面
  const handleOpenLog = (lesson: any) => {
    triggerHaptic('light')
    const k = lesson.班级 || currentClass || '八4班'
    const p = lesson.节次号 || lesson.节次 || 1
    const sub = lesson.科目 || '地理'
    Taro.navigateTo({
      url: `/pages/lessonlog-edit/index?date=${todayStr}&klass=${encodeURIComponent(k)}&period=${p}&subject=${encodeURIComponent(sub)}`,
    })
  }

  // 快捷发起课堂记笔记（自动带入当前/最后一节/默认任教班级）
  const handleOpenQuickLog = () => {
    triggerHaptic('light')
    const targetLesson = currentLesson || lastLesson || nextLesson
    const k = targetLesson?.班级 || currentClass || (classes[0] || '八4班')
    const p = targetLesson?.节次号 || targetLesson?.节次 || 1
    const sub = targetLesson?.科目 || '地理'
    Taro.navigateTo({
      url: `/pages/lessonlog-edit/index?date=${todayStr}&klass=${encodeURIComponent(k)}&period=${p}&subject=${encodeURIComponent(sub)}`,
    })
  }

  // 从下课提醒横幅前往记录
  const handleRecordFromAlert = (alertItem: any) => {
    triggerHaptic('medium')
    Taro.setStorageSync(alertItem.storageKey, String(Date.now()))
    setLessonEndAlert(null)
    Taro.navigateTo({
      url: `/pages/lessonlog-edit/index?date=${todayStr}&klass=${encodeURIComponent(alertItem.lesson.班级)}&period=${alertItem.lesson.节次号}&subject=${encodeURIComponent(alertItem.lesson.科目 || '地理')}`,
    })
  }

  // 关闭下课提醒横幅
  const handleDismissAlert = (alertItem: any) => {
    triggerHaptic('light')
    Taro.setStorageSync(alertItem.storageKey, String(Date.now()))
    setLessonEndAlert(null)
  }

  // 直达随堂快记 (切换至快记 Tab)
  const handleGoQuickNote = (targetClass?: string) => {
    triggerHaptic('light')
    if (targetClass) {
      setCurrentClass(targetClass)
    }
    Taro.switchTab({ url: '/pages/quicknote/index' })
  }

  // 换一句寄语
  const handleRefreshQuote = () => {
    triggerHaptic('light')
    setRefreshingQuote(true)
    const nextQ = getRandomQuote(quoteText)
    setQuoteText(nextQ)
    setTimeout(() => setRefreshingQuote(false), 500)
  }

  // 复制寄语
  const handleCopyQuote = () => {
    triggerHaptic('light')
    Taro.setClipboardData({
      data: quoteText,
      success: () => {
        Taro.showToast({ title: '已复制寄语到剪贴板', icon: 'success' })
      },
    })
  }

  // 首页一键直接办结待办
  const handleCompleteTodo = async (item: any) => {
    triggerHaptic('medium')
    await updateRow('todos', item.id || item._id, { 状态: '已办' })
    setTodos(todos.map((t) => ((t.id === item.id || t._id === item._id) ? { ...t, 状态: '已办' } : t)))
    Taro.showToast({ title: `已办结: ${item.事项}`, icon: 'success' })
  }

  // 待办分析：逾期的 + 今天的
  const overdueTodos = useMemo(() => {
    return todos.filter((t) => t.状态 !== '已办' && t.日期 && t.日期 < todayStr)
  }, [todos, todayStr])

  const todayPendingTodos = useMemo(() => {
    return todos.filter((t) => t.状态 !== '已办' && (!t.日期 || t.日期 >= todayStr))
  }, [todos, todayStr])

  // 今日已记录的笔记（按节次升序）
  const sortedTodayLogs = useMemo(() => {
    return [...lessonLogs].sort((a, b) => Number(a.节次) - Number(b.节次))
  }, [lessonLogs])

  return (
    <View className="page-container index-page">
      {/* 顶部动态问候栏 */}
      <View className="flex-between header-greet-bar">
        <View>
          <Text className="greet-title">{getGreetingText()}，老师</Text>
          <Text className="greet-date">
            {todayStr} {todayWeekday}
          </Text>
        </View>
        <View className={`env-tag ${DB_SCHEMA}`}>
          <Text>{DB_SCHEMA === 'test' ? '测试环境' : '生产环境'}</Text>
        </View>
      </View>

      {/* 下课智能提醒轻通知横幅（下课后 0~30 分钟内自动感知触发，支持一键直达补录） */}
      {lessonEndAlert && (
        <View className="lesson-end-banner flex-between">
          <View className="flex-row banner-left">
            <View className="banner-icon flex-center">
              <AppIcon name="clock" size={16} color="#4F46E5" />
            </View>
            <View className="banner-texts">
              <Text className="banner-title">
                第 {lessonEndAlert.lesson.节次号} 节课刚下课 🔔
              </Text>
              <Text className="banner-desc">
                {lessonEndAlert.lesson.班级} · {lessonEndAlert.lesson.科目 || '地理'} 顺手记一笔教学进度吧
              </Text>
            </View>
          </View>
          <View className="flex-row banner-right">
            <View
              className="btn-banner-record btn-active flex-center"
              onClick={() => handleRecordFromAlert(lessonEndAlert)}
            >
              <Text>去记录</Text>
            </View>
            <View
              className="btn-banner-close btn-active flex-center"
              onClick={() => handleDismissAlert(lessonEndAlert)}
            >
              <Text>×</Text>
            </View>
          </View>
        </View>
      )}

      {/* 晨间寄语卡片 (精选教育名言) */}
      <View className="card daily-quote-card">
        <View className="flex-between quote-top">
          <View className="flex-row">
            <AppIcon name="quote" size={16} color="#6366F1" />
            <Text className="quote-tag">晨间寄语 · 每日一句</Text>
          </View>
          <View className="quote-actions flex-row">
            <View
              className={`action-btn flex-row btn-active ${refreshingQuote ? 'spin' : ''}`}
              onClick={handleRefreshQuote}
            >
              <AppIcon name="refresh" size={13} color="#6366F1" />
              <Text style={{ marginLeft: '4rpx' }}>换一句</Text>
            </View>
            <View className="action-btn flex-row btn-active" onClick={handleCopyQuote}>
              <AppIcon name="edit" size={13} color="#64748B" />
              <Text style={{ marginLeft: '4rpx' }}>复制</Text>
            </View>
            <View
              className="action-btn poster-btn flex-row btn-active"
              onClick={() => {
                triggerHaptic('light')
                setPosterModalVisible(true)
              }}
            >
              <AppIcon name="image" size={13} color="#8B5CF6" />
              <Text style={{ marginLeft: '4rpx', color: '#8B5CF6', fontWeight: 600 }}>海报</Text>
            </View>
          </View>
        </View>
        <Text className="quote-content">“{quoteText}”</Text>
      </View>

      {/* 任教班级切换胶囊 */}
      <View className="class-segment-bar flex-row">
        <Text className="seg-label">任教班级：</Text>
        <View className="seg-list flex-row">
          {classes.map((cls) => (
            <View
              key={cls}
              className={`seg-item btn-active ${currentClass === cls ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic('light')
                setCurrentClass(cls)
              }}
            >
              <Text>{cls}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 主视觉：正在上课 & 下一节看板 */}
      <View className="main-lesson-block">
        {currentLesson && currentPeriod ? (
          /* 1. 正在上课卡片 */
          <View className="card in-lesson-card">
            <View className="flex-between in-lesson-top">
              <View className="flex-row">
                <View className="pulse-dot" />
                <Text className="in-lesson-badge">正在上课</Text>
                <Text className="remain-pill">还剩 {remainMinutes} 分钟</Text>
              </View>
              <View className="flex-row time-info">
                <AppIcon name="clock" size={14} color="#6366F1" />
                <Text className="period-span">{currentPeriod.time}</Text>
                <Text className="pct-num">{progressPct}%</Text>
              </View>
            </View>

            <Text className="lesson-heading">
              第{currentLesson.节次号}节 {currentLesson.班级} · {currentLesson.科目}
            </Text>

            {/* 平滑进度条 */}
            <View className="progress-bar-bg">
              <View className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </View>

            {/* 核心直达双按钮 */}
            <View className="lesson-actions-row flex-row">
              <View
                className={`btn-action btn-record-log btn-active flex-center ${isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? 'recorded' : ''}`}
                onClick={() => handleOpenLog(currentLesson)}
              >
                <AppIcon
                  name="book"
                  size={16}
                  color={isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? '#059669' : '#2563EB'}
                />
                <Text className="btn-text" style={{ marginLeft: '8rpx' }}>
                  {isLessonRecorded(currentLesson.节次号, currentLesson.班级) ? '已记课堂 ✓' : '记课堂'}
                </Text>
              </View>

              <View
                className="btn-action btn-quick-note btn-active flex-center"
                onClick={() => handleGoQuickNote(currentLesson.班级)}
              >
                <AppIcon name="bolt" size={16} color="#FFFFFF" />
                <Text className="btn-text" style={{ marginLeft: '8rpx' }}>记一笔</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 2. 课间 / 下一节课卡片 */}
        <View className={`card next-lesson-card ${currentLesson ? 'attached-bottom' : ''}`}>
          <View className="flex-between next-lesson-row">
            <View className="next-lesson-info">
              {nextLesson && nextPeriod ? (
                <>
                  <Text className="next-sub">{currentLesson ? '接下来' : '下一节课'}</Text>
                  <Text className="next-title">
                    第{nextLesson.节次号}节 {nextLesson.班级} · {nextLesson.科目}
                  </Text>
                  <View className="flex-row next-time">
                    <AppIcon name="clock" size={12} color="#94A3B8" />
                    <Text style={{ marginLeft: '6rpx' }}>{nextPeriod.time}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text className="no-more-text">
                    {todayLessons.length === 0 ? '今日暂无排课安排' : '今日课程已全部结束'}
                  </Text>
                  <Text className="no-more-sub">
                    {todayLessons.length === 0 ? '享受轻松充实的一天' : `全天共 ${todayLessons.length} 节授课完成`}
                  </Text>
                </>
              )}
            </View>

            {/* 课外/课间时的快速操作：补记上一节课 */}
            {!currentLesson && (
              <View className="next-lesson-actions flex-row">
                {lastLesson && (
                  <View
                    className={`btn-supplement btn-active flex-center ${isLessonRecorded(lastLesson.节次号, lastLesson.班级) ? 'done' : ''}`}
                    onClick={() => handleOpenLog(lastLesson)}
                  >
                    <AppIcon
                      name="book"
                      size={13}
                      color={isLessonRecorded(lastLesson.节次号, lastLesson.班级) ? '#059669' : '#2563EB'}
                    />
                    <Text className="btn-text" style={{ marginLeft: '6rpx' }}>
                      {isLessonRecorded(lastLesson.节次号, lastLesson.班级)
                        ? `已记第${lastLesson.节次号}节 ✓`
                        : `补记第${lastLesson.节次号}节`}
                    </Text>
                  </View>
                )}
                <View
                  className="btn-quick-enter btn-active flex-center"
                  onClick={() => handleGoQuickNote(nextLesson?.班级 || currentClass)}
                >
                  <AppIcon name="bolt" size={13} color="#FFFFFF" />
                  <Text className="btn-text" style={{ marginLeft: '6rpx' }}>记一笔</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 4 宫格大触控金刚区 (纯专业矢量图标) */}
      <View className="card quick-grid-card">
        <View className="grid-nav">
          <View
            className="nav-item btn-active"
            onClick={() => {
              triggerHaptic('light')
              Taro.switchTab({ url: '/pages/quicknote/index' })
            }}
          >
            <View className="nav-icon-box" style={{ background: '#EFF6FF' }}>
              <AppIcon name="bolt" size={24} color="#2563EB" />
            </View>
            <Text className="nav-title">随堂快记</Text>
            <Text className="nav-desc">分组加减分</Text>
          </View>

          <View
            className="nav-item btn-active"
            onClick={() => {
              triggerHaptic('light')
              Taro.switchTab({ url: '/pages/roster/index' })
            }}
          >
            <View className="nav-icon-box" style={{ background: '#F5F3FF' }}>
              <AppIcon name="users" size={24} color="#7C3AED" />
            </View>
            <Text className="nav-title">班级名册</Text>
            <Text className="nav-desc">{students.length} 人在册</Text>
          </View>

          <View
            className="nav-item btn-active"
            onClick={() => {
              triggerHaptic('light')
              Taro.navigateTo({ url: '/pages/schedule/index' })
            }}
          >
            <View className="nav-icon-box" style={{ background: '#ECFDF5' }}>
              <AppIcon name="calendar" size={24} color="#059669" />
            </View>
            <Text className="nav-title">课程表</Text>
            <Text className="nav-desc">今日 {todayLessons.length} 节</Text>
          </View>

          <View
            className="nav-item btn-active"
            onClick={() => {
              triggerHaptic('light')
              Taro.switchTab({ url: '/pages/todos/index' })
            }}
          >
            <View className="nav-icon-box" style={{ background: '#FFFBEB' }}>
              <AppIcon name="todo" size={24} color="#D97706" />
            </View>
            <Text className="nav-title">待办事务</Text>
            <Text className="nav-desc">{todayPendingTodos.length + overdueTodos.length} 件未办</Text>
          </View>
        </View>
      </View>

      {/* 今日课堂教学笔记清单 */}
      <View className="card section-card">
        <View className="flex-between section-head">
          <View className="flex-row">
            <AppIcon name="book" size={18} color="#2563EB" />
            <Text className="head-title" style={{ marginLeft: '8rpx' }}>
              今日课堂笔记
            </Text>
            <Text className="badge badge-primary" style={{ marginLeft: '12rpx' }}>
              {sortedTodayLogs.length} 条已记
            </Text>
          </View>
          <View className="flex-row" style={{ gap: '14rpx', alignItems: 'center' }}>
            <View
              className="btn-head-record btn-active flex-row"
              onClick={handleOpenQuickLog}
            >
              <AppIcon name="book" size={12} color="#FFFFFF" />
              <Text style={{ marginLeft: '6rpx' }}>+ 记笔记</Text>
            </View>
            <View
              className="head-link flex-row btn-active"
              onClick={() => {
                triggerHaptic('light')
                Taro.navigateTo({ url: '/pages/lessonlogs/index' })
              }}
            >
              <Text>全部记录</Text>
              <AppIcon name="arrow-right" size={11} color="#6366F1" />
            </View>
          </View>
        </View>

        {sortedTodayLogs.length === 0 ? (
          <View className="empty-state flex-column flex-center">
            <Text className="empty-text">今日暂无课堂笔记，课后随手记录教学进度与作业</Text>
            <View
              className="empty-action-btn btn-active flex-row flex-center"
              onClick={handleOpenQuickLog}
            >
              <AppIcon name="book" size={14} color="#FFFFFF" />
              <Text style={{ marginLeft: '8rpx' }}>立即添加今日课堂笔记</Text>
            </View>
          </View>
        ) : (
          <View className="logs-list">
            {sortedTodayLogs.map((log) => (
              <View
                key={log.id || log._id}
                className="log-item card btn-active"
                onClick={() =>
                  handleOpenLog({
                    班级: log.班级,
                    节次号: log.节次,
                    科目: log.科目,
                  })
                }
              >
                <View className="flex-between log-item-top">
                  <Text className="log-badge badge-primary">
                    第 {log.节次} 节 · {log.班级} {log.科目 ? `· ${log.科目}` : ''}
                  </Text>
                  <View className="flex-row" style={{ color: '#2563EB', fontSize: '22rpx' }}>
                    <AppIcon name="edit" size={12} color="#2563EB" />
                    <Text style={{ marginLeft: '4rpx' }}>编辑</Text>
                  </View>
                </View>
                <Text className="log-text">{log.内容}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 今日节奏看板 (对齐 Web: 排课, 待办, 逾期, 补测) */}
      <View className="card rhythm-card">
        <View className="rhythm-left flex-row">
          <View className="ring-circle flex-center">
            <Text className="ring-num">{todayLessons.length}</Text>
          </View>
          <View>
            <Text className="rhythm-title">今日节奏</Text>
            <Text className="rhythm-sub">排课总数</Text>
          </View>
        </View>
        <View className="rhythm-right flex-row">
          <View className="r-stat">
            <Text className="r-val">{todayPendingTodos.length}</Text>
            <Text className="r-lbl">待办</Text>
          </View>
          <View className="r-stat">
            <Text className={`r-val ${overdueTodos.length > 0 ? 'danger' : ''}`}>
              {overdueTodos.length}
            </Text>
            <Text className="r-lbl">逾期</Text>
          </View>
          <View className="r-stat">
            <Text className={`r-val ${absentees.length > 0 ? 'warning' : 'success'}`}>
              {absentees.length}
            </Text>
            <Text className="r-lbl">补测</Text>
          </View>
        </View>
      </View>

      {/* 紧要待办事项 (支持首页单手直接办结) */}
      <View className="card section-card">
        <View className="flex-between section-head">
          <View className="flex-row">
            <AppIcon name="todo" size={18} color="#EF4444" />
            <Text className="head-title" style={{ marginLeft: '8rpx' }}>
              紧要待办
            </Text>
          </View>
          <Text
            className="head-link"
            onClick={() => {
              triggerHaptic('light')
              Taro.switchTab({ url: '/pages/todos/index' })
            }}
          >
            全部待办 ➔
          </Text>
        </View>

        {overdueTodos.length === 0 && todayPendingTodos.length === 0 ? (
          <View className="empty-state">
            <Text>暂无紧要待办事项，工作井然有序</Text>
          </View>
        ) : (
          <View className="todos-direct-list">
            {/* 1. 逾期待办置顶展示 (红色警告) */}
            {overdueTodos.map((t) => (
              <View
                key={t.id || t._id}
                className="todo-direct-item overdue btn-active flex-between"
                onClick={() => handleCompleteTodo(t)}
              >
                <View className="flex-row" style={{ flex: 1 }}>
                  <View className="check-ring flex-center" />
                  <Text className="badge-overdue">逾期</Text>
                  <Text className="todo-content-text">{t.事项}</Text>
                </View>
                <Text className="click-hint">点此办结</Text>
              </View>
            ))}

            {/* 2. 今日待办 (橙色) */}
            {todayPendingTodos.slice(0, 4).map((t) => (
              <View
                key={t.id || t._id}
                className="todo-direct-item normal btn-active flex-between"
                onClick={() => handleCompleteTodo(t)}
              >
                <View className="flex-row" style={{ flex: 1 }}>
                  <View className="check-ring flex-center" />
                  <Text className="badge-today">今天</Text>
                  <Text className="todo-content-text">{t.事项}</Text>
                </View>
                <Text className="click-hint">点此办结</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 等着补测卡片 (对齐 Web: 最近一场考试的缺考学生名单) */}
      <View className="card section-card">
        <View className="flex-between section-head">
          <View className="flex-row">
            <AppIcon name="redo" size={18} color="#D97706" />
            <Text className="head-title" style={{ marginLeft: '8rpx' }}>
              等着补测 {exam?.名 ? `· ${exam.名}` : ''}
            </Text>
          </View>
          <Text className="badge badge-warning">
            {absentees.length} 人待补测
          </Text>
        </View>

        {absentees.length === 0 ? (
          <View className="empty-state flex-column flex-center" style={{ padding: '24rpx 0' }}>
            <Text className="empty-text">该班学生全勤参考，暂无缺考待补测</Text>
          </View>
        ) : (
          <View className="absentees-tags-wrap flex-row">
            {absentees.map((name: string) => (
              <View
                key={name}
                className="absentee-tag flex-row btn-active"
                onClick={() => {
                  triggerHaptic('light')
                  Taro.showToast({ title: `学生: ${name} (缺考待补测)`, icon: 'none' })
                }}
              >
                <Text className="absentee-name">{name}</Text>
                <Text className="badge-retest">待补测</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 学情概览指标 4 宫格 (对齐 Web: 均分, 及格率, 本周表现, 考勤异常) */}
      <View className="card section-card">
        <View className="flex-between section-head">
          <View className="flex-row">
            <AppIcon name="chart" size={18} color="#2563EB" />
            <Text className="head-title" style={{ marginLeft: '8rpx' }}>
              学情概览 · {currentClass}
            </Text>
          </View>
          <Text className="head-sub-tag">阶段反馈</Text>
        </View>

        <View className="academic-stat-grid">
          {/* 指标 1：最近考试均分 */}
          <View className="stat-card">
            <Text className="stat-top">最近考试均分</Text>
            <View className="stat-val-row flex-row">
              <Text className="stat-val">{exam?.均分 ?? '-'}</Text>
              <Text className="stat-unit">{exam?.均分 ? '分' : ''}</Text>
            </View>
            <Text className="stat-sub">{exam?.名 ?? '暂无考试'}</Text>
          </View>

          {/* 指标 2：及格率 */}
          <View className="stat-card">
            <Text className="stat-top">全卷及格率</Text>
            <View className="stat-val-row flex-row">
              <Text className="stat-val">{exam?.及格率 ?? '-'}</Text>
              <Text className="stat-unit">{exam?.及格率 ? '%' : ''}</Text>
            </View>
            <Text className="stat-sub">达标线 60 分</Text>
          </View>

          {/* 指标 3：本周表现 */}
          <View className="stat-card">
            <Text className="stat-top">本周表现净分</Text>
            <View className="stat-val-row flex-row">
              <Text className="stat-val" style={{ color: netBehavior >= 0 ? '#059669' : '#DC2626' }}>
                {netBehavior >= 0 ? `+${netBehavior}` : netBehavior}
              </Text>
            </View>
            <Text className="stat-sub">
              加 {behavior?.本周加分 ?? 0} / 减 {behavior?.本周减分 ?? 0}
            </Text>
          </View>

          {/* 指标 4：考勤异常 */}
          <View className="stat-card">
            <Text className="stat-top">考勤异常</Text>
            <View className="stat-val-row flex-row">
              <Text className="stat-val" style={{ color: attendance?.异常 ? '#DC2626' : '#1E293B' }}>
                {attendance?.异常 ?? 0}
              </Text>
              <Text className="stat-unit">人次</Text>
            </View>
            <Text className="stat-sub">{attendance?.异常 ? '需重点关注' : '出勤状况优良'}</Text>
          </View>
        </View>
      </View>

      {/* 今日课表条概览 (对齐 Web: 今日全天排课条) */}
      <View className="card section-card">
        <View className="flex-between section-head">
          <View className="flex-row">
            <AppIcon name="calendar" size={18} color="#059669" />
            <Text className="head-title" style={{ marginLeft: '8rpx' }}>
              今日课表一览
            </Text>
          </View>
          <View
            className="head-link flex-row btn-active"
            onClick={() => {
              triggerHaptic('light')
              Taro.navigateTo({ url: '/pages/schedule/index' })
            }}
          >
            <Text>查看完整课表</Text>
            <AppIcon name="arrow-right" size={11} color="#6366F1" />
          </View>
        </View>

        {todayLessons.length === 0 ? (
          <View className="empty-state flex-column flex-center" style={{ padding: '24rpx 0' }}>
            <Text className="empty-text">今天没有排课任务</Text>
          </View>
        ) : (
          <View className="schedule-tags-wrap flex-row">
            {todayLessons.map((l) => {
              const p = DEFAULT_PERIODS.find((x) => x.n === l.节次号)
              const isCurrent = currentLesson && l.id === currentLesson.id
              const isNext = nextLesson && l.id === nextLesson.id
              return (
                <View
                  key={l.id}
                  className={`schedule-pill btn-active flex-row ${isCurrent ? 'current' : ''} ${isNext ? 'next' : ''}`}
                  onClick={() => {
                    triggerHaptic('light')
                    handleOpenLog(l)
                  }}
                >
                  <Text className="pill-title">
                    第{l.节次号}节 {l.班级}·{l.科目}
                  </Text>
                  {p && <Text className="pill-time">{p.time}</Text>}
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* 学业项目完成率卡片 (对齐 Web: 各打钩/过关类完成率进度条) */}
      <View className="card section-card">
        <View className="flex-between section-head">
          <View className="flex-row">
            <AppIcon name="check" size={18} color="#7C3AED" />
            <Text className="head-title" style={{ marginLeft: '8rpx' }}>
              学业项目完成率 · {currentClass}
            </Text>
          </View>
          <Text className="head-sub-tag">平时考查</Text>
        </View>

        {completionRates.length === 0 ? (
          <View className="empty-state flex-column flex-center" style={{ padding: '24rpx 0' }}>
            <Text className="empty-text">暂无打钩/过关类考查项目</Text>
          </View>
        ) : (
          <View className="rate-items-list">
            {completionRates.map((c: any) => {
              const rate = Math.round(c.完成率 ?? 0)
              const isFull = rate >= 100
              return (
                <View key={c.项目} className="rate-item">
                  <View className="rate-top flex-between">
                    <Text className="rate-name">{c.项目}</Text>
                    <Text className={`rate-num ${isFull ? 'full' : ''}`}>{rate}%</Text>
                  </View>
                  <View className="rate-bar-bg">
                    <View
                      className={`rate-bar-fill ${isFull ? 'full' : ''}`}
                      style={{ width: `${Math.min(100, rate)}%` }}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* 📱 晨间寄语海报弹窗 */}
      {posterModalVisible && (
        <View className="poster-modal-mask flex-center" onClick={() => setPosterModalVisible(false)}>
          <View className="poster-modal-content" onClick={(e) => e.stopPropagation()}>
            <View className="poster-modal-header flex-between">
              <Text className="poster-modal-title">今日晨间寄语海报</Text>
              <View className="btn-close-poster flex-center btn-active" onClick={() => setPosterModalVisible(false)}>
                <Text>×</Text>
              </View>
            </View>

            {/* 高保真海报视觉卡片 */}
            <View
              className="poster-card-preview"
              style={{
                background: activeThemeObj.bg,
                borderColor: activeThemeObj.border,
              }}
            >
              <View className="poster-inner-border">
                <View className="poster-card-top flex-between">
                  <View className="flex-row poster-badge">
                    <AppIcon name="quote" size={12} color={activeThemeObj.accentColor} />
                    <Text style={{ color: activeThemeObj.accentColor, marginLeft: '6rpx', fontSize: '22rpx', fontWeight: 600 }}>
                      晨光微露 · 每日寄语
                    </Text>
                  </View>
                  <Text className="poster-date" style={{ color: activeThemeObj.accentColor }}>
                    {todayStr}
                  </Text>
                </View>

                <View className="poster-body">
                  <Text className="poster-quote-mark" style={{ color: activeThemeObj.accentColor }}>“</Text>
                  <Text className="poster-quote-text" style={{ color: activeThemeObj.textColor }}>
                    {quoteText}
                  </Text>
                  <Text className="poster-author" style={{ color: activeThemeObj.accentColor }}>
                    —— 教师工作台 · 晨光微露
                  </Text>
                </View>

                <View className="poster-card-footer flex-between">
                  <Text className="poster-foot-tag" style={{ color: activeThemeObj.accentColor }}>
                    {todayWeekday} · 致敬每一位潜心育人的老师
                  </Text>
                </View>
              </View>
            </View>

            {/* 4 色主题切换胶囊 */}
            <View className="poster-themes-row">
              {POSTER_THEMES.map((th) => (
                <View
                  key={th.id}
                  className={`theme-pill flex-row btn-active ${posterTheme === th.id ? 'active' : ''}`}
                  onClick={() => {
                    triggerHaptic('light')
                    setPosterTheme(th.id)
                  }}
                >
                  <View className="theme-dot" style={{ background: th.dot }} />
                  <Text className="theme-name">{th.name}</Text>
                </View>
              ))}
            </View>

            {/* 底部操作栏 */}
            <View className="poster-actions-row flex-row">
              <View
                className="btn-poster-action primary btn-active flex-row flex-center"
                onClick={handleCopyQuote}
              >
                <AppIcon name="edit" size={14} color="#FFFFFF" />
                <Text style={{ marginLeft: '8rpx' }}>复制寄语文字</Text>
              </View>
              <View
                className="btn-poster-action secondary btn-active flex-row flex-center"
                onClick={() => setPosterModalVisible(false)}
              >
                <Text>完成</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
