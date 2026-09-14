// pages/class-manage/index.js
import { callCloudFunction } from '../../utils/db';

/**
 * 智能推算标准学年列表及当前所在学年
 * (每年8-9月秋季开学开启新学年)
 */
function getAcademicYearsConfig() {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  const currentAcademicYear = `${startYear}-${startYear + 1}`;

  const options = [];
  for (let i = -3; i <= 3; i++) {
    const y = startYear + i;
    options.push(`${y}-${y + 1}`);
  }
  const defaultIndex = options.indexOf(currentAcademicYear);
  return { 
    options, 
    currentAcademicYear, 
    defaultIndex: defaultIndex >= 0 ? defaultIndex : 0 
  };
}

Page({
  data: {
    classList: [],
    isLoading: true,
    isModalVisible: false,
    isEditing: false,
    isSubmitting: false,
    editingId: '',
    academicYearOptions: [],
    academicYearIndex: 0,
    currentAcademicYear: '',
    form: {
      name: '',
      grade: '初一',
      academic_year: '',
    },
    gradeOptions: [
      '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
      '初一', '初二', '初三',
      '高一', '高二', '高三'
    ],
  },

  onLoad() {
    const yearConfig = getAcademicYearsConfig();
    this.setData({
      academicYearOptions: yearConfig.options,
      academicYearIndex: yearConfig.defaultIndex,
      currentAcademicYear: yearConfig.currentAcademicYear,
      'form.academic_year': yearConfig.currentAcademicYear,
    });
    this.fetchClassList();
  },

  onPullDownRefresh() {
    this.fetchClassList().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 获取班级列表
   */
  async fetchClassList() {
    this.setData({ isLoading: true });
    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'getMyClasses',
      });
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0 && dataRes.data) {
        const list = dataRes.data.list || [];
        this.setData({
          classList: list,
        });
      } else {
        wx.showToast({
          title: dataRes?.message || '获取班级列表失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('拉取班级列表异常:', err);
      wx.showToast({
        title: '网络连接异常，请重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 打开创建班级弹窗
   */
  openCreateModal() {
    const defaultYear = this.data.currentAcademicYear || '2024-2025';
    const index = this.data.academicYearOptions.indexOf(defaultYear);
    this.setData({
      isModalVisible: true,
      isEditing: false,
      editingId: '',
      academicYearIndex: index >= 0 ? index : 0,
      form: {
        name: '',
        grade: '初一',
        academic_year: defaultYear,
      },
    });
  },

  /**
   * 打开编辑班级弹窗
   */
  openEditModal(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    const currentYear = item.academic_year || this.data.currentAcademicYear || '2024-2025';
    const index = this.data.academicYearOptions.indexOf(currentYear);

    this.setData({
      isModalVisible: true,
      isEditing: true,
      editingId: item.id,
      academicYearIndex: index >= 0 ? index : 0,
      form: {
        name: item.name || '',
        grade: item.grade || '初一',
        academic_year: currentYear,
      },
    });
  },

  /**
   * 关闭弹窗
   */
  closeModal() {
    this.setData({ isModalVisible: false });
  },

  onModalVisibleChange(e) {
    this.setData({ isModalVisible: e.detail.visible });
  },

  onInputName(e) {
    this.setData({
      'form.name': e.detail.value,
    });
  },

  /**
   * 学年 Picker 改变事件
   */
  onAcademicYearChange(e) {
    const index = Number(e.detail.value);
    const selectedYear = this.data.academicYearOptions[index];
    if (selectedYear) {
      this.setData({
        academicYearIndex: index,
        'form.academic_year': selectedYear,
      });
    }
  },

  onSelectGrade(e) {
    const grade = e.currentTarget.dataset.grade;
    this.setData({
      'form.grade': grade,
    });
  },

  /**
   * 提交表单（创建/更新）
   */
  async submitClassForm() {
    const { name, grade, academic_year } = this.data.form;
    const trimmedName = (name || '').trim();

    if (!trimmedName) {
      wx.showToast({ title: '请输入班级名称', icon: 'none' });
      return;
    }

    if (!grade) {
      wx.showToast({ title: '请选择所属年级', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const action = this.data.isEditing ? 'updateClass' : 'createClass';
      const payload = {
        action,
        name: trimmedName,
        grade,
        academic_year: (academic_year || '').trim(),
      };

      if (this.data.isEditing) {
        payload.class_id = this.data.editingId;
      }

      const res = await callCloudFunction('teacher-service', payload);
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0) {
        wx.vibrateShort?.({ type: 'medium' });
        wx.showToast({
          title: this.data.isEditing ? '更新成功' : '创建成功',
          icon: 'success',
        });
        this.closeModal();
        await this.fetchClassList();
      } else {
        wx.showToast({
          title: dataRes?.message || '操作失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('提交班级表单异常:', err);
      wx.showToast({
        title: '提交失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  /**
   * 跳转至指定班级的学生花名册
   */
  navToStudentRoster(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/roster/index?class_id=${id}&class_name=${encodeURIComponent(name)}`,
    });
  },

  /**
   * 设为默认班级
   */
  async setDefaultClass(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) return;

    wx.vibrateShort?.({ type: 'light' });
    wx.showLoading({ title: '设置中...', mask: true });

    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'setDefaultClass',
        class_id: id,
      });
      const dataRes = res.result || res;

      if (dataRes && dataRes.code === 0) {
        wx.showToast({
          title: `已设「${name}」为默认班级`,
          icon: 'none',
        });
        await this.fetchClassList();
      } else {
        wx.showToast({
          title: dataRes?.message || '设为默认失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('设为默认班级异常:', err);
      wx.showToast({ title: '请求失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 解散班级确认
   */
  confirmDeleteClass(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) return;

    wx.showModal({
      title: '解散班级确认',
      content: `确定要解散班级「${name}」吗？解散后班级内学生数据将一并清理且不可恢复。`,
      confirmText: '确定解散',
      confirmColor: '#e34d59',
      cancelText: '取消',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          wx.showLoading({ title: '解散中...', mask: true });
          try {
            const res = await callCloudFunction('teacher-service', {
              action: 'deleteClass',
              class_id: id,
            });
            const dataRes = res.result || res;

            if (dataRes && dataRes.code === 0) {
              wx.showToast({ title: '班级已解散', icon: 'success' });
              await this.fetchClassList();
            } else {
              wx.showToast({
                title: dataRes?.message || '解散失败',
                icon: 'none',
              });
            }
          } catch (err) {
            console.error('解散班级异常:', err);
            wx.showToast({ title: '解散班级异常', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      },
    });
  },
});
