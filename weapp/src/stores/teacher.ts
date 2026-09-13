import { defineStore } from 'pinia'
import Taro from '@tarojs/taro'
import { callTeacherService } from '../api/teacher'

export interface TeacherInfo {
  id?: number
  openid: string
  name: string
  school?: string
  avatar_url?: string
}

export interface ClassItem {
  class_id: number
  name: string
  grade?: string
  invite_code: string
  is_headmaster: boolean
  subject_id?: number
  subject_name?: string
  subject_color?: string
  subject_short?: string
}

export interface StudentItem {
  id?: number
  class_id: number
  name: string
  student_no?: string
  group_name?: string
  gender?: string
  is_leader?: boolean
}

export interface SubjectItem {
  id: number
  name: string
  short_name: string
  color: string
  sort_order: number
}

export const useTeacherStore = defineStore('teacher', {
  state: () => ({
    teacher: null as TeacherInfo | null,
    classList: [] as ClassItem[],
    currentClassId: null as number | null,
    students: [] as StudentItem[],
    allSubjects: [] as SubjectItem[],
    loading: false,
    initialized: false
  }),

  getters: {
    currentClass: (state): ClassItem | null => {
      if (!state.currentClassId) return state.classList[0] || null
      return state.classList.find(c => c.class_id === state.currentClassId) || state.classList[0] || null
    },
    // 按小组聚类学生
    groupedStudents: (state) => {
      const map = new Map<string, StudentItem[]>()
      state.students.forEach(s => {
        const group = s.group_name || '未分组'
        if (!map.has(group)) {
          map.set(group, [])
        }
        map.get(group)!.push(s)
      })
      return Array.from(map.entries()).map(([groupName, list]) => ({
        groupName,
        list
      }))
    }
  },

  actions: {
    // 1. 初始化拉取教师信息与班级（支持静默刷新 SWR，杜绝切换 Tab 闪烁）
    async fetchProfile(force = false) {
      if (this.initialized && !force) {
        // 已有数据时后台静默更新，不干扰前台 DOM 渲染
        try {
          const data = await callTeacherService<{
            openid: string
            teacher: TeacherInfo
            classList: ClassItem[]
            allSubjects: SubjectItem[]
          }>('getProfile')

          this.teacher = data.teacher
          this.classList = data.classList || []
          this.allSubjects = data.allSubjects || []

          if (this.classList.length > 0) {
            if (!this.currentClassId || !this.classList.some(c => c.class_id === this.currentClassId)) {
              this.currentClassId = this.classList[0].class_id
              await this.fetchClassStudents(this.currentClassId)
            }
          } else {
            this.currentClassId = null
            this.students = []
          }
        } catch (e) {
          // 静默更新错误不阻断当前界面
        }
        return
      }

      this.loading = true
      try {
        const data = await callTeacherService<{
          openid: string
          teacher: TeacherInfo
          classList: ClassItem[]
          allSubjects: SubjectItem[]
        }>('getProfile')

        this.teacher = data.teacher
        this.classList = data.classList || []
        this.allSubjects = data.allSubjects || []

        if (this.classList.length > 0) {
          if (!this.currentClassId || !this.classList.some(c => c.class_id === this.currentClassId)) {
            this.currentClassId = this.classList[0].class_id
          }
          await this.fetchClassStudents(this.currentClassId)
        } else {
          this.currentClassId = null
          this.students = []
        }
        this.initialized = true
      } finally {
        this.loading = false
      }
    },

    // 2. 切换当前班级
    async selectClass(classId: number) {
      if (this.currentClassId === classId) return
      this.currentClassId = classId
      Taro.vibrateShort({ type: 'light' }) // 原生触感
      await this.fetchClassStudents(classId)
    },

    // 3. 拉取指定班级学生
    async fetchClassStudents(classId: number) {
      this.loading = true
      try {
        const list = await callTeacherService<StudentItem[]>('getClassStudents', {
          class_id: classId
        })
        this.students = list || []
      } finally {
        this.loading = false
      }
    },

    // 4. 创建新班级
    async createClass(params: { name: string; grade?: string; subject_id?: number }) {
      const res = await callTeacherService<ClassItem>('createClass', params)
      Taro.vibrateShort({ type: 'light' })
      if (res && res.class_id) {
        this.currentClassId = res.class_id
        // 乐观追加到当前班级列表，确保工作台状态即刻就绪
        const exists = this.classList.some(c => c.class_id === res.class_id)
        if (!exists) {
          this.classList.push({
            class_id: res.class_id,
            name: res.name || params.name,
            grade: res.grade || params.grade || '',
            invite_code: res.invite_code || '',
            is_headmaster: true,
            subject_name: '未设科目',
            subject_color: '#3b82f6',
            subject_short: '科'
          })
        }
        this.students = []
      }
      // 后台静默刷新全量档案，解耦错误传播，避免阻断创建主流程
      this.fetchProfile(true).catch(err => {
        console.warn('[createClass] 后台静默同步班级档案:', err)
      })
      return res
    },

    // 5. 邀请码加入班级
    async joinClass(inviteCode: string, subjectId?: number) {
      const res = await callTeacherService<ClassItem>('joinClassByCode', {
        invite_code: inviteCode,
        subject_id: subjectId
      })
      Taro.vibrateShort({ type: 'light' })
      if (res && res.class_id) {
        this.currentClassId = res.class_id
      }
      await this.fetchProfile(true)
      return res
    },

    // 6. 载入体验演示班
    async seedDemoClass() {
      const res = await callTeacherService<{ class_id: number }>('seedDemoClass')
      Taro.vibrateShort({ type: 'light' })
      if (res && res.class_id) {
        this.currentClassId = res.class_id
      }
      await this.fetchProfile(true)
      return res
    },

    // 8. 批量导入学生
    async batchImportStudents(students: Array<{ name: string; group_name?: string; is_leader?: boolean; gender?: string; student_no?: string }>) {
      if (!this.currentClassId) return
      const res = await callTeacherService('batchImportStudents', {
        class_id: this.currentClassId,
        students
      })
      Taro.vibrateShort({ type: 'light' })
      await this.fetchClassStudents(this.currentClassId)
      return res
    },

    // 9. 更新教师头像与资料
    async updateAvatar(avatarUrl: string) {
      await callTeacherService('updateProfile', {
        avatar_url: avatarUrl
      })
      if (this.teacher) {
        this.teacher.avatar_url = avatarUrl
      }
    },

    // 10. 单个添加学生
    async addStudent(student: { name: string; group_name?: string; is_leader?: boolean; gender?: string; student_no?: string }) {
      if (!this.currentClassId) return
      const res = await callTeacherService('addStudent', {
        class_id: this.currentClassId,
        ...student
      })
      Taro.vibrateShort({ type: 'light' })
      await this.fetchClassStudents(this.currentClassId)
      return res
    },

    // 11. 更新单个学生（乐观更新 + 云端持久化）
    async updateStudent(studentId: number, payload: Partial<StudentItem>) {
      const target = this.students.find(s => s.id === studentId)
      if (target) {
        Object.assign(target, payload)
      }
      Taro.vibrateShort({ type: 'light' })

      const res = await callTeacherService('updateStudent', {
        student_id: studentId,
        ...payload
      })
      return res
    },

    // 12. 切换组长状态（组长/组员）
    async toggleStudentLeader(studentId: number) {
      const target = this.students.find(s => s.id === studentId)
      if (!target) return
      const nextState = !target.is_leader
      target.is_leader = nextState
      Taro.vibrateShort({ type: 'medium' })

      await callTeacherService('updateStudent', {
        student_id: studentId,
        is_leader: nextState
      })
    },

    // 13. 从班级中移除单个学生（软删除）
    async deleteStudent(studentId: number) {
      this.students = this.students.filter(s => s.id !== studentId)
      Taro.vibrateShort({ type: 'medium' })

      const res = await callTeacherService('deleteStudent', {
        student_id: studentId
      })
      return res
    },

    // 9. 删除班级（级联删除学生与任教绑定，清空测试数据）
    async deleteClass(classId: number) {
      const res = await callTeacherService('deleteClass', {
        class_id: classId
      })
      Taro.vibrateShort({ type: 'light' })
      // 若删除的是当前班级，重置当前班级 id
      if (this.currentClassId === classId) {
        this.currentClassId = null
      }
      // 强制全量重新拉取档案与剩余班级列表
      await this.fetchProfile(true)
      return res
    }
  }
})
