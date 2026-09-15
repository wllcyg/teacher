// pages/index/index.js
import { callCloudFunction } from '../../utils/db';
import { getPeriodsConfig, hhmmToMinutes } from '../../utils/periods';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

Page({
  data: {
    classes: [],
    selectedClassId: '',
    selectedClassName: '',

    periods: [],
    schedules: [],
    todayLessons: [],

    currentLesson: null,
    currentPeriod: null,
    remainMinutes: 0,
    progressPct: 0,

    nextLesson: null,
    nextPeriod: null,
    lastLesson: null,
    dayStatusText: '',

    isCurrentLessonRecorded: false,
    isLastLessonRecorded: false,

    todayLogs: [],

    // 记课堂弹窗
    isRecordModalVisible: false,
    editingLogId: '',
    activeModalLesson: null,
    recordContent: '',
    isSavingRecord: false,

    // 随堂记一笔弹窗
    isQuickNoteModalVisible: false,
    quickNoteText: '',
    isSavingQuickNote: false,

    quickPhrases: [
      '讲第一章第三节',
      '背第一章第二节',
      '做地理助学指南',
      '背诵课本3~6页',
      '画中国地图',
      '讲活动3道题'
    ]
  },

  timer: null,

  onLoad() {
    this.initPeriods();
    this.startLiveTimer();
    this.fetchHomeData();
  },

  onShow() {
    // 每次从其他页面返回时，静默刷新最新班级、课表与今日课堂笔记
    this.fetchHomeData(false);
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  onPullDownRefresh() {
    this.fetchHomeData(false).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 初始化作息时间
   */
  initPeriods() {
    const periods = getPeriodsConfig();
    this.setData({ periods });
  },

  /**
   * 启动实时课时雷达秒级走时
   */
  startLiveTimer() {
    if (this.timer) clearInterval(this.timer);
    // 每 10 秒刷新一次，保证倒计时与跨节次自动切换
    this.timer = setInterval(() => {
      this.recalculateLiveLesson();
    }, 10000);
  },

  /**
   * 获取今日日期与星期字符串
   */
  getTodayDateInfo() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const weekdayStr = WEEKDAYS[now.getDay()];
    return { dateStr, weekdayStr, now };
  },

  /**
   * 并发拉取首页所需基础数据
   */
  async fetchHomeData(showLoading = false) {
    if (showLoading) {
      wx.showLoading({ title: '加载中...' });
    }

    try {
      const { dateStr, weekdayStr } = this.getTodayDateInfo();

      // 并行拉取班级列表、任教课表、今日课堂笔记
      const [classRes, scheduleRes, logsRes] = await Promise.all([
        callCloudFunction('teacher-service', { action: 'getMyClasses' }),
        callCloudFunction('teacher-service', { action: 'getMySchedule' }),
        callCloudFunction('teacher-service', { action: 'getTodayLessonLogs', date: dateStr })
      ]);

      // 1. 处理班级列表
      let classList = [];
      if (classRes?.result?.code === 0) {
        classList = classRes.result.data.list || [];
      } else if (classRes?.code === 0) {
        classList = classRes.data.list || [];
      }

      let selectedId = this.data.selectedClassId;
      let selectedName = this.data.selectedClassName;
      if (!selectedId && classList.length > 0) {
        selectedId = classList[0].id;
        selectedName = classList[0].name;
      }

      // 2. 处理排课列表与今日排课
      let schedules = [];
      if (scheduleRes?.result?.code === 0) {
        schedules = scheduleRes.result.data || [];
      } else if (scheduleRes?.code === 0) {
        schedules = scheduleRes.data || [];
      }

      const todayLessons = schedules
        .filter((item) => item.weekday === weekdayStr)
        .sort((a, b) => Number(a.period_n) - Number(b.period_n));

      // 3. 处理今日课堂笔记
      let todayLogs = [];
      if (logsRes?.result?.code === 0) {
        todayLogs = logsRes.result.data || [];
      } else if (logsRes?.code === 0) {
        todayLogs = logsRes.data || [];
      }

      this.setData({
        classes: classList,
        selectedClassId: selectedId,
        selectedClassName: selectedName,
        schedules,
        todayLessons,
        todayLogs
      });

      // 4. 执行核心课时雷达状态与进度推算
      this.recalculateLiveLesson();
    } catch (err) {
      console.error('拉取首页数据异常:', err);
    } finally {
      if (showLoading) {
        wx.hideLoading();
      }
    }
  },

  /**
   * 核心算法：实时推算正在上课、进度百分比、剩余分钟及下一节状态 (1:1 对齐 Web 端)
   */
  recalculateLiveLesson() {
    const { todayLessons, periods, todayLogs } = this.data;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. 判定当前正在上的课：start <= nowMinutes < end
    const currentLesson = todayLessons.find((l) => {
      const p = periods.find((x) => x.n === Number(l.period_n));
      if (!p) return false;
      return hhmmToMinutes(p.start) <= nowMinutes && nowMinutes < hhmmToMinutes(p.end);
    }) || null;

    const currentPeriod = currentLesson
      ? periods.find((p) => p.n === Number(currentLesson.period_n))
      : null;

    // 2. 计算剩余时间与进度百分比
    let remainMinutes = 0;
    let progressPct = 0;
    if (currentPeriod) {
      const startM = hhmmToMinutes(currentPeriod.start);
      const endM = hhmmToMinutes(currentPeriod.end);
      remainMinutes = Math.max(0, endM - nowMinutes);
      const total = endM - startM;
      const elapsed = nowMinutes - startM;
      progressPct = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
    }

    // 3. 推算下一节课
    const nextLesson = todayLessons.find((l) => {
      const p = periods.find((x) => x.n === Number(l.period_n));
      if (!p) return false;
      if (currentLesson) {
        return hhmmToMinutes(p.start) > nowMinutes;
      }
      return hhmmToMinutes(p.end) > nowMinutes;
    }) || null;

    const nextPeriod = nextLesson
      ? periods.find((p) => p.n === Number(nextLesson.period_n))
      : null;

    // 4. 刚上完的上一节课（已结束的课中离当前时间最近的一节）
    const finishedLessons = todayLessons.filter((l) => {
      const p = periods.find((x) => x.n === Number(l.period_n));
      return p && hhmmToMinutes(p.end) <= nowMinutes;
    });
    const lastLesson = finishedLessons.length > 0 ? finishedLessons[finishedLessons.length - 1] : null;

    // 5. 判定状态文案
    let dayStatusText = '';
    if (todayLessons.length === 0) {
      dayStatusText = '今天没有排课';
    } else if (currentLesson) {
      dayStatusText = nextLesson ? '' : '这是今天最后一节课了';
    } else {
      dayStatusText = nextLesson ? '' : '今天的课上完了';
    }

    // 6. 判定当前课与上一节课是否已在今日笔记中记录
    const isCurrentLessonRecorded = currentLesson
      ? todayLogs.some((r) => Number(r.period_n) === Number(currentLesson.period_n) && r.class_name === currentLesson.class_name)
      : false;

    const isLastLessonRecorded = lastLesson
      ? todayLogs.some((r) => Number(r.period_n) === Number(lastLesson.period_n) && r.class_name === lastLesson.class_name)
      : false;

    this.setData({
      currentLesson,
      currentPeriod,
      remainMinutes,
      progressPct,
      nextLesson,
      nextPeriod,
      lastLesson,
      dayStatusText,
      isCurrentLessonRecorded,
      isLastLessonRecorded
    });
  },

  /**
   * 顶部班级分段切换
   */
  onSelectClass(e) {
    const cls = e.currentTarget.dataset.class;
    if (!cls || cls.id === this.data.selectedClassId) return;

    wx.vibrateShort?.({ type: 'light' });
    this.setData({
      selectedClassId: cls.id,
      selectedClassName: cls.name
    });
  },

  /**
   * 打开「记课堂」录入/编辑弹窗
   */
  openRecordModal(e) {
    wx.vibrateShort?.({ type: 'light' });
    const lesson = e.currentTarget.dataset.lesson;
    if (!lesson) return;

    // 查找是否已有记录
    const existLog = this.data.todayLogs.find(
      (r) => Number(r.period_n) === Number(lesson.period_n) && r.class_name === lesson.class_name
    );

    this.setData({
      isRecordModalVisible: true,
      activeModalLesson: lesson,
      editingLogId: existLog ? existLog.id : '',
      recordContent: existLog ? existLog.content : ''
    });
  },

  closeRecordModal() {
    this.setData({ isRecordModalVisible: false });
  },

  onRecordModalVisibleChange(e) {
    this.setData({ isRecordModalVisible: e.detail.visible });
  },

  /**
   * 点击编辑已有笔记卡片
   */
  onEditLogItem(e) {
    wx.vibrateShort?.({ type: 'light' });
    const log = e.currentTarget.dataset.log;
    if (!log) return;

    this.setData({
      isRecordModalVisible: true,
      activeModalLesson: {
        period_n: log.period_n,
        period_str: log.period_str,
        class_name: log.class_name,
        subject: log.subject
      },
      editingLogId: log.id,
      recordContent: log.content || ''
    });
  },

  /**
   * 快捷填充短语
   */
  onSelectQuickPhrase(e) {
    const phrase = e.currentTarget.dataset.text;
    if (!phrase) return;

    wx.vibrateShort?.({ type: 'light' });
    const current = this.data.recordContent.trim();
    const newContent = current ? `${current}，${phrase}` : phrase;
    this.setData({ recordContent: newContent });
  },

  onInputRecordContent(e) {
    this.setData({ recordContent: e.detail.value });
  },

  /**
   * 保存课堂记录
   */
  async saveRecord() {
    const { recordContent, activeModalLesson } = this.data;
    if (!recordContent.trim() || !activeModalLesson) return;

    this.setData({ isSavingRecord: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const { dateStr } = this.getTodayDateInfo();
      const payload = {
        action: 'saveLessonLog',
        date: dateStr,
        class_id: activeModalLesson.class_id || '',
        class_name: activeModalLesson.class_name || '',
        period_n: Number(activeModalLesson.period_n || 1),
        period_str: activeModalLesson.period_str || `第${activeModalLesson.period_n}节`,
        subject: activeModalLesson.subject || '地理',
        content: recordContent.trim()
      };

      const res = await callCloudFunction('teacher-service', payload);
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        wx.hideLoading();
        wx.showToast({ title: '已记录课堂', icon: 'success' });
        this.closeRecordModal();

        // 重新拉取今日笔记列表并更新状态
        this.fetchHomeData(false);
      } else {
        wx.hideLoading();
        wx.showToast({ title: dataRes?.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存课堂记录异常:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ isSavingRecord: false });
    }
  },

  /**
   * 删除已有记录
   */
  async deleteRecord() {
    const { editingLogId } = this.data;
    if (!editingLogId) return;

    const modalRes = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条课堂笔记吗？',
        confirmColor: '#e34d59',
        success: resolve
      });
    });

    if (!modalRes.confirm) return;

    wx.showLoading({ title: '删除中...' });
    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'deleteLessonLog',
        id: editingLogId
      });
      const dataRes = res.result || res;
      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        wx.hideLoading();
        wx.showToast({ title: '已删除', icon: 'success' });
        this.closeRecordModal();
        this.fetchHomeData(false);
      } else {
        wx.hideLoading();
        wx.showToast({ title: dataRes?.message || '删除失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('删除课堂记录异常:', err);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  /**
   * 打开随堂「记一笔」弹窗
   */
  openQuickNoteModal(e) {
    wx.vibrateShort?.({ type: 'light' });
    const lesson = e?.currentTarget?.dataset?.lesson || this.data.currentLesson || this.data.nextLesson;
    this.setData({
      isQuickNoteModalVisible: true,
      activeModalLesson: lesson || {
        period_n: 1,
        period_str: '随堂',
        class_name: this.data.selectedClassName || '八4班',
        subject: '地理'
      },
      quickNoteText: ''
    });
  },

  closeQuickNoteModal() {
    this.setData({ isQuickNoteModalVisible: false });
  },

  onQuickNoteVisibleChange(e) {
    this.setData({ isQuickNoteModalVisible: e.detail.visible });
  },

  onInputQuickNoteText(e) {
    this.setData({ quickNoteText: e.detail.value });
  },

  /**
   * 保存随堂记一笔
   */
  async saveQuickNote() {
    const { quickNoteText, activeModalLesson } = this.data;
    if (!quickNoteText.trim() || !activeModalLesson) return;

    this.setData({ isSavingQuickNote: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const { dateStr } = this.getTodayDateInfo();
      const payload = {
        action: 'saveLessonLog',
        date: dateStr,
        class_id: activeModalLesson.class_id || '',
        class_name: activeModalLesson.class_name || '',
        period_n: Number(activeModalLesson.period_n || 1),
        period_str: activeModalLesson.period_str || `第${activeModalLesson.period_n}节`,
        subject: activeModalLesson.subject || '地理',
        content: quickNoteText.trim()
      };

      const res = await callCloudFunction('teacher-service', payload);
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        wx.hideLoading();
        wx.showToast({ title: '已记下', icon: 'success' });
        this.closeQuickNoteModal();
        this.fetchHomeData(false);
      } else {
        wx.hideLoading();
        wx.showToast({ title: dataRes?.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('随堂记一笔保存异常:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ isSavingQuickNote: false });
    }
  },

  /**
   * 跳转到任教课表页
   */
  navToSchedule() {
    wx.navigateTo({
      url: '/pages/schedule/index'
    });
  },

  /**
   * 跳转到课堂教学日志全景记录页
   */
  navToLessonLogs() {
    wx.navigateTo({
      url: '/pages/lesson-logs/index'
    });
  }
});
