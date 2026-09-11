<template>
  <view class="students-page">
    <!-- 顶部班级概览与切换 -->
    <view class="roster-top-bar">
      <view class="class-summary">
        <view class="class-name">{{ teacherStore.currentClass?.name || '班级花名册' }}</view>
        <view class="class-meta">
          全班共 <text class="highlight">{{ teacherStore.students.length }}</text> 人 · 
          共 <text class="highlight">{{ teacherStore.groupedStudents.length }}</text> 组 · 
          组长 <text class="highlight text-amber">{{ leaderTotal }}</text> 人
        </view>
      </view>

      <!-- 小组筛选 Tab 胶囊 -->
      <scroll-view class="group-filter-scroll" scroll-x :show-scrollbar="false">
        <view class="filter-chips">
          <view
            class="filter-chip"
            :class="{ active: selectedGroupFilter === 'ALL' }"
            @tap="setFilter('ALL')"
          >
            全部 ({{ teacherStore.students.length }})
          </view>
          <view
            v-for="group in teacherStore.groupedStudents"
            :key="group.groupName"
            class="filter-chip"
            :class="{ active: selectedGroupFilter === group.groupName }"
            @tap="setFilter(group.groupName)"
          >
            {{ group.groupName }} ({{ group.list.length }})
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 花名册列表主体 -->
    <view class="roster-content">
      <!-- 空状态 -->
      <view v-if="filteredStudents.length === 0" class="empty-state-wrap">
        <view class="empty-icon-circle">
          <People color="#94A3B8" size="36" />
        </view>
        <view class="empty-title">当前班级暂无学生数据</view>
        <view class="empty-desc">您可以点击底部按钮，分行粘贴微信群名单快速导入</view>
        <view class="empty-action-btn" @tap="openImportModal">
          立即批量导入学生
        </view>
      </view>

      <!-- 按小组分组卡片列表 -->
      <view v-else class="group-sections">
        <view
          v-for="group in displayGroups"
          :key="group.groupName"
          class="group-card"
        >
          <view class="group-card-header">
            <view class="group-title-box">
              <text class="group-title">{{ group.groupName }}</text>
              <text class="group-badge">{{ group.list.length }}人</text>
            </view>
          </view>

          <view class="student-grid">
            <view
              v-for="stu in group.list"
              :key="stu.id || stu.name"
              class="student-item"
              :class="{ 'is-leader-border': stu.is_leader }"
              @tap="onStudentClick(stu)"
            >
              <view class="stu-no-avatar">
                {{ stu.student_no || '•' }}
              </view>
              <view class="stu-info">
                <view class="stu-name-row">
                  <text class="stu-name">{{ stu.name }}</text>
                  <text v-if="stu.gender" class="gender-tag" :class="stu.gender === '女' ? 'female' : 'male'">
                    {{ stu.gender }}
                  </text>
                </view>
                <!-- 组长金色专属徽标 -->
                <view v-if="stu.is_leader" class="leader-pill">
                  <text class="crown-icon">👑</text>
                  <text class="leader-txt">组长</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部固定操作安全栏 (Home Bar 避让) -->
    <view class="bottom-action-bar">
      <view class="btn-group">
        <view class="action-btn secondary-btn" hover-class="btn-hover" @tap="openAddSingleModal">
          <Plus color="#1E293B" size="18" />
          <text class="btn-text">单人录入</text>
        </view>
        <view class="action-btn primary-btn" hover-class="btn-hover" @tap="openImportModal">
          <Checklist color="#FFFFFF" size="18" />
          <text class="btn-text">极简分行批量导入</text>
        </view>
      </view>
    </view>

    <!-- 弹窗 1: 极简分行批量导入 (核心亮点) -->
    <nut-dialog
      v-model:visible="importModalVisible"
      title="极简分行批量导入学生"
      custom-class="batch-import-dialog"
      :close-on-click-overlay="false"
      @ok="handleConfirmBatchImport"
    >
      <view class="import-dialog-body">
        <view class="import-tip">
          按组分行粘贴学生姓名，系统自动按组录入名单：
        </view>

        <!-- 极简文本输入框 -->
        <textarea
          v-model="importRawText"
          class="import-textarea"
          placeholder="例如：&#10;第一组&#10;李小明&#10;王小红&#10;张强&#10;&#10;第二组&#10;陈亮&#10;赵雪"
          maxlength="2000"
          @input="parseImportText"
        />

        <!-- 快捷开关：首位当组长 -->
        <view class="quick-switch-row" @tap="toggleFirstIsLeader">
          <view class="switch-checkbox" :class="{ active: firstIsLeader }">
            <Check v-if="firstIsLeader" color="#ffffff" size="12" />
          </view>
          <text class="switch-label">每组第 1 位学生默认设为组长</text>
        </view>

        <!-- 实时卡片预览区 (可点微调) -->
        <view v-if="parsedPreview.length > 0" class="preview-wrap">
          <view class="preview-header">
            <text class="preview-title">实时预览 (共 {{ totalParsedStudents }} 人)</text>
            <text class="preview-hint">轻触标签可快速切换组长/组员</text>
          </view>

          <scroll-view class="preview-scroll" scroll-y>
            <view
              v-for="group in parsedPreview"
              :key="group.groupName"
              class="preview-group-card"
            >
              <view class="p-group-title">{{ group.groupName }} ({{ group.students.length }}人)</view>
              <view class="p-student-chips">
                <view
                  v-for="(stu, sIdx) in group.students"
                  :key="sIdx"
                  class="p-chip"
                  :class="{ 'is-leader': stu.is_leader }"
                  @tap="toggleStudentLeader(group.groupName, sIdx)"
                >
                  <text class="p-chip-name">{{ stu.name }}</text>
                  <text class="p-chip-tag">{{ stu.is_leader ? '👑 组长' : '组员' }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
    </nut-dialog>

    <!-- 弹窗 2: 单个学生录入 -->
    <nut-dialog
      v-model:visible="addSingleVisible"
      title="添加学生"
      @ok="handleConfirmAddSingle"
    >
      <view class="single-form">
        <view class="f-label">学生姓名 <text class="req">*</text></view>
        <input v-model="singleName" class="f-input" placeholder="输入学生姓名" maxlength="15" />

        <view class="f-label mt-16">学号</view>
        <input v-model="singleNo" class="f-input" placeholder="例如：01" maxlength="10" />

        <view class="f-label mt-16">所属小组</view>
        <input v-model="singleGroup" class="f-input" placeholder="例如：第1组" maxlength="15" />

        <view class="f-label mt-16">设为组长</view>
        <view class="single-switch" @tap="singleIsLeader = !singleIsLeader">
          <view class="switch-checkbox" :class="{ active: singleIsLeader }">
            <Check v-if="singleIsLeader" color="#ffffff" size="12" />
          </view>
          <text class="switch-label">将该学生设为当前组组长</text>
        </view>
      </view>
    </nut-dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { useTeacherStore, type StudentItem } from '../../stores/teacher'
import { People, Plus, Checklist, Check } from '@nutui/icons-vue-taro'
import './index.less'

const router = useRouter()
const teacherStore = useTeacherStore()

const selectedGroupFilter = ref('ALL')
const leaderTotal = computed(() => teacherStore.students.filter(s => s.is_leader).length)

// 小组筛选
const filteredStudents = computed(() => {
  if (selectedGroupFilter.value === 'ALL') return teacherStore.students
  return teacherStore.students.filter(s => (s.group_name || '未分组') === selectedGroupFilter.value)
})

// 分组显示
const displayGroups = computed(() => {
  if (selectedGroupFilter.value === 'ALL') {
    return teacherStore.groupedStudents
  }
  return teacherStore.groupedStudents.filter(g => g.groupName === selectedGroupFilter.value)
})

const setFilter = (groupName: string) => {
  selectedGroupFilter.value = groupName
  Taro.vibrateShort({ type: 'light' })
}

// 批量导入状态
const importModalVisible = ref(false)
const importRawText = ref('')
const firstIsLeader = ref(true)

interface ParsedGroup {
  groupName: string
  students: Array<{ name: string; is_leader: boolean }>
}

const parsedPreview = ref<ParsedGroup[]>([])

const totalParsedStudents = computed(() => {
  return parsedPreview.value.reduce((acc, g) => acc + g.students.length, 0)
})

// 解析极简分行文本
const parseImportText = () => {
  const text = importRawText.value.trim()
  if (!text) {
    parsedPreview.value = []
    return
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const groups: ParsedGroup[] = []
  let currentGroupName = '未分组'
  let currentList: Array<{ name: string; is_leader: boolean }> = []

  // 判断是否为组名行（如：第一组、第1组、1组、组1、[第一组]）
  const isGroupHeader = (line: string) => {
    return /^(第[一二三四五六七八九十0-9]+组|[0-9]+组|组[0-9]+|小组[0-9]+|\[.*组.*\])/i.test(line) ||
      (line.endsWith('组') && line.length <= 8)
  }

  lines.forEach(line => {
    if (isGroupHeader(line)) {
      if (currentList.length > 0) {
        groups.push({ groupName: currentGroupName, students: currentList })
        currentList = []
      }
      currentGroupName = line.replace(/[\[\]]/g, '')
    } else {
      // 允许一行有顿号或空格隔开的多个名字
      const names = line.split(/[、,，\s\t]+/).filter(Boolean)
      names.forEach(n => {
        currentList.push({
          name: n,
          is_leader: false
        })
      })
    }
  })

  if (currentList.length > 0) {
    groups.push({ groupName: currentGroupName, students: currentList })
  }

  // 应用“每组首位默认当组长”
  if (firstIsLeader.value) {
    groups.forEach(g => {
      if (g.students.length > 0) {
        g.students[0].is_leader = true
      }
    })
  }

  parsedPreview.value = groups
}

const toggleFirstIsLeader = () => {
  firstIsLeader.value = !firstIsLeader.value
  Taro.vibrateShort({ type: 'light' })
  parseImportText()
}

// 轻触预览微调组长
const toggleStudentLeader = (groupName: string, studentIdx: number) => {
  const targetGroup = parsedPreview.value.find(g => g.groupName === groupName)
  if (targetGroup && targetGroup.students[studentIdx]) {
    targetGroup.students[studentIdx].is_leader = !targetGroup.students[studentIdx].is_leader
    Taro.vibrateShort({ type: 'light' })
  }
}

const openImportModal = () => {
  Taro.vibrateShort({ type: 'light' })
  importRawText.value = ''
  parsedPreview.value = []
  firstIsLeader.value = true
  importModalVisible.value = true
}

// 确认批量导入
const handleConfirmBatchImport = async () => {
  if (totalParsedStudents.value === 0) {
    Taro.showToast({ title: '请先粘贴学生名单', icon: 'none' })
    return
  }

  Taro.showLoading({ title: '正在批量导入...' })
  try {
    const flatList: Array<{ name: string; group_name: string; is_leader: boolean; student_no: string }> = []
    let counter = 1

    parsedPreview.value.forEach(g => {
      g.students.forEach(s => {
        flatList.push({
          name: s.name,
          group_name: g.groupName,
          is_leader: s.is_leader,
          student_no: String(counter++).padStart(2, '0')
        })
      })
    })

    await teacherStore.batchImportStudents(flatList)
    Taro.hideLoading()
    Taro.vibrateShort({ type: 'light' })
    Taro.showToast({ title: `已成功导入 ${flatList.length} 人`, icon: 'success' })
    importModalVisible.value = false
  } catch (err: any) {
    Taro.hideLoading()
    Taro.showToast({ title: err.message || '导入失败', icon: 'none' })
  }
}

// 单人添加
const addSingleVisible = ref(false)
const singleName = ref('')
const singleNo = ref('')
const singleGroup = ref('第1组')
const singleIsLeader = ref(false)

const openAddSingleModal = () => {
  Taro.vibrateShort({ type: 'light' })
  singleName.value = ''
  singleNo.value = String(teacherStore.students.length + 1).padStart(2, '0')
  singleGroup.value = teacherStore.groupedStudents[0]?.groupName || '第1组'
  singleIsLeader.value = false
  addSingleVisible.value = true
}

const handleConfirmAddSingle = async () => {
  if (!singleName.value.trim()) {
    Taro.showToast({ title: '请输入学生姓名', icon: 'none' })
    return
  }
  Taro.showLoading({ title: '添加中...' })
  try {
    await teacherStore.addStudent({
      name: singleName.value.trim(),
      student_no: singleNo.value.trim(),
      group_name: singleGroup.value.trim(),
      is_leader: singleIsLeader.value
    })
    Taro.hideLoading()
    Taro.showToast({ title: '添加成功', icon: 'success' })
    addSingleVisible.value = false
  } catch (err: any) {
    Taro.hideLoading()
    Taro.showToast({ title: err.message || '添加失败', icon: 'none' })
  }
}

const onStudentClick = (stu: StudentItem) => {
  Taro.vibrateShort({ type: 'light' })
  Taro.showToast({
    title: `${stu.name} (${stu.group_name || '未分组'}${stu.is_leader ? '·组长' : ''})`,
    icon: 'none'
  })
}

onMounted(() => {
  if (teacherStore.currentClassId) {
    teacherStore.fetchClassStudents(teacherStore.currentClassId)
  }
  if (router.params?.openImport === '1') {
    setTimeout(() => {
      openImportModal()
    }, 300)
  }
})
</script>
