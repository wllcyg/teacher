// pages/roster/index.js
import { callCloudFunction } from '../../utils/db';

/**
 * 智能提取中文姓名拼音首字母（含多音字姓氏矫正）
 */
function getFirstLetter(str) {
  if (!str) return '#';
  const char = str.trim().charAt(0);
  if (/^[a-zA-Z]/.test(char)) {
    return char.toUpperCase();
  }
  // 百家姓常见多音字特殊矫正
  const specialSurname = {
    '单': 'S', '区': 'O', '查': 'Z', '解': 'X', '曾': 'Z', '朴': 'P',
    '缪': 'M', '繁': 'P', '仇': 'Q', '乐': 'Y', '尉': 'Y', '重': 'C',
    '盖': 'G', '翟': 'Z', '冼': 'X'
  };
  if (specialSurname[char]) {
    return specialSurname[char];
  }

  // 基于标准 GB2312 汉字音序边界定位
  const zhBoundaries = [
    { letter: 'A', boundary: '啊' },
    { letter: 'B', boundary: '芭' },
    { letter: 'C', boundary: '擦' },
    { letter: 'D', boundary: '搭' },
    { letter: 'E', boundary: '蛾' },
    { letter: 'F', boundary: '发' },
    { letter: 'G', boundary: '噶' },
    { letter: 'H', boundary: '哈' },
    { letter: 'J', boundary: '击' },
    { letter: 'K', boundary: '喀' },
    { letter: 'L', boundary: '垃' },
    { letter: 'M', boundary: '妈' },
    { letter: 'N', boundary: '拿' },
    { letter: 'O', boundary: '哦' },
    { letter: 'P', boundary: '啪' },
    { letter: 'Q', boundary: '期' },
    { letter: 'R', boundary: '然' },
    { letter: 'S', boundary: '撒' },
    { letter: 'T', boundary: '塌' },
    { letter: 'W', boundary: '挖' },
    { letter: 'X', boundary: '昔' },
    { letter: 'Y', boundary: '压' },
    { letter: 'Z', boundary: '匝' },
  ];

  try {
    for (let i = zhBoundaries.length - 1; i >= 0; i--) {
      if (char.localeCompare(zhBoundaries[i].boundary, 'zh-Hans-CN') >= 0) {
        return zhBoundaries[i].letter;
      }
    }
  } catch (err) {
    // 降级
  }
  return '#';
}

/**
 * 将学生列表按拼音首字母分组并升序排列
 */
function groupStudentsByLetter(students) {
  const map = {};
  for (const s of students) {
    const letter = getFirstLetter(s.name);
    if (!map[letter]) {
      map[letter] = [];
    }
    map[letter].push(s);
  }

  const sortedLetters = Object.keys(map).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  return sortedLetters.map((letter) => ({
    index: letter,
    children: map[letter],
  }));
}

Page({
  data: {
    classId: '',
    className: '',
    isLoading: true,
    studentList: [],
    filteredStudents: [],
    groupedStudents: [],
    indexList: [],
    searchQuery: '',
    cadreSummaryText: '',

    // 智能批量录入抽屉状态
    isBatchModalVisible: false,
    batchRawText: '',
    parsedStudents: [],
    isAiParsing: false,

    // 常用学习小组
    commonGroups: ['', '一组', '二组', '三组', '四组', '五组', '六组', '七组', '八组'],

    // 单个添加/编辑抽屉状态
    isEditModalVisible: false,
    isEditing: false,
    isSubmitting: false,
    editingStudentId: '',
    singleForm: {
      name: '',
      group_name: '', // 学习小组如 '一组'
      duty: '', // 仅支持 '' | '班长' | '组长'
      student_no: '',
      gender: '',
      remarks: '',
    },
  },

  onLoad(options) {
    const classId = options?.class_id || '';
    const className = options?.class_name ? decodeURIComponent(options.class_name) : '学生花名册';

    this.setData({
      classId,
      className,
    });

    if (className) {
      wx.setNavigationBarTitle({
        title: `${className} - 花名册`,
      });
    }

    if (classId) {
      this.fetchStudents();
    } else {
      wx.showToast({
        title: '缺少班级参数',
        icon: 'none',
      });
    }
  },

  onPullDownRefresh() {
    this.fetchStudents().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 拉取当前班级学生列表
   * @param {boolean} showLoading 是否显示页面级loading骨架
   */
  async fetchStudents(showLoading = true) {
    if (!this.data.classId) return;
    if (showLoading) {
      this.setData({ isLoading: true });
    }

    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'getStudentsByClass',
        class_id: this.data.classId,
      });

      const dataRes = res.result || res;
      if (dataRes && dataRes.code === 0 && dataRes.data) {
        const rawList = dataRes.data.list || [];
        // 处理姓名首字
        const list = rawList.map((item) => ({
          ...item,
          nameFirstChar: (item.name || '').trim().slice(0, 1) || '生',
        }));

        // 计算班干部（班长、组长）统计
        const monitorCount = list.filter((s) => s.duty === '班长').length;
        const leaderCount = list.filter((s) => s.duty === '组长').length;
        const summaryParts = [];
        if (monitorCount > 0) summaryParts.push(`班长 ${monitorCount}人`);
        if (leaderCount > 0) summaryParts.push(`组长 ${leaderCount}人`);
        const cadreSummaryText = summaryParts.join(' · ');

        // 按拼音首字母分组构建索引结构
        const groupedStudents = groupStudentsByLetter(list);
        const indexList = groupedStudents.map((item) => item.index);

        this.setData({
          studentList: list,
          groupedStudents,
          indexList,
          cadreSummaryText,
        });

        this.applyFilter();
      } else {
        wx.showToast({
          title: dataRes?.message || '拉取花名册失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('拉取学生名册异常:', err);
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'none',
      });
    } finally {
      if (showLoading) {
        this.setData({ isLoading: false });
      }
    }
  },

  /**
   * 字母索引选中/滑动触发事件
   */
  onIndexSelect(e) {
    wx.vibrateShort?.({ type: 'light' });
  },

  /**
   * 搜索过滤处理
   */
  onSearchChange(e) {
    this.setData({
      searchQuery: e.detail.value,
    });
    this.applyFilter();
  },

  onSearchClear() {
    this.setData({
      searchQuery: '',
    });
    this.applyFilter();
  },

  applyFilter() {
    const q = (this.data.searchQuery || '').trim().toLowerCase();
    const all = this.data.studentList || [];
    if (!q) {
      this.setData({ filteredStudents: all });
      return;
    }

    const filtered = all.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const no = (s.student_no || '').toLowerCase();
      const duty = (s.duty || '').toLowerCase();
      return name.includes(q) || no.includes(q) || duty.includes(q);
    });

    this.setData({ filteredStudents: filtered });
  },

  // ================= 智能批量录入逻辑 =================

  openBatchModal() {
    this.setData({
      isBatchModalVisible: true,
      batchRawText: '',
      parsedStudents: [],
    });
  },

  closeBatchModal() {
    this.setData({
      isBatchModalVisible: false,
      batchRawText: '',
      parsedStudents: [],
    });
  },

  onBatchModalVisibleChange(e) {
    this.setData({ isBatchModalVisible: e.detail.visible });
  },

  /**
   * 本地智能分词解析：支持按组分段、冒号提取、行内括号与职务智能识别（0毫秒本地引擎）
   */
  onBatchTextInput(e) {
    const text = e.detail.value || '';
    const lines = text.split(/[\r\n]+/);
    const parsed = [];
    const nameCounter = {};
    let currentGroup = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. 匹配纯组名行，如 "一组"、"第1组："、"【二组】"
      const groupHeaderMatch = line.match(/^[\(（\[【]?\s*(第?[一二三四五六七八九十0-9]+组)\s*[\)）\]】]?[:：]?\s*$/);
      if (groupHeaderMatch) {
        currentGroup = this.normalizeGroupName(groupHeaderMatch[1]);
        continue;
      }

      // 2. 匹配带冒号的组前缀，如 "一组：张三、李四"
      const inlineGroupMatch = line.match(/^[\(（\[【]?\s*(第?[一二三四五六七八九十0-9]+组)\s*[\)）\]】]?[:：]\s*(.+)$/);
      let lineContent = line;
      let lineGroup = currentGroup;
      if (inlineGroupMatch) {
        lineGroup = this.normalizeGroupName(inlineGroupMatch[1]);
        lineContent = inlineGroupMatch[2];
      }

      const tokens = lineContent.split(/[,，;；、\t\s]+/);
      let i = 0;
      while (i < tokens.length) {
        let token = tokens[i].trim();
        token = token.replace(/^\d+[\.、\s]*/, '').trim();
        if (!token) {
          i++;
          continue;
        }

        let name = token;
        let duty = '';
        let studentGroup = lineGroup;

        // 提取姓名后的小组标记，如 "张三 (一组)"
        const tagGroupMatch = name.match(/[\(（\[【\-:_]?\s*(第?[一二三四五六七八九十0-9]+组)\s*[\)）\]】]?/);
        if (tagGroupMatch) {
          studentGroup = this.normalizeGroupName(tagGroupMatch[1]);
          name = name.replace(tagGroupMatch[0], '').trim();
        }

        // 提取职务
        if (/[\(（\[【\-:_]?\s*(班长)\s*[\)）\]】]?/.test(name)) {
          duty = '班长';
          name = name.replace(/[\(（\[【\-:_]?\s*班长\s*[\)）\]】]?/g, '').trim();
        } else if (/[\(（\[【\-:_]?\s*(组长)\s*[\)）\]】]?/.test(name)) {
          duty = '组长';
          name = name.replace(/[\(（\[【\-:_]?\s*组长\s*[\)）\]】]?/g, '').trim();
        } else if (i + 1 < tokens.length && (tokens[i + 1] === '班长' || tokens[i + 1] === '组长')) {
          duty = tokens[i + 1];
          i++;
        }

        name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9·]/g, '').trim();

        if (name && name.length >= 2) {
          nameCounter[name] = (nameCounter[name] || 0) + 1;
          parsed.push({
            name,
            group_name: studentGroup,
            duty,
            isDuplicate: nameCounter[name] > 1,
          });
        }
        i++;
      }
    }

    const duplicateNames = Object.keys(nameCounter).filter((n) => nameCounter[n] > 1);
    const duplicateTips = duplicateNames.length > 0 
      ? `检测到同名学生：${duplicateNames.map(n => `「${n}」${nameCounter[n]}人`).join('、')}，已全部保留`
      : '';

    this.setData({
      batchRawText: text,
      parsedStudents: parsed,
      duplicateTips,
    });
  },

  /**
   * 规范组名为 "一组"、"二组" 等
   */
  normalizeGroupName(grp) {
    if (!grp) return '';
    let str = grp.replace(/[第组]/g, '').trim();
    const digitMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九', '10': '十' };
    if (digitMap[str]) str = digitMap[str];
    return `${str}组`;
  },

  /**
   * AI 大模型智能深度名单解析
   */
  async onAiParseClick() {
    const rawText = (this.data.batchRawText || '').trim();
    if (!rawText) {
      wx.showToast({
        title: '请先粘贴待识别的名单文本',
        icon: 'none',
      });
      return;
    }

    try {
      wx.vibrateShort?.({ type: 'light' });
    } catch (e) {}

    this.setData({ isAiParsing: true });
    wx.showLoading({ title: '深度识别中...', mask: true });

    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'aiParseRoster',
        text: rawText,
      });

      wx.hideLoading();
      this.setData({ isAiParsing: false });
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0 && dataRes.data && Array.isArray(dataRes.data.list)) {
        const list = dataRes.data.list;
        if (list.length > 0) {
          const nameCounter = {};
          const parsed = list.map((item) => {
            nameCounter[item.name] = (nameCounter[item.name] || 0) + 1;
            return {
              name: item.name,
              group_name: item.group_name || '',
              duty: item.duty || '',
              isDuplicate: nameCounter[item.name] > 1,
            };
          });

          const duplicateNames = Object.keys(nameCounter).filter((n) => nameCounter[n] > 1);
          const duplicateTips = duplicateNames.length > 0
            ? `检测到同名学生：${duplicateNames.map(n => `「${n}」${nameCounter[n]}人`).join('、')}，已全部保留`
            : '';

          this.setData({
            parsedStudents: parsed,
            duplicateTips,
          });

          wx.showToast({
            title: `成功识别 ${parsed.length} 位学生`,
            icon: 'success',
          });
        } else {
          wx.showToast({
            title: '未能识别到有效学生姓名',
            icon: 'none',
          });
        }
      } else {
        wx.showToast({
          title: dataRes?.message || '智能解析未返回结果',
          icon: 'none',
        });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ isAiParsing: false });
      console.error('智能解析异常:', err);
      wx.showToast({
        title: '云端网络异常，已保持本地识别结果',
        icon: 'none',
      });
    }
  },

  clearBatchText() {
    this.setData({
      batchRawText: '',
      parsedStudents: [],
    });
  },

  /**
   * 提交批量录入（单次调用 + 单一遮罩 + 静默刷新，彻底杜绝多次闪烁）
   */
  async submitBatchImport() {
    if (this.data.isSubmitting) return;

    const students = this.data.parsedStudents;
    if (!students || students.length === 0) {
      wx.showToast({ title: '暂未解析到有效姓名', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    // 1. 先关闭弹窗，避免弹窗关闭动画与加载遮罩冲突
    this.closeBatchModal();
    // 2. 统一使用单一原生加载遮罩
    wx.showLoading({ title: '正在批量录入...', mask: true });

    try {
      const studentsPayload = students.map((s) => ({
        name: s.name,
        group_name: s.group_name || '',
        duty: s.duty || '',
        student_no: '',
      }));

      const res = await callCloudFunction('teacher-service', {
        action: 'batchImportStudents',
        class_id: this.data.classId,
        students: studentsPayload,
      });

      const dataRes = res.result || res;
      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        // 3. 静默拉取最新列表，不触发页面级空白闪烁
        await this.fetchStudents(false);
        wx.hideLoading();
        wx.showToast({
          title: `成功录入 ${students.length} 人`,
          icon: 'success',
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: dataRes?.message || '批量录入失败',
          icon: 'none',
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('批量录入提交异常:', err);
      wx.showToast({ title: '提交异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // ================= 单个添加 / 编辑学生逻辑 =================

  openCreateModal() {
    this.setData({
      isEditModalVisible: true,
      isEditing: false,
      editingStudentId: '',
      singleForm: {
        name: '',
        duty: '', // 仅限 '' | '班长' | '组长'
        group_name: '',
        student_no: '',
        gender: '',
        remarks: '',
      },
    });
  },

  openEditModal(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    this.setData({
      isEditModalVisible: true,
      isEditing: true,
      editingStudentId: item.id,
      singleForm: {
        name: item.name || '',
        duty: item.duty || '', // 班长、组长 或 ''
        group_name: item.group_name || '',
        student_no: item.student_no || '',
        gender: item.gender || '',
        remarks: item.remarks || '',
      },
    });
  },

  closeEditModal() {
    this.setData({ isEditModalVisible: false });
  },

  onEditModalVisibleChange(e) {
    this.setData({ isEditModalVisible: e.detail.visible });
  },

  onInputSingleName(e) {
    this.setData({ 'singleForm.name': e.detail.value });
  },

  onInputSingleNo(e) {
    this.setData({ 'singleForm.student_no': e.detail.value });
  },

  onInputSingleRemarks(e) {
    this.setData({ 'singleForm.remarks': e.detail.value });
  },

  onSelectDuty(e) {
    const duty = e.currentTarget.dataset.duty;
    this.setData({ 'singleForm.duty': duty });
  },

  onSelectGroup(e) {
    const group = e.currentTarget.dataset.group;
    this.setData({ 'singleForm.group_name': group });
  },

  onSelectGender(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({ 'singleForm.gender': gender });
  },

  /**
   * 提交单个添加/编辑表单
   */
  async submitSingleForm() {
    if (this.data.isSubmitting) return;

    const { name, duty, group_name, student_no, gender, remarks } = this.data.singleForm;
    const trimmedName = (name || '').trim();

    if (!trimmedName) {
      wx.showToast({ title: '请输入学生姓名', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    this.closeEditModal();
    wx.showLoading({ title: '正在保存...', mask: true });

    try {
      const action = this.data.isEditing ? 'updateStudent' : 'createStudent';
      const payload = {
        action,
        class_id: this.data.classId,
        name: trimmedName,
        duty: duty || '',
        group_name: (group_name || '').trim(),
        student_no: (student_no || '').trim(),
        gender: (gender || '').trim(),
        remarks: (remarks || '').trim(),
      };

      if (this.data.isEditing) {
        payload.student_id = this.data.editingStudentId;
      }

      const res = await callCloudFunction('teacher-service', payload);
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'light' });
        await this.fetchStudents(false);
        wx.hideLoading();
        wx.showToast({
          title: this.data.isEditing ? '更新成功' : '添加成功',
          icon: 'success',
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: dataRes?.message || '操作失败',
          icon: 'none',
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('提交学生表单异常:', err);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  /**
   * 移出/删除学生确认
   */
  confirmDeleteStudent() {
    const studentId = this.data.editingStudentId;
    const studentName = this.data.singleForm.name;
    if (!studentId) return;

    wx.showModal({
      title: '移出学生确认',
      content: `确定要将学生「${studentName}」从当前班级名册中移出吗？`,
      confirmText: '确定移出',
      confirmColor: '#e34d59',
      cancelText: '取消',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '移出中...', mask: true });
          try {
            const res = await callCloudFunction('teacher-service', {
              action: 'deleteStudent',
              student_id: studentId,
              class_id: this.data.classId,
            });

            const dataRes = res.result || res;
            if (dataRes && dataRes.code === 0) {
              wx.showToast({ title: '已成功移出', icon: 'success' });
              this.closeEditModal();
              await this.fetchStudents();
            } else {
              wx.showToast({
                title: dataRes?.message || '移出失败',
                icon: 'none',
              });
            }
          } catch (err) {
            console.error('移出学生异常:', err);
            wx.showToast({ title: '移出异常，请稍后重试', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      },
    });
  },
});
