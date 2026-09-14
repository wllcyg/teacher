-- 迁移文件：创建教师个人任教课表 (dev_schedules 和 prd_schedules)

CREATE TABLE IF NOT EXISTS public.dev_schedules (
    id VARCHAR(64) PRIMARY KEY,
    owner_openid TEXT NOT NULL,
    weekday VARCHAR(16) NOT NULL,
    period_n INT NOT NULL,
    class_id VARCHAR(64) DEFAULT '',
    class_name VARCHAR(64) NOT NULL,
    subject VARCHAR(32) NOT NULL,
    classroom VARCHAR(64) DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    CONSTRAINT uq_dev_schedules_slot UNIQUE (owner_openid, weekday, period_n)
);

CREATE INDEX IF NOT EXISTS idx_dev_schedules_owner ON public.dev_schedules (owner_openid);
CREATE INDEX IF NOT EXISTS idx_dev_schedules_lookup ON public.dev_schedules (owner_openid, weekday, period_n);

CREATE TABLE IF NOT EXISTS public.prd_schedules (
    id VARCHAR(64) PRIMARY KEY,
    owner_openid TEXT NOT NULL,
    weekday VARCHAR(16) NOT NULL,
    period_n INT NOT NULL,
    class_id VARCHAR(64) DEFAULT '',
    class_name VARCHAR(64) NOT NULL,
    subject VARCHAR(32) NOT NULL,
    classroom VARCHAR(64) DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    CONSTRAINT uq_prd_schedules_slot UNIQUE (owner_openid, weekday, period_n)
);

CREATE INDEX IF NOT EXISTS idx_prd_schedules_owner ON public.prd_schedules (owner_openid);
CREATE INDEX IF NOT EXISTS idx_prd_schedules_lookup ON public.prd_schedules (owner_openid, weekday, period_n);

-- 禁用 RLS 并授予访问权限
ALTER TABLE public.dev_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_schedules DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.dev_schedules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.prd_schedules TO anon, authenticated, service_role;
