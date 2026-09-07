# CZA canlıya çıkış kontrolü

Bu kaynak, Çelik Anzan / Çelik Zihin Akademisi uygulamasının teknik kontrol listesidir. Genel öğrenci ve eğitimci yayını, aşağıdaki maddeler kanıtlanmadan yapılmaz.

## Kimlik ve kayıt

- Öğrenci PIN doğrulaması merkezi öğrenci kayıt hizmetinde yapılır.
- Eğitimci Kampüsü kendi oturumunu sunucu tarafında doğrular; eğitimci oturum anahtarı elle girilen kalıcı bir arayüz alanı olmaz.
- Öğrenci kampüs kodu ile merkezi kimlik eşleştirmesi veritabanında tutulur. Kaynak kodda öğrenciye özel dönüşüm bulunmaz.
- Öğrenci, eğitimci ve veli rolleri için yetki matrisi yazılı olarak onaylanır.

## Ortam ve güvenlik

- Geliştirme, önizleme ve canlı servis adresleri ayrı tutulur.
- Tüm gizli değerler barındırma ortamındaki gizli değer deposunda tutulur; GitHub'a veya tarayıcıya gönderilmez.
- Giriş, rapor ve ses uçlarında merkezi veya kenar katmanında istek sınırı vardır.
- Güvenlik başlıkları, hata kaydı ve sağlık kontrolü canlı ortamda doğrulanır.

## Veri ve süreklilik

- Seans başlatma, soru kaydı, seans bitirme ve eğitimci raporu gerçek bir öğrenci hesabıyla birlikte test edilir.
- Yedekleme sıklığı, geri alma sorumlusu ve geri dönüş süresi yazılıdır.
- Tarayıcıdaki kısa süreli pilot verisi merkezi öğrenci kaydı sayılmaz.
- Ses dosyaları kalıcı, sürümlü ve erişim kontrollü depolamada önbelleklenir.

## Yayın kapısı

- Otomatik testler ve üretim derlemesi geçer.
- Mobilde parmak, soroban, haptik ve ses akışı denenir.
- Eğitimci raporunda doğru, yanlış, süre aşımı ve reddedilen parmak dokunuşu görünür.
- Geri alma adımı uygulanarak prova edilir.
