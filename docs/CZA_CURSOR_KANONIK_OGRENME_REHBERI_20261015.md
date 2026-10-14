# CZA | CURSOR KANONİK PROJE DEVİR REHBERİ
> 15 Ekim 2026, salt okunur kaynak temelli devir. Bu dosya bir yazılım teslimi, kod testi, staging kabulü veya üretim onayı değildir.
> REPO: https://github.com/dekorix/cza-akademi  |  DAİMİ KURAL: tek öğrenci, tek Student Learning Profile, mevcut özellikleri eksiltmeme.

## 0. İlk beş dakika: kaynak otoritesi
Cursor öncelikle gerçek git remote, branch, HEAD, tree ve dirty statüsünü okur. Hangi PR'da olduğundan emin değilse durur. GitHub HEAD/PR/CI dinamik gerçektir; dokümanlarda geçen SHA'lar zamanlı snapshot'tır.
Kanonik okuma sırası:
1. main/AGENTS.md (ajan disiplin), main/docs/CZA_CANLI_DURUM.md (aktif tek görev, eskimiş snapshot olabilir), main/docs/CZA_KONTROL_PROTOKOLU.md ve main/docs/CZA_KARAR_DEFTERI.md.
2. main/docs/CZA_MASTER_ARCHITECTURE.md, main/CENTRAL_IDENTITY_PLAN.md ve main/docs/CZA_URUN_VIZYONU_TASLAK.md (ticari/vizyon taslağı kabul edilmiş uygulama değildir).
3. main/docs/CZA_MODUL_KANONIK_MANIFEST.json (10 ana faz + 15 aile), main/docs/CZA_14_Beceri_v1.md (14 beceri), main/docs/CZA_DEGERLENDIRME_KAYNAK_ENVANTERI_20261009.md (26 profil, P2 23 bölüm).
4. Canlı GitHub Issue #80, #81, #94, #98 ve açık/korunan PR #73, #87, #89, #91, #101, #107. Kendi dalındaki daha eski CANLI_DURUM satırını güncel kanıt sayma.
5. docs/CZA_CURSOR_KOD_HARITASI_20261015.md ve docs/CZA_CURSOR_12_MADDE_DEVIR_KABULU_20261015.md.

## 1. Büyük ürün, küçük atölye değil
Büyük CZA, 5 yaş–YKS için **tek Student ID + tek Student Learning Profile** temelli bütünleşik eğitim/koçluk ürünüdür. Kanonik mevcut kaynakta 0–YKS erken gelişim kapsamı da korunur; 0–2 yaşta yetişkin aracılı gözlem/öğrenme esastır. 0–5 yaş kaynakları silinmez; ilk ticari sürümün yaş/fiyat kapsamı ayrıca karar ister.
Öğrencinin birbirine bağlı ÜÇ yüzeyi:
- Benim Öğrenme Rotam: bugün yapılacak eğitmen onaylı görev, hedef, kaldığı yer, kısa kişisel gelişim.
- Akademik Öğrenme Merkezi: ders/MEB kazanımı, önkoşullar, konu çalışması, hatanın analizi, tekrar ve yeniden ölçme.
- Beceri ve Zihin Atölyesi: Parmak aritmetiği, Soroban, Anzan/Flash/Sesli Anzan, dikkat, hafıza, hızlı ve anlamlı okuma, zihin haritaları, zekâ oyunları, not alma ve Tam Öğrenme.
Üçü ayrı öğrenci veya veri sistemi değildir. Anzan kazanımı otomatik matematik kazanımı sayılmaz.
Öğretim döngüsü: TANI → ÖĞRET → UYGULAT → ÖLÇ → HATAYI ANALİZ ET → PEKİŞTİR → DESTEĞİ AZALT → TRANSFER ET → BAĞIMSIZLAŞTIR. Eğitsel son karar öğretmene aittir. Tek testten klinik tanı, kalıcı zekâ ya da öğrenme stili etiketi üretme.
Ayrı ChatGPT Sites/tanıtım sitesi büyük platformun yerine geçmez. Repo package.json içindeki tarihi name: sites-project, repo kimliğini değiştirmez.

## 2. Değişmez 10 ana faz ve kod adresleri
| Faz | Amaç | Kanonik örnek kod |
| --- | --- | --- |
| F01 | Öğrenci Paneli | app/page.tsx, components/student-dashboard.tsx, app/api/core/dashboard/route.ts |
| F02 | Çalışma Merkezi | app/work/page.tsx, components/work-center.tsx, app/api/core/assignments/route.ts |
| F03 | Eğitmen Paneli | app/educator/page.tsx, components/educator-students.tsx, app/api/educator-auth/route.ts |
| F04 | Gerçek öğrenci geçmişi | components/student-learning-history.tsx, app/api/core/history/route.ts, lib/persistence/learning-timeline.ts |
| F05 | Ödevlendirme | components/educator-assignment-manager.tsx, app/api/educator-assignments/route.ts |
| F06 | Raporlar | components/central-student-report.tsx, app/api/educator-report/route.ts |
| F07 | Ortak Student Learning Profile | components/student-learning-profile.tsx, lib/persistence/student-learning-profile.ts |
| F08 | Koçluk/LGS/YKS | components/coaching-center.tsx, app/api/core/coaching/route.ts |
| F09 | Veli Paneli | components/guardian-panel.tsx, app/api/guardian/dashboard/route.ts |
| F10 | Açıklanabilir AI önerileri | lib/cza-work-recommendations.ts |
SIRA: Öğrenci Paneli → Çalışma Merkezi → Eğitmen Paneli → gerçek geçmiş → ödev → rapor → ortak SLP → Koçluk/LGS/YKS → Veli Paneli → AI. Kaynak dosya varlığı nihai kabul değildir.

## 3. 15 çapraz aile: hiçbirini unutma
| Kod | Aile | Ana kaynak |
| --- | --- | --- |
| X01 | Başlangıç Değerlendirmesi | components/central-assessment-intake.tsx |
| X02 | 26 yaş/sınıf ve özel eğitim profili | lib/assessment-bridge.ts |
| X03 | Eski özgün P2 23 bölüm | lib/p2-full-assessment-contract.ts |
| X04 | Özel Eğitim | lib/special-assessment.ts |
| X05 | Tanıtım, başvuru, paket, kayıt | lib/package-catalog.ts |
| X06 | Anzan, Flash, Sesli Anzan | components/anzan-exercise-renderer.tsx |
| X07 | Soroban | components/soroban.tsx |
| X08 | Parmak Aritmetiği | components/finger-hand.tsx |
| X09 | Hafıza Teknikleri | app/memory/page.tsx |
| X10 | Dikkat ve Odaklanma | app/attention/page.tsx |
| X11 | Hızlı ve Anlamlı Okuma | app/speed-reading/page.tsx |
| X12 | Zihin Haritaları | app/mind-maps/page.tsx |
| X13 | Zekâ Oyunları | app/intelligence-games/page.tsx |
| X14 | Etkili Not Alma | app/effective-notes/page.tsx |
| X15 | Tam Öğrenme 37 | app/full-study/page.tsx |
Schulte Tarama, X11 içindeki dar testtir; CZA'nın genel fazı veya ana geliştirme önceliği değildir. 14 beceri ise başka 14 ayrı ürün değil, bütün görevlerden toplanan kanıt boyutlarıdır.

## 4. CZA'nın 14 pedagojik becerisi (kaynak adı değişmez)
CZA-S01 Sayı ve Nicelik Duyusu
CZA-S02 Matematiksel Muhakeme ve İşlem Esnekliği
CZA-S03 Okuma Doğruluğu ve Akıcılığı
CZA-S04 Anlama ve Çıkarım
CZA-S05 Yazılı İfade
CZA-S06 Seçici ve Sürdürülen Dikkat
CZA-S07 Çalışma Belleği
CZA-S08 İşlemleme Hızı ve Hız-Doğruluk Dengesi
CZA-S09 Görsel-Uzamsal İşlemleme
CZA-S10 Mantıksal Örüntü ve Kural Çıkarma
CZA-S11 Problem Çözme ve Strateji Kurma
CZA-S12 Bilişsel Esneklik ve Yaratıcı Üretim
CZA-S13 Sözel İfade ve Gerekçelendirme
CZA-S14 Öz Düzenleme ve Yürütücü Kontrol
Tek soru/tek performans nihai puan veya tanı değildir. Kanıt yetersizse INSUFFICIENT; strateji, yardım, öz-düzeltme, süre, hata ve transfer ayrı kayıt alanlarıdır. Sınıf/takvim yaşı/gerçek beceri düzeyi birbirinden ayrılır.

## 5. Başlangıç Değerlendirmesi: 26 profil, özgün P2, özel eğitim
Kaynak main/docs/CZA_DEGERLENDIRME_KAYNAK_ENVANTERI_20261009.md:
- 16 yaş/sınıf kodu: E0 (0–12 ay), E1 (12–24 ay), E2 (24–36 ay), E3 (36–48 ay), E4 (48–60 ay), E5 (60–72 ay), P1, P2, P3, P4, P5, P6, P7/LGS ön, P8/LGS, P9/lise, P10/YKS. Kaynak statüsü E2/E3 CENTRAL_READY, P2 SOURCE_REFERENCE_ONLY, diğer 13 PLANNED. “CENTRAL_READY” gerçek uçtan uca staging kabulü değildir.
- 10 özel eğitim kaynak kodu: SP-DYS, SP-SLD, SP-DYSC, SP-DYSG, SP-ASD, SP-LANG, SP-ATTN, SP-DELAY, SP-COG, SP-MIX. Bunların her biri için gerçek görev, önkoşul, yetki, veri/rapor, pedagojik ve mobil kabul ayrı gerekir.
- P2 özgün kaynak 23 bölüm ve 226–239 mikro-görev sözleşmesel sınırı:
01 Tanışma ve İlgi; 02 Sayı ve Nicelik Başlangıcı; 03 Görsel Bellek; 04 Dikkat Avı; 05 Matematik Güç Taraması; 06 Dil ve Anlama; 07 Görsel Strateji ve Mantık; 08 Çalışma Belleği; 09 Hız ve Tepki Kontrolü; 10 Planlama ve Yönetici Beceriler; 11 Potansiyel ve Esnek Düşünme; 12 Organizasyon; 13 Karar Verme; 14 Transfer ve Doğrulama; 15 Üstbiliş; 16 Sesli Okuma ve Akıcılık; 17 Sesli Dikkat; 18 Anlatım ve Sözel Üretim; 19 Matematik Tutumu ve Özgüven; 20 Duygusal Farkındalık; 21 Koçluk ve Öz Liderlik; 22 Karakter ve Ahlaki Gelişim; 23 Manevi Farkındalık ve Değerler.
Bunlar çalışan ekranda eşdeğer görevlerin eksiksiz olduğunun kanıtı değildir. Önce/sonra kaynak parity olmadan asla eksiltme yapma.

## 6. Öğrenci veri omurgası ve rol izolasyonu
Neon Learning Core tek kalıcı kayıt otoritesidir. Google Forms/Sheets/Apps Script eski kampüs/veri aktarma kaynağı olarak korunur; yeni çift yazma sistemi değildir.
student_id kalıcı UUID; kampüs kodu, kullanıcı adı, legacy reference kimlik değildir. Geçici assessment candidateId/cycleId/sessionId görünen ad düzeltilince otomatik sıfırlanmaz; aday→öğrenci eşlemesi kanıtlı, idempotent ve çift kayıt yaratmadan yapılır.
Öğrenci: app/page.tsx + lib/core-client.ts → app/api/core/route.ts + lib/student-session.ts → app/api/core/dashboard/route.ts → components/work-center.tsx → app/api/core/history/route.ts → lib/persistence/learning-timeline.ts → app/api/core/learning-profile/route.ts.
Kanonik kayıt yazımı: lib/persistence/canonical-repository.ts, student/academy/session bound ve idempotency. Eğitmen: app/api/educator-auth/route.ts, app/api/educator-student-history/route.ts üzerinde academy_id, linked can_view ve aktif rol kontrolü. Veli: lib/guardian-context.ts ve app/api/guardian/dashboard/route.ts, yalnız yetkili öğrenci.
Her kayıt provenance, sourceReference, verificationStatus ve event türünü korur. Bağlı olmayan öğrenci/kurum ve yetkisiz role okuma/yazma yasaktır. 401/403/404/409/429/503 sınıflarını ve no-store gereğini koru. Altyapı hatasını sahte “geçmiş boş” durumuna dönüştürme.

## 7. Canlı geliştirme gerçeği: main farklı, PR #101 farklı
15 Ekim anlık görüntüsü:
- main HEAD 30de9c8641163c865d4863f3bcaf8e3e3c62faa2 / tree 64668eb1b046038629fb6e9b3eee7bb5dedc558a.
- Stacked zincir PR #73 (V01/T5) → #87 (V02) → #89 (V03) → #91 (V04) → #101 (A-DEMO-02) → #107 (izole QA güvenlik hazırlığı). Main'e merge edilmediler; rebase/reset/force-push yasak.
- Aktif TEK teknik iş Issue #98 ve DRAFT PR #101, HEAD dccc93d08b357c83453ff3b1b295d6c66fe5397a / tree d7e87353275341709b06a5645325057de364e17b. #107 HEAD 3737c2a79f722ec45a494c41dc25cf3cf3efee26.
- main'de AGENTS.md, KONTROL_PROTOKOLU, KARAR_DEFTERI, KANONIK_MANIFEST, DEGERLENDIRME_KAYNAK_ENVANTERI bulunur. #101/#107 eski atadan türediği için bu dokümanların çoğu yok. Bu bilgi ajan tarafından gerçek Git ağacından doğrulanacak; eksik dokümanı yok sayma veya başka projenin dosyasıyla ikame etme.
- Hızlı Okuma Cloud ortamı ana dal/snapshot üzerinden açılmış olabilir; orada kod görmüş olmak PR #101'i test ettiğini kanıtlamaz.
- B pedagojik kaynak incelemesi Issue #103 kod işi değildir, ikinci runtime uygulayıcı açılmaz.

## 8. Kabul, kanıt, rollback ve devam koşulları
- V01–V04 4/7 = %57,1, SADECE izole sentetik QA PASS_SCOPED. Genel projenin ilerleme yüzdesi ÖLÇÜLMEDİ, V05 geliştirmesi başlamadı.
- A-DEMO-02 önceki izole gerçek Chrome denemesinde ilk 20 geçmiş olayı geçti, devam sayfası 29'a ulaşamadı: FAIL. PostgreSQL mikro saniyeli occurred_at değeri JS Date ile milisaniyeye kırpılınca signed keyset cursor olay atlıyor. Salt okunur SQL karşılaştırmasında önceki cursor 20+7=27, hassas cursor 20+9=29; bu UI'da 27 görüntülendi demek değildir.
- Kanonik sentetik QA: 29 olay, 7 learning record, iki ayrı completed session 10 soru/8 doğru/2 yanlış; Work Center aggregate 20/16 (%80). PR #101'in dccc93d düzeltmesi kod/CI PASS_SCOPED, fakat bu sürümün gerçek Chrome desktop/mobile + Neon readback kabulü yapılmadı. A_DEMO_FULL_PASS=NO.
- İzole Worker rollback/EXECUTE revocation ve fixture OFF kaydı önceki #98 raporundadır. Tek kullanımlık SQL, secret, Worker onayı TÜKENDİ; sonraki deneme için yeni, tam hedefi belirli onay gerekir. WORKER_MODULE_BYTE_READBACK=UNVERIFIED production blokajı açık.
- Gerçek çocuk verisi, token, şifre, DB URL Cloud'a aktarılmaz. DB migration/SQL/GRANT/RLS, secret, Worker, main merge, genel staging, production, yeni fixture ve gerçek öğrenci testi ürün sahibinin yeni açık yetkisi olmadan YASAK. Closed P0-C/P1/P2/P3 konuları somut yeni kanıt olmadan açılmaz.
- Ajan sadece dar salt okunur kaynak devir sınavını yapacak. 12 madde kanıtlanmadan CODE_AUTHORIZATION=NO.

## 9. İşletim kuralı
ChatGPT Baş Mimar kapsam ve mimaride nihai karar verir. Cursor kod/test için dar kapsamlı uygulayıcı; Codex gerektiğinde hedefli inceleyici; GitHub tek kaynak. Aynı anda yalnız bir A/kod geliştirici; Codex ve Cursor aynı PR dosyasına paralel yazmaz.
Geliştirme disiplini: KAPSAM → UYGULAMA → MİMARİ KONTROL → GERÇEK BLOCKER/HIGH BAĞIMSIZ DENETİM → NİHAİ KARAR → COMMIT/TREE/REMOTE CHECKPOINT → İLERLEME RAPORU.
Rapor: GENEL PROJE İLERLEME %, MEVCUT FAZ İLERLEME %, TAMAMLANAN, KALAN, KAPSAM SAPMASI=YOK|VAR, SIRADAKİ TEK ADIM. Bilinmeyen yüzdeler uydurulmaz.
Birinci görevin sonucu docs/CZA_CURSOR_12_MADDE_DEVIR_KABULU_20261015.md uyarınca 12 maddelik kanıtlı CZA HAZIRLIK RAPORUDUR, KOD VE YAYIN DEĞİLDİR.
