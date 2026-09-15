-- 迁移文件：创建课堂教学笔记数据表 (dev_lesson_logs 和 prd_lesson_logs)
-- 记录教师每一节课的授课进度、备课内容、背诵要求与作业

CREATE TABLE IF NOT EXISTS public.dev_lesson_logs (
    id VARCHAR(64) PRIMARY KEY,
    owner_openid TEXT NOT NULL,
    date VARCHAR(32) NOT NULL,
    class_id VARCHAR(64) DEFAULT '',
    class_name VARCHAR(64) NOT NULL,
    period_n INT NOT NULL,
    period_str VARCHAR(32) NOT NULL,
    subject VARCHAR(32) DEFAULT '',
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    CONSTRAINT uq_dev_lesson_logs_slot UNIQUE (owner_openid, date, class_name, period_n)
);

CREATE INDEX IF NOT EXISTS idx_dev_lesson_logs_owner_date ON public.dev_lesson_logs (owner_openid, date);
CREATE INDEX IF NOT EXISTS idx_dev_lesson_logs_class ON public.dev_lesson_logs (owner_openid, class_name);

CREATE TABLE IF NOT EXISTS public.prd_lesson_logs (
    id VARCHAR(64) PRIMARY KEY,
    owner_openid TEXT NOT NULL,
    date VARCHAR(32) NOT NULL,
    class_id VARCHAR(64) DEFAULT '',
    class_name VARCHAR(64) NOT NULL,
    period_n INT NOT NULL,
    period_str VARCHAR(32) NOT NULL,
    subject VARCHAR(32) DEFAULT '',
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    CONSTRAINT uq_prd_lesson_logs_slot UNIQUE (owner_openid, date, class_name, period_n)
);

CREATE INDEX IF NOT EXISTS idx_prd_lesson_logs_owner_date ON public.prd_lesson_logs (owner_openid, date);
CREATE INDEX IF NOT EXISTS idx_prd_lesson_logs_class ON public.prd_lesson_logs (owner_openid, class_name);

-- 禁用 RLS 并授予访问权限
ALTER TABLE public.dev_lesson_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_lesson_logs DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.dev_lesson_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.prd_lesson_logs TO anon, authenticated, service_role;

-- 灌入 18 条 Web 端历史课堂笔记到开发环境 (dev_lesson_logs)
INSERT INTO public.dev_lesson_logs (id, owner_openid, date, class_id, class_name, period_n, period_str, subject, content)
VALUES
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-07', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%9%' LIMIT 1), ''), '八9班', 7, '第7节', '地理', '本节讲6页上面活动3道题。过关内容：3～6页'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-07', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%4%' LIMIT 1), ''), '八4班', 8, '第8节', '地理', '本节背诵课本3～6页，背完的同学做地理助学指南'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-07', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%9%' LIMIT 1), ''), '八9班', 10, '第10节', '地理', '本节背诵课本3～6页，背完的同学做地理助学'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-07', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%10%' LIMIT 1), ''), '八10班', 11, '第11节', '地理', '讲课本6页活动3道题，过关：课本3～6页'),

  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-08', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%10%' LIMIT 1), ''), '八10班', 1, '第1节', '地理', '本节背课本3～6页，背完做地理助学'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-08', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%4%' LIMIT 1), ''), '八4班', 5, '第5节', '地理', '讲第一章第二节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-08', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%3%' LIMIT 1), ''), '八3班', 8, '第8节', '地理', '讲课内容：第一章第二节'),

  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-09', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%9%' LIMIT 1), ''), '八9班', 5, '第5节', '地理', '本节讲第一章第二节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-09', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%10%' LIMIT 1), ''), '八10班', 6, '第6节', '地理', '讲第一章第二节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-09', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%3%' LIMIT 1), ''), '八3班', 8, '第8节', '地理', '画中国地图，背第一章第二节'),

  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-10', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%4%' LIMIT 1), ''), '八4班', 5, '第5节', '地理', '背第一章第二节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-10', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%9%' LIMIT 1), ''), '八9班', 6, '第6节', '地理', '背第一章第二节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-10', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%3%' LIMIT 1), ''), '八3班', 9, '第9节', '地理', '背第一章第二节，做地理助学指南'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-10', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%3%' LIMIT 1), ''), '八3班', 10, '第10节', '地理', '讲第一章第三节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-10', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%4%' LIMIT 1), ''), '八4班', 11, '第11节', '地理', '背第一章第二节，做地理助学指南'),

  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-14', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%9%' LIMIT 1), ''), '八9班', 7, '第7节', '地理', '讲第一章第三节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-14', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%4%' LIMIT 1), ''), '八4班', 8, '第8节', '地理', '讲第一章第三节'),
  (gen_random_uuid()::text, 'oDRk25fedN6QUmXjtJOMEzQ32Y7Y', '2026-09-14', COALESCE((SELECT id::text FROM public.dev_classes WHERE openid='oDRk25fedN6QUmXjtJOMEzQ32Y7Y' AND name LIKE '%9%' LIMIT 1), ''), '八9班', 10, '第10节', '地理', '背第一章第二节，第三节')
ON CONFLICT (owner_openid, date, class_name, period_n) 
DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = (EXTRACT(epoch FROM NOW()) * 1000)::bigint;

