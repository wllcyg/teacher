const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

// 格式化输出，防御 null 值，防止前端组件属性类型报错
function sanitizeTeacher(t) {
  if (!t) return null;
  return {
    id: t.id || '',
    openid: t.openid || '',
    name: t.name || '',
    avatar_url: t.avatar_url || '',
    subject: t.subject || '',
    school: t.school || '',
    phone: t.phone || '',
    created_at: t.created_at || Date.now(),
    updated_at: t.updated_at || Date.now()
  };
}

function sanitizeClass(c) {
  if (!c) return null;
  return {
    id: c.id || '',
    openid: c.openid || '',
    name: c.name || '',
    grade: c.grade || '',
    academic_year: c.academic_year || '',
    headmaster_name: c.headmaster_name || '',
    subject: c.subject || '',
    student_count: Number(c.student_count || 0),
    is_default: !!c.is_default,
    created_at: c.created_at || Date.now(),
    updated_at: c.updated_at || Date.now()
  };
}

function sanitizeStudent(s) {
  if (!s) return null;
  return {
    id: s.id || '',
    class_id: s.class_id || '',
    name: s.name || '',
    group_name: s.group_name || '', // 学习小组如 '一组'
    student_no: s.student_no || '',
    gender: s.gender || '',
    parent_name: s.parent_name || '',
    parent_phone: s.parent_phone || '',
    address: s.address || '',
    status: s.status || 'active',
    avatar_url: s.avatar_url || '',
    duty: s.duty || '', // '班长' | '组长' | ''
    remarks: s.remarks || '',
    created_at: s.created_at || Date.now(),
    updated_at: s.updated_at || Date.now()
  };
}

function sanitizePeriod(p) {
  if (!p) return null;
  const start = p.start_time || p.start || '08:00';
  const end = p.end_time || p.end || '08:40';
  const n = Number(p.n || 0);
  return {
    id: p.id || '',
    n,
    label: p.label || `第 ${n} 节`,
    start,
    end,
    time: `${start}-${end}`,
    duration: Number(p.duration || 40),
    sort_order: Number(p.sort_order || n),
    circle_id: p.circle_id || null,
    class_id: p.class_id || null
  };
}

function sanitizeScheduleItem(item) {
  if (!item) return null;
  return {
    id: item.id || '',
    weekday: item.weekday || '周一',
    period_n: Number(item.period_n || 1),
    class_id: item.class_id || '',
    class_name: item.class_name || '',
    subject: item.subject || '',
    classroom: item.classroom || '',
    created_at: Number(item.created_at || Date.now()),
    updated_at: Number(item.updated_at || Date.now())
  };
}

const DEFAULT_PERIODS_SEED = [
  { n: 1, label: '第 1 节', start_time: '08:00', end_time: '08:45', duration: 45 },
  { n: 2, label: '第 2 节', start_time: '09:00', end_time: '09:45', duration: 45 },
  { n: 3, label: '第 3 节', start_time: '10:15', end_time: '11:00', duration: 45 },
  { n: 4, label: '第 4 节', start_time: '11:15', end_time: '12:00', duration: 45 },
  { n: 5, label: '第 5 节', start_time: '14:00', end_time: '14:45', duration: 45 },
  { n: 6, label: '第 6 节', start_time: '15:00', end_time: '15:45', duration: 45 },
  { n: 7, label: '第 7 节', start_time: '16:15', end_time: '17:00', duration: 45 },
  { n: 8, label: '第 8 节', start_time: '17:15', end_time: '18:00', duration: 45 },
  { n: 9, label: '第 9 节', start_time: '18:50', end_time: '19:30', duration: 40 },
  { n: 10, label: '第 10 节', start_time: '19:40', end_time: '20:25', duration: 45 },
  { n: 11, label: '第 11 节', start_time: '20:35', end_time: '21:20', duration: 45 }
];

// 刷新班级学生总人数
async function syncClassStudentCount(rdb, classesTable, studentsTable, classId) {
  try {
    const countRes = await rdb.from(studentsTable).select('id').eq('class_id', classId);
    const count = (countRes.data || []).length;
    await rdb.from(classesTable).update({
      student_count: count,
      updated_at: Date.now()
    }).eq('id', classId);
    return count;
  } catch (err) {
    console.error('更新班级学生总人数失败:', err);
    return 0;
  }
}

// 归一化组名为 "一组"、"二组" 等标准格式
function normalizeGroupName(grp) {
  if (!grp) return '';
  let str = grp.replace(/[第组]/g, '').trim();
  const digitMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九', '10': '十' };
  if (digitMap[str]) str = digitMap[str];
  return `${str}组`;
}

// 深度启发式正则解析降级函数
function fallbackHeuristicParse(text) {
  if (!text) return [];
  const lines = text.split(/[\r\n]+/);
  const result = [];
  let currentGroup = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const groupHeaderMatch = line.match(/^[\(（\[【]?\s*(第?[一二三四五六七八九十0-9]+组)\s*[\)）\]】]?[:：]?\s*$/);
    if (groupHeaderMatch) {
      currentGroup = normalizeGroupName(groupHeaderMatch[1]);
      continue;
    }

    const inlineGroupMatch = line.match(/^[\(（\[【]?\s*(第?[一二三四五六七八九十0-9]+组)\s*[\)）\]】]?[:：]\s*(.+)$/);
    let lineContent = line;
    let lineGroup = currentGroup;
    if (inlineGroupMatch) {
      lineGroup = normalizeGroupName(inlineGroupMatch[1]);
      lineContent = inlineGroupMatch[2];
    }

    const tokens = lineContent.split(/[,，;；、\t\s]+/);
    for (let token of tokens) {
      token = token.trim();
      if (!token) continue;
      token = token.replace(/^\d+[\.、\s]*/, '').trim();
      let name = token;
      let duty = '';
      let studentGroup = lineGroup;

      const tagGroupMatch = name.match(/[\(（\[【\-:_]?\s*(第?[一二三四五六七八九十0-9]+组)\s*[\)）\]】]?/);
      if (tagGroupMatch) {
        studentGroup = normalizeGroupName(tagGroupMatch[1]);
        name = name.replace(tagGroupMatch[0], '').trim();
      }

      if (/[\(（\[【\-:_]?\s*(班长)\s*[\)）\]】]?/.test(name)) {
        duty = '班长';
        name = name.replace(/[\(（\[【\-:_]?\s*班长\s*[\)）\]】]?/g, '').trim();
      } else if (/[\(（\[【\-:_]?\s*(组长)\s*[\)）\]】]?/.test(name)) {
        duty = '组长';
        name = name.replace(/[\(（\[【\-:_]?\s*组长\s*[\)）\]】]?/g, '').trim();
      }

      name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9·]/g, '').trim();
      if (name && name.length >= 2 && name.length <= 10) {
        result.push({
          name,
          group_name: studentGroup,
          duty
        });
      }
    }
  }

  return result;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || event.mockOpenid || 'test_teacher_openid';
  const action = event.action;
  const env = event._env === 'prd' ? 'prd' : 'dev';
  const teachersTable = `${env}_teachers`;
  const classesTable = `${env}_classes`;
  const studentsTable = `${env}_students`;
  const periodsTable = `${env}_periods`;
  const schedulesTable = `${env}_schedules`;

  const rdb = app.rdb({
    database: 'public'
  });

  try {
    switch (action) {
      // 1. 获取教师档案
      case 'getProfile': {
        let teacherRes = await rdb.from(teachersTable).select('*').eq('openid', openid);
        let teacher = teacherRes.data && teacherRes.data[0];

        // 如果未登记，则自动初始化一条默认教师记录
        if (!teacher) {
          const insertRes = await rdb.from(teachersTable).insert({
            openid,
            name: (event.name || '').trim(),
            avatar_url: '',
            subject: '语文',
            school: '',
            created_at: Date.now(),
            updated_at: Date.now()
          }).select();
          teacher = insertRes.data && insertRes.data[0];
        }

        // 顺带查询该老师当前已创建班级数量
        const classCountRes = await rdb.from(classesTable).select('id').eq('openid', openid);
        const classCount = (classCountRes.data || []).length;

        return {
          code: 0,
          data: {
            openid,
            teacher: sanitizeTeacher(teacher),
            classCount,
            env
          }
        };
      }

      // 2. 更新教师个人资料
      case 'updateProfile': {
        const { avatar_url, name, subject, school } = event;
        const now = Date.now();
        const updatePayload = {
          updated_at: now
        };
        if (avatar_url !== undefined) updatePayload.avatar_url = (avatar_url || '').trim();
        if (name !== undefined) updatePayload.name = (name || '').trim();
        if (subject !== undefined) updatePayload.subject = (subject || '').trim();
        if (school !== undefined) updatePayload.school = (school || '').trim();

        const tCheck = await rdb.from(teachersTable).select('id').eq('openid', openid);
        if (!tCheck.data || tCheck.data.length === 0) {
          const insertRes = await rdb.from(teachersTable).insert({
            openid,
            name: (name || '').trim(),
            avatar_url: (avatar_url || '').trim(),
            subject: (subject || '语文').trim(),
            school: (school || '').trim(),
            created_at: now,
            updated_at: now
          }).select();
          const newTeacher = insertRes.data && insertRes.data[0];
          return {
            code: 0,
            data: sanitizeTeacher(newTeacher),
            message: '教师资料已创建'
          };
        } else {
          const upRes = await rdb.from(teachersTable)
            .update(updatePayload)
            .eq('openid', openid)
            .select();

          if (upRes.error) {
            console.error('更新教师资料失败:', upRes.error);
            throw new Error(`更新教师资料失败: ${upRes.error.message || JSON.stringify(upRes.error)}`);
          }

          const updatedTeacher = upRes.data && upRes.data[0];
          return {
            code: 0,
            data: sanitizeTeacher(updatedTeacher),
            message: '教师资料已更新'
          };
        }
      }

      // 3. 获取我的班级列表
      case 'getMyClasses': {
        const clsRes = await rdb.from(classesTable)
          .select('*')
          .eq('openid', openid)
          .order('created_at', { ascending: false });

        const list = (clsRes.data || []).map(sanitizeClass);
        return {
          code: 0,
          data: {
            list,
            total: list.length
          }
        };
      }

      // 4. 创建新班级
      case 'createClass': {
        const { name, grade, academic_year, subject, headmaster_name } = event;
        const trimmedName = (name || '').trim();
        if (!trimmedName) {
          return { code: 400, message: '班级名称不能为空' };
        }
        if (!grade || !grade.trim()) {
          return { code: 400, message: '所属年级不能为空' };
        }

        // 查重：同老师名下是否已有同名班级
        const dupCheck = await rdb.from(classesTable)
          .select('id')
          .eq('openid', openid)
          .eq('name', trimmedName);
        if (dupCheck.data && dupCheck.data.length > 0) {
          return { code: 400, message: `您名下已存在同名班级「${trimmedName}」，请勿重复创建` };
        }

        // 如果是该老师的第一个班级，自动设为默认班级
        const existCountRes = await rdb.from(classesTable).select('id').eq('openid', openid);
        const isFirst = !existCountRes.data || existCountRes.data.length === 0;

        const now = Date.now();
        const insertRes = await rdb.from(classesTable).insert({
          openid,
          name: trimmedName,
          grade: grade.trim(),
          academic_year: (academic_year || '2024-2025').trim(),
          headmaster_name: (headmaster_name || '').trim(),
          subject: (subject || '').trim(),
          student_count: 0,
          is_default: isFirst,
          created_at: now,
          updated_at: now
        }).select();

        if (insertRes.error) {
          console.error('创建班级失败:', insertRes.error);
          throw new Error(`创建班级失败: ${insertRes.error.message || JSON.stringify(insertRes.error)}`);
        }

        const newClass = insertRes.data && insertRes.data[0];
        return {
          code: 0,
          data: sanitizeClass(newClass),
          message: '班级创建成功'
        };
      }

      // 5. 更新班级信息
      case 'updateClass': {
        const { class_id, name, grade, academic_year, subject } = event;
        if (!class_id) {
          return { code: 400, message: '缺少班级 ID' };
        }

        const updatePayload = {
          updated_at: Date.now()
        };
        if (name !== undefined) updatePayload.name = name.trim();
        if (grade !== undefined) updatePayload.grade = grade.trim();
        if (academic_year !== undefined) updatePayload.academic_year = academic_year.trim();
        if (subject !== undefined) updatePayload.subject = subject.trim();

        const upRes = await rdb.from(classesTable)
          .update(updatePayload)
          .eq('id', class_id)
          .eq('openid', openid)
          .select();

        if (upRes.error) {
          console.error('更新班级失败:', upRes.error);
          throw new Error(`更新班级失败: ${upRes.error.message || JSON.stringify(upRes.error)}`);
        }

        const updatedCls = upRes.data && upRes.data[0];
        return {
          code: 0,
          data: sanitizeClass(updatedCls),
          message: '班级信息已更新'
        };
      }

      // 6. 设为默认班级
      case 'setDefaultClass': {
        const { class_id } = event;
        if (!class_id) {
          return { code: 400, message: '缺少班级 ID' };
        }

        // 先将名下所有班级置为 false
        await rdb.from(classesTable)
          .update({ is_default: false })
          .eq('openid', openid);

        // 再将指定班级设为 true
        const res = await rdb.from(classesTable)
          .update({ is_default: true, updated_at: Date.now() })
          .eq('id', class_id)
          .eq('openid', openid)
          .select();

        return {
          code: 0,
          data: sanitizeClass(res.data && res.data[0]),
          message: '已设为默认班级'
        };
      }

      // 7. 解散/删除班级（级联删除名下学生）
      case 'deleteClass': {
        const { class_id } = event;
        if (!class_id) {
          return { code: 400, message: '缺少班级 ID' };
        }

        const delRes = await rdb.from(classesTable)
          .delete()
          .eq('id', class_id)
          .eq('openid', openid);

        if (delRes.error) {
          console.error('删除班级失败:', delRes.error);
          throw new Error(`删除班级失败: ${delRes.error.message || JSON.stringify(delRes.error)}`);
        }

        return {
          code: 0,
          data: { class_id },
          message: '班级已成功解散'
        };
      }

      // 8. 获取指定班级的学生列表
      case 'getStudentsByClass': {
        const { class_id } = event;
        if (!class_id) {
          return { code: 400, message: '缺少班级 ID' };
        }

        const stuRes = await rdb.from(studentsTable)
          .select('*')
          .eq('class_id', class_id)
          .order('student_no', { ascending: true })
          .order('created_at', { ascending: true });

        const list = (stuRes.data || []).map(sanitizeStudent);
        return {
          code: 0,
          data: {
            list,
            total: list.length
          }
        };
      }

      // 9. 单个创建学生
      case 'createStudent': {
        const { class_id, name, group_name, student_no, gender, duty, remarks } = event;
        if (!class_id) {
          return { code: 400, message: '缺少所属班级 ID' };
        }
        const trimmedName = (name || '').trim();
        if (!trimmedName) {
          return { code: 400, message: '学生姓名不能为空' };
        }

        const now = Date.now();
        const insertRes = await rdb.from(studentsTable).insert({
          class_id,
          name: trimmedName,
          group_name: (group_name || '').trim(),
          student_no: (student_no || '').trim(),
          gender: (gender || '').trim(),
          duty: (duty || '').trim(), // 班长 | 组长 | ''
          remarks: (remarks || '').trim(),
          status: 'active',
          avatar_url: '',
          created_at: now,
          updated_at: now
        }).select();

        if (insertRes.error) {
          console.error('创建学生记录失败:', insertRes.error);
          throw new Error(`创建学生失败: ${insertRes.error.message || JSON.stringify(insertRes.error)}`);
        }

        const newStudent = insertRes.data && insertRes.data[0];
        // 联动同步更新班级学生总人数
        await syncClassStudentCount(rdb, classesTable, studentsTable, class_id);

        return {
          code: 0,
          data: sanitizeStudent(newStudent),
          message: '学生添加成功'
        };
      }

      // 10. 智能批量录入学生名单
      case 'batchImportStudents': {
        const { class_id, students } = event;
        if (!class_id) {
          return { code: 400, message: '缺少所属班级 ID' };
        }
        if (!Array.isArray(students) || students.length === 0) {
          return { code: 400, message: '导入名单不能为空' };
        }

        const now = Date.now();
        const validRows = [];
        for (const item of students) {
          const sName = (typeof item === 'string' ? item : item.name || '').trim();
          if (sName) {
            validRows.push({
              class_id,
              name: sName,
              group_name: (item.group_name || '').trim(),
              student_no: (item.student_no || '').trim(),
              gender: (item.gender || '').trim(),
              duty: (item.duty || '').trim(),
              remarks: (item.remarks || '').trim(),
              status: 'active',
              avatar_url: '',
              created_at: now,
              updated_at: now
            });
          }
        }

        if (validRows.length === 0) {
          return { code: 400, message: '没有解析到有效的学生姓名' };
        }

        const batchRes = await rdb.from(studentsTable).insert(validRows).select();
        if (batchRes.error) {
          console.error('批量录入学生失败:', batchRes.error);
          throw new Error(`批量录入学生失败: ${batchRes.error.message || JSON.stringify(batchRes.error)}`);
        }

        // 联动同步更新班级学生总人数
        const total = await syncClassStudentCount(rdb, classesTable, studentsTable, class_id);

        return {
          code: 0,
          data: {
            imported_count: validRows.length,
            total_students: total
          },
          message: `成功录入 ${validRows.length} 位学生`
        };
      }

      // 11. 更新学生档案
      case 'updateStudent': {
        const { student_id, name, group_name, student_no, gender, duty, remarks } = event;
        if (!student_id) {
          return { code: 400, message: '缺少学生 ID' };
        }

        const updatePayload = {
          updated_at: Date.now()
        };
        if (name !== undefined) updatePayload.name = name.trim();
        if (group_name !== undefined) updatePayload.group_name = group_name.trim();
        if (student_no !== undefined) updatePayload.student_no = student_no.trim();
        if (gender !== undefined) updatePayload.gender = gender.trim();
        if (duty !== undefined) updatePayload.duty = duty.trim();
        if (remarks !== undefined) updatePayload.remarks = remarks.trim();

        const upRes = await rdb.from(studentsTable)
          .update(updatePayload)
          .eq('id', student_id)
          .select();

        if (upRes.error) {
          console.error('更新学生档案失败:', upRes.error);
          throw new Error(`更新学生档案失败: ${upRes.error.message || JSON.stringify(upRes.error)}`);
        }

        return {
          code: 0,
          data: sanitizeStudent(upRes.data && upRes.data[0]),
          message: '学生档案更新成功'
        };
      }

      // 12. AI 智能名单解析
      case 'aiParseRoster': {
        const rawText = (event.text || '').trim();
        if (!rawText) {
          return { code: 400, message: '输入文本不能为空' };
        }

        const configsTable = `${env}_app_configs`;
        let aiConfig = {
          baseUrl: 'https://teacher-d4g74wc9be2d5b1f5.api.tcloudbasegateway.com/v1/ai/cloudbase',
          apiKey: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViZjk5YWQ5LTdlYzQtNDc0MS05ZmY2LWIxZTljM2Y2Zjg5NSJ9.eyJhdWQiOiJ0ZWFjaGVy-d0c3RzR3YzlCYWUyZDViMWY1IiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4OTM1NzIwNSwiYXRfaGFzaCI6IjZHMldlcHNUUUJ5SGNLQ1RXT25oSkEiLCJwcm9qZWN0X2lkIjoidGVhY2hlci1kNGc3NHdjOWJlMmQ1YjFmNSIsIm1ldGEiOnsicGxhdGZvcm0iOiJBcGlLZXkifSwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImFwaWtleSIsInByb3ZpZGVycyI6WyJhcGlrZXkiXX0sImFkbWluaXN0cmF0b3JfaWQiOiIyMDk4MjM4MDI4MTE0ODI1MjE2IiwidXNlcl90eXBlIjoiIiwiY2xpZW50X3R5cGUiOiJjbGllbnRfc2VydmVyIiwiaXNfc3lzdGVtX2FkbWluIjp0cnVlfQ.cPu-dnR-t8BFqs4vNmstDLARXYYY3I0eH3eP8sOw_L-bc6LWEq_ntBldwN9hYso20-xzRzFEKXs94VytfXW5HdjVoCreWjTIgZJh0qWbBfphQxRgVkv-MkCBiAU9mzfeBt_T27DiKAQSgV8vYCqfqliWtPof9CF-Vtxgg_PpeuGnFtcr_4jwrKBQvL24E3YJoYBy54dDTUmKD9iRneUWVaZ81WTpLCskK7JGTf7tjNAYbTKfC2ReMzO_ZUyyvhd4Lhm3bJlQvHyDISl15ZYhi4TLST8sxtWO3w37zZsxEvb0cIpsHhILLu81L6IhLciRMWq-svomzpGC6bSUN8xz7Q',
          model: 'hy3'
        };

        try {
          const cfgRes = await rdb.from(configsTable).select('value').eq('key', 'AI_ROSTER_CONFIG').maybeSingle();
          if (cfgRes && cfgRes.data && cfgRes.data.value) {
            aiConfig = Object.assign(aiConfig, cfgRes.data.value);
          }
        } catch (e) {
          console.warn('读取 AI 配置异常:', e);
        }

        let parsedList = [];
        let parseSource = 'ai';

        try {
          const requestUrl = aiConfig.baseUrl.endsWith('/chat/completions')
            ? aiConfig.baseUrl
            : `${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;

          const payload = {
            model: aiConfig.model || 'hunyuan-lite',
            messages: [
              {
                role: 'system',
                content: '你是一个专业的班级学生名单结构化提取助手。请从用户输入的自然语言文本中提取学生姓名、所在小组和职务。\n\n【提取规则】\n1. 仅提取真实学生姓名，过滤无关词汇与标点；\n2. 职务(duty)仅限识别两类：\"班长\" 或 \"组长\"，普通学生为空字符串 \"\"；\n3. 小组(group_name)若识别到\"一组\"、\"第一组\"、\"1组\"，统一规范为\"一组\"；\"二组\"、\"第2组\"规范为\"二组\"，未提及组别为空字符串 \"\"；\n4. 严格输出标准 JSON 数组，严禁包含任何 Markdown 标记或多余文字。\n\n【示例格式】\n[{\"name\":\"张三\",\"group_name\":\"一组\",\"duty\":\"组长\"},{\"name\":\"李四\",\"group_name\":\"一组\",\"duty\":\"\"}]'
              },
              {
                role: 'user',
                content: rawText
              }
            ],
            temperature: 0.1
          };

          const aiResp = await fetch(requestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify(payload)
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const replyContent = aiData.choices?.[0]?.message?.content || '';
            const cleanedJson = replyContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
            const rawArr = JSON.parse(cleanedJson);
            if (Array.isArray(rawArr)) {
              parsedList = rawArr
                .filter(item => item && item.name && typeof item.name === 'string' && item.name.trim().length >= 2)
                .map(item => ({
                  name: item.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9·]/g, '').trim(),
                  group_name: (item.group_name || '').trim(),
                  duty: item.duty === '班长' ? '班长' : (item.duty === '组长' ? '组长' : '')
                }));
            }
          } else {
            console.warn('AI 接口调用非 200:', aiResp.status);
          }
        } catch (aiErr) {
          console.error('AI 解析调用异常，降级启发式解析:', aiErr);
        }

        // 降级启发式解析
        if (parsedList.length === 0) {
          parseSource = 'heuristic';
          parsedList = fallbackHeuristicParse(rawText);
        }

        return {
          code: 0,
          data: {
            list: parsedList,
            total: parsedList.length,
            source: parseSource
          },
          message: parsedList.length > 0 ? `成功识别 ${parsedList.length} 位学生` : '未识别到有效名单'
        };
      }

      // 13. 移出/删除学生
      case 'deleteStudent': {
        const { student_id, class_id } = event;
        if (!student_id) {
          return { code: 400, message: '缺少学生 ID' };
        }

        const delRes = await rdb.from(studentsTable)
          .delete()
          .eq('id', student_id);

        if (delRes.error) {
          console.error('移出学生失败:', delRes.error);
          throw new Error(`移出学生失败: ${delRes.error.message || JSON.stringify(delRes.error)}`);
        }

        if (class_id) {
          await syncClassStudentCount(rdb, classesTable, studentsTable, class_id);
        }

        return {
          code: 0,
          data: { student_id },
          message: '学生已移出名册'
        };
      }

      // 13. 获取作息时间表（空时自动播种默认11节课）
      case 'getMyPeriods': {
        const queryRes = await rdb.from(periodsTable)
          .select('*')
          .eq('owner_openid', openid)
          .order('sort_order', { ascending: true });

        if (queryRes.error) {
          console.error('查询作息表失败:', queryRes.error);
          throw new Error(`查询作息表失败: ${queryRes.error.message || JSON.stringify(queryRes.error)}`);
        }

        let list = queryRes.data || [];

        // 首次使用自动初始化 11 节课
        if (list.length === 0) {
          const nowTs = Date.now();
          const seedRows = DEFAULT_PERIODS_SEED.map((item, idx) => ({
            id: `period_${nowTs}_${idx}_${Math.random().toString(36).slice(-4)}`,
            owner_openid: openid,
            circle_id: null,
            class_id: null,
            n: item.n,
            label: item.label,
            start_time: item.start_time,
            end_time: item.end_time,
            duration: item.duration,
            sort_order: idx + 1,
            created_at: nowTs,
            updated_at: nowTs
          }));

          const insertRes = await rdb.from(periodsTable).insert(seedRows).select();
          if (insertRes.error) {
            console.error('初始化作息时间表失败:', insertRes.error);
            list = seedRows;
          } else {
            list = insertRes.data || seedRows;
          }
        }

        return {
          code: 0,
          data: list.map(sanitizePeriod),
          message: '获取作息时间表成功'
        };
      }

      // 14. 批量保存/更新作息时间表
      case 'saveMyPeriods': {
        const { periods } = event;
        if (!Array.isArray(periods)) {
          return { code: 400, message: '入参 periods 必须为数组' };
        }

        // 先清理该教师名下的旧记录
        const delRes = await rdb.from(periodsTable)
          .delete()
          .eq('owner_openid', openid);

        if (delRes.error) {
          console.error('清空旧作息失败:', delRes.error);
        }

        let savedList = [];
        if (periods.length > 0) {
          const nowTs = Date.now();
          const insertRows = periods.map((p, idx) => {
            const start = p.start_time || p.start || '08:00';
            const end = p.end_time || p.end || '08:40';
            const n = idx + 1;
            return {
              id: p.id || `period_${nowTs}_${idx}_${Math.random().toString(36).slice(-4)}`,
              owner_openid: openid,
              circle_id: p.circle_id || null,
              class_id: p.class_id || null,
              n,
              label: p.label || `第 ${n} 节`,
              start_time: start,
              end_time: end,
              duration: Number(p.duration || 40),
              sort_order: n,
              created_at: nowTs,
              updated_at: nowTs
            };
          });

          const insertRes = await rdb.from(periodsTable).insert(insertRows).select();
          if (insertRes.error) {
            console.error('保存新节次失败:', insertRes.error);
            throw new Error(`保存节次失败: ${insertRes.error.message || JSON.stringify(insertRes.error)}`);
          }
          savedList = insertRes.data || insertRows;
        }

        return {
          code: 0,
          data: savedList.map(sanitizePeriod),
          message: '作息时间已同步至云端'
        };
      }

      // 15. 恢复标准默认作息时间表
      case 'resetMyPeriods': {
        // 清理旧记录
        await rdb.from(periodsTable)
          .delete()
          .eq('owner_openid', openid);

        const nowTs = Date.now();
        const seedRows = DEFAULT_PERIODS_SEED.map((item, idx) => ({
          id: `period_${nowTs}_${idx}_${Math.random().toString(36).slice(-4)}`,
          owner_openid: openid,
          circle_id: null,
          class_id: null,
          n: item.n,
          label: item.label,
          start_time: item.start_time,
          end_time: item.end_time,
          duration: item.duration,
          sort_order: idx + 1,
          created_at: nowTs,
          updated_at: nowTs
        }));

        const insertRes = await rdb.from(periodsTable).insert(seedRows).select();
        const list = (insertRes.data && insertRes.data.length > 0) ? insertRes.data : seedRows;

        return {
          code: 0,
          data: list.map(sanitizePeriod),
          message: '已恢复官方标准作息时间'
        };
      }

      // 16. 获取教师任教课表
      case 'getMySchedule': {
        const queryRes = await rdb.from(schedulesTable)
          .select('*')
          .eq('owner_openid', openid)
          .order('period_n', { ascending: true });

        if (queryRes.error) {
          console.error('查询课表失败:', queryRes.error);
          throw new Error(`查询课表失败: ${queryRes.error.message || JSON.stringify(queryRes.error)}`);
        }

        const list = (queryRes.data || []).map(sanitizeScheduleItem);
        return {
          code: 0,
          data: list,
          message: '获取课表成功'
        };
      }

      // 17. 新增或更新单节排课（Upsert）
      case 'saveScheduleItem': {
        const { id, weekday, period_n, class_id, class_name, subject, classroom } = event;
        if (!weekday || !period_n || !class_name || !subject) {
          return { code: 400, message: '星期、节次、班级与科目为必填项' };
        }

        const numPeriod = Number(period_n);
        const nowTs = Date.now();

        // 检查该时段是否已有记录
        const existRes = await rdb.from(schedulesTable)
          .select('id')
          .eq('owner_openid', openid)
          .eq('weekday', weekday)
          .eq('period_n', numPeriod);

        const existing = existRes.data && existRes.data[0];

        let resultItem = null;
        if (existing) {
          // 更新已有记录
          const upRes = await rdb.from(schedulesTable)
            .update({
              class_id: class_id || '',
              class_name: class_name.trim(),
              subject: subject.trim(),
              classroom: (classroom || '').trim(),
              updated_at: nowTs
            })
            .eq('id', existing.id)
            .select();

          if (upRes.error) {
            throw new Error(`更新排课失败: ${upRes.error.message || JSON.stringify(upRes.error)}`);
          }
          resultItem = upRes.data && upRes.data[0];
        } else {
          // 插入新记录
          const newId = id || `sch_${nowTs}_${Math.random().toString(36).slice(-6)}`;
          const inRes = await rdb.from(schedulesTable)
            .insert({
              id: newId,
              owner_openid: openid,
              weekday,
              period_n: numPeriod,
              class_id: class_id || '',
              class_name: class_name.trim(),
              subject: subject.trim(),
              classroom: (classroom || '').trim(),
              created_at: nowTs,
              updated_at: nowTs
            })
            .select();

          if (inRes.error) {
            throw new Error(`插入排课失败: ${inRes.error.message || JSON.stringify(inRes.error)}`);
          }
          resultItem = inRes.data && inRes.data[0];
        }

        return {
          code: 0,
          data: sanitizeScheduleItem(resultItem),
          message: '课程已成功排入'
        };
      }

      // 18. 删除单节排课
      case 'deleteScheduleItem': {
        const { id, weekday, period_n } = event;
        let delQuery = rdb.from(schedulesTable).delete().eq('owner_openid', openid);
        if (id) {
          delQuery = delQuery.eq('id', id);
        } else if (weekday && period_n) {
          delQuery = delQuery.eq('weekday', weekday).eq('period_n', Number(period_n));
        } else {
          return { code: 400, message: '缺少待删除课程的标识' };
        }

        const delRes = await delQuery;
        if (delRes.error) {
          throw new Error(`删除排课失败: ${delRes.error.message || JSON.stringify(delRes.error)}`);
        }

        return {
          code: 0,
          data: { id, weekday, period_n },
          message: '课程已移除'
        };
      }

      // 19. 整天课表一键复制到其他星期（支持多选）
      case 'batchCopyDaySchedule': {
        const { source_weekday, target_weekdays } = event;
        if (!source_weekday || !Array.isArray(target_weekdays) || target_weekdays.length === 0) {
          return { code: 400, message: '请指定来源星期和目标星期列表' };
        }

        // 1. 查询来源星期的所有排课
        const srcRes = await rdb.from(schedulesTable)
          .select('*')
          .eq('owner_openid', openid)
          .eq('weekday', source_weekday);

        const srcList = srcRes.data || [];
        if (srcList.length === 0) {
          return { code: 400, message: `来源【${source_weekday}】暂无排课记录，无法复制` };
        }

        const nowTs = Date.now();

        // 2. 依次清空目标星期的旧排课，并批量克隆写入
        for (const targetDay of target_weekdays) {
          if (targetDay === source_weekday) continue;

          // 先清空该目标日
          await rdb.from(schedulesTable)
            .delete()
            .eq('owner_openid', openid)
            .eq('weekday', targetDay);

          // 批量插入克隆记录
          const cloneRows = srcList.map((item, idx) => ({
            id: `sch_${nowTs}_${targetDay}_${idx}_${Math.random().toString(36).slice(-4)}`,
            owner_openid: openid,
            weekday: targetDay,
            period_n: Number(item.period_n),
            class_id: item.class_id || '',
            class_name: item.class_name,
            subject: item.subject,
            classroom: item.classroom || '',
            created_at: nowTs,
            updated_at: nowTs
          }));

          await rdb.from(schedulesTable).insert(cloneRows);
        }

        // 返回更新后的完整课表
        const allRes = await rdb.from(schedulesTable)
          .select('*')
          .eq('owner_openid', openid)
          .order('period_n', { ascending: true });

        return {
          code: 0,
          data: (allRes.data || []).map(sanitizeScheduleItem),
          message: `已将【${source_weekday}】课表快速复制至指定星期`
        };
      }

      // 20. 清空整周课表
      case 'clearSchedule': {
        await rdb.from(schedulesTable)
          .delete()
          .eq('owner_openid', openid);

        return {
          code: 0,
          data: [],
          message: '课表已全部清空'
        };
      }

      default:
        return { code: 404, message: `未知 Action: ${action}` };
    }
  } catch (err) {
    console.error('云函数执行异常:', err);
    return {
      code: 500,
      message: err.message || '云端执行错误',
      error: String(err)
    };
  }
};
