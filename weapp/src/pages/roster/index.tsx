import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { usePullDownRefresh, useDidShow } from '@tarojs/taro'
import { listTable, createRow, updateRow, deleteRow } from '../../services/cloudApi'
import { triggerHaptic } from '../../utils/haptics'
import { useAppStore } from '../../stores'
import { AppIcon } from '../../components/AppIcon'
import './index.less'

export default function RosterPage() {
  const { currentClass, setCurrentClass, classes } = useAppStore()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKey, setSearchKey] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentNo, setNewStudentNo] = useState('')
  const [newStudentGroup, setNewStudentGroup] = useState('第1组')

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const data = await listTable('students')
      setStudents(data)
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  useDidShow(() => {
    fetchStudents()
  })

  usePullDownRefresh(() => {
    fetchStudents()
  })

  // 按当前选定班级过滤
  const classStudents = useMemo(() => {
    return students.filter(s => s.班级 === currentClass)
  }, [students, currentClass])

  // 按关键字搜索
  const filteredStudents = useMemo(() => {
    if (!searchKey.trim()) return classStudents
    return classStudents.filter(s =>
      (s.姓名 || '').includes(searchKey) || String(s.学号 || '').includes(searchKey)
    )
  }, [classStudents, searchKey])

  // 按小组聚合
  const groupMap = useMemo(() => {
    const map = new Map<string, any[]>()
    filteredStudents.forEach(s => {
      const groupName = s.小组 || '未分组合'
      if (!map.has(groupName)) map.set(groupName, [])
      map.get(groupName)!.push(s)
    })
    return map
  }, [filteredStudents])

  // 快捷切换组长/普通标签
  const handleToggleLeader = async (student: any) => {
    triggerHaptic('light')
    const nextTag = student.标签 === '组长' ? '' : '组长'
    await updateRow('students', student.id || student._id, { 标签: nextTag })
    setStudents(students.map(s =>
      (s.id === student.id || s._id === student._id) ? { ...s, 标签: nextTag } : s
    ))
    Taro.showToast({
      title: nextTag === '组长' ? '已设为组长' : '已取消组长',
      icon: 'none'
    })
  }

  // 添加学生
  const handleAddStudent = async () => {
    if (!newStudentName.trim()) {
      Taro.showToast({ title: '请输入学生姓名', icon: 'none' })
      return
    }
    triggerHaptic('medium')
    const added = await createRow('students', {
      班级: currentClass,
      姓名: newStudentName.trim(),
      学号: newStudentNo.trim() || String(classStudents.length + 1),
      小组: newStudentGroup || '第1组',
      标签: '',
    })
    setStudents([...students, added])
    setShowAddModal(false)
    setNewStudentName('')
    setNewStudentNo('')
    Taro.showToast({ title: '添加成功', icon: 'success' })
  }

  // 删除学生
  const handleDeleteStudent = (student: any) => {
    Taro.showModal({
      title: '移除学生',
      content: `确定将「${student.姓名}」从花名册中移除？`,
      success: async (res) => {
        if (res.confirm) {
          triggerHaptic('heavy')
          await deleteRow('students', student.id || student._id)
          setStudents(students.filter(s => s.id !== student.id && s._id !== student._id))
          Taro.showToast({ title: '已移除', icon: 'none' })
        }
      }
    })
  }

  return (
    <View className="page-container roster-page">
      {/* 顶部班级选择与操作栏 */}
      <View className="card header-card flex-between">
        <View className="flex-row">
          <Text className="class-label">当前班级：</Text>
          <Picker
            mode="selector"
            range={classes}
            value={classes.indexOf(currentClass)}
            onChange={(e) => {
              triggerHaptic('light')
              const idx = Number(e.detail.value)
              setCurrentClass(classes[idx])
            }}
          >
            <View className="class-picker-btn btn-active flex-row">
              <Text className="class-title">{currentClass}</Text>
              <Text className="arrow-down">▼</Text>
            </View>
          </Picker>
        </View>

        <Button
          className="btn-add-stu btn-active"
          onClick={() => {
            triggerHaptic('light')
            setShowAddModal(true)
          }}
        >
          + 添加学生
        </Button>
      </View>

      {/* 搜索与人数统计 */}
      <View className="card search-card flex-between">
        <Input
          className="search-input"
          placeholder="搜索姓名或学号..."
          value={searchKey}
          onInput={(e) => setSearchKey(e.detail.value)}
        />
        <Text className="total-badge">{classStudents.length} 人在册</Text>
      </View>

      {/* 小组卡片列表 */}
      <View className="groups-list">
        {filteredStudents.length === 0 ? (
          <View className="empty-state card">
            <Text>该班级暂无学生或未匹配到结果</Text>
          </View>
        ) : (
          Array.from(groupMap.entries()).map(([groupName, stus]) => (
            <View key={groupName} className="card group-card">
              <View className="group-header flex-between">
                <Text className="group-title">{groupName}</Text>
                <Text className="group-count">{stus.length} 人</Text>
              </View>

              <View className="student-grid">
                {stus.map((s) => {
                  const isLeader = s.标签 === '组长'
                  return (
                    <View
                      key={s.id || s._id}
                      className="student-item btn-active"
                      onClick={() => handleToggleLeader(s)}
                      onLongPress={() => handleDeleteStudent(s)}
                    >
                      <View className="avatar-box flex-center">
                        <Text className="avatar-text">{(s.姓名 || '').slice(-1)}</Text>
                      </View>
                      <Text className="stu-name">{s.姓名}</Text>
                      <Text className="stu-no">#{s.学号 || '-'}</Text>
                      {isLeader && (
                        <View className="leader-badge flex-center">
                          <AppIcon name="crown" size={10} color="#B45309" />
                          <Text className="crown-icon">组长</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          ))
        )}
      </View>

      {/* 提示文案 */}
      <View className="flex-center hint-bar">
        <AppIcon name="tips" size={12} color="#94A3B8" />
        <Text className="hint-text" style={{ marginLeft: '8rpx' }}>点击学生切换组长身份，长按可移除学生</Text>
      </View>

      {/* 新增学生弹窗 */}
      {showAddModal && (
        <View className="modal-mask flex-center">
          <View className="modal-box card">
            <Text className="modal-title">添加新学生到 {currentClass}</Text>
            <View className="form-item">
              <Text className="form-label">姓名</Text>
              <Input
                className="form-input"
                placeholder="请输入学生姓名"
                value={newStudentName}
                onInput={(e) => setNewStudentName(e.detail.value)}
              />
            </View>
            <View className="form-item">
              <Text className="form-label">学号</Text>
              <Input
                className="form-input"
                placeholder="默认自动递增"
                type="number"
                value={newStudentNo}
                onInput={(e) => setNewStudentNo(e.detail.value)}
              />
            </View>
            <View className="form-item">
              <Text className="form-label">所属小组</Text>
              <Input
                className="form-input"
                placeholder="如: 第1组"
                value={newStudentGroup}
                onInput={(e) => setNewStudentGroup(e.detail.value)}
              />
            </View>
            <View className="modal-actions flex-row">
              <Button className="btn-cancel" onClick={() => setShowAddModal(false)}>取消</Button>
              <Button className="btn-confirm" onClick={handleAddStudent}>确定添加</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
