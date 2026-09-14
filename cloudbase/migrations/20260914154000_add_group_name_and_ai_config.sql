-- 20260914154000_add_group_name_and_ai_config.sql
-- 1. 为学生表增加学习小组字段 group_name
ALTER TABLE public.dev_students ADD COLUMN IF NOT EXISTS group_name VARCHAR(50) DEFAULT '';
ALTER TABLE public.prd_students ADD COLUMN IF NOT EXISTS group_name VARCHAR(50) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_dev_students_class_group ON public.dev_students (class_id, group_name);
CREATE INDEX IF NOT EXISTS idx_prd_students_class_group ON public.prd_students (class_id, group_name);

-- 2. 创建系统配置表存储 AI 接口密钥及模型配置（dev 与 prd 隔离）
CREATE TABLE IF NOT EXISTS public.dev_app_configs (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT DEFAULT '',
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

CREATE TABLE IF NOT EXISTS public.prd_app_configs (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT DEFAULT '',
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::bigint
);

-- 3. 写入 CloudBase AI 网关配置
INSERT INTO public.dev_app_configs (key, value, description, updated_at)
VALUES (
    'AI_ROSTER_CONFIG',
    '{"baseUrl": "https://teacher-d4g74wc9be2d5b1f5.api.tcloudbasegateway.com/v1/ai/cloudbase", "apiKey": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjViZjk5YWQ5LTdlYzQtNDc0MS05ZmY2LWIxZTljM2Y2Zjg5NSJ9.eyJhdWQiOiJ0ZWFjaGVyLWQ0Zzc0d2M5YmUyZDViMWY1IiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4OTM1NzIwNSwiYXRfaGFzaCI6IjZHMldlcHNUUUJ5SGNLQ1RXT25oSkEiLCJwcm9qZWN0X2lkIjoidGVhY2hlci1kNGc3NHdjOWJlMmQ1YjFmNSIsIm1ldGEiOnsicGxhdGZvcm0iOiJBcGlLZXkifSwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImFwaWtleSIsInByb3ZpZGVycyI6WyJhcGlrZXkiXX0sImFkbWluaXN0cmF0b3JfaWQiOiIyMDk4MjM4MDI4MTE0ODI1MjE2IiwidXNlcl90eXBlIjoiIiwiY2xpZW50X3R5cGUiOiJjbGllbnRfc2VydmVyIiwiaXNfc3lzdGVtX2FkbWluIjp0cnVlfQ.cPu-dnR-t8BFqs4vNmstDLARXYYY3I0eH3eP8sOw_L-bc6LWEq_ntBldwN9hYso20-xzRzFEKXs94VytfXW5HdjVoCreWjTIgZJh0qWbBfphQxRgVkv-MkCBiAU9mzfeBt_T27DiKAQSgV8vYCqfqliWtPof9CF-Vtxgg_PpeuGnFtcr_4jwrKBQvL24E3YJoYBy54dDTUmKD9iRneUWVaZ81WTpLCskK7JGTf7tjNAYbTKfC2ReMzO_ZUyyvhd4Lhm3bJlQvHyDISl15ZYhi4TLST8sxtWO3w37zZsxEvb0cIpsHhILLu81L6IhLciRMWq-svomzpGC6bSUN8xz7Q", "model": "hunyuan-lite"}'::jsonb,
    'CloudBase AI 网关配置（名单智能解析）',
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
)
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.prd_app_configs (key, value, description, updated_at)
VALUES (
    'AI_ROSTER_CONFIG',
    '{"baseUrl": "https://teacher-d4g74wc9be2d5b1f5.api.tcloudbasegateway.com/v1/ai/cloudbase", "apiKey": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjViZjk5YWQ5LTdlYzQtNDc0MS05ZmY2LWIxZTljM2Y2Zjg5NSJ9.eyJhdWQiOiJ0ZWFjaGVyLWQ0Zzc0d2M5YmUyZDViMWY1IiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4OTM1NzIwNSwiYXRfaGFzaCI6IjZHMldlcHNUUUJ5SGNLQ1RXT25oSkEiLCJwcm9qZWN0X2lkIjoidGVhY2hlci1kNGc3NHdjOWJlMmQ1YjFmNSIsIm1ldGEiOnsicGxhdGZvcm0iOiJBcGlLZXkifSwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImFwaWtleSIsInByb3ZpZGVycyI6WyJhcGlrZXkiXX0sImFkbWluaXN0cmF0b3JfaWQiOiIyMDk4MjM4MDI4MTE0ODI1MjE2IiwidXNlcl90eXBlIjoiIiwiY2xpZW50X3R5cGUiOiJjbGllbnRfc2VydmVyIiwiaXNfc3lzdGVtX2FkbWluIjp0cnVlfQ.cPu-dnR-t8BFqs4vNmstDLARXYYY3I0eH3eP8sOw_L-bc6LWEq_ntBldwN9hYso20-xzRzFEKXs94VytfXW5HdjVoCreWjTIgZJh0qWbBfphQxRgVkv-MkCBiAU9mzfeBt_T27DiKAQSgV8vYCqfqliWtPof9CF-Vtxgg_PpeuGnFtcr_4jwrKBQvL24E3YJoYBy54dDTUmKD9iRneUWVaZ81WTpLCskK7JGTf7tjNAYbTKfC2ReMzO_ZUyyvhd4Lhm3bJlQvHyDISl15ZYhi4TLST8sxtWO3w37zZsxEvb0cIpsHhILLu81L6IhLciRMWq-svomzpGC6bSUN8xz7Q", "model": "hunyuan-lite"}'::jsonb,
    'CloudBase AI 网关配置（名单智能解析）',
    (EXTRACT(epoch FROM NOW()) * 1000)::bigint
)
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
