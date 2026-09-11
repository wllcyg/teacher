<template>
  <view class="my-page">
    <!-- 教师档案名片卡 -->
    <view class="teacher-profile-card">
      <view class="profile-header">
        <view class="avatar-box">
          <image
            v-if="teacherStore.teacher?.avatar_url"
            class="avatar-img"
            :src="teacherStore.teacher.avatar_url"
            mode="aspectFill"
          />
          <view v-else class="avatar-placeholder">
            {{ teacherNameInitial }}
          </view>
        </view>

        <view class="teacher-details">
          <view class="teacher-name-row">
            <text class="teacher-name">{{ teacherStore.teacher?.name || '微信教师' }}</text>
            <text class="teacher-role-tag">已认证教师</text>
          </view>
          <view class="teacher-school">
            {{ teacherStore.teacher?.school || '未绑定学校' }}
          </view>
        </view>

        <!-- 当前环境模式标签 -->
        <view class="schema-badge">
          <text class="schema-dot"></text>
          <text class="schema-text">{{ currentSchemaText }}</text>
        </view>
      </view>
    </view>

    <!-- 任教班级列表区块 -->
    <view class="section-container">
      <view class="section-header">
        <view class="section-title-wrap">
          <text class="section-title">我任教与管理的班级</text>
          <text class="section-count">({{ teacherStore.classList.length }})</text>
        </view>
        <view class="header-action-btn" hover-class="action-hover" @tap="openCreateModal">
          <text class="action-plus">+</text>
          <text class="action-text">新建班级</text>
        </view>
      </view>

      <!-- 班级列表 -->
      <view v-if="teacherStore.classList.length > 0" class="class-card-list">
        <view
          v-for="cls in teacherStore.classList"
          :key="cls.class_id"
          class="class-manage-card"
          :class="{ 'is-current': teacherStore.currentClassId === cls.class_id }"
        >
          <!-- 班级头部基本信息 -->
          <view class="card-main-info">
            <view class="class-title-row">
              <text class="class-title">{{ cls.name }}</text>
              <text v-if="cls.is_headmaster" class="role-pill headmaster">班主任</text>
              <text v-else class="role-pill subject-teacher">任课老师</text>
            </view>
            <view class="class-sub-meta">
              <text v-if="cls.grade" class="meta-tag">{{ cls.grade }}</text>
              <text v-if="cls.subject_name" class="meta-tag subject" :style="{ backgroundColor: cls.subject_color || '#2563EB' }">
                {{ cls.subject_name }}
              </text>
              <text v-if="teacherStore.currentClassId === cls.class_id" class="current-tag">当前使用中</text>
            </view>
          </view>

          <!-- 6 位加入码与一键复制 -->
          <view class="invite-code-box">
            <view class="code-left">
              <text class="code-label">科任老师加入码</text>
              <text class="code-value">{{ cls.invite_code }}</text>
            </view>
            <view
              class="copy-btn"
              hover-class="copy-btn-hover"
              @tap="copyInviteCode(cls.invite_code, cls.name)"
            >
              <text class="copy-text">一键复制</text>
            </view>
          </view>

          <!-- 卡片底部快捷操作 -->
          <view class="card-actions">
            <view
              v-if="teacherStore.currentClassId !== cls.class_id"
              class="action-pill outline"
              @tap="switchCurrentClass(cls.class_id)"
            >
              设为当前工作班级
            </view>
            <view class="action-pill primary" @tap="goToStudents(cls.class_id)">
              查看学生花名册
            </view>
          </view>
        </view>
      </view>

      <!-- 班级为空时引导 -->
      <view v-else class="empty-classes-card">
        <view class="empty-text">您目前暂未加入或创建任何班级</view>
        <view class="empty-btns">
          <view class="e-btn primary" @tap="openCreateModal">自创新班级</view>
          <view class="e-btn secondary" @tap="openJoinModal">输入邀请码加入</view>
        </view>
      </view>
    </view>

    <!-- 快捷功能与协同设置 -->
    <view class="section-container">
      <view class="section-header">
        <text class="section-title">快捷协同操作</text>
      </view>

      <view class="action-grid">
        <view class="action-tile" hover-class="tile-hover" @tap="openJoinModal">
          <view class="tile-icon-box blue">
            <People color="#2563EB" size="22" />
          </view>
          <view class="tile-title">输入邀请码加入</view>
          <view class="tile-desc">输入 6 位加入码共享班级</view>
        </view>

        <view class="action-tile" hover-class="tile-hover" @tap="handleSeedDemo">
          <view class="tile-icon-box amber">
            <Checklist color="#D97706" size="22" />
          </view>
          <view class="tile-title">注入体验班级</view>
          <view class="tile-desc">快速生成演示班级与学生</view>
        </view>
      </view>
    </view>

    <!-- 底部抽屉面板: 输入邀请码加入班级 (NutUI 底部 Panel) -->
    <nut-popup
      v-model:visible="joinModalVisible"
      position="bottom"
      round
      :closeable="false"
      :safe-area-inset-bottom="keyboardHeight === 0"
      :style="{
        bottom: keyboardHeight + 'px',
        transition: 'bottom 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)'
      }"
    >
      <view class="my-bottom-panel" :class="{ 'keyboard-opened': keyboardHeight > 0 }">
        <view class="panel-drag-handle"></view>
        <view class="panel-head">
          <view class="panel-header-bar">
            <text class="panel-title">加入现有班级</text>
            <view class="panel-close-btn" hover-class="close-btn-active" @tap="closeJoinModal">
              <text class="close-symbol">✕</text>
            </view>
          </view>
          <text class="panel-desc">输入班主任分享的 6 位大写邀请码加入协同</text>
        </view>

        <view class="panel-body">
          <view class="field-item">
            <view class="field-label">6 位班级邀请码 <text class="req">*</text></view>
            <nut-input
              v-model="inputInviteCode"
              class="custom-nut-input code-nut-input"
              placeholder="请输入 6 位英数大写邀请码"
              max-length="6"
              clearable
              :border="false"
              :adjust-position="false"
              :formatter="(val: string) => val ? val.toUpperCase() : ''"
            />
          </view>

          <view class="field-item mt-20">
            <view class="field-label">您在该班任教的学科</view>
            <view class="subject-chips-wrap">
              <view
                v-for="sub in teacherStore.allSubjects"
                :key="sub.id"
                class="subject-chip-item"
                :class="{ active: joinSubjectId === sub.id }"
                @tap="joinSubjectId = sub.id"
              >
                {{ sub.name }}
              </view>
            </view>
          </view>
        </view>

        <view class="panel-foot">
          <view
            class="save-submit-btn"
            hover-class="btn-pressed"
            @tap="handleConfirmJoinClass"
          >
            <text>验证并加入班级</text>
          </view>
        </view>
      </view>
    </nut-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTeacherStore } from '../../stores/teacher'
import { People, Checklist } from '@nutui/icons-vue-taro'
import './index.less'

const teacherStore = useTeacherStore()

// 状态声明
const joinModalVisible = ref(false)
const inputInviteCode = ref('')
const joinSubjectId = ref<number | undefined>(undefined)
const keyboardHeight = ref(0)

// 获取机型底部安全区高度 (iOS全面屏小黑条，通常为 34px~40px)
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

// 全局监听软键盘高度：iOS的res.height包含安全区，必须扣除以严丝合缝贴紧键盘
const onKeyboardChange = (res: { height: number }) => {
  const h = res.height || 0
  keyboardHeight.value = h > 0 ? Math.max(0, h - safeAreaBottom) : 0
}

const closeJoinModal = () => {
  Taro.vibrateShort({ type: 'light' })
  joinModalVisible.value = false
  keyboardHeight.value = 0
}

// 计算属性
const teacherNameInitial = computed(() => {
  const name = teacherStore.teacher?.name
  return name ? name.slice(0, 1) : '师'
})

const currentSchemaText = computed(() => {
  // @ts-ignore
  const schema = (typeof DB_SCHEMA !== 'undefined' ? DB_SCHEMA : 'test') || 'test'
  return schema === 'prod' ? '生产环境 (prod)' : '测试环境 (test)'
})

// 页面加载与生命周期监听
onMounted(async () => {
  Taro.onKeyboardHeightChange(onKeyboardChange)
  if (!teacherStore.teacher) {
    await teacherStore.fetchProfile()
  }
})

onUnmounted(() => {
  Taro.offKeyboardHeightChange(onKeyboardChange)
})

useDidShow(async () => {
  await teacherStore.fetchProfile()
})

// 复制 6 位加入码
const copyInviteCode = (code: string, className: string) => {
  Taro.vibrateShort({ type: 'light' })
  Taro.setClipboardData({
    data: code,
    success: () => {
      Taro.showToast({
        title: `已复制【${className}】加入码`,
        icon: 'success',
        duration: 2000
      })
    }
  })
}

// 切换当前工作班级
const switchCurrentClass = async (classId: number) => {
  await teacherStore.selectClass(classId)
  Taro.showToast({
    title: '已切换当前班级',
    icon: 'success'
  })
}

// 跳转到花名册
const goToStudents = (classId: number) => {
  teacherStore.selectClass(classId)
  Taro.navigateTo({
    url: `/pages/students/index?classId=${classId}`
  })
}

// 跳转至独立创建新班级微页面
const openCreateModal = () => {
  Taro.vibrateShort({ type: 'light' })
  Taro.navigateTo({
    url: '/pages/class-create/index'
  })
}

// 打开加入弹窗
const openJoinModal = () => {
  inputInviteCode.value = ''
  joinSubjectId.value = teacherStore.allSubjects[0]?.id
  joinModalVisible.value = true
}

// 确认加入班级
const handleConfirmJoinClass = async () => {
  const code = inputInviteCode.value.trim().toUpperCase()
  if (!code || code.length !== 6) {
    Taro.showToast({ title: '请输入 6 位邀请码', icon: 'none' })
    return
  }

  try {
    Taro.showLoading({ title: '正在校验加入...' })
    await teacherStore.joinClass(code, joinSubjectId.value)
    Taro.hideLoading()
    joinModalVisible.value = false
    Taro.showToast({ title: '已成功加入班级', icon: 'success' })
  } catch (err: any) {
    Taro.hideLoading()
    Taro.showToast({ title: err?.message || '加入失败', icon: 'none' })
  }
}

// 体验班级注入
const handleSeedDemo = async () => {
  Taro.showModal({
    title: '载入体验班级',
    content: '将为您快速生成包含预设分组学生的花名册演示班级，是否继续？',
    success: async (res) => {
      if (res.confirm) {
        try {
          Taro.showLoading({ title: '正在生成演示数据...' })
          await teacherStore.seedDemoClass()
          Taro.hideLoading()
          Taro.showToast({ title: '体验班级载入成功', icon: 'success' })
        } catch (err: any) {
          Taro.hideLoading()
          Taro.showToast({ title: err?.message || '生成失败', icon: 'none' })
        }
      }
    }
  })
}
</script>
