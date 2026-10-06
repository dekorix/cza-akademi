-- CZA Zihin Gelişim · Dikkat ve Derin Odak v1
-- Canonical module catalog registration. Additive/idempotent.

BEGIN;

INSERT INTO public.modules (code,name,category,is_active)
VALUES ('attention_focus','Dikkat ve Derin Odak','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_active = true;

COMMIT;
