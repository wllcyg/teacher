// pages/mine/index.js
import { callCloudFunction, CURRENT_ENV } from '../../utils/db';

Page({
  data: {
    currentEnv: CURRENT_ENV,
    teacher: {
      name: '',
      avatar_url: '',
      subject: '',
      school: '',
    },
    form: {
      name: '',
      avatar_url: '',
      subject: '语文',
      school: '',
    },
    commonSubjects: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道法', '体育', '音乐', '美术', '信息科技'],
    isEditPopupVisible: false,
    isSaving: false,
    tempAvatarFile: '', // 本地临时选中的头像文件路径
    classCountText: '',
  },

  // 数据格式安全净化，杜绝 null 值导致 TDesign avatar 组件报错
  sanitizeProfile(data = {}) {
    return {
      id: data.id || '',
      openid: data.openid || '',
      name: data.name || '',
      avatar_url: (data.avatar_url || '').trim(),
      subject: data.subject || '语文',
      school: data.school || '',
    };
  },

  onLoad() {
    // 1. 优先从本地缓存秒级回显，杜绝白屏闪烁
    const cached = wx.getStorageSync('TEACHER_PROFILE');
    if (cached) {
      const safeCached = this.sanitizeProfile(cached);
      this.setData({
        teacher: safeCached,
        form: {
          name: safeCached.name,
          avatar_url: safeCached.avatar_url,
          subject: safeCached.subject,
          school: safeCached.school,
        },
      });
    }
    // 2. 后台拉取云端最新数据同步
    this.fetchTeacherProfile();
  },

  onShow() {
    this.fetchTeacherProfile();
  },

  navToClassManage() {
    wx.navigateTo({
      url: '/pages/class-manage/index',
    });
  },

  navToPeriods() {
    wx.navigateTo({
      url: '/pages/periods/index',
    });
  },

  /**
   * 从远端数据库拉取教师个人资料并同步缓存
   */
  async fetchTeacherProfile() {
    try {
      const res = await callCloudFunction('teacher-service', {
        action: 'getProfile',
      });

      if (res.result && res.result.code === 0) {
        const rawTeacher = res.result.data.teacher || {};
        const safeTeacher = this.sanitizeProfile(rawTeacher);
        const count = res.result.data.classCount || 0;
        const classCountText = count > 0 ? `已建 ${count} 个班级` : '尚未建班 (点击创建)';

        // 更新页面展示
        this.setData({
          teacher: safeTeacher,
          classCountText,
          form: {
            name: safeTeacher.name,
            avatar_url: safeTeacher.avatar_url,
            subject: safeTeacher.subject,
            school: safeTeacher.school,
          },
        });
        // 写入本地持久缓存
        wx.setStorageSync('TEACHER_PROFILE', safeTeacher);
      }
    } catch (err) {
      console.error('[mine] 拉取教师资料失败:', err);
    }
  },

  /**
   * 打开编辑弹窗
   */
  openEditPopup() {
    this.setData({
      isEditPopupVisible: true,
      form: {
        name: this.data.teacher.name || '',
        avatar_url: this.data.teacher.avatar_url || '',
        subject: this.data.teacher.subject || '语文',
        school: this.data.teacher.school || '',
      },
      tempAvatarFile: '',
    });
  },

  /**
   * 关闭编辑弹窗
   */
  closeEditPopup() {
    this.setData({
      isEditPopupVisible: false,
      tempAvatarFile: '',
    });
  },

  onPopupVisibleChange(e) {
    this.setData({
      isEditPopupVisible: e.detail.visible,
    });
  },

  /**
   * 微信原生头像选择回调
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;

    // 先在本地做即时回显
    this.setData({
      'form.avatar_url': avatarUrl,
      'teacher.avatar_url': avatarUrl,
      tempAvatarFile: avatarUrl,
    });

    // 无论在弹窗内还是主卡片点击，都直接在后台上传并保存
    this.uploadAndSaveAvatar(avatarUrl);
  },

  /**
   * 上传临时头像至云存储并持久化
   */
  async uploadAndSaveAvatar(tempFilePath) {
    wx.showLoading({ title: '正在同步头像...', mask: true });
    try {
      const ext = tempFilePath.split('.').pop() || 'jpg';
      const cloudPath = `avatars/teacher_${Date.now()}_${Math.random().toString(36).slice(-6)}.${ext}`;

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
      });

      const fileID = uploadRes.fileID;

      // 持久化到云端数据库
      await callCloudFunction('teacher-service', {
        action: 'updateProfile',
        avatar_url: fileID,
      });

      this.setData({
        'teacher.avatar_url': fileID,
        'form.avatar_url': fileID,
        tempAvatarFile: '',
      });
      wx.setStorageSync('TEACHER_PROFILE', {
        ...this.data.teacher,
        avatar_url: fileID,
      });

      wx.hideLoading();
      wx.showToast({ title: '头像已同步', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error('上传头像失败:', err);
      wx.showToast({ title: '头像上传失败', icon: 'none' });
    }
  },

  /**
   * 微信昵称失去焦点（点击微信键盘上方推荐昵称时触发）
   */
  onNicknameBlur(e) {
    const val = e.detail.value || '';
    if (val.trim()) {
      this.setData({
        'form.name': val.trim(),
      });
    }
  },

  /**
   * 姓名手动输入
   */
  onNameInput(e) {
    this.setData({
      'form.name': e.detail.value,
    });
  },

  /**
   * 学校输入
   */
  onSchoolInput(e) {
    this.setData({
      'form.school': e.detail.value,
    });
  },

  /**
   * 选择常用学科
   */
  onSelectSubject(e) {
    const { subject } = e.currentTarget.dataset;
    this.setData({
      'form.subject': subject,
    });
  },

  /**
   * 保存完整的个人资料
   */
  async saveProfile() {
    const { name, subject, school, avatar_url } = this.data.form;

    if (!name || !name.trim()) {
      wx.showToast({ title: '请填写教师称呼', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    try {
      let finalAvatarUrl = avatar_url;

      // 如果有待上传的本地临时文件，先完成上传
      if (this.data.tempAvatarFile) {
        const ext = this.data.tempAvatarFile.split('.').pop() || 'jpg';
        const cloudPath = `avatars/teacher_${Date.now()}_${Math.random().toString(36).slice(-6)}.${ext}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: this.data.tempAvatarFile,
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      console.log('[mine] 发起 updateProfile 入参:', { name, subject, school, finalAvatarUrl });
      const res = await callCloudFunction('teacher-service', {
        action: 'updateProfile',
        name: name.trim(),
        subject: (subject || '').trim(),
        school: (school || '').trim(),
        avatar_url: finalAvatarUrl,
      });

      console.log('[mine] 云函数 updateProfile 返回:', res);
      this.setData({ isSaving: false });

      if (res.result && res.result.code === 0) {
        const updatedTeacher = {
          ...this.data.teacher,
          name: name.trim(),
          subject: (subject || '').trim(),
          school: (school || '').trim(),
          avatar_url: finalAvatarUrl,
        };
        this.setData({
          teacher: updatedTeacher,
          isEditPopupVisible: false,
          tempAvatarFile: '',
        });
        wx.setStorageSync('TEACHER_PROFILE', updatedTeacher);

        wx.showToast({ title: '资料已更新', icon: 'success' });
      } else {
        console.error('[mine] 云函数业务返回异常:', res.result);
        wx.showToast({ title: res.result?.message || '更新失败', icon: 'none' });
      }
    } catch (err) {
      this.setData({ isSaving: false });
      console.error('[mine] 保存教师资料调用失败:', err);
      wx.showToast({ title: '云端保存失败', icon: 'none' });
    }
  },

  /**
   * 跳转至班级管理
   */
  navToClassManage() {
    wx.navigateTo({
      url: '/pages/class-manage/index',
    });
  },

  /**
   * 跳转至我的任教课表
   */
  navToSchedule() {
    wx.navigateTo({
      url: '/pages/schedule/index',
    });
  },

  /**
   * 跳转至作息时间表配置
   */
  navToPeriods() {
    wx.navigateTo({
      url: '/pages/periods/index',
    });
  },

  onTapTip(e) {
    const { text } = e.currentTarget.dataset;
    wx.showToast({
      title: `${text}功能建设中`,
      icon: 'none',
    });
  },
});
