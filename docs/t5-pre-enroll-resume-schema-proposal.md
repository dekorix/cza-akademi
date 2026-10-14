# T5 kayıt öncesi oturum bütünlüğü — şema teklifi

**Durum: ONAY BEKLİYOR.** Bu SQL hiçbir ortama uygulanmadı. Kod, geçerli
benzersiz indeks bulunmazsa kayıt öncesi create işlemini 503 ile durdurur.

Kimlik: `academyId + createdByEducatorId + candidateId + cycleId + template_code`.
`candidateId` ve `cycleId` UUID olup istemcide oluşturulur ve yenilemede
korunur. Ad yalnız ekranda gösterilir; eşleştirmede kullanılmaz.

İzole staging üzerinde, yalnız sentetik veriler için önce mevcut çakışmaları
salt okunur sorguyla inceleyin:

```sql
SELECT metadata->>'academyId' AS academy_id,
       metadata->>'createdByEducatorId' AS educator_id,
       metadata->>'candidateId' AS candidate_id,
       metadata->>'cycleId' AS cycle_id,
       template_code, count(*) AS active_count
FROM public.assessment_sessions
WHERE student_id IS NULL AND status = 'active'
  AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
  AND metadata->>'candidateId' IS NOT NULL
  AND metadata->>'cycleId' IS NOT NULL
GROUP BY 1, 2, 3, 4, 5
HAVING count(*) > 1;
```

Onaylandıktan ve çakışma sorgusu boş döndükten sonra **yalnız izole staging**
DB'de önerilen migration:

```sql
CREATE UNIQUE INDEX CONCURRENTLY assessment_sessions_pre_enroll_active_identity_uq
ON public.assessment_sessions (
  (metadata->>'academyId'),
  (metadata->>'createdByEducatorId'),
  (metadata->>'candidateId'),
  (metadata->>'cycleId'),
  template_code
)
WHERE student_id IS NULL AND status = 'active'
  AND metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'
  AND metadata->>'candidateId' IS NOT NULL
  AND metadata->>'cycleId' IS NOT NULL;
```

`CONCURRENTLY` transaction bloğu dışında çalıştırılmalıdır. Geri alma:
`DROP INDEX CONCURRENTLY public.assessment_sessions_pre_enroll_active_identity_uq;`.
Uygulama öncesi staging runtime bağlantısı, yetki, indeks geçerliliği ve
sentetik kayıt izolasyonu ayrıca doğrulanmalıdır. Production uygulaması bu
teklifin kapsamında değildir.
