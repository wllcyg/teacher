import React, { useState, useEffect } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { listTable, createRow, updateRow, deleteRow } from '../../services/cloudApi'
import { triggerHaptic } from '../../utils/haptics'
import { AppIcon } from '../AppIcon'
import './index.less'

export interface LessonContext {
  日期: string
  班级: string
  节次: string | number
  科目?: string
}

interface LessonLogDrawerProps {
  open: boolean
  onClose: () => void
  lessonContext: LessonContext | null
  onSuccess?: () => void
}

const QUICK_TAGS = [
  '新课讲授',
  '重点复习',
  '随堂测验',
  '作业布置',
  '纪律良好',
  '进度正常',
  '重难点答疑',
]

export const LessonLogDrawer: React.FC<LessonLogDrawerProps> = ({
  open,
  onClose,
  lessonContext,
  onSuccess,
}) => {
  const [content, setContent] = useState('')
  const [existingId, setExistingId] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // 当打开抽屉时，根据上下文查找该节课是否已有记录
  useEffect(() => {
    if (!open || !lessonContext) {
      setContent('')
      setExistingId(null)
      return
    }

    const loadLog = async () => {
      setLoading(true)
      try {
        const logs = await listTable('lesson_log', {
          日期: lessonContext.日期,
          班级: lessonContext.班级,
          节次: String(lessonContext.节次),
        })
        if (logs.length > 0) {
          setContent(logs[0].内容 || '')
          setExistingId(logs[0].id || logs[0]._id)
        } else {
          setContent('')
          setExistingId(null)
        }
      } finally {
        setLoading(false)
      }
    }
    loadLog()
  }, [open, lessonContext])

  if (!open || !lessonContext) return null

  // 追加快捷标签
  const handleAddTag = (tag: string) => {
    triggerHaptic('light')
    const toAppend = `【${tag}】`
    if (!content.includes(toAppend)) {
      setContent(prev => (prev ? `${prev} ${toAppend}` : toAppend))
    }
  }

  // 保存课堂记录
  const handleSave = async () => {
    const text = content.trim()
    if (!text) {
      Taro.showToast({ title: '请输入课堂记录内容', icon: 'none' })
      return
    }

    triggerHaptic('medium')
    try {
      if (existingId) {
        await updateRow('lesson_log', existingId, {
          内容: text,
          科目: lessonContext.科目,
        })
      } else {
        await createRow('lesson_log', {
          日期: lessonContext.日期,
          班级: lessonContext.班级,
          节次: String(lessonContext.节次),
          科目: lessonContext.科目 || '地理',
          内容: text,
        })
      }
      Taro.showToast({ title: '课堂记录已保存', icon: 'success' })
      onSuccess?.()
      onClose()
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  // 删除记录
  const handleDelete = () => {
    if (!existingId) return
    Taro.showModal({
      title: '删除记录',
      content: '确定删除本节课的课堂记录吗？',
      success: async (res) => {
        if (res.confirm) {
          triggerHaptic('heavy')
          await deleteRow('lesson_log', existingId)
          Taro.showToast({ title: '已删除记录', icon: 'none' })
          onSuccess?.()
          onClose()
        }
      },
    })
  }

  return (
    <View className="drawer-overlay" onClick={onClose}>
      <View className="drawer-container" onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题与授课上下文 */}
        <View className="drawer-header flex-between">
          <View className="flex-row">
            <AppIcon name="book" size={20} color="#2563EB" />
            <Text className="drawer-title">
              {existingId ? '编辑课堂教学笔记' : '记录随堂教学进度'}
            </Text>
          </View>
          <View className="btn-close flex-center" onClick={onClose}>
            <Text className="close-text">✕</Text>
          </View>
        </View>

        {/* 授课信息标签栏 */}
        <View className="context-bar flex-row">
          <Text className="context-tag badge-primary">
            第 {lessonContext.节次} 节
          </Text>
          <Text className="context-tag badge-primary">
            {lessonContext.班级}
          </Text>
          {lessonContext.科目 && (
            <Text className="context-tag badge-primary">
              {lessonContext.科目}
            </Text>
          )}
          <Text className="context-date">{lessonContext.日期}</Text>
        </View>

        {/* 快捷常用标签 */}
        <View className="tags-section">
          <Text className="tags-label">点选快捷标签：</Text>
          <View className="tags-list flex-row">
            {QUICK_TAGS.map((tag) => (
              <View
                key={tag}
                className="tag-chip btn-active"
                onClick={() => handleAddTag(tag)}
              >
                <Text>+{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 文本输入区 */}
        <View className="input-box">
          <Textarea
            className="log-textarea"
            value={content}
            placeholder="记下本节课教学进度、重点难点、布置作业或随堂反思..."
            placeholderClass="placeholder"
            maxlength={500}
            onInput={(e) => setContent(e.detail.value)}
          />
          <Text className="word-count">{content.length}/500</Text>
        </View>

        {/* 底部操作按钮 */}
        <View className="drawer-actions flex-row">
          {existingId && (
            <Button className="btn-del btn-active flex-center" onClick={handleDelete}>
              <AppIcon name="del" size={16} color="#EF4444" />
              <Text style={{ marginLeft: '8rpx', color: '#EF4444' }}>删除</Text>
            </Button>
          )}
          <Button className="btn-cancel btn-active" onClick={onClose}>
            取消
          </Button>
          <Button className="btn-submit btn-active" onClick={handleSave}>
            保存记录
          </Button>
        </View>
      </View>
    </View>
  )
}

export default LessonLogDrawer
