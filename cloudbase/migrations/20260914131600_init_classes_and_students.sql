CREATE TABLE IF NOT EXISTS public.dev_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    academic_year VARCHAR(50) DEFAULT '',
    headmaster_name VARCHAR(50) DEFAULT '',
    subject VARCHAR(50) DEFAULT '',
    student_count INTEGER DEFAULT 0,
    assistant_teachers JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_dev_classes_openid ON public.dev_classes (openid);

CREATE TABLE IF NOT EXISTS public.dev_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.dev_classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    student_no VARCHAR(50) DEFAULT '',
    gender VARCHAR(10) DEFAULT '',
    parent_name VARCHAR(100) DEFAULT '',
    parent_phone VARCHAR(50) DEFAULT '',
    address TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'active',
    avatar_url TEXT DEFAULT '',
    duty VARCHAR(50) DEFAULT '',
    remarks TEXT DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_dev_students_class_id ON public.dev_students (class_id);
CREATE INDEX IF NOT EXISTS idx_dev_students_class_created ON public.dev_students (class_id, created_at);

CREATE TABLE IF NOT EXISTS public.prd_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    academic_year VARCHAR(50) DEFAULT '',
    headmaster_name VARCHAR(50) DEFAULT '',
    subject VARCHAR(50) DEFAULT '',
    student_count INTEGER DEFAULT 0,
    assistant_teachers JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_prd_classes_openid ON public.prd_classes (openid);

CREATE TABLE IF NOT EXISTS public.prd_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.prd_classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    student_no VARCHAR(50) DEFAULT '',
    gender VARCHAR(10) DEFAULT '',
    parent_name VARCHAR(100) DEFAULT '',
    parent_phone VARCHAR(50) DEFAULT '',
    address TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'active',
    avatar_url TEXT DEFAULT '',
    duty VARCHAR(50) DEFAULT '',
    remarks TEXT DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_prd_students_class_id ON public.prd_students (class_id);
CREATE INDEX IF NOT EXISTS idx_prd_students_class_created ON public.prd_students (class_id, created_at);
