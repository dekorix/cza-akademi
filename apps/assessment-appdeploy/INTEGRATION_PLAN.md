# Başlangıç Değerlendirmesi → CZA Entegrasyon Planı

## 1. Kaynak sabitleme
AppDeploy `cza-degerlendirme-hl4a5d` sürüm `1790749888495` tam kaynak snapshotı GitHub'a alınır ve ana CZA build'inden izole edilir.

## 2. Kimlik ve veri köprüsü
AppDeploy öğrenci/session kimliği merkezi CZA student identity ile eşlenir. Ayrı PIN/session mantığı yerine CZA educator/student auth kullanılır. Değerlendirme kanıtları canonical assessment / learning record katmanına taşınır.

## 3. Başlangıç Değerlendirmesi arayüzü
`src/ProfileIntake.tsx` içindeki yaş / sınıf / amaç arayüzü korunur. Erken gelişim, 1–8. sınıf ve özel eğitim profilleri tek giriş ekranında birleşir. Çalışan görev bankaları kaybolmadan ana CZA bileşenlerine port edilir.

## 4. Özel Eğitim
Disleksi / Okuma Güçlüğü, Özgül Öğrenme Güçlüğü, Diskalkuli, Disgrafi, Otizm Spektrumu Eğitsel Profili, Dil ve Konuşma, Dikkat / Yürütücü İşlevler, Gelişimsel Gecikme, Bilişsel / Öğrenme Hızı ve Karma Profil ana başlangıç ekranına bağlanır.

## 5. Ortak kapanış zinciri
Başlangıç Değerlendirmesi → Öğrenme Profili → Eğitimci Onaylı Program → Günlük Çalışma → Yeniden Ölçüm → Veli Raporu → Paket/Yetki zinciri tek merkezi öğrenci kaydında birleşir.

## Güvenlik kuralı
AppDeploy canlı uygulaması, GitHub entegrasyonu kabul edilene kadar silinmez veya kaynak olarak kaybedilmez.
