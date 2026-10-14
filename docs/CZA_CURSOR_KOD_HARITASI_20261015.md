# CZA CURSOR | TEKNİK KOD HARİTASI VE KABUL BAĞLANTILARI
Bu dosya GitHub main + stacked #101 kaynak keşfidir. Kaynak varlığı işlevsel kabul değildir.
## Başlangıç ve scriptler
package.json package name = sites-project (tarihsel metadata; kanonik büyük depo dekorix/cza-akademi'dir). Node >=22.13; npm run dev = vinext dev; npm run build = vinext build; npm test = node --test tests/*.test.mjs; npm run lint = oxlint. Cloud setup npm ci --ignore-scripts, start npm run dev -- -H 127.0.0.1. Cloud test kapsamı ayrıca ölçülür.
## Ekranlar
app/page.tsx: StudentPortal login/logout, dashboard ve handoff.
app/work/page.tsx; components/work-center.tsx: atama toplamı, çalışma, geçmiş, serbest atölyeler.
app/studio/page.tsx: çalışma/studio; sonuç okuma ile yeni oturum oluşturmayı karıştırma.
app/educator/page.tsx; components/educator-students.tsx: rol/kurum/öğrenci bağlı yönetim.
app/parent/page.tsx; components/guardian-panel.tsx: veli.
app/assessment/page.tsx; components/central-assessment-intake.tsx; app/assessment/e2, app/assessment/e3, app/assessment/p2: ayrı yaş/profil değerlendirme yüzeyleri.
app/speed-reading/page.tsx; app/speed-reading/training/page.tsx: X11 Hızlı Okuma; Schulte duman testi platform kabulü değil.
app/memory, app/attention, app/mind-maps, app/intelligence-games, app/effective-notes, app/full-study: çapraz atölye sayfaları.
## API ve veri zinciri
lib/core-client.ts → app/api/core/route.ts → lib/student-session.ts: öğrenci giriş/oturum.
app/api/core/dashboard/route.ts: kişisel dashboard; app/api/core/assignments/route.ts: görev/çalışma.
lib/persistence/canonical-repository.ts: oturum ve student/academy bağlı, idempotent kanonik öğrenme kaydı.
app/api/core/history/route.ts → lib/persistence/learning-timeline.ts: güvenli signed HMAC cursor, UTC mikro saniye, keyset event tie-breaker, sınırlı olay/filtre, provenance/verificationStatus. Yetki/DB hatası sahte boş timeline olmaz.
app/api/core/work-results/route.ts ve app/work/result/page.tsx, yalnız PR #101 dalında: tamamlanan *ayrı* session sonuçlarının salt okunur sunumu. Atama 20/16 (%80) aggregate toplamından ayrı 2x(10/8/2).
app/api/core/learning-profile/route.ts + lib/persistence/student-learning-profile.ts: ortak öğrenci kanıtı.
app/api/educator-auth/route.ts, app/api/educator-student-history/route.ts: authenticatedEducator, academy scope, teacher_student_links.can_view, aktif rol/öğrenci izinleri.
app/api/guardian-auth/route.ts, lib/guardian-context.ts, app/api/guardian/dashboard/route.ts: guardian/student scope.
app/api/assessment-linked, assessment-e2-linked, assessment-e3-linked, assessment-special-linked; eski/yeninin uyuşması ve aday→öğrenci kimliği için ayrı auth test.
## SQL ve güvenlik
db/migrations: SQL dosyaları deployment kanıtı değildir. db/qa/a-demo-02-read.review.sql ve .rollback.review.sql yalnız stacked #101 kaynağında review-only paketlerdir. Hiçbiri izinsiz çalıştırılamaz.
Öğrenci identity ve consent, immutable record provenance, academy tenant, educator/student association, RLS/ACL/role ve örnek dış veri kayıtları korunur.
## Test kaynakları (örnek)
tests/cza-governance-contract.test.mjs; tests/cza-handoff-inventory-guard.test.mjs (main'de; stacked dalda olmayabilir), tests/assessment-bridge.test.mjs, tests/p2-full-assessment-contract.test.mjs, tests/special-assessment-contract.test.mjs.
tests/canonical-learning-persistence.test.mjs; tests/canonical-security-hardening.test.mjs; tests/canonical-postgres-behavior.test.mjs.
tests/u1-student-panel.test.mjs, tests/u2-work-center.test.mjs, tests/u3-educator-core.test.mjs, tests/u4-learning-timeline.test.mjs, tests/u5-assignment-management.test.mjs, tests/u7-student-learning-profile.test.mjs.
PR #101: tests/a-demo-02-api.test.mjs, tests/a-demo-02-read-postgres.test.mjs, tests/a-demo-02-browser.mjs.
tests/fast-reading-browser.e2e.mjs yalnız X11'i kontrol eder; CZA tamamı için PASS değildir.
Test = doğru kaynak HEAD+komut+çıktı; CI=kod kalitesi; gerçek sentetik Chrome mobile/desktop+Neon izin/DB readback=ayrı staging kabulü.
## Çalıştırma kilidi
İlk görev yalnız git remote/branch/HEAD/tree ve 12 maddelik kaynak kanıtıdır. GitHub main farklı, PR #101 farklı; API/SQL/browser testine, Cloud ajan yazma görevine, main merge veya production'a izin YOK.
