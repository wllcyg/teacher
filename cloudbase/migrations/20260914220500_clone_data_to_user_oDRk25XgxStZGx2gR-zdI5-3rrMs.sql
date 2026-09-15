-- 迁移脚本：将源教师用户 (oDRk25fedN6QUmXjtJOMEzQ32Y7Y) 的开发环境数据全量克隆给新用户 (oDRk25XgxStZGx2gR-zdI5-3rrMs)
-- 涵盖范围：教师个人档案、班级列表、学生花名册（含外键班级ID与学习小组）、独立作息时间表、任教课表、课堂教学台账
-- 约束：仅在 dev_ 开发环境执行，绝不影响生产环境 prd_ 数据

BEGIN;

-- 1. 清理目标用户在开发环境可能存在的残留旧数据（级联清空，防唯一键/主键冲突）
DELETE FROM public.dev_students WHERE class_id IN (SELECT id FROM public.dev_classes WHERE openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs');
DELETE FROM public.dev_classes WHERE openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs';
DELETE FROM public.dev_periods WHERE owner_openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs';
DELETE FROM public.dev_schedules WHERE owner_openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs';
DELETE FROM public.dev_lesson_logs WHERE owner_openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs';
DELETE FROM public.dev_teachers WHERE openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs';

-- 2. 克隆教师个人资料 dev_teachers
INSERT INTO public.dev_teachers (id, openid, name, avatar_url, subject, school, phone, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'oDRk25XgxStZGx2gR-zdI5-3rrMs',
    COALESCE(name, '崔老师'),
    COALESCE(avatar_url, ''),
    COALESCE(subject, '地理'),
    COALESCE(school, ''),
    COALESCE(phone, ''),
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
FROM public.dev_teachers 
WHERE openid = 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y'
LIMIT 1;

-- 若源教师表中尚未建立档案，则保底插入一条崔老师基准档案
INSERT INTO public.dev_teachers (id, openid, name, subject, created_at, updated_at)
SELECT 
    gen_random_uuid(), 
    'oDRk25XgxStZGx2gR-zdI5-3rrMs', 
    '崔老师', 
    '地理', 
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint, 
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
WHERE NOT EXISTS (SELECT 1 FROM public.dev_teachers WHERE openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs');

-- 3. 克隆班级列表 dev_classes（生成新用户的独立班级 UUID）
INSERT INTO public.dev_classes (id, openid, name, grade, academic_year, headmaster_name, subject, student_count, assistant_teachers, is_default, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'oDRk25XgxStZGx2gR-zdI5-3rrMs',
    name,
    grade,
    academic_year,
    headmaster_name,
    subject,
    student_count,
    assistant_teachers,
    is_default,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
FROM public.dev_classes
WHERE openid = 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y';

-- 4. 克隆学生花名册 dev_students（将 class_id 智能映射并重连到新用户的对应新班级 ID）
INSERT INTO public.dev_students (
    id, class_id, name, group_name, student_no, gender, parent_name, parent_phone, address, status, avatar_url, duty, remarks, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    nc.id, -- 新用户的对应班级新UUID
    s.name,
    COALESCE(s.group_name, ''),
    COALESCE(s.student_no, ''),
    COALESCE(s.gender, ''),
    COALESCE(s.parent_name, ''),
    COALESCE(s.parent_phone, ''),
    COALESCE(s.address, ''),
    COALESCE(s.status, 'active'),
    COALESCE(s.avatar_url, ''),
    COALESCE(s.duty, ''),
    COALESCE(s.remarks, ''),
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
FROM public.dev_students s
JOIN public.dev_classes oc ON s.class_id = oc.id AND oc.openid = 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y'
JOIN public.dev_classes nc ON nc.name = oc.name AND nc.openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs';

-- 5. 克隆独立作息时间表 dev_periods
INSERT INTO public.dev_periods (
    id, owner_openid, circle_id, class_id, n, label, start_time, end_time, duration, sort_order, created_at, updated_at
)
SELECT 
    gen_random_uuid()::text,
    'oDRk25XgxStZGx2gR-zdI5-3rrMs',
    circle_id,
    class_id,
    n,
    label,
    start_time,
    end_time,
    duration,
    sort_order,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
FROM public.dev_periods
WHERE owner_openid = 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y';

-- 6. 克隆任教课表 dev_schedules（关联至新班级对应 ID）
INSERT INTO public.dev_schedules (
    id, owner_openid, weekday, period_n, class_id, class_name, subject, classroom, created_at, updated_at
)
SELECT 
    gen_random_uuid()::text,
    'oDRk25XgxStZGx2gR-zdI5-3rrMs',
    sch.weekday,
    sch.period_n,
    COALESCE(nc.id::text, sch.class_id),
    sch.class_name,
    sch.subject,
    COALESCE(sch.classroom, ''),
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
FROM public.dev_schedules sch
LEFT JOIN public.dev_classes nc ON nc.name = sch.class_name AND nc.openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs'
WHERE sch.owner_openid = 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y';

-- 7. 克隆课堂教学台账 dev_lesson_logs（关联至新班级对应 ID）
INSERT INTO public.dev_lesson_logs (
    id, owner_openid, date, class_id, class_name, period_n, period_str, subject, content, created_at, updated_at
)
SELECT 
    gen_random_uuid()::text,
    'oDRk25XgxStZGx2gR-zdI5-3rrMs',
    l.date,
    COALESCE(nc.id::text, l.class_id),
    l.class_name,
    l.period_n,
    l.period_str,
    l.subject,
    l.content,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
FROM public.dev_lesson_logs l
LEFT JOIN public.dev_classes nc ON nc.name = l.class_name AND nc.openid = 'oDRk25XgxStZGx2gR-zdI5-3rrMs'
WHERE l.owner_openid = 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y';

COMMIT;
