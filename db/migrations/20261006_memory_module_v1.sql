-- CZA Zihin Gelişim · Hafıza Teknikleri v1
-- Canonical module catalog registration. Additive/idempotent.

BEGIN;

INSERT INTO public.modules (code,name,category,is_active)
VALUES ('memory','Hafıza Teknikleri','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_active = true;

COMMIT;
