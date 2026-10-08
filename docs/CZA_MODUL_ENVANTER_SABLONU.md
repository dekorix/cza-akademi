# CZA | Modül Envanteri ve Eksiltme Kontrol Şablonu

> Her önemli modül/sürüm için bir kopyası doldurulur. Şablonun varlığı modülün denetlendiği anlamına gelmez.

## Modül kimliği
- Modül / yaş / kullanıcı rolü:
- Kanonik ürün hedefi bağlantısı:
- Kaynak BASE_COMMIT / TREE:
- Eski özgün kaynak ve varsa envanter sha:
- İlgili issue ve PR:

## Değişmeden korunacak içerik
| Varlık türü | Önceki kaynak/kimlik | Mevcut envanter sayısı | Yeni kaynak/kimlik | Eşleşme | Kanıt |
|---|---|---|---|---|---|
| Ekran / rota | | | | PASS/FAIL/UNKNOWN | |
| Beceri / akademik kazanım | | | | PASS/FAIL/UNKNOWN | |
| Görev / soru / görsel | | | | PASS/FAIL/UNKNOWN | |
| Öğretmen yönergesi / gözlem | | | | PASS/FAIL/UNKNOWN | |
| API / veri modeli / Student ID | | | | PASS/FAIL/UNKNOWN | |
| Yetki / kurum izolasyonu | | | | PASS/FAIL/UNKNOWN | |
| Ödev / geçmiş / rapor | | | | PASS/FAIL/UNKNOWN | |
| Mobil/masaüstü ve erişilebilirlik | | | | PASS/FAIL/UNKNOWN | |

## Öğrenme kalitesi
- Yaşa uygun pedagojik hedef ve görev türleri:
- 14 beceri kodları (varsa) ve hedef becerinin ölçme kanıtı:
- Ön koşul/yanlış örüntü/destek/bağımsız transfer:
- Soru çeşitliliği, gerçek materyal, görsel doğruluk:
- Yapay zekâ önerisi varsa eğitimci onayı ve tanısal sınır:

## Ortak veri sözleşmesi
- Kalıcı Student ID veya kayıt öncesi aday/çevrim kimliği:
- Academy/educator/student/parent yetki matrisi:
- Source → session → attempt/observation → evidence → Student Learning Profile → rapor:
- Yeniden yükleme, tekrar yazma ve çift kayıt önleme:
- Veri gizliliği, senaryo sentetik test sınırları:

## Kabul ve regresyon
| Kontrol | Sonuç | Tarih / commit / run / URL |
|---|---|---|
| Ürün mimarisi/kapsam | NOT_RUN | |
| Pedagojik içerik ve örneklem denetimi | NOT_RUN | |
| UI desktop/mobil/erişilebilirlik | NOT_RUN | |
| Unit/integration/CI | NOT_RUN | |
| İmzalı giriş ve kurum izolasyonu | NOT_RUN | |
| Sentetik uçtan uca çalışma | NOT_RUN | |
| Staging gerçek DB readback / reload | NOT_RUN | |
| Bağımsız BLOCKER/HIGH denetimi (gerektiğinde) | NOT_RUN | |
| Kaynak commit/tree/deploy sürüm eşlemesi | NOT_RUN | |

## Karar
- Eksiltme: YOK / VAR / DOĞRULANAMADI
- Kabul: PLANLANDI / KODLANDI / HEDEFLİ TEST PASS / STAGING KABUL PASS / NİHAİ KABUL / BLOCKED
- Korunacak açık riskler:
- Sıradaki tek adım:

**Kural:** Eski kaynak incelenemiyorsa eksiltme kontrolü PASS değil, DOĞRULANAMADI olur. Kaybolduğu kanıtlanan işlev silinemez; kapsam koruması ayrı karar gerektirir.
