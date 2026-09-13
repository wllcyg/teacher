import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Button, Picker } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { listTable, createRow, deleteRow } from '../../services/cloudApi'
import { triggerHaptic } from '../../utils/haptics'
import { useAppStore } from '../../stores'
import './index.less'

interface UndoItem {
  id?: any
  studentName: string
  itemName: string
  delta: number
  type: string
}

export default function QuickNotePage() {
  const { currentClass, setCurrentClass, classes } = useAppStore()
  const [students, setStudents] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedItemId, setSelectedItemId] = useState<number | string>(1)
  const [activeDelta, setActiveDelta] = useState<number>(1) // +1, +2, -1, -2
  const [records, setRecords] = useState<any[]>([])
  const [undoStack, setUndoStack] = useState<UndoItem[]>([])

  const fetchData = async () => {
    try {
      const [stus, itms, recs] = await Promise.all([
        listTable('students'),
        listTable('quicknote_items'),
        listTable('quicknote_records'),
      ])
      setStudents(stus)
      setItems(itms)
      setRecords(recs)
      if (itms.length > 0 && !selectedItemId) {
        setSelectedItemId(itms[0].id)
      }
    } finally {
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  usePullDownRefresh(() => {
    fetchData()
  })

  // 当前选中的项目
  const currentItem = useMemo(() => {
    return items.find(i => String(i.id) === String(selectedItemId)) || items[0] || {
      项目名: '随堂表现',
      类型: '表现',
    }
  }, [items, selectedItemId])

  // 当前班级学生
  const classStudents = useMemo(() => {
    return students.filter(s => s.班级 === currentClass)
  }, [students, currentClass])

  // 统计每位学生在该项目下的当前得分/记数
  const studentScoreMap = useMemo(() => {
    const map = new Map<string, number>()
    records.forEach(r => {
      if (r.班级 === currentClass && String(r.项目名) === String(currentItem.项目名)) {
        const prev = map.get(r.姓名) || 0
        map.set(r.姓名, prev + (Number(r.分值) || 1))
      }
    })
    return map
  }, [records, currentClass, currentItem])

  // 点击学生记分/打分
  const handleScoreStudent = async (student: any) => {
    triggerHaptic('light')
    const today = new Date().toISOString().slice(0, 10)
    const newRecord = await createRow('quicknote_records', {
      班级: currentClass,
      姓名: student.姓名,
      学号: student.学号,
      项目名: currentItem.项目名,
      分值: activeDelta,
      日期: today,
    })

    setRecords([newRecord, ...records])

    // 压入撤销栈
    setUndoStack(prev => [
      {
        id: newRecord.id || newRecord._id,
        studentName: student.姓名,
        itemName: currentItem.项目名,
        delta: activeDelta,
        type: currentItem.类型,
      },
      ...prev.slice(0, 19), // 最多保留 20 步撤销
    ])

    Taro.showToast({
      title: `${student.姓名} ${activeDelta > 0 ? `+${activeDelta}` : activeDelta}`,
      icon: 'none',
      duration: 1000,
    })
  }

  // 撤销上一步
  const handleUndo = async () => {
    if (undoStack.length === 0) return
    triggerHaptic('medium')
    const lastOp = undoStack[0]
    if (lastOp.id) {
      await deleteRow('quicknote_records', lastOp.id)
      setRecords(records.filter(r => (r.id !== lastOp.id && r._id !== lastOp.id)))
    }
    setUndoStack(undoStack.slice(1))
    Taro.showToast({
      title: `已撤销: ${lastOp.studentName}`,
      icon: 'none',
    })
  }

  return (
    <View className="page-container quicknote-page">
      {/* 顶部班级与项目选择 */}
      <View className="card control-card">
        <View className="flex-between" style={{ marginBottom: '16rpx' }}>
          <Picker
            mode="selector"
            range={classes}
            value={classes.indexOf(currentClass)}
            onChange={(e) => {
              triggerHaptic('light')
              setCurrentClass(classes[Number(e.detail.value)])
            }}
          >
            <View className="badge badge-primary flex-row picker-btn btn-active">
              <Text style={{ fontSize: '26rpx', fontWeight: 600 }}>{currentClass}</Text>
              <Text style={{ marginLeft: '6rpx', fontSize: '20rpx' }}>▼</Text>
            </View>
          </Picker>

          {/* 撤销按钮 */}
          <Button
            className={`btn-undo btn-active ${undoStack.length > 0 ? 'enabled' : 'disabled'}`}
            disabled={undoStack.length === 0}
            onClick={handleUndo}
          >
            ↩ 撤销 {undoStack.length > 0 ? `(${undoStack.length})` : ''}
          </Button>
        </View>

        {/* 项目横滑选择 */}
        <View className="items-bar flex-row">
          {items.map((it) => (
            <View
              key={it.id}
              className={`item-tab btn-active ${String(selectedItemId) === String(it.id) ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic('light')
                setSelectedItemId(it.id)
              }}
            >
              <Text>{it.项目名}</Text>
            </View>
          ))}
        </View>

        {/* 加减分档位选择 */}
        <View className="delta-bar flex-between">
          <Text className="delta-label">点记分值：</Text>
          <View className="delta-group flex-row">
            {[1, 2, -1, -2].map((d) => (
              <View
                key={d}
                className={`delta-chip btn-active ${activeDelta === d ? 'active' : ''} ${d < 0 ? 'neg' : 'pos'}`}
                onClick={() => {
                  triggerHaptic('light')
                  setActiveDelta(d)
                }}
              >
                <Text>{d > 0 ? `+${d}` : d}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 学生打分网格 */}
      <View className="card grid-card">
        <View className="flex-between grid-header">
          <Text className="grid-title">随堂点记 ({classStudents.length}人)</Text>
          <Text className="grid-hint">轻触姓名即可记录分值</Text>
        </View>

        <View className="student-matrix">
          {classStudents.map((s) => {
            const score = studentScoreMap.get(s.姓名) || 0
            return (
              <View
                key={s.id || s._id}
                className="matrix-cell btn-active"
                onClick={() => handleScoreStudent(s)}
              >
                <Text className="stu-name">{s.姓名}</Text>
                <Text className="stu-group">{s.小组 || '第1组'}</Text>
                {score !== 0 && (
                  <View className={`score-badge ${score > 0 ? 'pos' : 'neg'}`}>
                    <Text>{score > 0 ? `+${score}` : score}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
