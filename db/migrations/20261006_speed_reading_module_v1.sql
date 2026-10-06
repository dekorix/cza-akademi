-- CZA Zihin Gelişim · Hızlı Okuma v1
-- Canonical module catalog registration. Additive/idempotent.

BEGIN;

INSERT INTO public.modules (code,name,category,is_active)
VALUES ('speed_reading','Hızlı Okuma','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_active = true;

COMMIT;
