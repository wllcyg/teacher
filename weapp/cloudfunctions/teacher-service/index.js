const cloud = require('wx-server-sdk')
const cloudbase = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
})

// 生成6位大写字母+数字邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || event.mockOpenid || 'test_teacher_openid'
  const action = event.action
  const rdb = app.rdb({
    database: 'public'
  })

  try {
    switch (action) {
      // 1. 获取教师档案、任教班级列表与全部科目字典
      case 'getProfile': {
        // 查找或创建教师
        let teacherRes = await rdb.from('teachers').select('*').eq('openid', openid)
        let teacher = teacherRes.data && teacherRes.data[0]
        if (!teacher) {
          const insertRes = await rdb.from('teachers').insert({
            openid,
            name: event.name || '老师',
            school: event.school || ''
          }).select()
          teacher = insertRes.data && insertRes.data[0]
        }

        // 查询任教班级（排除已软删除）
        const ctRes = await rdb.from('class_teachers')
          .select('class_id, subject_id, is_headmaster')
          .eq('teacher_openid', openid)
          .is('deleted_at', null)
        const classTeachers = ctRes.data || []

        let classList = []
        if (classTeachers.length > 0) {
          const classIds = classTeachers.map(item => item.class_id)
          const classesRes = await rdb.from('classes')
            .select('*')
            .in('id', classIds)
            .is('deleted_at', null)
          const classes = classesRes.data || []

          const subjectIds = classTeachers.map(item => item.subject_id).filter(Boolean)
          let subjects = []
          if (subjectIds.length > 0) {
            const subRes = await rdb.from('subjects').select('*').in('id', subjectIds)
            subjects = subRes.data || []
          }

          classList = classTeachers.map(ct => {
            const cls = classes.find(c => c.id === ct.class_id) || {}
            const sub = subjects.find(s => s.id === ct.subject_id) || {}
            return {
              class_id: ct.class_id,
              name: cls.name || '未知班级',
              grade: cls.grade || '',
              invite_code: cls.invite_code || '',
              is_headmaster: ct.is_headmaster || false,
              subject_id: ct.subject_id,
              subject_name: sub.name || '未设科目',
              subject_color: sub.color || '#3b82f6',
              subject_short: sub.short_name || '科'
            }
          })
        }

        // 获取全量科目列表供选择
        const allSubjectsRes = await rdb.from('subjects').select('*').order('sort_order', { ascending: true })

        return {
          code: 0,
          data: {
            openid,
            teacher,
            classList,
            allSubjects: allSubjectsRes.data || []
          }
        }
      }

      // 2. 创建新班级并设为班主任
      case 'createClass': {
        const { name, grade, subject_id } = event
        const trimmedName = (name || '').trim()
        if (!trimmedName) return { code: 400, message: '班级名称不能为空' }

        // 校验当前教师名下是否已有同名活跃班级（排除已软删除）
        const ctListRes = await rdb.from('class_teachers')
          .select('class_id')
          .eq('teacher_openid', openid)
          .is('deleted_at', null)
        const myClassIds = (ctListRes.data || []).map(i => i.class_id)
        if (myClassIds.length > 0) {
          const duplicateClsRes = await rdb.from('classes')
            .select('id, name')
            .in('id', myClassIds)
            .eq('name', trimmedName)
            .is('deleted_at', null)
          if (duplicateClsRes.data && duplicateClsRes.data.length > 0) {
            return { code: 400, message: `您名下已存在同名班级「${trimmedName}」，请勿重复创建` }
          }
        }

        // 确保教师在 teachers 表已登记
        const tRes = await rdb.from('teachers').select('*').eq('openid', openid)
        if (!tRes.data || tRes.data.length === 0) {
          await rdb.from('teachers').insert({
            openid,
            name: event.name || '老师',
            school: ''
          })
        }

        const invite_code = generateInviteCode()
        const classInsert = await rdb.from('classes').insert({
          name: trimmedName,
          grade: grade || '',
          invite_code,
          created_by: openid
        }).select()

        const newClass = classInsert.data && classInsert.data[0]
        if (!newClass) {
          throw new Error(`班级创建失败: ${classInsert.error?.message || '未返回数据'}`)
        }

        // 插入任教关联表（班主任）
        await rdb.from('class_teachers').insert({
          class_id: newClass.id,
          teacher_openid: openid,
          subject_id: subject_id ? Number(subject_id) : null,
          is_headmaster: true
        })

        return {
          code: 0,
          data: {
            class_id: newClass.id,
            name: newClass.name,
            grade: newClass.grade,
            invite_code: newClass.invite_code,
            is_headmaster: true
          }
        }
      }

      // 3. 通过邀请码加入已有班级
      case 'joinClassByCode': {
        const { invite_code, subject_id } = event
        if (!invite_code) return { code: 400, message: '请输入6位邀请码' }

        // 确保教师在 teachers 表已登记
        const tRes = await rdb.from('teachers').select('*').eq('openid', openid)
        if (!tRes.data || tRes.data.length === 0) {
          await rdb.from('teachers').insert({
            openid,
            name: event.name || '老师',
            school: ''
          })
        }

        const clsRes = await rdb.from('classes')
          .select('*')
          .eq('invite_code', invite_code.toUpperCase().trim())
          .is('deleted_at', null)
        const targetClass = clsRes.data && clsRes.data[0]
        if (!targetClass) return { code: 404, message: '未找到该邀请码对应的有效班级' }

        // 检查是否已在班中（且未被软删除）
        const existRes = await rdb.from('class_teachers')
          .select('*')
          .eq('class_id', targetClass.id)
          .eq('teacher_openid', openid)
          .is('deleted_at', null)

        if (existRes.data && existRes.data.length > 0) {
          return { code: 0, data: targetClass, message: '您已加入该班级' }
        }

        await rdb.from('class_teachers').insert({
          class_id: targetClass.id,
          teacher_openid: openid,
          subject_id: subject_id ? Number(subject_id) : null,
          is_headmaster: false
        })

        return {
          code: 0,
          data: targetClass,
          message: '加入班级成功'
        }
      }

      // 4. 一键载入体验演示班（包含8名预置学生与组长）
      case 'seedDemoClass': {
        // 确保教师在 teachers 表已登记
        const tRes = await rdb.from('teachers').select('*').eq('openid', openid)
        if (!tRes.data || tRes.data.length === 0) {
          await rdb.from('teachers').insert({
            openid,
            name: event.name || '老师',
            school: ''
          })
        }

        const invite_code = generateInviteCode()
        const clsRes = await rdb.from('classes').insert({
          name: '三年级2班(体验班)',
          grade: '三年级',
          invite_code,
          created_by: openid
        }).select()

        if (clsRes.error) {
          console.error('clsRes.error:', clsRes.error)
          throw new Error(`创建班级失败: ${clsRes.error.message || JSON.stringify(clsRes.error)}`)
        }

        const demoClass = clsRes.data && clsRes.data[0]
        if (!demoClass) return { code: 500, message: '演示班创建失败: 数据未返回' }

        // 绑定语文+班主任
        const ctRes = await rdb.from('class_teachers').insert({
          class_id: demoClass.id,
          teacher_openid: openid,
          subject_id: 1, // 语文
          is_headmaster: true
        })
        if (ctRes.error) {
          console.error('ctRes.error:', ctRes.error)
          throw new Error(`绑定班主任失败: ${ctRes.error.message || JSON.stringify(ctRes.error)}`)
        }

        // 插入8名演示学生（两组，分别含组长）
        const demoStudents = [
          { class_id: demoClass.id, name: '李小明', student_no: '01', group_name: '先锋组', is_leader: true, gender: '男' },
          { class_id: demoClass.id, name: '王小红', student_no: '02', group_name: '先锋组', is_leader: false, gender: '女' },
          { class_id: demoClass.id, name: '张子豪', student_no: '03', group_name: '先锋组', is_leader: false, gender: '男' },
          { class_id: demoClass.id, name: '刘思雨', student_no: '04', group_name: '先锋组', is_leader: false, gender: '女' },
          { class_id: demoClass.id, name: '陈晨', student_no: '05', group_name: '朝阳组', is_leader: true, gender: '男' },
          { class_id: demoClass.id, name: '赵静', student_no: '06', group_name: '朝阳组', is_leader: false, gender: '女' },
          { class_id: demoClass.id, name: '孙浩', student_no: '07', group_name: '朝阳组', is_leader: false, gender: '男' },
          { class_id: demoClass.id, name: '周佳怡', student_no: '08', group_name: '朝阳组', is_leader: false, gender: '女' },
        ]

        const stuRes = await rdb.from('students').insert(demoStudents)
        if (stuRes.error) {
          console.error('stuRes.error:', stuRes.error)
          throw new Error(`插入演示学生失败: ${stuRes.error.message || JSON.stringify(stuRes.error)}`)
        }

        return {
          code: 0,
          data: {
            class_id: demoClass.id,
            name: demoClass.name,
            invite_code: demoClass.invite_code
          }
        }
      }

      // 5. 获取班级全部学生名单（排除已软删除）
      case 'getClassStudents': {
        const { class_id } = event
        if (!class_id) return { code: 400, message: '请指定班级 ID' }

        const stuRes = await rdb.from('students')
          .select('*')
          .eq('class_id', Number(class_id))
          .is('deleted_at', null)
          .order('group_name', { ascending: true })
          .order('student_no', { ascending: true })
          .order('id', { ascending: true })

        return {
          code: 0,
          data: stuRes.data || []
        }
      }

      // 6. 极简批量导入学生
      case 'batchImportStudents': {
        const { class_id, students } = event
        if (!class_id || !Array.isArray(students) || students.length === 0) {
          return { code: 400, message: '导入学生数据为空' }
        }

        const insertPayload = students.map((s, idx) => ({
          class_id: Number(class_id),
          name: s.name.trim(),
          student_no: s.student_no ? String(s.student_no) : String(idx + 1).padStart(2, '0'),
          group_name: s.group_name ? s.group_name.trim() : '未分组',
          is_leader: !!s.is_leader,
          gender: s.gender || '男'
        }))

        const insertRes = await rdb.from('students').insert(insertPayload).select()

        return {
          code: 0,
          data: insertRes.data || [],
          count: insertPayload.length,
          message: `成功导入 ${insertPayload.length} 名学生`
        }
      }

      // 7. 单个添加学生
      case 'addStudent': {
        const { class_id, name, student_no, group_name, is_leader, gender } = event
        if (!class_id || !name) return { code: 400, message: '姓名不能为空' }

        const addRes = await rdb.from('students').insert({
          class_id: Number(class_id),
          name: name.trim(),
          student_no: student_no || '',
          group_name: group_name || '未分组',
          is_leader: !!is_leader,
          gender: gender || '男'
        }).select()

        return {
          code: 0,
          data: addRes.data && addRes.data[0]
        }
      }

      // 8. 更新单个学生（姓名、学号、所属小组、是否组长、性别）
      case 'updateStudent': {
        const { student_id, name, student_no, group_name, is_leader, gender } = event
        if (!student_id) return { code: 400, message: '请指定学生 ID' }

        const updatePayload = {}
        if (name !== undefined) updatePayload.name = name.trim()
        if (student_no !== undefined) updatePayload.student_no = String(student_no).trim()
        if (group_name !== undefined) updatePayload.group_name = group_name.trim()
        if (is_leader !== undefined) updatePayload.is_leader = !!is_leader
        if (gender !== undefined) updatePayload.gender = gender

        const upRes = await rdb.from('students')
          .update(updatePayload)
          .eq('id', Number(student_id))
          .select()

        if (upRes.error) {
          console.error('更新学生失败:', upRes.error)
          throw new Error(`更新学生失败: ${upRes.error.message || JSON.stringify(upRes.error)}`)
        }

        return {
          code: 0,
          data: upRes.data && upRes.data[0],
          message: '学生信息更新成功'
        }
      }

      // 9. 软删除单个学生（从班级花名册移出）
      case 'deleteStudent': {
        const { student_id } = event
        if (!student_id) return { code: 400, message: '请指定学生 ID' }

        const now = new Date().toISOString()
        const delRes = await rdb.from('students')
          .update({ deleted_at: now })
          .eq('id', Number(student_id))

        if (delRes.error) {
          console.error('删除学生失败:', delRes.error)
          throw new Error(`删除学生失败: ${delRes.error.message || JSON.stringify(delRes.error)}`)
        }

        return {
          code: 0,
          data: { student_id: Number(student_id) },
          message: '学生已成功移出班级'
        }
      }

      // 8. 删除班级（级联软删除名下学生、任教关系及班级）
      case 'deleteClass': {
        const { class_id } = event
        if (!class_id) return { code: 400, message: '请指定要删除的班级 ID' }

        const targetClassId = Number(class_id)
        const now = new Date().toISOString()

        // 1) 级联软删除该班级名下所有学生
        const delStuRes = await rdb.from('students')
          .update({ deleted_at: now })
          .eq('class_id', targetClassId)
          .is('deleted_at', null)
        if (delStuRes.error) {
          console.error('软删除学生失败:', delStuRes.error)
          throw new Error(`软删除学生失败: ${delStuRes.error.message || JSON.stringify(delStuRes.error)}`)
        }

        // 2) 软删除任教关联记录
        const delCtRes = await rdb.from('class_teachers')
          .update({ deleted_at: now })
          .eq('class_id', targetClassId)
          .is('deleted_at', null)
        if (delCtRes.error) {
          console.error('软删除任教关系失败:', delCtRes.error)
          throw new Error(`软删除任教关系失败: ${delCtRes.error.message || JSON.stringify(delCtRes.error)}`)
        }

        // 3) 软删除班级本身
        const delClsRes = await rdb.from('classes')
          .update({ deleted_at: now })
          .eq('id', targetClassId)
          .is('deleted_at', null)
        if (delClsRes.error) {
          console.error('软删除班级失败:', delClsRes.error)
          throw new Error(`软删除班级失败: ${delClsRes.error.message || JSON.stringify(delClsRes.error)}`)
        }

        return {
          code: 0,
          data: { class_id: targetClassId },
          message: '班级及名下学生已安全软删除'
        }
      }

      // 9. 更新教师个人资料（如微信头像、姓名）
      case 'updateProfile': {
        const { avatar_url, name } = event
        const updatePayload = {}
        if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url
        if (name !== undefined) updatePayload.name = name.trim()

        if (Object.keys(updatePayload).length === 0) {
          return { code: 400, message: '无有效更新内容' }
        }

        // 确保教师已登记，未登记则自动插入
        const tCheck = await rdb.from('teachers').select('id').eq('openid', openid)
        if (!tCheck.data || tCheck.data.length === 0) {
          await rdb.from('teachers').insert({
            openid,
            name: name ? name.trim() : '老师',
            avatar_url: avatar_url || null
          })
        } else {
          const upRes = await rdb.from('teachers')
            .update(updatePayload)
            .eq('openid', openid)

          if (upRes.error) {
            console.error('更新教师资料失败:', upRes.error)
            throw new Error(`更新教师资料失败: ${upRes.error.message || JSON.stringify(upRes.error)}`)
          }
        }

        return {
          code: 0,
          data: { openid, ...updatePayload },
          message: '教师资料已更新'
        }
      }

      default:
        return { code: 404, message: `未知 Action: ${action}` }
    }
  } catch (err) {
    console.error('云函数执行异常:', err)
    return {
      code: 500,
      message: err.message || '云端执行错误',
      error: String(err)
    }
  }
}
