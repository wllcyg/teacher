// pages/schedule/index.js
import { callCloudFunction } from '../../utils/db';
import { getPeriodsConfig, fetchPeriodsFromCloud, WEEKDAYS } from '../../utils/periods';

const COMMON_SUBJECTS = [
  '语文', '数学', '英语', '物理', '化学',
  '生物', '历史', '地理', '道德与法治',
  '体育', '美术', '音乐', '信息科技'
];

Page({
  data: {
    weekdays: WEEKDAYS,
    todayWeekday: '周一',
    selectedDay: '周一',
    viewMode: 'single', // 'single' (单日大卡片) | 'all' (全周大矩阵)
    periods: [],
    schedules: [],
    cellMap: {}, // 格式: { '周一-1': lessonItem, ... }
    dayCounts: {}, // 各天排课数统计
    totalLessonsCount: 0,
    currentDayLessonsCount: 0,
    myClasses: [],
    defaultTeacherSubject: '语文',
    commonSubjects: COMMON_SUBJECTS,

    // 排课编辑抽屉
    isEditDrawerVisible: false,
    editingLessonId: null,
    currentPeriodTimeStr: '',
    form: {
      weekday: '周一',
      period_n: 1,
      class_id: '',
      class_name: '',
      subject: '',
      classroom: ''
    },
    selectedClassLabel: '',
    classPickerOptions: [],
    isClassPickerVisible: false,
    classPickerValue: [],
    subjectPickerOptions: COMMON_SUBJECTS.map(s => ({ label: s, value: s })),
    isSubjectPickerVisible: false,
    subjectPickerValue: [],
    isSubmitting: false,

    // 整天复制弹窗
    isCopyModalVisible: false,
    copyTargetDays: {},
    isCopying: false
  },

  onLoad() {
    this.initTodayWeekday();
    this.loadPeriods();
    this.loadMyClasses();
    this.loadTeacherProfile();
    this.fetchScheduleData();
  },

  onShow() {
    this.loadPeriods();
    this.loadMyClasses();
    this.fetchScheduleData();
  },

  /**
   * 初始化今日星期与默认选中的天
   */
  initTodayWeekday() {
    const dayIndex = new Date().getDay(); // 0 是周日, 1-5 是周一至周五, 6 是周六
    let todayWeekday = '周一';
    if (dayIndex >= 1 && dayIndex <= 5) {
      todayWeekday = WEEKDAYS[dayIndex - 1];
    }
    this.setData({
      todayWeekday,
      selectedDay: todayWeekday
    });
  },

  /**
   * 加载动态节次作息定义
   */
  async loadPeriods() {
    const local = getPeriodsConfig();
    this.setData({ periods: local });
    // 静默拉取云端作息
    const cloud = await fetchPeriodsFromCloud();
    if (cloud && cloud.length > 0) {
      this.setData({ periods: cloud });
    }
  },

  /**
   * 拉取教师名下已创建的班级空间列表
   */
  async loadMyClasses() {
    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'getMyClasses'
      });
      const dataRes = res.result || res;
      if (dataRes && dataRes.code === 0 && dataRes.data) {
        const list = Array.isArray(dataRes.data) ? dataRes.data : (dataRes.data.list || []);
        const classPickerOptions = list.map(c => ({
          label: c.grade ? `${c.name} (${c.grade})` : c.name,
          value: c.id
        }));
        this.setData({ 
          myClasses: list,
          classPickerOptions
        });
      }
    } catch (err) {
      console.warn('[schedule] 拉取班级列表失败:', err);
    }
  },

  /**
   * 读取教师个人资料的主修学科
   */
  loadTeacherProfile() {
    try {
      const cached = wx.getStorageSync('TEACHER_PROFILE');
      if (cached && cached.subject) {
        this.setData({ defaultTeacherSubject: cached.subject });
      }
    } catch (e) {}
  },

  /**
   * 从云端拉取当前教师的完整排课数据
   */
  async fetchScheduleData() {
    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'getMySchedule'
      });
      if (res.result && res.result.code === 0) {
        const list = res.result.data || [];
        this.formatScheduleData(list);
      }
    } catch (err) {
      console.error('[schedule] 获取课表失败:', err);
    }
  },

  /**
   * 格式化排课数据生成 (星期-节次) 极速映射 Map 与数量统计
   */
  formatScheduleData(list) {
    const cellMap = {};
    const dayCounts = { 周一: 0, 周二: 0, 周三: 0, 周四: 0, 周五: 0 };

    list.forEach(item => {
      const key = `${item.weekday}-${item.period_n}`;
      cellMap[key] = item;
      if (dayCounts[item.weekday] !== undefined) {
        dayCounts[item.weekday]++;
      }
    });

    const currentDayLessonsCount = dayCounts[this.data.selectedDay] || 0;
    this.setData({
      schedules: list,
      cellMap,
      dayCounts,
      totalLessonsCount: list.length,
      currentDayLessonsCount
    });
  },

  /**
   * 切换星期
   */
  onSelectWeekday(e) {
    const day = e.currentTarget.dataset.day;
    if (!day || day === this.data.selectedDay) return;

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    const currentDayLessonsCount = this.data.dayCounts[day] || 0;
    this.setData({
      selectedDay: day,
      currentDayLessonsCount
    });
  },

  /**
   * 切换视图：单日聚焦 ⇄ 全周大矩阵
   */
  toggleViewMode() {
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    const nextMode = this.data.viewMode === 'single' ? 'all' : 'single';
    this.setData({ viewMode: nextMode });
  },

  /**
   * 点击单日空节次卡片，弹出极速排课抽屉
   */
  openAddModal(e) {
    const { day, period } = e.currentTarget.dataset;
    const { myClasses, defaultTeacherSubject } = this.data;

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    // 默认班级：优先选中标记为默认的班级，否则选中第 1 个班级
    let defaultClassId = '';
    let defaultClassName = '';
    let defaultClassLabel = '';
    let defaultSubject = defaultTeacherSubject || '语文';

    if (myClasses.length > 0) {
      const defaultClass = myClasses.find(c => c.is_default) || myClasses[0];
      defaultClassId = defaultClass.id;
      defaultClassName = defaultClass.name;
      defaultClassLabel = defaultClass.grade ? `${defaultClass.name} (${defaultClass.grade})` : defaultClass.name;
      if (defaultClass.subject) {
        defaultSubject = defaultClass.subject;
      }
    }

    this.setData({
      editingLessonId: null,
      selectedClassLabel: defaultClassLabel,
      classPickerValue: defaultClassId ? [defaultClassId] : [],
      subjectPickerValue: [defaultSubject],
      currentPeriodTimeStr: period.time || `${period.start} - ${period.end}`,
      form: {
        weekday: day || this.data.selectedDay,
        period_n: period.n,
        class_id: defaultClassId,
        class_name: defaultClassName,
        subject: defaultSubject,
        classroom: ''
      },
      isEditDrawerVisible: true
    });
  },

  /**
   * 点击单日已有排课卡片，弹出编辑抽屉
   */
  openEditModal(e) {
    const { lesson, period } = e.currentTarget.dataset;
    if (!lesson) return;
    const { myClasses } = this.data;

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    let matchedClassId = lesson.class_id || '';
    let matchedLabel = lesson.class_name;
    if (myClasses.length > 0) {
      const found = myClasses.find(c => c.id === matchedClassId || c.name === lesson.class_name);
      if (found) {
        matchedClassId = found.id;
        matchedLabel = found.grade ? `${found.name} (${found.grade})` : found.name;
      }
    }

    this.setData({
      editingLessonId: lesson.id,
      selectedClassLabel: matchedLabel,
      classPickerValue: matchedClassId ? [matchedClassId] : [],
      subjectPickerValue: [lesson.subject || '语文'],
      currentPeriodTimeStr: period ? (period.time || `${period.start} - ${period.end}`) : '',
      form: {
        weekday: lesson.weekday,
        period_n: lesson.period_n,
        class_id: matchedClassId,
        class_name: lesson.class_name,
        subject: lesson.subject,
        classroom: lesson.classroom || ''
      },
      isEditDrawerVisible: true
    });
  },

  /**
   * 点击全周矩阵中的小方格
   */
  onGridCellTap(e) {
    const { day, period } = e.currentTarget.dataset;
    const key = `${day}-${period.n}`;
    const lesson = this.data.cellMap[key];

    if (lesson) {
      this.openEditModal({ currentTarget: { dataset: { lesson, period } } });
    } else {
      this.openAddModal({ currentTarget: { dataset: { day, period } } });
    }
  },

  /**
   * 关闭排课抽屉
   */
  closeDrawer() {
    this.setData({
      isEditDrawerVisible: false,
      editingLessonId: null
    });
  },

  onDrawerVisibleChange(e) {
    if (!e.detail.visible) {
      this.closeDrawer();
    }
  },

  /**
   * 唤起班级滚动选择器 (TDesign t-picker)
   */
  openClassPicker() {
    const { myClasses, form } = this.data;
    if (!myClasses || myClasses.length === 0) {
      wx.showModal({
        title: '暂无班级',
        content: '课表需关联已有班级空间，是否前往「班级管理」创建班级？',
        confirmText: '去创建',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.closeDrawer();
            wx.navigateTo({ url: '/pages/class-manage/index' });
          }
        }
      });
      return;
    }

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) {}

    const currentVal = form.class_id ? [form.class_id] : [myClasses[0].id];
    this.setData({
      isClassPickerVisible: true,
      classPickerValue: currentVal
    });
  },

  /**
   * 确定班级选择
   */
  onConfirmClassPicker(e) {
    const value = e.detail.value ? e.detail.value[0] : '';
    const item = this.data.myClasses.find(c => c.id === value);

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    if (item) {
      const updates = {
        isClassPickerVisible: false,
        classPickerValue: [item.id],
        selectedClassLabel: item.grade ? `${item.name} (${item.grade})` : item.name,
        'form.class_id': item.id,
        'form.class_name': item.name
      };

      if (item.subject && !this.data.form.subject) {
        updates['form.subject'] = item.subject;
        updates.subjectPickerValue = [item.subject];
      }

      this.setData(updates);
    } else {
      this.setData({ isClassPickerVisible: false });
    }
  },

  onCancelClassPicker() {
    this.setData({ isClassPickerVisible: false });
  },

  /**
   * 唤起科目滚动选择器 (TDesign t-picker)
   */
  openSubjectPicker() {
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) {}

    const currentVal = this.data.form.subject ? [this.data.form.subject] : ['语文'];
    this.setData({
      isSubjectPickerVisible: true,
      subjectPickerValue: currentVal
    });
  },

  /**
   * 确定科目选择
   */
  onConfirmSubjectPicker(e) {
    const value = e.detail.value ? e.detail.value[0] : '';

    try {
      wx.vibrateShort({ type: 'light' });
    } catch (err) {}

    this.setData({
      isSubjectPickerVisible: false,
      subjectPickerValue: [value],
      'form.subject': value
    });
  },

  onCancelSubjectPicker() {
    this.setData({ isSubjectPickerVisible: false });
  },

  /**
   * 未建班级时引导直达创建页
   */
  goToClassManage() {
    this.closeDrawer();
    wx.navigateTo({
      url: '/pages/class-manage/index'
    });
  },

  /**
   * 快捷选择常用科目标签
   */
  onSelectSubjectChip(e) {
    const subject = e.currentTarget.dataset.subject;
    this.setData({
      'form.subject': subject
    });
  },

  onSubjectInput(e) {
    this.setData({
      'form.subject': e.detail.value
    });
  },

  onClassroomInput(e) {
    this.setData({
      'form.classroom': e.detail.value
    });
  },

  /**
   * 提交保存排课表单
   */
  async submitLessonForm() {
    const { form, editingLessonId } = this.data;

    // 严禁手动随意输入，必须选中班级实体
    if (!form.class_id || !form.class_name) {
      wx.showToast({ title: '请选择授课班级', icon: 'none' });
      return;
    }
    if (!form.subject || !form.subject.trim()) {
      wx.showToast({ title: '请选择或输入授课科目', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const payload = {
        action: 'saveScheduleItem',
        id: editingLessonId || undefined,
        weekday: form.weekday,
        period_n: form.period_n,
        class_id: form.class_id || '',
        class_name: form.class_name.trim(),
        subject: form.subject.trim(),
        classroom: (form.classroom || '').trim()
      };

      const res = await callCloudFunction('teacher-service', payload);
      this.setData({ isSubmitting: false });

      if (res.result && res.result.code === 0) {
        this.closeDrawer();
        try {
          wx.vibrateShort({ type: 'light' });
        } catch (e) {}

        wx.showToast({
          title: editingLessonId ? '课程修改已保存' : '已排入课表',
          icon: 'success'
        });
        // 重新拉取最新课表
        this.fetchScheduleData();
      } else {
        wx.showToast({ title: res.result?.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      this.setData({ isSubmitting: false });
      console.error('[schedule] 保存课程调用异常:', err);
      wx.showToast({ title: '云端保存失败', icon: 'none' });
    }
  },

  /**
   * 在编辑抽屉中删除当前课程
   */
  onDeleteFromDrawer() {
    const { editingLessonId, form } = this.data;
    if (!editingLessonId) return;

    this.confirmDeleteLesson(editingLessonId, `${form.weekday} 第 ${form.period_n} 节 ${form.subject}`);
  },

  /**
   * 左滑删除指定课程
   */
  onDeleteLesson(e) {
    const { id, desc } = e.currentTarget.dataset;
    if (!id) return;
    this.confirmDeleteLesson(id, desc);
  },

  /**
   * 确认并执行删除课程
   */
  confirmDeleteLesson(id, desc = '') {
    try {
      wx.vibrateShort({ type: 'medium' });
    } catch (err) {}

    wx.showModal({
      title: '清空本节排课',
      content: `确定从课表中移除【${desc}】吗？`,
      confirmText: '确认移除',
      confirmColor: '#e34d59',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在移除...', mask: true });
          try {
            const delRes = await callCloudFunction('teacher-service', {
              action: 'deleteScheduleItem',
              id
            });
            wx.hideLoading();
            if (delRes.result && delRes.result.code === 0) {
              this.closeDrawer();
              try {
                wx.vibrateShort({ type: 'light' });
              } catch (e) {}
              wx.showToast({ title: '已移除该课程', icon: 'success' });
              this.fetchScheduleData();
            } else {
              wx.showToast({ title: delRes.result?.message || '移除失败', icon: 'none' });
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '云端删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 打开一键复制整天课表弹窗
   */
  openCopyModal() {
    const { selectedDay, weekdays } = this.data;
    const copyTargetDays = {};
    weekdays.forEach(d => {
      if (d !== selectedDay) {
        copyTargetDays[d] = false;
      }
    });

    this.setData({
      copyTargetDays,
      isCopyModalVisible: true
    });
  },

  closeCopyModal() {
    this.setData({ isCopyModalVisible: false });
  },

  onCopyModalVisibleChange(e) {
    if (!e.detail.visible) {
      this.closeCopyModal();
    }
  },

  /**
   * 切换目标复制星期
   */
  toggleCopyTargetDay(e) {
    const day = e.currentTarget.dataset.day;
    const currentVal = !!this.data.copyTargetDays[day];
    this.setData({
      [`copyTargetDays.${day}`]: !currentVal
    });
  },

  /**
   * 提交整天课表一键复制
   */
  async submitBatchCopy() {
    const { selectedDay, copyTargetDays } = this.data;
    const targetWeekdays = Object.keys(copyTargetDays).filter(d => copyTargetDays[d]);

    if (targetWeekdays.length === 0) {
      wx.showToast({ title: '请至少勾选一个目标星期', icon: 'none' });
      return;
    }

    this.setData({ isCopying: true });

    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'batchCopyDaySchedule',
        source_weekday: selectedDay,
        target_weekdays: targetWeekdays
      });

      this.setData({ isCopying: false });

      if (res.result && res.result.code === 0) {
        this.closeCopyModal();
        try {
          wx.vibrateShort({ type: 'medium' });
        } catch (e) {}

        wx.showToast({
          title: '已批量复制整天课表',
          icon: 'success'
        });
        this.fetchScheduleData();
      } else {
        wx.showToast({ title: res.result?.message || '复制失败', icon: 'none' });
      }
    } catch (err) {
      this.setData({ isCopying: false });
      console.error('[schedule] 批量复制异常:', err);
      wx.showToast({ title: '云端复制失败', icon: 'none' });
    }
  }
});
