// pages/lesson-logs/index.js
import { callCloudFunction } from '../../utils/db';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const PERIOD_NAMES = [
  '第1节', '第2节', '第3节', '第4节', '第5节', '第6节',
  '第7节', '第8节', '第9节', '第10节', '第11节'
];

const DEFAULT_CLASSES = [
  { id: '八3班', name: '八3班' },
  { id: '八4班', name: '八4班' },
  { id: '八9班', name: '八9班' },
  { id: '八10班', name: '八10班' }
];

/**
 * 统一将日期归一化为标准的 YYYY-MM-DD 字符串
 */
function normalizeDateStr(d) {
  if (!d) return '';
  if (typeof d === 'string') {
    return d.trim().slice(0, 10);
  }
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).trim().slice(0, 10);
}

Page({
  data: {
    // 班级 / 年级 Tabs 列表（初始具备完整列表，避免初次单项导致滑块测量错位）
    classTabs: [
      { label: '全部', value: 'ALL', class_id: 'ALL', class_name: 'ALL' },
      ...DEFAULT_CLASSES.map((c) => ({ label: c.name, value: c.id, class_id: c.id, class_name: c.name }))
    ],
    classPickerOptions: DEFAULT_CLASSES.map((c) => ({ label: c.name, value: c.name, id: c.id })),
    periodPickerOptions: PERIOD_NAMES.map((p) => ({ label: p, value: p })),
    selectedClass: 'ALL',
    selectedClassText: '全部班级',

    searchKeyword: '',

    // 分页与数据
    logsList: [],
    groupedLogs: [],
    page: 1,
    pageSize: 12,
    totalLogsCount: 0,
    hasMore: true,

    // 状态标识
    isLoading: true,
    isFetchingMore: false,
    emptyDescription: '暂无符合条件的课堂教学记录',

    // 抽屉弹窗状态
    isModalVisible: false,
    editingId: '',

    form: {
      date: '',
      class_name: '',
      period_n: 1,
      period_str: '第1节',
      subject: '地理',
      content: ''
    },
    isSubmitting: false,

    // 选择器状态
    isDatePickerVisible: false,
    datePickerStart: '2024-01-01',
    datePickerEnd: '2028-12-31',

    isClassPickerVisible: false,
    isPeriodPickerVisible: false,

    // 删除对话框状态
    isDeleteDialogOpen: false,
    pendingDeleteId: '',

    // 常用快捷短语
    quickPhrases: [
      '讲第一章第三节',
      '背第一章第二节',
      '做地理助学指南',
      '背诵课本3~6页',
      '画中国地图',
      '讲活动3道题'
    ]
  },

  searchTimer: null,

  onLoad(options) {
    if (options?.class_name) {
      const cls = decodeURIComponent(options.class_name);
      this.setData({
        selectedClass: cls,
        selectedClassText: cls
      });
    }
    this.initPageData();
  },

  onShow() {
    // 每次显示页面时，若已有数据则静默刷新第一页
    if (!this.data.isLoading) {
      this.fetchLogs({ resetPage: true, showLoading: false });
    }
  },

  /**
   * 页面下拉刷新生命周期
   */
  async onPullDownRefresh() {
    wx.vibrateShort?.({ type: 'light' });
    await this.fetchLogs({ resetPage: true, showLoading: false });
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底加载分页生命周期
   */
  onReachBottom() {
    const { hasMore, isFetchingMore, isLoading } = this.data;
    if (hasMore && !isFetchingMore && !isLoading) {
      this.loadMoreLogs();
    }
  },

  /**
   * 格式化今日日期 YYYY-MM-DD
   */
  getTodayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * 页面初始化：并发拉取班级 Tab 与第一页数据
   */
  async initPageData() {
    this.setData({ isLoading: true });
    try {
      await Promise.all([
        this.fetchClasses(),
        this.fetchLogs({ resetPage: true, showLoading: true })
      ]);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 拉取我的班级并构造顶部 Tab（同时支持年级视角与具体班级视角）
   */
  async fetchClasses() {
    try {
      const classRes = await callCloudFunction('teacher-service', { action: 'getMyClasses' });
      let classes = [];
      if (classRes?.result?.code === 0) {
        classes = classRes.result.data.list || [];
      } else if (classRes?.code === 0) {
        classes = classRes.data.list || [];
      }

      if (!classes || classes.length === 0) {
        classes = DEFAULT_CLASSES;
      }

      const classTabs = [
        { label: '全部', value: 'ALL', class_id: 'ALL', class_name: 'ALL' }
      ];

      // 仅插入具体教学平行班，绑定真实 class_id 与 class_name
      classes.forEach((c) => {
        classTabs.push({
          label: c.name,
          value: c.id || c.name,
          class_id: c.id || '',
          class_name: c.name
        });
      });

      const classPickerOptions = classes.map((c) => ({ label: c.name, value: c.name, id: c.id || '' }));

      const currentSelected = this.data.selectedClass || 'ALL';
      this.setData({
        classTabs,
        classPickerOptions
      }, () => {
        wx.nextTick(() => {
          this.setData({ selectedClass: currentSelected });
        });
      });
    } catch (err) {
      console.warn('[lesson-logs] 获取班级列表失败，使用默认班级:', err);
      const classTabs = [
        { label: '全部', value: 'ALL', class_id: 'ALL', class_name: 'ALL' },
        ...DEFAULT_CLASSES.map((c) => ({ label: c.name, value: c.name, class_id: c.id, class_name: c.name }))
      ];
      const currentSelected = this.data.selectedClass || 'ALL';
      this.setData({
        classTabs,
        classPickerOptions: DEFAULT_CLASSES.map((c) => ({ label: c.name, value: c.name }))
      }, () => {
        wx.nextTick(() => {
          this.setData({ selectedClass: currentSelected });
        });
      });
    }
  },

  /**
   * 请求课堂日志接口（支持班级ID与班级名称双键精准筛选及分页）
   * @param {Object} options
   * @param {boolean} options.resetPage 是否重置为第 1 页
   * @param {boolean} options.showLoading 是否显示加载器
   */
  async fetchLogs({ resetPage = false, showLoading = true } = {}) {
    if (showLoading) {
      wx.showNavigationBarLoading();
    }

    const currentPage = resetPage ? 1 : this.data.page;
    const { selectedClass, searchKeyword, pageSize, classTabs } = this.data;

    const payload = {
      action: 'getLessonLogs',
      page: currentPage,
      page_size: pageSize
    };

    // 获取当前选中的 Tab 元数据，支持 class_id 优先传递
    const currentTab = classTabs.find((t) => t.value === selectedClass) || {};
    if (currentTab.class_id && currentTab.class_id !== 'ALL') {
      payload.class_id = currentTab.class_id;
    }
    if (currentTab.class_name && currentTab.class_name !== 'ALL') {
      payload.class_name = currentTab.class_name;
    } else if (selectedClass && selectedClass !== 'ALL') {
      payload.class_name = selectedClass;
    }

    if (searchKeyword && searchKeyword.trim()) {
      payload.keyword = searchKeyword.trim();
    }

    console.log(`>>> [课堂台账] 请求接口: page=${currentPage}, class=${selectedClass}, kw=${searchKeyword}`);

    try {
      const logRes = await callCloudFunction('teacher-service', payload);
      const resData = logRes?.result || logRes || {};

      let newItems = [];
      let total = 0;
      let hasMore = false;

      if (resData.code === 0) {
        const rawData = resData.data;
        if (Array.isArray(rawData)) {
          newItems = rawData;
        } else if (rawData && Array.isArray(rawData.list)) {
          newItems = rawData.list;
        }
        total = typeof resData.total === 'number' ? resData.total : newItems.length;
        hasMore = typeof resData.has_more === 'boolean'
          ? resData.has_more
          : (currentPage * pageSize < total);
      }

      // 清洗数据日期
      const cleanedItems = newItems.map((item) => ({
        ...item,
        date: normalizeDateStr(item.date),
        class_name: (item.class_name || '').trim()
      }));

      // 聚合已有数据或覆盖
      const finalLogsList = resetPage ? cleanedItems : [...this.data.logsList, ...cleanedItems];

      // 按日期分组渲染时光轴
      this.renderGroupedLogs(finalLogsList);

      this.setData({
        logsList: finalLogsList,
        page: currentPage,
        totalLogsCount: total,
        hasMore
      });

      console.log(`<<< [课堂台账] 接口返回: 本次 ${cleanedItems.length} 条, 累计 ${finalLogsList.length}/${total} 条, hasMore=${hasMore}`);
    } catch (err) {
      console.error('[lesson-logs] 请求课堂日志失败:', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      if (showLoading) {
        wx.hideNavigationBarLoading();
      }
      this.setData({
        isLoading: false,
        isFetchingMore: false
      });
    }
  },

  /**
   * 滚动触底：加载下一页数据
   */
  async loadMoreLogs() {
    this.setData({ isFetchingMore: true });
    const nextPage = this.data.page + 1;
    this.setData({ page: nextPage });
    await this.fetchLogs({ resetPage: false, showLoading: false });
  },

  /**
   * 将日志列表按日期聚合分组并生成空状态文案
   */
  renderGroupedLogs(list) {
    const { selectedClass } = this.data;

    const sortedList = [...list].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return Number(b.period_n || 0) - Number(a.period_n || 0);
    });

    const groupMap = {};
    for (const item of sortedList) {
      if (!groupMap[item.date]) {
        groupMap[item.date] = [];
      }
      groupMap[item.date].push(item);
    }

    const groupedLogs = Object.entries(groupMap).map(([date, items]) => {
      const dObj = new Date(date);
      const weekday = isNaN(dObj.getDay()) ? '' : WEEKDAYS[dObj.getDay()];
      const parts = date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[0]}年${parts[1]}月${parts[2]}日` : date;
      return {
        date,
        formattedDate,
        weekday,
        items
      };
    });

    let emptyDescription = '暂无符合条件的课堂教学记录';
    if (selectedClass !== 'ALL') {
      emptyDescription = `「${selectedClass}」暂无授课记录`;
    }

    this.setData({
      groupedLogs,
      emptyDescription
    });
  },

  /**
   * 点击年级 / 班级 Tab：重置为第一页并请求云端接口
   */
  onClassTabChange(e) {
    let cls = e?.detail?.value;
    if (cls === undefined) {
      cls = e?.detail;
    }
    // 兼容数字索引
    if (typeof cls === 'number' || (typeof cls === 'string' && /^\d+$/.test(cls))) {
      const idx = Number(cls);
      if (this.data.classTabs[idx]) {
        cls = this.data.classTabs[idx].value;
      }
    }

    if (!cls || cls === this.data.selectedClass) return;

    wx.vibrateShort?.({ type: 'light' });
    const selectedText = cls === 'ALL' ? '全部班级' : cls;

    this.setData({
      selectedClass: cls,
      selectedClassText: selectedText,
      logsList: [],
      groupedLogs: [],
      page: 1,
      hasMore: true
    }, () => {
      // 切换 Tab 时直接触发接口请求！
      this.fetchLogs({ resetPage: true, showLoading: true });
    });
  },

  /**
   * 一键重置所有筛选条件并重新请求接口
   */
  resetAllFilters() {
    wx.vibrateShort?.({ type: 'light' });
    this.setData({
      selectedClass: 'ALL',
      selectedClassText: '全部班级',
      searchKeyword: '',
      page: 1,
      logsList: [],
      groupedLogs: [],
      hasMore: true
    }, () => {
      this.fetchLogs({ resetPage: true, showLoading: true });
    });
  },

  /**
   * 搜索框内容变更（带 350ms 防抖请求接口）
   */
  onSearchChange(e) {
    const val = e.detail.value;
    this.setData({ searchKeyword: val });

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.fetchLogs({ resetPage: true, showLoading: true });
    }, 350);
  },

  /**
   * 清空搜索框并刷新接口
   */
  onSearchClear() {
    this.setData({ searchKeyword: '' }, () => {
      this.fetchLogs({ resetPage: true, showLoading: true });
    });
  },

  /**
   * 打开新增 / 补记弹窗
   */
  openCreateModal() {
    wx.vibrateShort?.({ type: 'light' });
    const defaultClassName = this.data.selectedClass !== 'ALL'
      ? this.data.selectedClass
      : (this.data.classPickerOptions[0]?.value || '八4班');

    const matchedOpt = this.data.classPickerOptions.find((c) => c.value === defaultClassName);

    this.setData({
      isModalVisible: true,
      editingId: '',
      form: {
        date: this.getTodayDateStr(),
        class_id: matchedOpt?.id || '',
        class_name: defaultClassName,
        period_n: 1,
        period_str: '第1节',
        subject: '地理',
        content: ''
      }
    });
  },

  /**
   * 打开编辑已有记录弹窗
   */
  onEditLog(e) {
    wx.vibrateShort?.({ type: 'light' });
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    const pStr = item.period_str || `第${item.period_n}节`;

    this.setData({
      isModalVisible: true,
      editingId: item.id,
      form: {
        date: item.date,
        class_id: item.class_id || '',
        class_name: item.class_name,
        period_n: Number(item.period_n || 1),
        period_str: pStr,
        subject: item.subject || '地理',
        content: item.content || ''
      }
    });
  },

  closeModal() {
    this.setData({ isModalVisible: false });
  },

  onModalVisibleChange(e) {
    this.setData({ isModalVisible: e.detail.visible });
  },

  /* ================== 日期选择器 ================== */
  openDatePicker() {
    wx.vibrateShort?.({ type: 'light' });
    this.setData({ isDatePickerVisible: true });
  },

  onDatePickerConfirm(e) {
    const val = normalizeDateStr(e.detail.value);
    this.setData({
      'form.date': val,
      isDatePickerVisible: false
    });
  },

  onDatePickerCancel() {
    this.setData({ isDatePickerVisible: false });
  },

  /* ================== 班级选择器 ================== */
  openClassPicker() {
    wx.vibrateShort?.({ type: 'light' });
    this.setData({ isClassPickerVisible: true });
  },

  onClassPickerConfirm(e) {
    const val = (e.detail.value[0] || '').trim();
    const matchedOpt = this.data.classPickerOptions.find((c) => c.value === val);
    this.setData({
      'form.class_name': val,
      'form.class_id': matchedOpt?.id || '',
      isClassPickerVisible: false
    });
  },

  onClassPickerCancel() {
    this.setData({ isClassPickerVisible: false });
  },

  /* ================== 课时节次选择器 ================== */
  openPeriodPicker() {
    wx.vibrateShort?.({ type: 'light' });
    this.setData({ isPeriodPickerVisible: true });
  },

  onPeriodPickerConfirm(e) {
    const val = e.detail.value[0];
    const n = PERIOD_NAMES.indexOf(val) + 1;
    this.setData({
      'form.period_str': val,
      'form.period_n': n > 0 ? n : 1,
      isPeriodPickerVisible: false
    });
  },

  onPeriodPickerCancel() {
    this.setData({ isPeriodPickerVisible: false });
  },

  /* ================== 快捷短语与输入 ================== */
  onSelectQuickPhrase(e) {
    const phrase = e.currentTarget.dataset.text;
    if (!phrase) return;

    wx.vibrateShort?.({ type: 'light' });
    const current = (this.data.form.content || '').trim();
    const newContent = current ? `${current}，${phrase}` : phrase;
    this.setData({ 'form.content': newContent });
  },

  onInputContent(e) {
    this.setData({ 'form.content': e.detail.value });
  },

  /* ================== 保存记录 ================== */
  async submitRecord() {
    const { form } = this.data;
    if (!form.content.trim() || !form.class_name) return;

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const matchedOpt = this.data.classPickerOptions.find((c) => c.value === form.class_name.trim());
      const classId = matchedOpt?.id || form.class_id || '';

      const res = await callCloudFunction('teacher-service', {
        action: 'saveLessonLog',
        date: normalizeDateStr(form.date),
        class_id: classId,
        class_name: form.class_name.trim(),
        period_n: form.period_n,
        period_str: form.period_str,
        subject: form.subject,
        content: form.content.trim()
      });

      const dataRes = res.result || res;
      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        wx.hideLoading();
        wx.showToast({ title: '已保存记录', icon: 'success' });
        this.closeModal();
        this.fetchLogs({ resetPage: true, showLoading: false });
      } else {
        wx.hideLoading();
        wx.showToast({ title: dataRes?.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[lesson-logs] 提交课堂记录失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  /* ================== 删除处理 (T-Dialog) ================== */
  openDeleteDialog(e) {
    wx.vibrateShort?.({ type: 'light' });
    const id = e.currentTarget.dataset.id;
    this.setData({
      isDeleteDialogOpen: true,
      pendingDeleteId: id
    });
  },

  deleteCurrentEditing() {
    this.setData({
      isDeleteDialogOpen: true,
      pendingDeleteId: this.data.editingId
    });
  },

  onCancelDelete() {
    this.setData({
      isDeleteDialogOpen: false,
      pendingDeleteId: ''
    });
  },

  async onConfirmDelete() {
    const id = this.data.pendingDeleteId;
    if (!id) return;

    this.setData({ isDeleteDialogOpen: false });
    wx.showLoading({ title: '删除中...' });

    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'deleteLessonLog',
        id: id
      });
      const dataRes = res.result || res;
      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        wx.hideLoading();
        wx.showToast({ title: '已删除', icon: 'success' });
        if (this.data.isModalVisible) {
          this.closeModal();
        }
        this.fetchLogs({ resetPage: true, showLoading: false });
      } else {
        wx.hideLoading();
        wx.showToast({ title: dataRes?.message || '删除失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[lesson-logs] 删除课堂记录失败:', err);
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
