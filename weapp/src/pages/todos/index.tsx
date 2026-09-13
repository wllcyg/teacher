import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { listTable, createRow, updateRow, deleteRow } from '../../services/cloudApi'
import { triggerHaptic } from '../../utils/haptics'
import { DB_SCHEMA } from '../../services/env'
import { AppIcon } from '../../components/AppIcon'
import './index.less'

const KINDS = ['全部', '教学', '班务', '家校', '行政']
const KIND_COLORS: Record<string, string> = {
  教学: '#2563EB',
  班务: '#7C3AED',
  家校: '#059669',
  行政: '#D97706',
}

export default function TodosPage() {
  const [todos, setTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKind, setSelectedKind] = useState('全部')
  const [inputText, setInputText] = useState('')
  const [inputKind, setInputKind] = useState('教学')

  const fetchTodos = async () => {
    setLoading(true)
    try {
      const data = await listTable('todos')
      setTodos(data)
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  usePullDownRefresh(() => {
    fetchTodos()
  })

  // 添加新待办
  const handleAdd = async () => {
    const text = inputText.trim()
    if (!text) {
      Taro.showToast({ title: '请输入待办内容', icon: 'none' })
      return
    }
    triggerHaptic('light')
    const today = new Date().toISOString().slice(0, 10)
    const newTodo = await createRow('todos', {
      事项: text,
      类别: inputKind,
      状态: '待办',
      日期: today,
    })
    setTodos([newTodo, ...todos])
    setInputText('')
    Taro.showToast({ title: '已记录待办', icon: 'success' })
  }

  // 切换完成状态
  const handleToggle = async (item: any) => {
    triggerHaptic('medium')
    const newStatus = item.状态 === '已办' ? '待办' : '已办'
    await updateRow('todos', item.id || item._id, { 状态: newStatus })
    setTodos(todos.map(t => (t.id === item.id || t._id === item._id ? { ...t, 状态: newStatus } : t)))
  }

  // 删除待办
  const handleDelete = (item: any) => {
    Taro.showModal({
      title: '删除待办',
      content: `确定删除「${item.事项}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          triggerHaptic('heavy')
          await deleteRow('todos', item.id || item._id)
          setTodos(todos.filter(t => (t.id !== item.id && t._id !== item._id)))
          Taro.showToast({ title: '已删除', icon: 'none' })
        }
      },
    })
  }

  const filteredTodos = useMemo(() => {
    if (selectedKind === '全部') return todos
    return todos.filter(t => t.类别 === selectedKind)
  }, [todos, selectedKind])

  const pendingCount = useMemo(() => todos.filter(t => t.状态 === '待办').length, [todos])

  return (
    <View className="page-container todos-page">
      {/* 顶部随手记快捷栏 */}
      <View className="card quick-input-card">
        <View className="flex-between" style={{ marginBottom: '16rpx' }}>
          <View className="flex-row">
            <AppIcon name="bolt" size={16} color="#2563EB" />
            <Text className="input-card-title" style={{ marginLeft: '8rpx' }}>极速随手记</Text>
          </View>
          <Text className="env-badge">{DB_SCHEMA === 'test' ? '测试库' : '生产库'}</Text>
        </View>
        <View className="input-row flex-row">
          <Input
            className="todo-input"
            value={inputText}
            placeholder="记下要办的事..."
            placeholderClass="placeholder"
            onInput={(e) => setInputText(e.detail.value)}
            onConfirm={handleAdd}
          />
          <Button className="btn-add btn-active" onClick={handleAdd}>添加</Button>
        </View>
        <View className="kind-selector flex-row">
          {['教学', '班务', '家校', '行政'].map(k => (
            <View
              key={k}
              className={`kind-pill btn-active ${inputKind === k ? 'active' : ''}`}
              style={{
                borderColor: inputKind === k ? KIND_COLORS[k] : 'transparent',
                backgroundColor: inputKind === k ? `${KIND_COLORS[k]}15` : '#F1F5F9',
                color: inputKind === k ? KIND_COLORS[k] : '#64748B',
              }}
              onClick={() => {
                triggerHaptic('light')
                setInputKind(k)
              }}
            >
              {k}
            </View>
          ))}
        </View>
      </View>

      {/* 分类过滤器与待办统计 */}
      <View className="flex-between stats-bar">
        <View className="filter-scroll flex-row">
          {KINDS.map(k => (
            <View
              key={k}
              className={`filter-tab btn-active ${selectedKind === k ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic('light')
                setSelectedKind(k)
              }}
            >
              <Text>{k}</Text>
            </View>
          ))}
        </View>
        <Text className="pending-hint">{pendingCount} 件待办</Text>
      </View>

      {/* 待办列表 */}
      <View className="todo-list">
        {filteredTodos.length === 0 ? (
          <View className="empty-state">
            <Text>暂无待办事项，轻松一下吧</Text>
          </View>
        ) : (
          filteredTodos.map((item) => {
            const isDone = item.状态 === '已办'
            const kindColor = KIND_COLORS[item.类别] || '#64748B'
            return (
              <View
                key={item.id || item._id}
                className={`card todo-item ${isDone ? 'done' : ''}`}
              >
                <View className="flex-row" style={{ flex: 1 }} onClick={() => handleToggle(item)}>
                  <View className={`checkbox flex-center ${isDone ? 'checked' : ''}`}>
                    {isDone && <Text className="check-mark">✓</Text>}
                  </View>
                  <View className="todo-content">
                    <Text className={`todo-title ${isDone ? 'strike' : ''}`}>{item.事项}</Text>
                    <View className="flex-row meta-row">
                      <Text
                        className="badge"
                        style={{
                          backgroundColor: `${kindColor}15`,
                          color: kindColor,
                          marginRight: '12rpx',
                        }}
                      >
                        {item.类别 || '日常'}
                      </Text>
                      {item.日期 && <Text className="todo-date">{item.日期}</Text>}
                    </View>
                  </View>
                </View>
                <View
                  className="btn-del btn-active flex-center"
                  onClick={() => handleDelete(item)}
                >
                  <Text style={{ color: '#EF4444', fontSize: '24rpx' }}>删除</Text>
                </View>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}
