-- CZA Zihin Gelişim · Zekâ Oyunları v1
BEGIN;
INSERT INTO public.modules (code,name,category,is_active)
VALUES ('intelligence_games','Zekâ Oyunları','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name=EXCLUDED.name, category=EXCLUDED.category, is_active=true;
COMMIT;
