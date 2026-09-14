// pages/periods/index.js
import {
  getPeriodsConfig,
  savePeriodsConfig,
  resetPeriodsConfig,
  fetchPeriodsFromCloud,
  savePeriodsToCloud,
  resetPeriodsToCloud,
  getDurationMinutes,
  hhmmToMinutes,
  minutesToHhmm,
  normalizePeriods
} from '../../utils/periods';

Page({
  data: {
    currentTimeStr: '',
    periods: [],
    isModalVisible: false,
    modalType: 'edit', // 'edit' | 'add'
    editingPeriod: null,
    editForm: {
      start: '08:20',
      end: '09:00'
    },
    computedDuration: 40,
    isSyncing: false
  },

  timer: null,

  onLoad() {
    // 1. 先读取本地缓存立即展示，零白屏等待
    this.loadPeriodsData();
    this.startClockTimer();
    // 2. 后台静默与云端 PostgreSQL 校准同步
    this.syncFromCloud();
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  /**
   * 后台静默从云端拉取最新作息时间
   */
  async syncFromCloud() {
    const cloudPeriods = await fetchPeriodsFromCloud();
    if (cloudPeriods && cloudPeriods.length > 0) {
      this.setData({ periods: cloudPeriods });
    }
  },

  /**
   * 启动秒级时钟走时
   */
  startClockTimer() {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      this.setData({ currentTimeStr: `${h}:${m}:${s}` });
    };

    updateTime();
    this.timer = setInterval(updateTime, 1000);
  },

  /**
   * 加载作息时间段列表
   */
  loadPeriodsData() {
    const periods = getPeriodsConfig();
    this.setData({ periods });
  },

  /**
   * 打开微调已有节次弹窗
   */
  openEditModal(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    this.setData({
      modalType: 'edit',
      editingPeriod: item,
      editForm: {
        start: item.start,
        end: item.end
      },
      computedDuration: getDurationMinutes(item.start, item.end),
      isModalVisible: true
    });
  },

  /**
   * 打开添加新时间段弹窗
   */
  openAddModal() {
    const { periods } = this.data;
    let defaultStart = '08:00';
    let defaultEnd = '08:40';

    if (periods && periods.length > 0) {
      // 获取当前最后一节课，向后推算10分钟休息与40分钟课时
      const lastPeriod = periods[periods.length - 1];
      const lastEndMin = hhmmToMinutes(lastPeriod.end);
      const nextStartMin = lastEndMin + 10;
      const nextEndMin = nextStartMin + 40;

      if (nextEndMin <= 1439) {
        defaultStart = minutesToHhmm(nextStartMin);
        defaultEnd = minutesToHhmm(nextEndMin);
      }
    }

    this.setData({
      modalType: 'add',
      editingPeriod: null,
      editForm: {
        start: defaultStart,
        end: defaultEnd
      },
      computedDuration: getDurationMinutes(defaultStart, defaultEnd),
      isModalVisible: true
    });
  },

  /**
   * 关闭抽屉弹窗
   */
  closeModal() {
    this.setData({
      isModalVisible: false,
      editingPeriod: null
    });
  },

  onModalVisibleChange(e) {
    if (!e.detail.visible) {
      this.closeModal();
    }
  },

  /**
   * 开始时间微调
   */
  onStartTimeChange(e) {
    const newStart = e.detail.value;
    const newEnd = this.data.editForm.end;
    const duration = getDurationMinutes(newStart, newEnd);

    this.setData({
      'editForm.start': newStart,
      computedDuration: duration
    });
  },

  /**
   * 结束时间微调
   */
  onEndTimeChange(e) {
    const newStart = this.data.editForm.start;
    const newEnd = e.detail.value;
    const duration = getDurationMinutes(newStart, newEnd);

    this.setData({
      'editForm.end': newEnd,
      computedDuration: duration
    });
  },

  /**
   * 保存修改或新增节次
   */
  async savePeriodModal() {
    const { modalType, editingPeriod, editForm, computedDuration, periods } = this.data;

    if (computedDuration <= 0) {
      wx.showToast({
        title: '结束时间必须晚于开始时间',
        icon: 'none'
      });
      return;
    }

    let updatedList = [];

    if (modalType === 'edit') {
      updatedList = periods.map(item => {
        if (item.id === editingPeriod.id || item.n === editingPeriod.n) {
          return {
            ...item,
            start: editForm.start,
            end: editForm.end,
            time: `${editForm.start}-${editForm.end}`
          };
        }
        return item;
      });
    } else {
      // 新增时间段
      const newPeriod = {
        id: `period_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
        start: editForm.start,
        end: editForm.end,
        time: `${editForm.start}-${editForm.end}`
      };
      updatedList = [...periods, newPeriod];
    }

    // 重新根据开始时间升序排列并顺延重新标记节次序号
    const normalized = normalizePeriods(updatedList);
    this.closeModal();
    this.setData({ periods: normalized });

    wx.showLoading({ title: '同步云端中...', mask: true });
    try {
      await savePeriodsToCloud(normalized);
      wx.hideLoading();
      try {
        wx.vibrateShort({ type: 'light' });
      } catch (e) {}

      wx.showToast({
        title: modalType === 'add' ? '已添加并同步' : '已更新并同步',
        icon: 'success'
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '本地已更新(云端同步失败)',
        icon: 'none'
      });
    }
  },

  /**
   * 左滑删除指定时间段
   */
  onDeletePeriod(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    try {
      wx.vibrateShort({ type: 'medium' });
    } catch (err) {}

    wx.showModal({
      title: '删除时间段',
      content: `确定删除「第 ${item.n} 节课 (${item.start} - ${item.end})」吗？`,
      confirmText: '确认删除',
      confirmColor: '#e34d59',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          const currentList = this.data.periods;
          const filtered = currentList.filter(p => p.id !== item.id && p.n !== item.n);
          // 重新排序与编号
          const normalized = normalizePeriods(filtered);
          this.setData({ periods: normalized });

          wx.showLoading({ title: '正在删除...', mask: true });
          try {
            await savePeriodsToCloud(normalized);
            wx.hideLoading();
            try {
              wx.vibrateShort({ type: 'light' });
            } catch (e) {}

            wx.showToast({
              title: '已删除该时间段',
              icon: 'success'
            });
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '本地已删(云端同步失败)',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 恢复标准默认作息（11节）
   */
  confirmResetDefault() {
    wx.showModal({
      title: '恢复标准作息',
      content: '是否将作息时间表重置为官方标准 11 节课时间？',
      confirmText: '确认恢复',
      confirmColor: '#0052d9',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在恢复...', mask: true });
          try {
            const defaultList = await resetPeriodsToCloud();
            this.setData({ periods: defaultList });
            wx.hideLoading();
            try {
              wx.vibrateShort({ type: 'light' });
            } catch (e) {}
            wx.showToast({
              title: '已恢复标准作息',
              icon: 'success'
            });
          } catch (err) {
            wx.hideLoading();
            resetPeriodsConfig();
            this.loadPeriodsData();
            wx.showToast({
              title: '已恢复(本地)',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
