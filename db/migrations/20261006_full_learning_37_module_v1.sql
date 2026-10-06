-- CZA Zihin Gelişim · Tam Öğrenme Sistemi 37 v1
BEGIN;

INSERT INTO public.modules (code,name,category,is_active)
VALUES ('full_learning_37','Tam Öğrenme Sistemi 37','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name=EXCLUDED.name,
    category=EXCLUDED.category,
    is_active=true;

COMMIT;
