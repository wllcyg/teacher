import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Textarea, Picker } from '@tarojs/components'
import { listTable, createRow, updateRow, deleteRow } from '../../services/cloudApi'
import { DEFAULT_PERIODS } from '../../utils/periods'
import { AppIcon } from '../../components/AppIcon'
import { triggerHaptic } from '../../utils/haptics'
import './index.less'

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const QUICK_TAGS = [
  '新课讲授',
  '重点复习',
  '随堂测验',
  '作业布置',
  '纪律良好',
  '进度正常',
  '重难点答疑',
]

export default function LessonLogEditPage() {
  const router = useRouter()
  const { date: initDate, klass: initKlass, period: initPeriod, subject: initSubject, id: initId } = router.params

  // 安全解码路由参数，杜绝中文 URL 编码（如 %E5%85%AB3%E7%8F%AD）
  const safeDecode = (str?: string) => {
    if (!str) return ''
    try {
      return decodeURIComponent(str)
    } catch (e) {
      return str
    }
  }

  const parsedKlass = safeDecode(initKlass) || '八4班'
  const parsedSubject = safeDecode(initSubject) || '地理'
  const parsedDate = safeDecode(initDate)

  // 今天与昨天的日期字符串
  const todayStr = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  const yesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${date}`
  }, [])

  // 状态
  const [selectedDate, setSelectedDate] = useState<string>(parsedDate || todayStr)
  const [selectedClass, setSelectedClass] = useState<string>(parsedKlass)
  const [selectedPeriodNum, setSelectedPeriodNum] = useState<number>(
    initPeriod ? (parseInt(String(initPeriod).replace(/\D/g, ''), 10) || 1) : 1
  )
  const [subject, setSubject] = useState<string>(parsedSubject)
  const [classes, setClasses] = useState<string[]>(['八4班', '八10班', '八9班', '八3班'])
  const [content, setContent] = useState<string>('')
  const [existingRecord, setExistingRecord] = useState<any>(null)
  const [saving, setSaving] = useState<boolean>(false)

  // 计算所选日期的星期
  const dateWeekday = useMemo(() => {
    if (!selectedDate) return ''
    const d = new Date(selectedDate)
    return isNaN(d.getTime()) ? '' : WEEKDAY_NAMES[d.getDay()]
  }, [selectedDate])

  // 加载全量班级列表
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const stuList = await listTable('students')
        const clsList = Array.from(new Set(stuList.map((s: any) => s.班级).filter(Boolean))) as string[]
        if (clsList.length > 0) {
          setClasses(clsList)
          if (!initKlass && !clsList.includes(selectedClass)) {
            setSelectedClass(clsList[0])
          }
        }
      } catch (e) {
        // fallback
      }
    }
    fetchClasses()
  }, [initKlass, selectedClass])

  // 检索当前选中的 (日期 + 班级 + 节次) 是否已经有课堂记录
  const checkExistingLog = useCallback(async (dateVal: string, classVal: string, periodVal: number) => {
    try {
      const logs = await listTable('lesson_log')
      const found = logs.find(
        (l: any) =>
          l.日期 === dateVal &&
          l.班级 === classVal &&
          (String(l.节次) === String(periodVal) || String(l.节次) === `第${periodVal}节`)
      )
      if (found) {
        setExistingRecord(found)
        setContent(found.内容 || '')
        if (found.科目) setSubject(found.科目)
      } else {
        setExistingRecord(null)
        setContent('')
      }
    } catch (e) {
      console.error('检索已有记录失败', e)
    }
  }, [])

  // 当日期、班级、节次变化时自动检索对应记录
  useEffect(() => {
    checkExistingLog(selectedDate, selectedClass, selectedPeriodNum)
  }, [selectedDate, selectedClass, selectedPeriodNum, checkExistingLog])

  // 插入快捷短语
  const handleInsertTag = (tag: string) => {
    triggerHaptic('light')
    const prefix = content.trim() ? (content.endsWith('；') || content.endsWith('，') || content.endsWith(' ') ? '' : ' ') : ''
    const newContent = `${content}${prefix}【${tag}】`
    if (newContent.length <= 300) {
      setContent(newContent)
    } else {
      Taro.showToast({ title: '内容已达 300 字上限', icon: 'none' })
    }
  }

  // 保存记录
  const handleSave = async () => {
    if (!content.trim()) {
      triggerHaptic('error')
      Taro.showToast({ title: '请输入课堂记录内容', icon: 'none' })
      return
    }

    triggerHaptic('medium')
    setSaving(true)

    try {
      const payload = {
        日期: selectedDate,
        班级: selectedClass,
        节次: selectedPeriodNum,
        科目: subject,
        内容: content.trim(),
      }

      if (existingRecord) {
        const targetId = existingRecord.id || existingRecord._id
        await updateRow('lesson_log', targetId, payload)
      } else {
        await createRow('lesson_log', payload)
      }

      triggerHaptic('success')
      Taro.showToast({ title: existingRecord ? '课堂记录已更新' : '课堂记录已保存', icon: 'success' })

      // 稍微延时后返回上一页
      setTimeout(() => {
        Taro.navigateBack()
      }, 500)
    } catch (e) {
      triggerHaptic('error')
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  // 删除记录
  const handleDelete = () => {
    if (!existingRecord) return
    triggerHaptic('medium')
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除 ${selectedDate} 第${selectedPeriodNum}节「${selectedClass}」的课堂记录吗？`,
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          const targetId = existingRecord.id || existingRecord._id
          await deleteRow('lesson_log', targetId)
          triggerHaptic('light')
          Taro.showToast({ title: '已删除记录', icon: 'success' })
          setTimeout(() => {
            Taro.navigateBack()
          }, 400)
        }
      },
    })
  }

  return (
    <View className="page-container lessonlog-edit-page">
      {/* 顶部标题栏 */}
      <View className="edit-header flex-between">
        <View className="flex-row header-left">
          <View className="header-icon-box flex-center">
            <AppIcon name="book" size={18} color="#4F46E5" />
          </View>
          <Text className="header-title">
            {existingRecord ? '编辑课堂记录' : '补录课堂记录'}
          </Text>
        </View>
        {existingRecord && (
          <View className="tag-saved flex-center">
            <Text>已记录</Text>
          </View>
        )}
      </View>

      {/* 主选择面板卡片 */}
      <View className="card selector-card">
        {/* 1. 授课日期 */}
        <View className="section-block">
          <View className="flex-between section-title-row">
            <Text className="block-label">授课日期</Text>
            <View className="quick-date-tabs flex-row">
              <View
                className={`quick-pill btn-active ${selectedDate === todayStr ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('light')
                  setSelectedDate(todayStr)
                }}
              >
                <Text>今天</Text>
              </View>
              <View
                className={`quick-pill btn-active ${selectedDate === yesterdayStr ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('light')
                  setSelectedDate(yesterdayStr)
                }}
              >
                <Text>昨天</Text>
              </View>
            </View>
          </View>

          {/* 更改日期卡片 */}
          <Picker
            mode="date"
            value={selectedDate}
            onChange={(e) => {
              triggerHaptic('light')
              setSelectedDate(e.detail.value)
            }}
          >
            <View className="date-picker-box flex-between btn-active">
              <View className="flex-row date-val-group">
                <AppIcon name="calendar" size={16} color="#4F46E5" />
                <Text className="date-text">
                  {selectedDate} {dateWeekday}
                </Text>
              </View>
              <Text className="change-hint">更改日期 ›</Text>
            </View>
          </Picker>
        </View>

        {/* 2. 授课班级 */}
        <View className="section-block">
          <View className="flex-between section-title-row">
            <Text className="block-label">授课班级</Text>
            <Text className="active-highlight">当前：{selectedClass}</Text>
          </View>
          <View className="classes-grid flex-row">
            {classes.map((c) => {
              const isSelected = selectedClass === c
              return (
                <View
                  key={c}
                  className={`class-chip btn-active ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    triggerHaptic('light')
                    setSelectedClass(c)
                  }}
                >
                  <Text>{c}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 3. 上课节次 (共 11 节可选) */}
        <View className="section-block">
          <View className="flex-between section-title-row">
            <Text className="block-label">上课节次（共 {DEFAULT_PERIODS.length} 节可选）</Text>
            <Text className="active-highlight">当前已选：第{selectedPeriodNum}节</Text>
          </View>
          <View className="periods-grid">
            {DEFAULT_PERIODS.map((p) => {
              const isSelected = selectedPeriodNum === p.n
              return (
                <View
                  key={p.n}
                  className={`period-cell btn-active ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    triggerHaptic('light')
                    setSelectedPeriodNum(p.n)
                  }}
                >
                  <Text className="period-name">第{p.n}节</Text>
                  <Text className="period-time">{p.start}</Text>
                </View>
              )
            })}
          </View>
        </View>
      </View>

      {/* 快捷短语标签 */}
      <View className="quick-tags-section">
        <Text className="tags-hint">快捷短语标签（点击插入）：</Text>
        <View className="tags-flow flex-row">
          {QUICK_TAGS.map((tag) => (
            <View
              key={tag}
              className="tag-chip btn-active"
              onClick={() => handleInsertTag(tag)}
            >
              <Text>+ {tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 文本输入卡片 */}
      <View className="card textarea-card">
        <Textarea
          className="log-textarea"
          maxlength={300}
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          placeholder="记录本节课讲授进度、课后作业、随堂突出情况等（如：完成第3课练习册P20，小测均分88分）..."
          placeholderClass="textarea-placeholder"
        />
        <View className="textarea-footer flex-between">
          {existingRecord ? (
            <View className="btn-del-record btn-active flex-row" onClick={handleDelete}>
              <AppIcon name="del" size={13} color="#EF4444" />
              <Text style={{ marginLeft: '4rpx', color: '#EF4444', fontSize: '24rpx' }}>删除本节记录</Text>
            </View>
          ) : (
            <View />
          )}
          <Text className="char-counter">{content.length} / 300</Text>
        </View>
      </View>

      {/* 底部保存按钮 */}
      <View className="bottom-bar">
        <View
          className={`btn-save-record btn-active flex-center ${saving ? 'loading' : ''}`}
          onClick={handleSave}
        >
          <AppIcon name="book" size={16} color="#FFFFFF" />
          <Text className="save-btn-text">
            {saving ? '正在保存...' : '保存课堂记录'}
          </Text>
        </View>
      </View>
    </View>
  )
}
