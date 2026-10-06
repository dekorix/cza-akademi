-- CZA Zihin Gelişim · Etkili Not Alma v1
BEGIN;

INSERT INTO public.modules (code,name,category,is_active)
VALUES ('effective_notes','Etkili Not Alma','zihin',true)
ON CONFLICT (code) DO UPDATE
SET name=EXCLUDED.name,
    category=EXCLUDED.category,
    is_active=true;

COMMIT;
