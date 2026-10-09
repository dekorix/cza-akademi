# CZA | Başlangıç Değerlendirmesi Kaynak Envanteri (9 Ekim 2026)

**Kaynak kontrol referansı:** `dekorix/cza-akademi`, ana dal temel SHA `9f76b6322991a850980dd1240e6232882bface2e`. Bu belge kaynak sözleşmelerinden üretilmiştir; gerçek Chrome/staging/Neon akış kabulü DEĞİLDİR. Tarihsel snapshot, her yeni değişiklikte güncellenip diff alınacaktır.

## Envanter ve doğruluk sınırı

- Kaynakta **16** yaş/sınıf kodu, **10** özel eğitim kodu tanımlı; toplam **26** profil sözleşmesi.
- Yaş/sınıf statüsü: **2** `CENTRAL_READY`, **1** `SOURCE_REFERENCE_ONLY`, **13** `PLANNED`. Bunlar yalnız **kaynakta beyan edilen hazırlık**; gerçek kabul seviyesi değildir.
- 10 özel eğitim kodu `lib/assessment-bridge.ts` içinde `CENTRAL_READY` döndürüyor; her birinin gerçek kayıt/rapor ve yetki/yaşa uygunluk kabulü ayrıca gerekir.
- Eski P2: **23 bölüm**, `minTasks=226`, `maxTasks=239` sözleşmesel sınırları. **Bunlar çalışan arayüzde aynı sayıdaki gerçek görev olduğu veya bütün kaynak mikro-görevlerin taşındığı anlamına gelmez.**
- 14 beceri: `docs/CZA_14_Beceri_v1.md` dosyası; yaşa uygun kanıt standardı, 0–2 yaş çocuk ekranı standardı değildir.

## Yaş ve okul profilleri, kaynak sözleşmesi

| Kod | Profil | Kaynak durumu | Merkezi route / durum | Kaynak kabul notu |
|---|---|---|---|---|
| `E0` | 0–12 ay · Erken Gelişim | `PLANNED` | `null` | Yaşa özel merkezi görev bankası henüz port edilmedi. |
| `E1` | 12–24 ay · Erken Gelişim | `PLANNED` | `null` | Yaşa özel merkezi görev bankası henüz port edilmedi. |
| `E2` | 24–36 ay · Erken Gelişim | `CENTRAL_READY` | `'/api/assessment-e2-linked'` | 138 görevlik E2-v7 adaptif motoru, bakımveren kanıtı ve rapor merkezi CZA öğrenci kimliğiyle hazır. |
| `E3` | 36–48 ay · Erken Gelişim | `CENTRAL_READY` | `'/api/assessment-e3-linked'` | Merkezi öğrenci kimliği ve eğitimci yetkisi ile hazır. |
| `E4` | 48–60 ay · Erken Gelişim | `PLANNED` | `null` | Yaşa özel merkezi görev bankası henüz port edilmedi. |
| `E5` | 60–72 ay · Okula Hazırlık | `PLANNED` | `null` | Okula hazırlık görev bankası merkezi hatta henüz port edilmedi. |
| `P1` | 1. Sınıf | `PLANNED` | `null` | 1. sınıf merkezi görev bankası henüz port edilmedi. |
| `P2` | 1. sınıf sonu / 2. sınıf başlangıcı | `SOURCE_REFERENCE_ONLY` | `null` | Eski gerçek P2 motorundaki 23 bölüm ve tüm mikro-görevler merkezi CZA’ya eksiksiz port edilene kadar kilitli. |
| `P3` | 3. Sınıf | `PLANNED` | `null` | 3. sınıf merkezi görev bankası henüz port edilmedi. |
| `P4` | 4. Sınıf | `PLANNED` | `null` | 4. sınıf merkezi görev bankası henüz port edilmedi. |
| `P5` | 5. Sınıf | `PLANNED` | `null` | 5. sınıf merkezi görev bankası henüz port edilmedi. |
| `P6` | 6. Sınıf | `PLANNED` | `null` | 6. sınıf merkezi görev bankası henüz port edilmedi. |
| `P7` | 7. Sınıf · LGS Ön Hazırlık | `PLANNED` | `null` | 7. sınıf / LGS ön hazırlık merkezi görev bankası henüz port edilmedi. |
| `P8` | 8. Sınıf · LGS | `PLANNED` | `null` | 8. sınıf / LGS merkezi görev bankası henüz port edilmedi. |
| `P9` | 9–10. Sınıf · Lise Öğrenme Sistemi | `PLANNED` | `null` | Lise merkezi görev bankası henüz port edilmedi. |
| `P10` | 11–12 / Mezun · YKS-TYT | `PLANNED` | `null` | YKS/TYT merkezi görev bankası henüz port edilmedi. |

## Özel eğitim ve öğrenme profilleri

`SP-DYS`, `SP-SLD`, `SP-DYSC`, `SP-DYSG`, `SP-ASD`, `SP-LANG`, `SP-ATTN`, `SP-DELAY`, `SP-COG`, `SP-MIX`.

Her biri için ayrı: görev alt başlıkları ve görev sayısı, öğretmen yönergesi, görev örneklemi, gerçek Chrome mobil/masaüstü, izole/sentetik oturum, merkezi evidence yazma, hard reload, yetki izolasyonu, rapor ve eğitimci kararı kanıtı doldurulmalıdır. Boş alan **NİHAİ KABUL** değil **DOĞRULANAMADI**dır.

## P2 özgün 23 bölüm koruma envanteri

| ID | Bölüm | Kaynak motor | Sözleşmesel görev sınırı |
|---|---|---|---|
| `P2-01` | Tanışma ve İlgi | `WarmupDiscoveryLab` | 9–9 |
| `P2-02` | Sayı ve Nicelik Başlangıcı | `CzaApp/Warmup` | 2–2 |
| `P2-03` | Görsel Bellek | `CzaApp/Visual Memory` | 1–1 |
| `P2-04` | Dikkat Avı | `CzaApp/Attention Hunt` | 1–3 |
| `P2-05` | Matematik Güç Taraması | `Math Scan` | 17–23 |
| `P2-06` | Dil ve Anlama | `LanguageScan` | 15–20 |
| `P2-07` | Görsel Strateji ve Mantık | `VisualStrategyLab` | 10–10 |
| `P2-08` | Çalışma Belleği | `WorkingMemoryLab` | 16–16 |
| `P2-09` | Hız ve Tepki Kontrolü | `SpeedBalanceLab` | 10–10 |
| `P2-10` | Planlama ve Yönetici Beceriler | `PlanExecutiveLab` | 16–16 |
| `P2-11` | Potansiyel ve Esnek Düşünme | `PotentialLab` | 16–16 |
| `P2-12` | Organizasyon | `OrganizerLab` | 10–10 |
| `P2-13` | Karar Verme | `DecisionLab` | 12–12 |
| `P2-14` | Transfer ve Doğrulama | `AdaptiveTransferLab` | 6–6 |
| `P2-15` | Üstbiliş | `MetacognitionLab` | 12–12 |
| `P2-16` | Sesli Okuma ve Akıcılık | `ReadingFluencyLab` | 8–8 |
| `P2-17` | Sesli Dikkat | `VoiceStroopLab` | 1–1 |
| `P2-18` | Anlatım ve Sözel Üretim | `ExpressionLab` | 14–14 |
| `P2-19` | Matematik Tutumu ve Özgüven | `MathAttitudeLab` | 10–10 |
| `P2-20` | Duygusal Farkındalık | `EmotionalAwarenessLab` | 10–10 |
| `P2-21` | Koçluk ve Öz Liderlik | `SelfLeadershipLab` | 10–10 |
| `P2-22` | Karakter ve Ahlaki Gelişim | `CharacterCompassLab` | 10–10 |
| `P2-23` | Manevi Farkındalık ve Değerler | `SpiritualValuesLab` | 10–10 |

**Eksiltme kilidi:** Bu envanterdeki hiçbir P2 bölümünün kaybı kanıtsız kabul edilemez. İçerik tekrarları, yaşa uygunluk, etik ve gerçek soru envanteri bu sayısal koruma testinden ayrıdır. İyi neden olmadan kaynak azaltılmaz; her geçiş önce/sonra matrisiyle yapılır.

## Aynı bilgi, farklı uygulama yüzeyleri

- `lib/assessment-bridge.ts`: katalog ve `resolveAssessmentBridge` kaynak hazırlık statüsü.
- `cza-degerlendirme/app.js`: büyük değerlendirme sayfasının ayrı yönlendirme mantığı; E2 aktif görünüp açılamama vakası GitHub Issue #72'de. Bu sayfa katalogla aynı kabulü göstermiyor.
- `app/assessment/p2`: ayrı P2 yüzeyi; 23 bölümün birebir merkezî veri transferini kanıtlamaz.
- `app/api/assessment-special-linked/route.ts`: özel eğitim merkezi oturum; kayıt öncesi resume PR #73, sentetik staging ve DB kabulü ayrı.
- `components/central-assessment-intake.tsx`: merkezi React giriş; durum rozeti değişiklikleri PR #69.

## Eksiltme ve kabul matrisi

| Kontrol | Durum | Dayanak |
|---|---|---|
| 16+10 profil kodunun kaynakta varlığı | KAYNAK ENVANTERİ | `lib/assessment-bridge.ts` |
| P2 23 bölüm kimliklerinin kaynakta varlığı | KAYNAK ENVANTERİ | `lib/p2-full-assessment-contract.ts` |
| 14 beceri isimleri/kodlarının v1'de varlığı | KAYNAK ENVANTERİ | `docs/CZA_14_Beceri_v1.md` |
| P2 eski mikro-görevlerin yeni ekranda birebir korunması | **DOĞRULANAMADI** | Eski gerçek kaynak ile güncel ekran yan yana inceleme gerekiyor |
| E2, E3, P2 ve 10 özel profilin başlangıçtan rapora gerçek akışı | **BLOCKED / KABUL YOK** | Issue #72, PR #73 ve diğer açık kabul kapıları |
| Ekran renk, yazı, dokunma hedefi, çocuk yaş uyumu | **KABUL YOK** | UI/UX değerlendirmesi ve gerçek Chrome kanıtı eksik |
| Ortak Student ID, yetki, Neon readback, veli raporu | **KABUL YOK** | T5 ve ilgili PR staging kabul kanıtları gerekli |

**Sıradaki tek konu:** Yeni gerçek özellik geliştirmeden önce kanonik profil/kazanım envanterlerinin kaynak koruma testini çalıştır ve denetlenebilir devir paketiyle T5'e aktar. Ana dal ve production değişmesin.
