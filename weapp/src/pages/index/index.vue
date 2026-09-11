<template>
  <view class="wechat-page">
    <!-- 1. 顶部沉浸式教师信息条 (微信原生顶栏风格) -->
    <view class="wechat-topbar">
      <view class="teacher-profile">
        <view class="avatar-cell">
          <text class="avatar-letter">{{ teacherStore.teacher?.name?.slice(0, 1) || '师' }}</text>
        </view>
        <view class="profile-info">
          <view class="teacher-title">
            <text class="name-txt">{{ teacherStore.teacher?.name || '教师' }}</text>
            <text class="role-badge">教师工作台</text>
          </view>
          <text class="school-txt">{{ teacherStore.teacher?.school || '教学空间' }}</text>
        </view>
      </view>
      <view class="greeting-pill">
        <text>{{ greetingText }}</text>
      </view>
    </view>

    <!-- 状态 0: 首次加载态骨架屏 -->
    <view v-if="!teacherStore.initialized && teacherStore.loading" class="wechat-skeleton-card"></view>

    <!-- 状态 A: 冷启动迎新引导 (微信官方空状态规范) -->
    <view v-else-if="teacherStore.classList.length === 0" class="wechat-empty-panel">
      <view class="empty-hero">
        <view class="empty-icon-wrap">
          <People color="#2563EB" size="48" />
        </view>
        <view class="empty-title">欢迎开启班级数字化工作台</view>
        <view class="empty-subtitle">您尚未创建或加入任何班级，推荐载入演示班体验完整功能：</view>
      </view>

      <!-- 微信官方主行动大按钮 -->
      <view class="empty-cta-box">
        <view class="wechat-primary-btn" hover-class="wechat-btn-active" @tap="handleSeedDemoClass">
          <Checklist color="#FFFFFF" size="18" />
          <text class="btn-txt">快速上手 · 载入体验演示班</text>
        </view>
      </view>

      <!-- 微信列表组: 其他建班途径 -->
      <view class="wechat-cell-group mt-24">
        <view class="wechat-cell" hover-class="wechat-cell-active" @tap="openCreateClassModal">
          <view class="cell-icon-box icon-bg-blue">
            <Plus color="#2563EB" size="20" />
          </view>
          <view class="cell-main">
            <view class="cell-title">我是班主任 · 创建新班级</view>
            <view class="cell-sub">自主建班，支持一键批量导入全班学生</view>
          </view>
          <ArrowRight color="#B2B2B2" size="16" />
        </view>

        <view class="wechat-cell" hover-class="wechat-cell-active" @tap="openJoinClassModal">
          <view class="cell-icon-box icon-bg-emerald">
            <People color="#059669" size="20" />
          </view>
          <view class="cell-main">
            <view class="cell-title">我是科任老师 · 邀请码加入</view>
            <view class="cell-sub">输入班主任分享的 6 位码，直接共享花名册</view>
          </view>
          <ArrowRight color="#B2B2B2" size="16" />
        </view>
      </view>
    </view>

    <!-- 状态 B: 已有班级 (微信原生卡片与 WeUI 列表组) -->
    <view v-else class="wechat-main-content">
      <!-- 1. 当前教学班级核心卡片 -->
      <view class="wechat-card class-hero-card">
        <!-- 班级与学科主信息 -->
        <view class="class-hero-header">
          <view class="class-title-row">
            <text class="hero-class-name">{{ teacherStore.currentClass?.name || '选择班级' }}</text>
            <text
              class="hero-subject-tag"
              :style="{
                backgroundColor: teacherStore.currentClass?.subject_color ? teacherStore.currentClass?.subject_color + '15' : '#EFF6FF',
                color: teacherStore.currentClass?.subject_color || '#2563EB'
              }"
            >
              {{ teacherStore.currentClass?.subject_name || '科任' }}
              {{ teacherStore.currentClass?.is_headmaster ? '· 班主任' : '' }}
            </text>
          </view>

          <!-- 顶部右侧微操作 -->
          <view class="class-header-actions">
            <view
              v-if="teacherStore.classList.length > 1"
              class="action-switch-pill"
              hover-class="pill-active"
              @tap="openClassPicker"
            >
              <text>切换班级 ▾</text>
            </view>
            <view
              class="action-del-pill"
              hover-class="pill-active"
              @tap="handleConfirmDeleteClass"
            >
              <text>删除班级</text>
            </view>
          </view>
        </view>

        <!-- 紧凑微数据横栏 -->
        <view class="class-metrics-bar">
          <view class="metric-item">
            <text class="metric-number">{{ teacherStore.students.length }}</text>
            <text class="metric-caption">在册学生</text>
          </view>
          <view class="metric-divider"></view>
          <view class="metric-item">
            <text class="metric-number">{{ groupCount }}</text>
            <text class="metric-caption">教学小组</text>
          </view>
          <view class="metric-divider"></view>
          <view class="metric-item">
            <text class="metric-number font-amber">{{ leaderCount }}</text>
            <text class="metric-caption">当选组长</text>
          </view>
        </view>

        <!-- 班级卡片内置快速进入花名册条 -->
        <view class="class-roster-entrance" hover-class="entrance-active" @tap="navToStudents">
          <view class="entrance-left">
            <People color="#2563EB" size="18" />
            <text class="entrance-title">进入班级花名册管理</text>
          </view>
          <view class="entrance-right">
            <text class="entrance-count">{{ teacherStore.students.length }} 人</text>
            <ArrowRight color="#2563EB" size="14" />
          </view>
        </view>
      </view>

      <!-- 2. 微信 WeUI 功能列表组 -->
      <view class="wechat-group-wrap">
        <view class="wechat-group-title">常用班务捷径</view>
        <view class="wechat-cell-group">
          <!-- 项 1: 全班名册 -->
          <view class="wechat-cell" hover-class="wechat-cell-active" @tap="navToStudents">
            <view class="cell-icon-box icon-bg-blue">
              <People color="#2563EB" size="20" />
            </view>
            <view class="cell-main">
              <view class="cell-title">全班学生名单</view>
              <view class="cell-sub">查看花名册、各组学生档案与组长标记</view>
            </view>
            <view class="cell-tail">
              <text class="badge-count">{{ teacherStore.students.length }} 人</text>
              <ArrowRight color="#B2B2B2" size="16" />
            </view>
          </view>

          <!-- 项 2: 批量导入 -->
          <view class="wechat-cell" hover-class="wechat-cell-active" @tap="navToBatchImport">
            <view class="cell-icon-box icon-bg-blue">
              <Checklist color="#2563EB" size="20" />
            </view>
            <view class="cell-main">
              <view class="cell-title">一键批量导入</view>
              <view class="cell-sub">按行粘贴学生名单，自动识别排号分组</view>
            </view>
            <view class="cell-tail">
              <ArrowRight color="#B2B2B2" size="16" />
            </view>
          </view>

          <!-- 项 3: 科任邀请码 -->
          <view class="wechat-cell" hover-class="wechat-cell-active" @tap="copyClassInviteCode">
            <view class="cell-icon-box icon-bg-purple">
              <Share color="#7C3AED" size="20" />
            </view>
            <view class="cell-main">
              <view class="cell-title">科任教师邀请码</view>
              <view class="cell-sub">分享给同班其他科目老师共享名册</view>
            </view>
            <view class="cell-tail">
              <view class="code-copy-tag">
                <text class="code-txt">{{ teacherStore.currentClass?.invite_code || '复制' }}</text>
              </view>
            </view>
          </view>

          <!-- 项 4: 再建新班 -->
          <view class="wechat-cell" hover-class="wechat-cell-active" @tap="openCreateClassModal">
            <view class="cell-icon-box icon-bg-gray">
              <Plus color="#576B95" size="20" />
            </view>
            <view class="cell-main">
              <view class="cell-title">开设新的教学班</view>
              <view class="cell-sub">新增其他年级或学科的任教班级</view>
            </view>
            <view class="cell-tail">
              <ArrowRight color="#B2B2B2" size="16" />
            </view>
          </view>
        </view>
      </view>

      <!-- 3. 教学备忘提醒 -->
      <view class="wechat-group-wrap">
        <view class="wechat-group-title">教学日常备忘</view>
        <view class="wechat-cell-group">
          <view class="wechat-cell todo-cell" hover-class="wechat-cell-active" @tap="toggleTodo">
            <view class="wechat-checkbox" :class="{ checked: isTodoDone }">
              <Check v-if="isTodoDone" color="#FFFFFF" size="14" />
            </view>
            <view class="cell-main">
              <view class="cell-title" :class="{ 'text-done': isTodoDone }">检查全班分组及各组组长名单</view>
              <view class="cell-sub">开学初建班常规核对</view>
            </view>
            <view class="cell-tail">
              <text class="todo-pill">日常</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部抽屉面板：邀请码加入班级 -->
    <nut-popup
      v-model:visible="joinClassVisible"
      position="bottom"
      round
      :closeable="false"
      :safe-area-inset-bottom="keyboardHeight === 0"
      :style="{
        bottom: keyboardHeight + 'px',
        transition: 'bottom 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)'
      }"
    >
      <view class="wechat-bottom-panel" :class="{ 'keyboard-opened': keyboardHeight > 0 }">
        <view class="panel-drag-handle"></view>
        <view class="panel-header">
          <view class="panel-header-bar">
            <text class="panel-main-title">加入已有班级</text>
            <view class="panel-close-btn" hover-class="close-btn-active" @tap="closeJoinModal">
              <text class="close-symbol">✕</text>
            </view>
          </view>
          <text class="panel-sub-title">输入班主任分享的 6 位大写邀请码，加入教学协同</text>
        </view>

        <view class="panel-form">
          <view class="form-field">
            <view class="field-label">6 位班级邀请码 <text class="field-required">*</text></view>
            <nut-input
              v-model="inputInviteCode"
              class="custom-nut-input code-nut-input"
              placeholder="请输入 6 位字母和数字"
              max-length="6"
              clearable
              :border="false"
              :adjust-position="false"
              :formatter="(val: string) => val ? val.toUpperCase() : ''"
            />
          </view>

          <view class="form-field mt-20">
            <view class="field-label">您的任教学科</view>
            <view class="panel-subject-chips">
              <view
                v-for="sub in teacherStore.allSubjects"
                :key="sub.id"
                class="subject-chip"
                :class="{ active: selectedSubjectId === sub.id }"
                @tap="selectedSubjectId = sub.id"
              >
                {{ sub.name }}
              </view>
            </view>
          </view>
        </view>

        <view class="panel-actions">
          <view
            class="panel-save-btn"
            hover-class="panel-btn-active"
            @tap="handleConfirmJoinClass"
          >
            <text>验证并加入班级</text>
          </view>
        </view>
      </view>
    </nut-popup>

    <!-- 班级切换底部半屏列表 -->
    <nut-action-sheet
      v-model:visible="classSheetVisible"
      :menu-items="classMenuItems"
      @choose="onChooseClass"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTeacherStore } from '../../stores/teacher'
import { People, Plus, Checklist, ArrowRight, Share, Check } from '@nutui/icons-vue-taro'
import './index.less'

const teacherStore = useTeacherStore()

// 情感化问候语
const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

// 统计数据
const groupCount = computed(() => teacherStore.groupedStudents.length)
const leaderCount = computed(() => teacherStore.students.filter(s => s.is_leader).length)

// 弹窗状态与全局软键盘监听
const joinClassVisible = ref(false)
const classSheetVisible = ref(false)
const selectedSubjectId = ref<number>(1)
const inputInviteCode = ref('')
const isTodoDone = ref(false)
const keyboardHeight = ref(0)

// 获取机型底部安全区高度 (全面屏 Home 条，iOS 通常为 34px~40px)
const getSafeAreaBottom = () => {
  try {
    const info = Taro.getSystemInfoSync()
    if (info.safeArea) {
      return info.screenHeight - info.safeArea.bottom
    }
  } catch (e) {}
  return 0
}

const safeAreaBottom = getSafeAreaBottom()

// 全局监听键盘高度：iOS的res.height包含安全区，必须扣除以实现严丝合缝贴紧键盘
const onKeyboardChange = (res: { height: number }) => {
  const h = res.height || 0
  keyboardHeight.value = h > 0 ? Math.max(0, h - safeAreaBottom) : 0
}

onMounted(() => {
  Taro.onKeyboardHeightChange(onKeyboardChange)
})

onUnmounted(() => {
  Taro.offKeyboardHeightChange(onKeyboardChange)
})

const closeJoinModal = () => {
  Taro.vibrateShort({ type: 'light' })
  joinClassVisible.value = false
  keyboardHeight.value = 0
}

// 班级切换面板选项
const classMenuItems = computed(() => {
  return teacherStore.classList.map(c => ({
    name: c.name + (c.is_headmaster ? ' (班主任)' : ` (${c.subject_name || '科任'})`),
    subname: `邀请码: ${c.invite_code}`,
    class_id: c.class_id
  }))
})

// 跳转至独立创建新班级微页面
const openCreateClassModal = () => {
  Taro.vibrateShort({ type: 'light' })
  Taro.navigateTo({ url: '/pages/class-create/index' })
}

// 打开邀请码加入弹窗
const openJoinClassModal = () => {
  Taro.vibrateShort({ type: 'light' })
  inputInviteCode.value = ''
  selectedSubjectId.value = teacherStore.allSubjects[0]?.id || 1
  joinClassVisible.value = true
}

// 确认加入班级
const handleConfirmJoinClass = async () => {
  if (!inputInviteCode.value.trim()) {
    Taro.showToast({ title: '请输入 6 位邀请码', icon: 'none' })
    return
  }
  Taro.showLoading({ title: '验证并加入中...' })
  try {
    await teacherStore.joinClass(inputInviteCode.value.trim(), selectedSubjectId.value)
    Taro.hideLoading()
    Taro.showToast({ title: '成功加入班级', icon: 'success' })
    joinClassVisible.value = false
  } catch (err: any) {
    Taro.hideLoading()
    Taro.showToast({ title: err.message || '加入失败', icon: 'none' })
  }
}

// 载入体验演示班
const handleSeedDemoClass = () => {
  Taro.vibrateShort({ type: 'light' })
  Taro.showModal({
    title: '载入体验班级',
    content: '将为您在测试库中生成包含8名学生与各组组长的三年级2班，是否立即载入？',
    confirmText: '立即体验',
    cancelText: '取消',
    success: async (res) => {
      if (res.confirm) {
        Taro.showLoading({ title: '正在初始化班级...', mask: true })
        try {
          await teacherStore.seedDemoClass()
          Taro.hideLoading()
          Taro.showToast({ title: '体验班载入成功', icon: 'success' })
        } catch (err: any) {
          Taro.hideLoading()
          console.error('seedDemoClass error:', err)
          Taro.showModal({
            title: '生成失败提示',
            content: err?.message || '生成失败，请重试',
            showCancel: false
          })
        }
      }
    }
  })
}

// 打开班级选择器
const openClassPicker = () => {
  if (teacherStore.classList.length <= 1) return
  Taro.vibrateShort({ type: 'light' })
  classSheetVisible.value = true
}

// 选择切换班级
const onChooseClass = (item: any) => {
  if (item && item.class_id) {
    teacherStore.selectClass(item.class_id)
  }
}

// 确认删除当前班级（级联删除学生与测试数据）
const handleConfirmDeleteClass = () => {
  const current = teacherStore.currentClass
  if (!current) return

  Taro.vibrateShort({ type: 'medium' })
  Taro.showModal({
    title: '删除班级确认',
    content: `确定删除「${current.name}」吗？\n删除后该班级名下的所有学生档案、任教记录将同步彻底清除，不可恢复。`,
    confirmText: '确认删除',
    confirmColor: '#DC2626',
    cancelText: '取消',
    success: async (res) => {
      if (res.confirm) {
        Taro.showLoading({ title: '正在清理数据...', mask: true })
        try {
          await teacherStore.deleteClass(current.class_id)
          Taro.hideLoading()
          Taro.showToast({ title: '班级已删除', icon: 'success' })
        } catch (err: any) {
          Taro.hideLoading()
          Taro.showModal({
            title: '删除失败',
            content: err?.message || '删除班级失败，请重试',
            showCancel: false
          })
        }
      }
    }
  })
}

// 复制科任邀请码
const copyClassInviteCode = () => {
  const code = teacherStore.currentClass?.invite_code
  if (!code) return
  Taro.setClipboardData({
    data: code,
    success: () => {
      Taro.vibrateShort({ type: 'light' })
      Taro.showToast({ title: `邀请码 ${code} 已复制`, icon: 'success' })
    }
  })
}

// 模拟待办勾选
const toggleTodo = () => {
  isTodoDone.value = !isTodoDone.value
  Taro.vibrateShort({ type: 'light' })
}

const showTodoHint = () => {
  Taro.showToast({ title: '待办中心即将在下个版本开放', icon: 'none' })
}

// 页面跳转
const navToStudents = () => {
  Taro.vibrateShort({ type: 'light' })
  Taro.navigateTo({ url: '/pages/students/index' })
}

const navToBatchImport = () => {
  Taro.vibrateShort({ type: 'light' })
  Taro.navigateTo({ url: '/pages/students/index?openImport=1' })
}

useDidShow(() => {
  teacherStore.fetchProfile()
})
</script>
