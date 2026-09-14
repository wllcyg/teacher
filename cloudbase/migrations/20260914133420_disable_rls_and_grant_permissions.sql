ALTER TABLE public.dev_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prd_students DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.dev_teachers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.dev_classes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.dev_students TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.prd_teachers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.prd_classes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.prd_students TO anon, authenticated, service_role;
