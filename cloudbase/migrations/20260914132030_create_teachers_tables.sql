CREATE TABLE IF NOT EXISTS public.dev_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid TEXT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url TEXT DEFAULT '',
    subject VARCHAR(50) DEFAULT '',
    school VARCHAR(100) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_teachers_openid ON public.dev_teachers (openid);

CREATE TABLE IF NOT EXISTS public.prd_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid TEXT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url TEXT DEFAULT '',
    subject VARCHAR(50) DEFAULT '',
    school VARCHAR(100) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prd_teachers_openid ON public.prd_teachers (openid);
