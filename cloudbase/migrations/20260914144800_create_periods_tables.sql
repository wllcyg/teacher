-- 迁移文件：创建独立作息时间表 (dev_periods 和 prd_periods)
-- 支持当前单人模式，并原生预留 circle_id 和 class_id 扩展字段

CREATE TABLE IF NOT EXISTS public.dev_periods (
    id VARCHAR(64) PRIMARY KEY,
    owner_openid TEXT NOT NULL,
    circle_id VARCHAR(64) DEFAULT NULL,
    class_id VARCHAR(64) DEFAULT NULL,
    n INT NOT NULL,
    label VARCHAR(32) NOT NULL,
    start_time VARCHAR(8) NOT NULL,
    end_time VARCHAR(8) NOT NULL,
    duration INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_dev_periods_owner ON public.dev_periods (owner_openid);
CREATE INDEX IF NOT EXISTS idx_dev_periods_circle ON public.dev_periods (circle_id);
CREATE INDEX IF NOT EXISTS idx_dev_periods_sort ON public.dev_periods (owner_openid, sort_order ASC);

CREATE TABLE IF NOT EXISTS public.prd_periods (
    id VARCHAR(64) PRIMARY KEY,
    owner_openid TEXT NOT NULL,
    circle_id VARCHAR(64) DEFAULT NULL,
    class_id VARCHAR(64) DEFAULT NULL,
    n INT NOT NULL,
    label VARCHAR(32) NOT NULL,
    start_time VARCHAR(8) NOT NULL,
    end_time VARCHAR(8) NOT NULL,
    duration INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_prd_periods_owner ON public.prd_periods (owner_openid);
CREATE INDEX IF NOT EXISTS idx_prd_periods_circle ON public.prd_periods (circle_id);
CREATE INDEX IF NOT EXISTS idx_prd_periods_sort ON public.prd_periods (owner_openid, sort_order ASC);

-- 禁用 RLS 并授予访问权限
ALTER TABLE public.dev_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_periods DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.dev_periods TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.prd_periods TO anon, authenticated, service_role;
