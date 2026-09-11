<template>
  <view class="class-create-page">
    <!-- 1. 顶部向导卡片 -->
    <view class="guide-card">
      <view class="guide-icon-wrap">
        <People color="#2563EB" size="24" />
      </view>
      <view class="guide-content">
        <text class="guide-title">自建班级空间</text>
        <text class="guide-desc">创建成功后将自动设为您任教的班级，并生成 6 位协同邀请码供科任老师加入。</text>
      </view>
    </view>

    <!-- 2. 主表单卡片 -->
    <view class="form-card">
      <view class="form-item">
        <view class="form-label">
          班级名称 <text class="req">*</text>
          <text class="label-hint">例如：三年级2班、高一(1)班</text>
        </view>
        <view class="input-wrapper">
          <nut-input
            v-model="className"
            class="page-nut-input"
            placeholder="请输入班级名称"
            max-length="20"
            clearable
            :border="false"
            :autofocus="true"
          />
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">
          所属年级
          <text class="label-hint">可选，便于学生分段统计</text>
        </view>
        <view class="input-wrapper">
          <nut-input
            v-model="classGrade"
            class="page-nut-input"
            placeholder="请选择或输入年级"
            max-length="10"
            clearable
            :border="false"
          />
        </view>

        <!-- 常用年级快速点选微胶囊 -->
        <view class="quick-grade-chips">
          <view
            v-for="grade in commonGrades"
            :key="grade"
            class="grade-chip"
            :class="{ active: classGrade === grade }"
            @tap="selectQuickGrade(grade)"
          >
            {{ grade }}
          </view>
        </view>
      </view>
    </view>

    <!-- 3. 底部主行动大按钮 -->
    <view class="action-footer">
      <view
        class="submit-btn"
        hover-class="btn-pressed"
        @tap="handleSubmitCreate"
      >
        <text>保存并创建班级</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Taro from '@tarojs/taro'
import { useTeacherStore } from '../../stores/teacher'
import { People } from '@nutui/icons-vue-taro'
import './index.less'

const teacherStore = useTeacherStore()

// 表单状态
const className = ref('')
const classGrade = ref('')

// 常用年级快捷项
const commonGrades = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三']

const selectQuickGrade = (grade: string) => {
  Taro.vibrateShort({ type: 'light' })
  if (classGrade.value === grade) {
    classGrade.value = ''
  } else {
    classGrade.value = grade
  }
}

// 提交创建
const handleSubmitCreate = async () => {
  const name = className.value.trim()
  if (!name) {
    Taro.showToast({ title: '请输入班级名称', icon: 'none' })
    return
  }

  try {
    Taro.vibrateShort({ type: 'light' })
    Taro.showLoading({ title: '正在创建班级...' })

    await teacherStore.createClass({
      name,
      grade: classGrade.value.trim() || undefined
    })

    Taro.hideLoading()
    Taro.showToast({ title: '班级创建成功', icon: 'success' })

    // 延时平滑返回工作台，避免 Toast 闪烁
    setTimeout(() => {
      Taro.navigateBack()
    }, 600)
  } catch (err: any) {
    Taro.hideLoading()
    Taro.showToast({ title: err?.message || '创建失败', icon: 'none' })
  }
}
</script>
