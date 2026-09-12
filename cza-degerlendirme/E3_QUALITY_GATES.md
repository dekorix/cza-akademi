# CZA E3 (36–48 Ay) — Kalite Kapıları

Bu belge E3 geliştirmesinde pazarlık konusu olmayan kabul kriteridir. Bir ekran veya görev bu kriterlerden biriyle çelişiyorsa tamamlanmış sayılmaz.

## 1. Kurumsal arayüz standardı
- Mobilde ana gövde metni 16 px altına düşmez; kritik yönerge ve eylemler 18–24 px bandındadır.
- Hiyerarşi tek bakışta okunur: kurum/oturum > alan > alt beceri > görev > kanıt.
- Her bölümün sınırı, başlığı, durum etiketi ve ilerleme göstergesi nettir; rastgele kart yığını kullanılmaz.
- Aynı tür veriler aynı grid, boşluk, kenarlık, radius ve tipografi sistemini kullanır.
- Renk, doğru/yanlış mesajı sızdırmaz. Çocuk ekranında seçim rengi yalnız “seçildi” anlamına gelir.
- Çocuk ekranı ile eğitimci kanıt paneli görsel ve işlevsel olarak ayrıdır.
- Mobil, tablet ve masaüstü aynı bilgi mimarisini korur; hiçbirinde dev boşluk, taşma veya küçük punto kabul edilmez.

## 2. Ölçme ve pedagojik standardı
- Her alan tek soruyla değil, birden çok alt beceri ve zorluk katmanıyla ölçülür.
- Görev sırası: tanıdık giriş > ayırt edici temel > iki özellik/iki adım > yeni bağlam > transfer/keşif.
- Soru bankası geniş tutulur; çocuk tüm bankayı çözmez. Yaş, performans, yardım düzeyi ve kanıt yeterliliğine göre adaptif rota seçilir.
- Sonuç yalnız doğru/yanlış değildir: ilk seçim, gecikme, dokunuş, strateji, bağımsızlık, yardım düzeyi, öz-düzeltme, açıklama, transfer ve davranışsal gözlem birlikte tutulur.
- Tavan/keşif görevleri nötrdür; yapılamaması düşük performans olarak puanlanmaz.
- Motor, oyun, dil ve özbakım gibi ekranla güvenilir ölçülemeyen beceriler gerçek materyal/doğrudan gözlem protokolüyle yürütülür.
- Norm, tanı, gelişim yaşı veya klinik hüküm üretilmez; kanıt temelli betimleyici profil üretilir.

## 3. Ayırt edicilik standardı
- Distraktörler bariz yanlış seçenekler değildir; aynı kavramsal aile içinde makul ama ayırt edici olmalıdır.
- Tek görsel ipucuyla cevap verilebilen sorular azaltılır; gerektiğinde renk, biçim, konum ve işlev kontrollü olarak ayrıştırılır.
- Bir alt beceride en az iki farklı bağlamdan kanıt aranır; tek başarı genellenmez.
- Aynı cevabı ezberleterek tekrar eden paralel maddeler kullanılmaz.

## 4. Mühendislik standardı
- E3 içerik bankası, rota motoru, kanıt modeli ve UI birbirinden ayrılır; tek dev dosyada karışık iş mantığı kabul edilmez.
- Görevler kararlı kimlik taşır; sürüm değişse de eski kanıt kayıtları yorumlanabilir kalır.
- Durum saklama, yarım oturuma devam, nötr geçme, bölüm tamamlama ve rapor üretimi test edilir.
- Yaş kapıları ve adaptif dallanma deterministik testlerle doğrulanır.
- Üretim dağıtımı, bütün E3 bankası + arayüz + test paketi tamamlanmadan yapılmaz.

## 5. Tamamlanma tanımı
Bir alan ancak şu dört çıktı birlikte hazırsa biter: (1) geniş görev bankası, (2) adaptif rota, (3) çocuk/eğitimci ekranları, (4) alan özetleme ve kanıt testi. Görsel olarak “güzel” ama ölçme gücü düşük ekran tamamlanmış sayılmaz; ölçme gücü yüksek ama düzensiz/amatör arayüz de tamamlanmış sayılmaz.
