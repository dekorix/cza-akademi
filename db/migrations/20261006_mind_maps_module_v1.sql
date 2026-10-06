-- CZA Zihin Gelişim · Zihin Haritaları v1
BEGIN;
INSERT INTO public.modules (code,name,category,is_active)
VALUES ('mind_maps','Zihin Haritaları','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name=EXCLUDED.name, category=EXCLUDED.category, is_active=true;
COMMIT;
