const CZA_CONFIG = Object.freeze({
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('CZA_SPREADSHEET_ID') || '',
  STUDENTS_SHEET: 'OGRENCI_LISTESI',
  QUESTIONS_SHEET: 'CZA_SORU_BANKASI',
  ANSWERS_SHEET: 'CZA_CEVAPLAR',
  MASTERY_SHEET: 'CZA_KAZANIM_DURUMLARI',
  SKILL_SCORES_SHEET: 'BECERI_PUANLARI',
  HOLISTIC_SKILLS_SHEET: 'CZA_BECERI_HARITASI',
  CONTENT_CATALOG_SHEET: 'CZA_ICERIK_KATALOGU',
  CAMPUS_STATE_SHEET: 'CZA_KAMPUS_DURUMU',
  EDUCATORS_SHEET: 'CZA_EGITIMCI_LISTESI',
  DOCUMENTS_SHEET: 'CZA_BELGE_KUTUPHANESI',
  ASSIGNMENTS_SHEET: 'CZA_ICERIK_ATAMALARI',
  CONTENT_PROGRESS_SHEET: 'CZA_ICERIK_ILERLEME',
  INTERVENTIONS_SHEET: 'CZA_MUDAHALE_PLANLARI',
  INTERVENTION_HISTORY_SHEET: 'CZA_MUDAHALE_GECMISI',
  WEEKLY_REPORT_ARCHIVE_SHEET: 'CZA_HAFTALIK_RAPOR_ARSIVI',
  WORKSHOP_SESSIONS_SHEET: 'CZA_ATOLYE_SEANSLARI',
  WORKSHOP_ASSIGNMENTS_SHEET: 'CZA_ATOLYE_ATAMALARI',
  EDUCATOR_ASSESSMENTS_SHEET: 'CZA_EGITMEN_DEGERLENDIRMELERI',
  CONTENT_FOLDER_NAME: 'CZA_Dijital_Akademi_Belgeleri',
  CONTENT_FOLDER_PROPERTY: 'cza_content_folder_id',
  MAX_UPLOAD_BYTES: 5242880,
  SESSION_PREFIX: 'cza_student_session_',
  SESSION_SECONDS: 21600,
  EDUCATOR_SESSION_PREFIX: 'cza_educator_session_',
  EDUCATOR_SESSION_SECONDS: 14400,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_WINDOW_SECONDS: 600,
});

const CZA_HEADERS = Object.freeze({
  workshopAssignments: [
    'Atama ID', 'Öğrenci Kodu', 'Modül', 'Beceri ID', 'İçerik ID',
    'İçerik Sürümü', 'Durum', 'Başlangıç', 'Bitiş', 'Atayan Eğitimci',
    'Atama Zamanı', 'Not',
  ],
  workshopSessions: [
    'Seans ID', 'Öğrenci Kodu', 'Modül', 'Beceri ID', 'İçerik ID',
    'İçerik Sürümü', 'Durum', 'Başlangıç', 'Güncelleme', 'Bitiş', 'Seans JSON',
  ],
  questions: [
    'Soru ID', 'Ders', 'Kazanım', 'Seviye', 'Soru',
    'A', 'B', 'C', 'D', 'Doğru Cevap', 'Açıklama', 'Aktif',
  ],
  answers: [
    'Zaman', 'Öğrenci Kodu', 'Soru ID', 'Ders', 'Kazanım',
    'Cevap', 'Doğru Mu', 'Süre (sn)', 'Deneme ID',
  ],
  mastery: [
    'Öğrenci Kodu', 'Ders', 'Kazanım', 'Son 3 Doğru',
    'Son 3 Toplam', 'Başarı', 'Durum', 'Son Güncelleme',
  ],
  holisticSkills: [
    'Beceri ID', 'Ana Alan', 'Beceri Alanı', 'Kısa Açıklama',
    'CZA Yöntemleri', 'Önerilen Modüller', 'Paket', 'Sıra', 'Renk', 'Aktif',
  ],
  contentCatalog: [
    'İçerik ID', 'Beceri ID', 'Beceri Alanı', 'Aşama', 'İçerik Başlığı',
    'İçerik Türü', 'Seviye', 'Süre (dk)', 'Modül', 'Paket',
    'Durum', 'İçerik Referansı', 'Açıklama',
  ],
  campusState: [
    'Öğrenci Kodu', 'İlk Giriş', 'Son Giriş', 'Tanıtım Tamamlandı',
    'Aktif Rota', 'Tamamlanan Görev',
  ],
  educators: [
    'Eğitimci Kodu', 'Ad Soyad', 'Rol', 'Giriş PIN', 'Aktif',
  ],
  documents: [
    'Belge ID', 'Drive Dosya ID', 'Kaynak Türü', 'Kaynak URL', 'Dosya Adı',
    'MIME Türü', 'Boyut (bayt)', 'İçerik Başlığı', 'Sınıf', 'Ders', 'Konu',
    'Kazanım', 'Beceri ID', 'Beceri Alanı', 'Aşama', 'Süre (dk)', 'Paket',
    'Durum', 'Eğitimci Kodu', 'Oluşturma', 'Güncelleme', 'Açıklama',
  ],
  assignments: [
    'Atama ID', 'Belge ID', 'Hedef Türü', 'Hedef Değer', 'Başlangıç',
    'Bitiş', 'Durum', 'Atayan Eğitimci', 'Atama Zamanı', 'Not',
  ],
  contentProgress: [
    'Öğrenci Kodu', 'Belge ID', 'Atama ID', 'Durum', 'İlk Açılış',
    'Son Açılış', 'Tamamlanma', 'Açılış Sayısı', 'Son Güncelleme',
  ],
  interventions: [
    'Müdahale ID', 'Öğrenci Kodu', 'Müdahale Türü', 'Başlık', 'Açıklama',
    'Öncelik', 'Durum', 'Plan Tarihi', 'Kontrol Tarihi', 'Tamamlanma',
    'Eğitimci Kodu', 'Son Güncelleme', 'Başarı Ölçütü', 'Sonuç Düzeyi',
    'Sonuç Notu', 'Sonraki Adım', 'Sonuç Tarihi',
  ],
  interventionHistory: [
    'Geçmiş ID', 'Müdahale ID', 'Öğrenci Kodu', 'Olay Türü',
    'Önceki Durum', 'Yeni Durum', 'Eğitimci Notu', 'Sonuç Düzeyi',
    'Kontrol Tarihi', 'Eğitimci Kodu', 'Zaman',
  ],
  weeklyReportArchive: [
    'Rapor ID', 'Dönem Başlangıcı', 'Dönem Bitişi', 'Toplam Öğrenci',
    'Aktif Öğrenci', 'Toplam Cevap', 'Ortalama Doğruluk',
    'Tamamlanan Müdahale', 'Takip Kaydı', 'Hazırlayan',
    'Arşiv Zamanı', 'Rapor JSON',
  ],
  educatorAssessments: [
    'Değerlendirme ID', 'Öğrenci Kodu', 'Form', 'Durum', 'Uygulama Tarihi',
    'Eğitimci Kodu', 'Oluşturma', 'Güncelleme', 'Tamamlanma',
    'Değerlendirme JSON', 'Kısa Özet',
  ],
});

function doGet(event) {
  const portal = event && event.parameter
    ? String(event.parameter.portal || '').toLowerCase()
    : '';
  const educatorMode = portal === 'educator' || portal === 'egitimci';
  return HtmlService.createTemplateFromFile(educatorMode ? 'Egitimci' : 'Index')
    .evaluate()
    .setTitle(educatorMode ? 'CZA Eğitimci Kontrol Merkezi' : 'CZA Öğrenci Akademisi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Run once before publishing the web app. It creates only CZA-prefixed
 * backend sheets and adds a PIN column to the existing student list.
 */
function setupCzaOgrenciApp() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getSpreadsheet_();
    const students = ss.getSheetByName(CZA_CONFIG.STUDENTS_SHEET);
    if (!students) {
      throw new Error('OGRENCI_LISTESI sayfası bulunamadı.');
    }

    ensureStudentPins_(students);
    const questions = ensureSheet_(ss, CZA_CONFIG.QUESTIONS_SHEET, CZA_HEADERS.questions);
    ensureSheet_(ss, CZA_CONFIG.ANSWERS_SHEET, CZA_HEADERS.answers);
    ensureSheet_(ss, CZA_CONFIG.MASTERY_SHEET, CZA_HEADERS.mastery);
    const holisticSkills = ensureSheet_(
      ss, CZA_CONFIG.HOLISTIC_SKILLS_SHEET, CZA_HEADERS.holisticSkills
    );
    const contentCatalog = ensureSheet_(
      ss, CZA_CONFIG.CONTENT_CATALOG_SHEET, CZA_HEADERS.contentCatalog
    );
    ensureSheet_(ss, CZA_CONFIG.CAMPUS_STATE_SHEET, CZA_HEADERS.campusState);
    const educators = ensureSheet_(ss, CZA_CONFIG.EDUCATORS_SHEET, CZA_HEADERS.educators);
    const documents = ensureSheet_(ss, CZA_CONFIG.DOCUMENTS_SHEET, CZA_HEADERS.documents);
    const assignments = ensureSheet_(ss, CZA_CONFIG.ASSIGNMENTS_SHEET, CZA_HEADERS.assignments);
    const contentProgress = ensureSheet_(
      ss, CZA_CONFIG.CONTENT_PROGRESS_SHEET, CZA_HEADERS.contentProgress
    );
    const interventions = ensureSheet_(
      ss, CZA_CONFIG.INTERVENTIONS_SHEET, CZA_HEADERS.interventions
    );
    const interventionHistory = ensureSheet_(
      ss, CZA_CONFIG.INTERVENTION_HISTORY_SHEET, CZA_HEADERS.interventionHistory
    );
    const weeklyReportArchive = ensureSheet_(
      ss, CZA_CONFIG.WEEKLY_REPORT_ARCHIVE_SHEET, CZA_HEADERS.weeklyReportArchive
    );
    const workshopAssignments = ensureSheet_(
      ss, CZA_CONFIG.WORKSHOP_ASSIGNMENTS_SHEET, CZA_HEADERS.workshopAssignments
    );
    const educatorAssessments = ensureSheet_(
      ss, CZA_CONFIG.EDUCATOR_ASSESSMENTS_SHEET, CZA_HEADERS.educatorAssessments
    );
    seedQuestions_(questions);
    seedHolisticSkills_(holisticSkills);
    seedContentCatalog_(contentCatalog);
    seedEducatorAccount_(educators);

    return {
      ok: true,
      message: 'CZA Öğrenci Akademisi veri yapısı hazır.',
      questionCount: Math.max(questions.getLastRow() - 1, 0),
      holisticSkillCount: Math.max(holisticSkills.getLastRow() - 1, 0),
      contentCount: Math.max(contentCatalog.getLastRow() - 1, 0),
      educatorCount: Math.max(educators.getLastRow() - 1, 0),
      documentCount: Math.max(documents.getLastRow() - 1, 0),
      assignmentCount: Math.max(assignments.getLastRow() - 1, 0),
      contentProgressCount: Math.max(contentProgress.getLastRow() - 1, 0),
      interventionCount: Math.max(interventions.getLastRow() - 1, 0),
      interventionHistoryCount: Math.max(interventionHistory.getLastRow() - 1, 0),
      weeklyReportArchiveCount: Math.max(weeklyReportArchive.getLastRow() - 1, 0),
      workshopAssignmentCount: Math.max(workshopAssignments.getLastRow() - 1, 0),
      educatorAssessmentCount: Math.max(educatorAssessments.getLastRow() - 1, 0),
    };
  } finally {
    lock.releaseLock();
  }
}

function loginStudent(studentCode, pin) {
  const code = normalizeCode_(studentCode);
  const cleanPin = String(pin || '').trim();
  if (!code || !/^\d{6}$/.test(cleanPin)) {
    throw new Error('Öğrenci kodu ve 6 haneli PIN gereklidir.');
  }

  const cache = CacheService.getScriptCache();
  const attemptKey = 'cza_login_attempts_' + Utilities.base64EncodeWebSafe(code).slice(0, 80);
  const failedAttempts = Number(cache.get(attemptKey) || 0);
  if (failedAttempts >= CZA_CONFIG.MAX_LOGIN_ATTEMPTS) {
    throw new Error('Çok fazla hatalı deneme yapıldı. 10 dakika sonra yeniden deneyin.');
  }

  const student = findStudent_(code);
  if (!student || student.pin !== cleanPin) {
    cache.put(
      attemptKey,
      String(failedAttempts + 1),
      CZA_CONFIG.LOGIN_WINDOW_SECONDS
    );
    throw new Error('Öğrenci kodu veya PIN hatalı.');
  }

  cache.remove(attemptKey);
  const token = Utilities.getUuid();
  cache.put(
    CZA_CONFIG.SESSION_PREFIX + token,
    JSON.stringify({ code: student.code, name: student.name }),
    CZA_CONFIG.SESSION_SECONDS
  );

  recordCampusLogin_(student.code);

  return {
    token: token,
    student: publicStudent_(student),
    dashboard: getDashboardForCode_(student.code),
  };
}

function logoutStudent(token) {
  if (token) {
    CacheService.getScriptCache().remove(CZA_CONFIG.SESSION_PREFIX + token);
  }
  return { ok: true };
}

function loginEducator(educatorCode, pin) {
  const code = normalizeEducatorCode_(educatorCode);
  const cleanPin = String(pin || '').trim();
  if (!code || !/^\d{8}$/.test(cleanPin)) {
    throw new Error('Eğitimci kodu ve 8 haneli PIN gereklidir.');
  }

  const cache = CacheService.getScriptCache();
  const attemptKey = 'cza_educator_login_attempts_'
    + Utilities.base64EncodeWebSafe(code).slice(0, 80);
  const failedAttempts = Number(cache.get(attemptKey) || 0);
  if (failedAttempts >= CZA_CONFIG.MAX_LOGIN_ATTEMPTS) {
    throw new Error('Çok fazla hatalı deneme yapıldı. 10 dakika sonra yeniden deneyin.');
  }

  const educator = findEducator_(code);
  if (!educator || educator.pin !== cleanPin) {
    cache.put(attemptKey, String(failedAttempts + 1), CZA_CONFIG.LOGIN_WINDOW_SECONDS);
    throw new Error('Eğitimci kodu veya PIN hatalı.');
  }

  cache.remove(attemptKey);
  const token = Utilities.getUuid();
  cache.put(
    CZA_CONFIG.EDUCATOR_SESSION_PREFIX + token,
    JSON.stringify({ code: educator.code, name: educator.name, role: educator.role }),
    CZA_CONFIG.EDUCATOR_SESSION_SECONDS
  );
  return {
    token: token,
    educator: publicEducator_(educator),
    dashboard: getEducatorDashboardData_(),
  };
}

function logoutEducator(token) {
  if (token) {
    CacheService.getScriptCache().remove(CZA_CONFIG.EDUCATOR_SESSION_PREFIX + token);
  }
  return { ok: true };
}

function getEducatorDashboard(token) {
  requireEducatorSession_(token);
  return getEducatorDashboardData_();
}

function getEducatorOperations(token) {
  requireEducatorSession_(token);
  const dashboard = getEducatorDashboardData_();
  return {
    generatedAt: dashboard.generatedAt,
    interventionCenter: dashboard.interventionCenter,
    weeklyReport: dashboard.weeklyReport,
  };
}

function getEducatorStudentDetail(token, studentCode) {
  requireEducatorSession_(token);
  const student = findStudent_(normalizeCode_(studentCode));
  if (!student) throw new Error('Öğrenci bulunamadı.');
  const dashboard = getDashboardForCode_(student.code);
  return {
    student: publicStudent_(student),
    risk: getEducatorStudentRisk_(student.code, dashboard),
    profile: dashboard.holisticProfile,
    dailyRoute: dashboard.dailyRoute,
    learning: {
      totalAnswers: dashboard.totalAnswers,
      totalCorrect: dashboard.totalCorrect,
      accuracy: dashboard.accuracy,
      streak: dashboard.streak,
      todayAnswers: dashboard.todayAnswers,
      mastery: dashboard.skills,
      weeklyActivity: dashboard.weeklyActivity,
    },
    assignedContent: dashboard.assignedContent,
    workshopAssignments: getWorkshopAssignmentsForStudent_(student.code, true),
    interventions: getEducatorInterventionsForStudent_(student.code),
    recentAnswers: getRecentStudentAnswers_(student.code, 10),
    workshopSessions: getWorkshopHistory_(student.code, 10),
    educatorAssessments: getEducatorAssessmentWorkspace_(student.code),
  };
}

function educatorAssessmentSchema_() {
  return {
    version: 1,
    title: 'CZA Standart Öğrenci Değerlendirme Uygulama Seti',
    subtitle: 'Eğitimsel performans taraması • Eğitmen uygulama ve kayıt alanı',
    warning: 'Bu çalışma klinik veya psikolojik tanı koymaz. Ham süreler yaş/sınıf normları oluşana kadar otomatik 1-5 puana çevrilmez.',
    standardization: 'Aynı görev, aynı yönerge, aynı süre kuralı ve aynı puanlama ölçütü kullanılmalıdır.',
    forms: [
      { id: 'A', label: 'Form A • Başlangıç değerlendirmesi' },
      { id: 'B', label: 'Form B • Aylık / ara yeniden değerlendirme' },
      { id: 'C', label: 'Form C • Kontrol / dönem sonu değerlendirmesi' },
    ],
    mental: {
      title: 'Zihinsel İşlem Hızı',
      note: 'Çocuğa hız baskısı yapılmaz; kronometre sessizce tutulur. Süre, doğruluk, strateji ve bağımsızlık birlikte kaydedilir.',
      tasks: [
        {
          id: 'addition', title: '2A • 20 Tek Haneli Toplama', maxCorrect: 20,
          instruction: 'İşlemleri sırayla yap. Yapabildiğin kadar doğru çalış. Bir soruyu bilmiyorsan geçebiliriz.',
          items: [
            ['3 + 4', 7], ['5 + 2', 7], ['6 + 3', 9], ['4 + 5', 9], ['7 + 2', 9],
            ['8 + 1', 9], ['6 + 4', 10], ['7 + 3', 10], ['8 + 2', 10], ['9 + 1', 10],
            ['5 + 6', 11], ['7 + 5', 12], ['8 + 4', 12], ['9 + 3', 12], ['6 + 7', 13],
            ['8 + 5', 13], ['9 + 5', 14], ['7 + 8', 15], ['9 + 7', 16], ['8 + 9', 17],
          ],
        },
        {
          id: 'subtraction', title: '2B • 15 Tek Haneli Çıkarma', maxCorrect: 15,
          instruction: 'Aynı uygulama ve kronometre kuralını kullanın.',
          items: [
            ['7 - 3', 4], ['9 - 2', 7], ['8 - 5', 3], ['6 - 4', 2], ['5 - 1', 4],
            ['9 - 6', 3], ['8 - 3', 5], ['7 - 5', 2], ['6 - 2', 4], ['9 - 4', 5],
            ['8 - 6', 2], ['7 - 2', 5], ['5 - 3', 2], ['9 - 7', 2], ['8 - 4', 4],
          ],
        },
        {
          id: 'sequential', title: '2C • 10 Ardışık İşlem', maxCorrect: 10,
          instruction: 'Çocuk işlemleri mümkün olduğunca zihinden sürdürür; işlem sırası ve dış destek ayrıca gözlenir.',
          items: [
            ['4 + 3 - 2', 5], ['6 - 2 + 5', 9], ['3 + 5 - 4', 4], ['8 - 3 + 2', 7], ['7 + 2 - 5', 4],
            ['5 + 4 - 3 + 2', 8], ['9 - 4 + 3 - 2', 6], ['6 + 2 - 5 + 4', 7], ['8 - 2 + 1 - 3', 4], ['7 + 1 - 4 + 5', 9],
          ],
        },
      ],
      fluencyRubric: [
        [1, 'Yoğun yardım olmadan sürdüremiyor.'],
        [2, 'Sık yardım, parmak/nesne desteği ve uzun duraksamalar var.'],
        [3, 'Genel olarak yapıyor; ara sıra destek gerekiyor.'],
        [4, 'Büyük ölçüde zihinden ve bağımsız ilerliyor.'],
        [5, 'Akıcı, bağımsız ve dış desteğe ihtiyaç duymuyor.'],
      ],
    },
    auditory: {
      title: 'İşitsel Dikkat ve Hafıza',
      note: 'Sayı dizilerini saniyede yaklaşık bir rakam hızında, aynı ton ve hızla okuyun; ek ipucu vermeyin.',
      forward: [
        [2, '4-7', '6-2'], [3, '3-8-1', '7-2-9'], [4, '5-1-8-3', '9-4-2-7'],
        [5, '6-1-9-3-8', '2-7-4-9-5'], [6, '8-3-1-7-4-9', '5-9-2-6-1-8'],
        [7, '4-9-1-6-3-8-2', '7-2-8-5-1-9-4'], [8, '6-2-9-4-1-7-3-8', '3-8-1-5-9-2-7-4'],
      ],
      backward: [
        [2, '3-8', '6-1'], [3, '4-1-7', '9-2-5'], [4, '6-3-9-2', '8-1-4-7'],
        [5, '2-8-5-1-9', '7-4-1-6-3'], [6, '9-2-7-4-1-8', '5-1-8-3-9-6'],
      ],
      oralOperations: [
        ['6 + 3', 9], ['9 - 4', 5], ['7 + 5', 12], ['13 - 6', 7], ['4 + 8', 12],
        ['15 - 7', 8], ['6 + 5 - 3', 8], ['12 - 4 + 2', 10], ['7 + 6 - 5', 8], ['18 - 9 + 4', 13],
      ],
      instructions: [
        [1, 'Kalemi eline al.'],
        [2, 'Kalemi masaya bırak ve silgiyi bana göster.'],
        [3, 'Kâğıda bir yıldız çiz, kalemi bırak ve ellerini masaya koy.'],
        [4, 'Kâğıdı çevir, sol alt tarafa bir daire çiz, adını söyle ve kâğıdı tekrar çevir.'],
        [5, 'Kalemi al, kâğıdın ortasına bir kare çiz, karenin içine bir nokta koy, silgiyi kâğıdın soluna koy ve ellerini masaya bırak.'],
      ],
      attentionSequence: '3 - 7 - 1 - 5 - 2 - 7 - 9 - 4 - 7 - 6 - 2 - 8 - 7 - 1 - 3 - 5 - 9 - 4 - 6 - 7 - 2 - 1 - 7 - 8 - 3 - 5 - 2 - 7 - 9 - 1 - 4 - 6 - 3 - 8 - 7 - 2 - 5 - 1 - 9 - 6',
      targetCount: 8,
    },
    reading: {
      title: 'Bireysel Okuma',
      forms: [
        ['1-2. sınıf', 'CZA Okuma Metni A'], ['3-4. sınıf', 'CZA Okuma Metni B'],
        ['5-6. sınıf', 'CZA Okuma Metni C'], ['7-8. sınıf', 'CZA Okuma Metni D'],
      ],
      note: 'Sınıfa uygun metin ve cevap anahtarları ayrı içerik paketi olarak hazırlanacaktır; farklı sınıflara tek ortak metin uygulanmamalıdır.',
    },
    attention: {
      title: 'Dikkat ve Odaklanma Gözlemi',
      items: [
        ['taskStart', 'Göreve başlama'], ['taskSustain', 'Görevi sürdürme'],
        ['distractionResistance', 'Dikkat dağıtıcılara direnme'], ['refocusAfterError', 'Hata sonrası yeniden odaklanma'],
        ['completionPersistence', 'Görevi tamamlama ısrarı'], ['followInstruction', 'Yönergeyi sonuna kadar takip etme'],
      ],
      sustainRubric: [
        [1, 'Çok sık bırakıyor; 4 veya daha fazla yeniden yönlendirme gerekiyor.'],
        [2, '3-4 kez yeniden yönlendirme gerekiyor.'], [3, '2 kez yeniden yönlendirme gerekiyor.'],
        [4, 'En fazla 1 kısa hatırlatma gerekiyor.'], [5, 'Baştan sona bağımsız sürdürüyor.'],
      ],
    },
    selfRegulation: {
      title: 'Çalışma Davranışları ve Öz Düzenleme',
      note: 'Tek oturumdan karakter etiketi çıkarılmaz; yalnız oturumda gözlenen davranış kaydedilir.',
      items: [
        ['patience', 'Sabır gösterme'], ['responsibility', 'Görev sorumluluğu alma'],
        ['errorCorrection', 'Hatasını kabul edip düzeltme'], ['ruleFollowing', 'Kurala uyma'],
        ['notAbandoning', 'Çalışmayı yarıda bırakmama'], ['independentAttempt', 'Yardım almadan önce kendi çözümünü deneme'],
      ],
      delayedRewardOptions: [
        'Ödülü bekleyebildi', 'Kısa süre bekleyebildi', 'Yoğun hatırlatmayla bekledi',
        'Beklemekte belirgin zorlandı', 'Uygulanmadı',
      ],
    },
    noteFields: [
      ['strengths', 'Öğrencinin en güçlü gözlenen alanları'],
      ['supportNeeds', 'En çok desteklenmesi gereken alanlar'],
      ['pattern', 'Dikkat çeken davranış / strateji / hata örüntüsü'],
      ['nextTarget', 'Bir sonraki çalışma için önerilen hedef'],
    ],
  };
}

function getEducatorAssessmentWorkspace_(studentCode) {
  const code = normalizeCode_(studentCode);
  return {
    schema: educatorAssessmentSchema_(),
    records: readEducatorAssessmentRows_().filter(function (item) {
      return item.studentCode === code;
    }).sort(function (left, right) {
      return right.updatedAtMs - left.updatedAtMs;
    }).slice(0, 12).map(publicEducatorAssessment_),
  };
}

function getEducatorAssessmentWorkspace(token, studentCode) {
  requireEducatorSession_(token);
  const student = findStudent_(normalizeCode_(studentCode));
  if (!student) throw new Error('Öğrenci bulunamadı.');
  return getEducatorAssessmentWorkspace_(student.code);
}

function saveEducatorAssessment(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = validateEducatorAssessmentPayload_(payload || {});
  const student = findStudent_(data.studentCode);
  if (!student) throw new Error('Öğrenci bulunamadı.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.EDUCATOR_ASSESSMENTS_SHEET,
      CZA_HEADERS.educatorAssessments
    );
    const now = new Date();
    let rowNumber = 0;
    let createdAt = now;
    if (data.id && sheet.getLastRow() >= 2) {
      const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
      for (let index = 0; index < ids.length; index += 1) {
        if (String(ids[index][0]) === data.id) {
          if (normalizeCode_(ids[index][1]) !== student.code) {
            throw new Error('Değerlendirme kaydı bu öğrenciye ait değil.');
          }
          if (String(ids[index][3]) === 'TAMAMLANDI') {
            throw new Error('Tamamlanmış değerlendirme değiştirilemez; yeni paralel form açın.');
          }
          rowNumber = index + 2;
          const existingCreated = sheet.getRange(rowNumber, 7).getValue();
          if (existingCreated instanceof Date) createdAt = existingCreated;
          break;
        }
      }
      if (!rowNumber) throw new Error('Güncellenecek değerlendirme kaydı bulunamadı.');
    }
    const assessmentId = data.id || createCzaId_('DEGERLENDIRME');
    const completedAt = data.status === 'TAMAMLANDI' ? now : '';
    const row = [[
      assessmentId, safeSheetValue_(student.code), data.form, data.status,
      data.applicationDate, educator.code, createdAt, now, completedAt,
      safeSheetValue_(JSON.stringify(data.data)),
      safeSheetValue_(educatorAssessmentSummary_(data)),
    ]];
    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, CZA_HEADERS.educatorAssessments.length).setValues(row);
    } else {
      sheet.appendRow(row[0]);
    }
    return {
      ok: true,
      message: data.status === 'TAMAMLANDI'
        ? 'Eğitimci değerlendirmesi tamamlandı ve öğrenci dosyasına bağlandı.'
        : 'Eğitimci değerlendirmesi taslak olarak kaydedildi.',
      workspace: getEducatorAssessmentWorkspace_(student.code),
    };
  } finally {
    lock.releaseLock();
  }
}

function validateEducatorAssessmentPayload_(payload) {
  const studentCode = normalizeCode_(payload.studentCode);
  const id = cleanContentText_(payload.id, 90);
  const form = cleanContentText_(payload.form, 3).toUpperCase();
  const status = cleanContentText_(payload.status, 20).toLocaleUpperCase('tr-TR');
  if (!studentCode) throw new Error('Değerlendirme için öğrenci seçin.');
  if (['A', 'B', 'C'].indexOf(form) === -1) throw new Error('Geçerli bir değerlendirme formu seçin.');
  if (['TASLAK', 'TAMAMLANDI'].indexOf(status) === -1) {
    throw new Error('Değerlendirme durumu taslak veya tamamlandı olmalıdır.');
  }
  const dateText = cleanContentText_(payload.applicationDate, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error('Uygulama tarihi geçerli değil.');
  const applicationDate = new Date(dateText + 'T12:00:00');
  if (Number.isNaN(applicationDate.getTime())) throw new Error('Uygulama tarihi geçerli değil.');
  const normalized = sanitizeEducatorAssessmentData_(payload.data || {});
  if (status === 'TAMAMLANDI') {
    if (assessmentEvidenceCount_(normalized) < 8) {
      throw new Error('Tamamlamak için yeterli görev sonucu veya gözlem kaydı girin.');
    }
    if (normalized.notes.nextTarget.length < 5) {
      throw new Error('Tamamlamak için bir sonraki çalışma hedefini yazın.');
    }
  }
  return {
    id: id, studentCode: studentCode, form: form, status: status,
    applicationDate: applicationDate, data: normalized,
  };
}

function sanitizeEducatorAssessmentData_(source) {
  const data = source && typeof source === 'object' ? source : {};
  const mental = data.mental || {};
  const auditory = data.auditory || {};
  const reading = data.reading || {};
  const attention = data.attention || {};
  const selfRegulation = data.selfRegulation || {};
  const notes = data.notes || {};
  const sanitizeTask = function (task, maxCorrect) {
    const item = task || {};
    const normalized = {
      durationSeconds: assessmentNumberOrBlank_(item.durationSeconds, 0, 7200),
      correct: assessmentNumberOrBlank_(item.correct, 0, maxCorrect),
      wrong: assessmentNumberOrBlank_(item.wrong, 0, maxCorrect),
      skipped: assessmentNumberOrBlank_(item.skipped, 0, maxCorrect),
      fingerUse: cleanContentText_(item.fingerUse, 80),
      assistance: cleanContentText_(item.assistance, 80),
      notes: cleanContentText_(item.notes, 700),
    };
    const answeredTotal = ['correct', 'wrong', 'skipped'].reduce(function (total, key) {
      return total + (normalized[key] === '' ? 0 : normalized[key]);
    }, 0);
    if (answeredTotal > maxCorrect) {
      throw new Error('Doğru, yanlış ve boş toplamı görevdeki soru sayısını aşamaz.');
    }
    return normalized;
  };
  const attentionOut = {};
  educatorAssessmentSchema_().attention.items.forEach(function (item) {
    attentionOut[item[0]] = assessmentScoreOrNotObserved_(attention[item[0]]);
  });
  const selfOut = {};
  educatorAssessmentSchema_().selfRegulation.items.forEach(function (item) {
    selfOut[item[0]] = assessmentScoreOrNotObserved_(selfRegulation[item[0]]);
  });
  const schema = educatorAssessmentSchema_();
  const readingForms = schema.reading.forms.map(function (item) { return item[1]; });
  const oralCorrect = assessmentNumberOrBlank_(auditory.oralCorrect, 0, 10);
  const oralWrong = assessmentNumberOrBlank_(auditory.oralWrong, 0, 10);
  if ((oralCorrect === '' ? 0 : oralCorrect) + (oralWrong === '' ? 0 : oralWrong) > 10) {
    throw new Error('Sözlü işlem doğru ve yanlış toplamı 10 soruyu aşamaz.');
  }
  const targetCorrect = assessmentNumberOrBlank_(auditory.targetCorrect, 0, 8);
  const targetMissed = assessmentNumberOrBlank_(auditory.targetMissed, 0, 8);
  if ((targetCorrect === '' ? 0 : targetCorrect) + (targetMissed === '' ? 0 : targetMissed) > 8) {
    throw new Error('Doğru ve kaçırılan hedef toplamı 8 hedefi aşamaz.');
  }
  return {
    mental: {
      addition: sanitizeTask(mental.addition, 20),
      subtraction: sanitizeTask(mental.subtraction, 15),
      sequential: sanitizeTask(mental.sequential, 10),
      fluencyScore: assessmentScoreOrNotObserved_(mental.fluencyScore),
    },
    auditory: {
      forwardSpan: assessmentNumberOrBlank_(auditory.forwardSpan, 0, 8),
      backwardSpan: assessmentNumberOrBlank_(auditory.backwardSpan, 0, 6),
      oralCorrect: oralCorrect,
      oralWrong: oralWrong,
      instructionScore: assessmentScoreOrNotObserved_(auditory.instructionScore),
      targetCorrect: targetCorrect,
      targetMissed: targetMissed,
      falseResponses: assessmentNumberOrBlank_(auditory.falseResponses, 0, 40),
      notes: cleanContentText_(auditory.notes, 700),
    },
    reading: {
      form: assessmentOptionOrBlank_(reading.form, readingForms, 'Okuma metni'),
      wordCount: assessmentNumberOrBlank_(reading.wordCount, 0, 5000),
      readingSeconds: assessmentNumberOrBlank_(reading.readingSeconds, 0, 14400),
      errorCount: assessmentNumberOrBlank_(reading.errorCount, 0, 1000),
      comprehensionCorrect: assessmentNumberOrBlank_(reading.comprehensionCorrect, 0, 5),
      fluencyScore: assessmentScoreOrNotObserved_(reading.fluencyScore),
      attentionScore: assessmentScoreOrNotObserved_(reading.attentionScore),
      notes: cleanContentText_(reading.notes, 700),
    },
    attention: attentionOut,
    attentionNotes: cleanContentText_(data.attentionNotes, 1000),
    selfRegulation: selfOut,
    selfRegulationNotes: cleanContentText_(data.selfRegulationNotes, 1000),
    delayedReward: assessmentOptionOrBlank_(
      data.delayedReward, schema.selfRegulation.delayedRewardOptions, 'Gecikmeli ödül sonucu'
    ),
    delayedRewardNotes: cleanContentText_(data.delayedRewardNotes, 700),
    notes: {
      strengths: cleanContentText_(notes.strengths, 1500),
      supportNeeds: cleanContentText_(notes.supportNeeds, 1500),
      pattern: cleanContentText_(notes.pattern, 1500),
      nextTarget: cleanContentText_(notes.nextTarget, 1500),
    },
  };
}

function assessmentOptionOrBlank_(value, allowedValues, fieldLabel) {
  const text = cleanContentText_(value, 100);
  if (!text) return '';
  if ((allowedValues || []).indexOf(text) === -1) {
    throw new Error((fieldLabel || 'Seçim') + ' geçerli seçeneklerden biri olmalıdır.');
  }
  return text;
}

function assessmentNumberOrBlank_(value, minimum, maximum) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error('Değerlendirme sayısal alanlarından biri geçerli aralıkta değil.');
  }
  return Math.round(number * 100) / 100;
}

function assessmentScoreOrNotObserved_(value) {
  const text = cleanContentText_(value, 30).toLocaleUpperCase('tr-TR');
  if (!text) return '';
  if (['UYGULANMADI', 'GÖZLENMEDİ'].indexOf(text) !== -1) return text;
  const score = Number(text);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Gözlem puanı 1-5, Uygulanmadı veya Gözlenmedi olmalıdır.');
  }
  return score;
}

function assessmentEvidenceCount_(value) {
  if (value === '' || value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    return value.reduce(function (total, item) { return total + assessmentEvidenceCount_(item); }, 0);
  }
  if (typeof value === 'object') {
    return Object.keys(value).reduce(function (total, key) {
      return total + assessmentEvidenceCount_(value[key]);
    }, 0);
  }
  return 1;
}

function educatorAssessmentSummary_(item) {
  const data = item.data || {};
  const mental = data.mental || {};
  const auditory = data.auditory || {};
  const reading = data.reading || {};
  const parts = ['Form ' + item.form, item.status];
  if (mental.addition && mental.addition.correct !== '') {
    parts.push('Toplama ' + mental.addition.correct + '/20');
  }
  if (auditory.forwardSpan !== '') parts.push('İleri dizi ' + auditory.forwardSpan);
  if (reading.comprehensionCorrect !== '') parts.push('Okuma anlama ' + reading.comprehensionCorrect + '/5');
  return parts.join(' • ');
}

function readEducatorAssessmentRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.EDUCATOR_ASSESSMENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.educatorAssessments.length
  ).getValues().filter(function (row) { return row[0]; }).map(function (row) {
    let data = {};
    try { data = JSON.parse(String(row[9] || '{}').replace(/^'/, '')); } catch (error) { data = {}; }
    const updatedAt = row[7] instanceof Date ? row[7] : null;
    return {
      id: String(row[0] || ''), studentCode: normalizeCode_(row[1]),
      form: String(row[2] || ''), status: String(row[3] || ''),
      applicationDate: row[4] instanceof Date ? row[4] : null,
      educatorCode: String(row[5] || ''), createdAt: row[6] instanceof Date ? row[6] : null,
      updatedAt: updatedAt, updatedAtMs: updatedAt ? updatedAt.getTime() : 0,
      completedAt: row[8] instanceof Date ? row[8] : null,
      data: data, summary: String(row[10] || '').replace(/^'/, ''),
    };
  });
}

function publicEducatorAssessment_(item) {
  const timeZone = Session.getScriptTimeZone() || 'Europe/Istanbul';
  return {
    id: item.id, form: item.form, status: item.status,
    applicationDate: item.applicationDate instanceof Date
      ? Utilities.formatDate(item.applicationDate, timeZone, 'yyyy-MM-dd') : '',
    educatorCode: item.educatorCode,
    createdAt: formatOptionalEducatorDate_(item.createdAt),
    updatedAt: formatOptionalEducatorDate_(item.updatedAt),
    completedAt: formatOptionalEducatorDate_(item.completedAt),
    data: item.data || {}, summary: item.summary || '',
  };
}

// Original pilot texts. Published versions are immutable: add a new ID/version
// instead of editing a version used by saved sessions. Answer keys stay server-side.
function readingLibrary_() {
  return [
    {
      id: 'OKUMA-PILOT-01', version: 1, title: 'Bahçedeki Küçük Deney',
      description: 'Bir okul bahçesinde merak, gözlem ve birlikte çözüm arama.',
      paragraphs: [
        'Okulun arka bahçesinde küçük bir sebze alanı vardı. Elif ve arkadaşları, aynı gün diktikleri fasulyelerin farklı hızlarda büyüdüğünü fark etti. Bazı fideler uzun ve canlıydı; bazıları ise daha kısa kalmıştı. İlk anda daha fazla su vermenin sorunu çözeceğini düşündüler. Ancak öğretmenleri, bir değişiklik yapmadan önce neyin farklı olduğunu araştırmalarını önerdi.',
        'Grup, bahçeyi üç gün boyunca gözlemledi. Sabah, öğle ve öğleden sonra hangi bölümlerin güneş aldığını bir çizelgeye yazdılar. Toprağın nemini de aynı saatlerde kontrol ettiler. Kısa kalan fidelerin çoğu, duvarın gölgesinde duruyordu. Üstelik bu bölümdeki toprak daha uzun süre nemli kalıyordu. Bu yüzden bütün fidelere daha çok su vermekten vazgeçtiler.',
        'Bir sonraki adımda iki benzer fideyi ayrı saksılara aldılar. Saksılardan birini güneşli bir yere, diğerini eski yerine koydular. Toprak miktarını ve sulama düzenini aynı tuttular. Böylece yalnızca güneş alan yerin etkisini gözlemlemeye çalıştılar. Elif, her gün aynı saatte fidelerin boyunu ölçtü; arkadaşı Deniz sonuçları kaydetti.',
        'Bir hafta sonra güneşli yerdeki fide daha fazla uzamıştı. Çocuklar bu sonucu bütün bitkiler için kesin bir kural saymadı. Deneyi başka fidelerle tekrarlamaya karar verdiler. Bahçedeki sorun henüz tamamen çözülmemişti ama artık tahmin etmek yerine gözlem yaparak ilerliyorlardı. Hazırladıkları çizelgeyi de sonraki grubun kullanması için sınıfta bıraktılar.',
      ],
      questions: [
        { id: 'B1', prompt: 'Çocukların araştırmaya başlamasına ne neden oldu?', options: ['Fasulyelerin farklı hızlarda büyümesi', 'Bahçede hiç su bulunmaması', 'Bütün fidelerin kuruması', 'Çizelgenin kaybolması'], correct: 0, explanation: 'Aynı gün dikilen fasulyelerin farklı büyümesi araştırmanın başlangıcıdır.' },
        { id: 'B2', prompt: 'Neden bütün fidelere daha çok su vermekten vazgeçtiler?', options: ['Sulama işini sevmedikleri için', 'Gölgedeki toprağın zaten daha uzun süre nemli kaldığını gördükleri için', 'Fideleri sınıfa taşıdıkları için', 'Deney bittiği için'], correct: 1, explanation: 'Gözlem, kısa fidelerin bulunduğu toprağın zaten daha uzun süre nemli kaldığını gösterdi.' },
        { id: 'B3', prompt: 'Saksılarda toprak ve sulama düzeninin aynı tutulmasının amacı neydi?', options: ['Bütün fideleri aynı boya getirmek', 'Ölçüm yapmaktan kaçınmak', 'Güneş alan yerin etkisini daha açık gözlemlemek', 'Deneyi bir günde bitirmek'], correct: 2, explanation: 'Diğer koşulları aynı tutarak yerin güneş alma durumunu karşılaştırdılar.' },
        { id: 'B4', prompt: 'Metnin ana düşüncesine en uygun ifade hangisidir?', options: ['İlk tahmin her zaman doğrudur.', 'Bir sonuç bütün bitkilere uygulanmalıdır.', 'Ölçüm yapmak sorunları geciktirir.', 'Gözlem ve kontrollü denemeler çözüm arayışını destekler.'], correct: 3, explanation: 'Çocuklar ilk tahminlerini gözlemle sorguladı, koşulları karşılaştırdı ve deneyi tekrarlamayı seçti.' },
      ],
    },
    {
      id: 'OKUMA-PILOT-02', version: 1, title: 'Mahallenin Paylaşım Rafı',
      description: 'Ortak kullanılan bir kitap rafı için küçük ama işe yarayan bir düzen.',
      paragraphs: [
        'Mahalle kütüphanesinin girişine bir paylaşım rafı yerleştirilmişti. İnsanlar evlerindeki kitapları getiriyor, okumak istediklerini raftan alıyordu. İlk haftalarda raf çok ilgi gördü. Fakat zamanla bazı kitaplar uzun süre geri gelmedi; bazıları da aynı köşede hiç alınmadan bekledi. Görevli, rafı kaldırmayı düşünürken Eren başka bir yol denemeyi önerdi.',
        'Eren önce rafı kullanan birkaç kişiyle konuştu. Bazıları kitabı geri getirmek için belirli bir gün olmadığını söyledi. Bazıları ise kapaklara bakarak kendine uygun kitap seçemediğini anlattı. Eren, sorunların hepsinin insanların ilgisizliğinden kaynaklanmadığını anladı. Kullanım biçimi yeterince açık değildi ve kitaplar hakkında kısa bilgiye ihtiyaç vardı.',
        'Birlikte basit bir düzen hazırladılar. Rafın yanına kitapların nasıl paylaşılacağını anlatan bir not astılar. Her kitabın içine, konusu hakkında iki cümlelik tanıtım kartı koydular. Kitap alanlar isterse geri getirmeyi düşündükleri tarihi küçük bir karta yazabiliyordu. Bu kartlara isim veya telefon numarası eklenmiyordu. Amaç insanları izlemek değil, paylaşımı hatırlamalarını kolaylaştırmaktı.',
        'İki hafta sonra görevli, daha çok kitabın geri geldiğini fark etti. Uzun süredir bekleyen bazı kitaplar da tanıtım kartları sayesinde okuyucu bulmuştu. Yine de her sorun çözülmemişti. Eren ve arkadaşları, rafı kullananların önerilerini toplamaya devam etti. Onlara göre iyi bir düzen, bir kez kurulup unutulan değil, ihtiyaçlara göre gözden geçirilen bir düzendi.',
      ],
      questions: [
        { id: 'R1', prompt: 'Eren bir çözüm önermeden önce ne yaptı?', options: ['Bütün kitapları eve götürdü.', 'Rafı kullanan kişilerle konuştu.', 'Kütüphaneyi kapattı.', 'Kitaplara fiyat yazdı.'], correct: 1, explanation: 'Eren önce kullanıcılarla konuşarak yaşanan sorunları anlamaya çalıştı.' },
        { id: 'R2', prompt: 'Kitapların içindeki tanıtım kartları hangi ihtiyaca karşılık veriyordu?', options: ['Kitapların sayfa sayısını artırmak', 'Okuyucuların adreslerini toplamak', 'Uygun kitap seçmeyi kolaylaştırmak', 'Kitapları gizlemek'], correct: 2, explanation: 'Kısa konu bilgisi, yalnız kapağa bakarak seçim yapmakta zorlananlara yardımcı oldu.' },
        { id: 'R3', prompt: 'Geri getirme kartlarına neden isim ve telefon eklenmedi?', options: ['Amaç kişileri izlemek değil, hatırlamayı kolaylaştırmaktı.', 'Kartlarda hiç yer yoktu.', 'Bütün okuyucular birbirini tanıyordu.', 'Kitapları geri almak istemiyorlardı.'], correct: 0, explanation: 'Metin, kartların kişileri izlemek için değil hatırlatma amacıyla kullanıldığını açıklar.' },
        { id: 'R4', prompt: 'Metne göre iyi bir düzenin özelliği nedir?', options: ['Hiç değişmemesi', 'Yalnız ilk gün işe yaraması', 'Bütün önerileri reddetmesi', 'İhtiyaçlara göre gözden geçirilmesi'], correct: 3, explanation: 'Son paragrafta iyi düzenin ihtiyaçlara göre yeniden değerlendirildiği vurgulanır.' },
      ],
    },
  ];
}

function readingContent_(id, version) {
  const content = readingLibrary_().filter(function (item) {
    return item.id === id && (version == null || item.version === version);
  })[0];
  if (!content) throw new Error('Okuma içeriği veya sürümü bulunamadı. Eğitimcine bildir.');
  return content;
}

function readingWordCount_(content) {
  return content.paragraphs.join(' ').trim().split(/\s+/).length;
}

function readingRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.WORKSHOP_SESSIONS_SHEET);
  if (!sheet) return { sheet: null, entries: [] };
  const headers = sheet.getRange(1, 1, 1, CZA_HEADERS.workshopSessions.length).getDisplayValues()[0];
  if (headers.join('|') !== CZA_HEADERS.workshopSessions.join('|')) {
    throw new Error('Atölye kayıt yapısı uyuşmuyor. Veri değiştirilmedi; eğitimcine bildir.');
  }
  const entries = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, CZA_HEADERS.workshopSessions.length).getValues();
  return { sheet: sheet, entries: entries.map(function (row, index) { return { row: index + 2, values: row }; }) };
}

function readingRecord_(entry) {
  let record;
  try { record = JSON.parse(entry.values[10]); } catch (error) { throw new Error('Atölye seans kaydı okunamadı. Eğitimcine bildir.'); }
  if (!record || record.id !== entry.values[0] || normalizeCode_(record.studentCode) !== normalizeCode_(entry.values[1])) {
    throw new Error('Atölye seans kaydı tutarsız. Eğitimcine bildir.');
  }
  return record;
}

function readingOwnedEntries_(data, code) {
  return data.entries.filter(function (entry) { return normalizeCode_(entry.values[1]) === normalizeCode_(code); });
}

function workshopRecordsForStudent_(studentCode, moduleId) {
  return readingOwnedEntries_(readingRows_(), studentCode).map(readingRecord_).filter(function (record) {
    return !moduleId || record.moduleId === moduleId;
  });
}

function readingActive_(record) {
  return record.phase === 'READING' || record.phase === 'QUIZ';
}

function readingElapsed_(record, now) {
  return record.readingMs + (record.phase === 'READING' && !record.paused ? Math.max(0, now - record.segmentStartedAtMs) : 0);
}

function readingSummary_(record) {
  return {
    id: record.id, moduleId: 'reading', skillId: 'AO02', title: record.title,
    contentId: record.contentId, contentVersion: record.contentVersion,
    phase: record.phase, paused: record.paused, pilot: true,
    source: record.source || 'FREE_PILOT', assignmentId: record.assignmentId || '',
    startedAt: new Date(record.startedAtMs).toISOString(),
    completedAt: record.completedAtMs ? new Date(record.completedAtMs).toISOString() : '',
    result: record.result || null,
  };
}

function publicReadingSession_(record, now) {
  const content = readingContent_(record.contentId, record.contentVersion);
  const data = readingSummary_(record);
  data.revision = record.revision;
  data.wordCount = record.wordCount;
  data.elapsedMs = readingElapsed_(record, now);
  data.timingExpired = data.elapsedMs > 30 * 60 * 1000;
  // No answer keys, future questions, or private identifiers in reading-phase responses.
  if (record.phase === 'READING' && !record.paused) data.paragraphs = content.paragraphs;
  if (record.phase === 'QUIZ') {
    data.questions = content.questions.map(function (question) {
      return { id: question.id, prompt: question.prompt, options: question.options.slice() };
    });
  }
  if (record.phase === 'COMPLETED') {
    data.review = content.questions.map(function (question) {
      return { id: question.id, prompt: question.prompt, selected: question.options[record.answers[question.id]], correct: question.options[question.correct], isCorrect: record.answers[question.id] === question.correct, explanation: question.explanation };
    });
  }
  return data;
}

function getReadingHistory_(studentCode, limit) {
  return workshopRecordsForStudent_(studentCode, 'reading')
    .sort(function (a, b) { return b.startedAtMs - a.startedAtMs; })
    .slice(0, limit).map(readingSummary_);
}

function publicReadingCatalog_() {
  return readingLibrary_().map(function (content) {
    return {
      id: content.id, version: content.version, title: content.title,
      description: content.description, wordCount: readingWordCount_(content),
      questionCount: content.questions.length, pilot: true,
    };
  });
}

// Published Anzan content is immutable. Sequences are visible during the task;
// expected totals stay server-side until the completed review is returned.
function anzanLibrary_() {
  return [
    {
      id: 'ANZAN-BASLANGIC-01', version: 1,
      title: 'Soroban–Anzan Başlangıç',
      description: 'Üç tek basamaklı sayıyı sırayla gör, zihninde birleştir ve sonucu yaz.',
      level: 1, intervalMs: 1200, skillId: 'ZI01', operationMode: 'ADDITION',
      operationLabel: 'Toplama', digitMin: 1, digitMax: 1, displayMode: 'NUMBER',
      rounds: [
        { id: 'A1', values: [2, 3, 1], correct: 6 },
        { id: 'A2', values: [4, 1, 3], correct: 8 },
        { id: 'A3', values: [5, 2, 2], correct: 9 },
        { id: 'A4', values: [3, 4, 2], correct: 9 },
        { id: 'A5', values: [6, 1, 2], correct: 9 },
      ],
    },
    {
      id: 'ANZAN-ODAK-02', version: 1,
      title: 'Anzan Odak',
      description: 'Dört tek basamaklı sayıyla dikkati ve zihinsel işlem akışını güçlendir.',
      level: 2, intervalMs: 900, skillId: 'ZI01', operationMode: 'ADDITION',
      operationLabel: 'Toplama', digitMin: 1, digitMax: 1, displayMode: 'NUMBER',
      rounds: [
        { id: 'B1', values: [3, 2, 4, 1], correct: 10 },
        { id: 'B2', values: [6, 1, 2, 4], correct: 13 },
        { id: 'B3', values: [8, 3, 5, 2], correct: 18 },
        { id: 'B4', values: [7, 4, 6, 3], correct: 20 },
        { id: 'B5', values: [9, 5, 2, 4], correct: 20 },
        { id: 'B6', values: [4, 8, 7, 6], correct: 25 },
      ],
    },
    {
      id: 'ANZAN-KARMA-03', version: 1,
      title: 'Anzan Karma',
      description: 'Bir ve iki basamaklı sayılarda toplama–çıkarma geçişlerini zihninde yönet.',
      level: 3, intervalMs: 750, skillId: 'ZI01', operationMode: 'MIXED',
      operationLabel: 'Toplama ve çıkarma', digitMin: 1, digitMax: 2, displayMode: 'NUMBER',
      rounds: [
        { id: 'C1', values: [14, 8, -5, 3, -4], correct: 16 },
        { id: 'C2', values: [21, -7, 6, -4, 9], correct: 25 },
        { id: 'C3', values: [32, -9, -8, 6, 5], correct: 26 },
        { id: 'C4', values: [18, 7, -6, 12, -9], correct: 22 },
        { id: 'C5', values: [45, -12, 8, -7, 6], correct: 40 },
        { id: 'C6', values: [27, 15, -9, -8, 4], correct: 29 },
      ],
    },
  ];
}

function anzanContent_(id, version) {
  const content = anzanLibrary_().filter(function (item) {
    return item.id === id && (version == null || item.version === version);
  })[0];
  if (!content) throw new Error('Soroban–Anzan içeriği veya sürümü bulunamadı. Eğitimcine bildir.');
  return content;
}

function anzanOperationLabel_(mode) {
  return mode === 'SUBTRACTION' ? 'Çıkarma'
    : (mode === 'MIXED' ? 'Toplama ve çıkarma' : 'Toplama');
}

function anzanPresentationLabel_(mode) {
  return mode === 'AUDIO' ? 'Sesli Anzan'
    : (mode === 'FLASH_AUDIO' ? 'Görsel + sesli Anzan' : 'Flash Anzan');
}

function normalizeAnzanConfig_(input, content) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const base = content || anzanContent_('ANZAN-BASLANGIC-01');
  function integerValue(name, fallback, minimum, maximum, label) {
    const value = source[name] == null || source[name] === '' ? fallback : Number(source[name]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(label + ' ' + minimum + ' ile ' + maximum + ' arasında tam sayı olmalıdır.');
    }
    return value;
  }
  const operationMode = String(source.operationMode || base.operationMode || 'ADDITION').toUpperCase();
  if (['ADDITION','SUBTRACTION','MIXED'].indexOf(operationMode) < 0) {
    throw new Error('Anzan işlem türü geçersiz.');
  }
  const presentationMode = String(source.presentationMode || 'FLASH').toUpperCase();
  if (['FLASH','FLASH_AUDIO','AUDIO'].indexOf(presentationMode) < 0) {
    throw new Error('Anzan sunum biçimi geçersiz.');
  }
  const transitionMode = String(source.transitionMode || 'FADE').toUpperCase();
  if (['NONE','FADE','SCALE'].indexOf(transitionMode) < 0) {
    throw new Error('Anzan geçiş biçimi geçersiz.');
  }
  const theme = String(source.theme || 'FOCUS_DARK').toUpperCase();
  if (['FOCUS_LIGHT','FOCUS_DARK','HIGH_CONTRAST'].indexOf(theme) < 0) {
    throw new Error('Anzan ekran teması geçersiz.');
  }
  const roundCount = integerValue('roundCount', base.rounds.length, 3, 30, 'Tur sayısı');
  const itemCount = integerValue('itemCount', base.rounds[0].values.length, 2, 10, 'Tur başına sayı');
  const digitMin = integerValue('digitMin', base.digitMin || 1, 1, 3, 'Minimum basamak');
  const digitMax = integerValue('digitMax', base.digitMax || digitMin, 1, 3, 'Maksimum basamak');
  if (digitMin > digitMax) throw new Error('Minimum basamak maksimum basamaktan büyük olamaz.');
  const intervalMs = integerValue('intervalMs', base.intervalMs || 1200, 200, 3000, 'Sayı geçiş süresi');
  if ((presentationMode === 'AUDIO' || presentationMode === 'FLASH_AUDIO') && intervalMs < 700) {
    throw new Error('Sesli Anzan için sayı geçiş süresi en az 700 ms olmalıdır.');
  }
  const countdownSeconds = integerValue('countdownSeconds', 3, 1, 5, 'Hazırlık sayacı');
  let allowedDigits = Array.isArray(source.allowedDigits) ? source.allowedDigits.map(Number) : [1,2,3,4,5,6,7,8,9];
  allowedDigits = allowedDigits.filter(function (value, index, values) {
    return Number.isInteger(value) && value >= 0 && value <= 9 && values.indexOf(value) === index;
  }).sort(function (left, right) { return left - right; });
  if (allowedDigits.length < 2 || !allowedDigits.some(function (value) { return value > 0; })) {
    throw new Error('Anzan sayı havuzunda en az iki rakam ve sıfırdan farklı bir rakam seçilmelidir.');
  }
  return {
    schemaVersion: 1,
    operationMode: operationMode,
    operationLabel: anzanOperationLabel_(operationMode),
    roundCount: roundCount,
    itemCount: itemCount,
    digitMin: digitMin,
    digitMax: digitMax,
    intervalMs: intervalMs,
    presentationMode: presentationMode,
    presentationLabel: anzanPresentationLabel_(presentationMode),
    transitionMode: transitionMode,
    theme: theme,
    countdownSeconds: countdownSeconds,
    allowedDigits: allowedDigits,
    showSorobanCue: source.showSorobanCue !== false,
  };
}

function anzanConfigForAssignment_(assignment, content) {
  return normalizeAnzanConfig_(assignment && assignment.anzanConfig, content);
}

function anzanSeed_(text) {
  let hash = 2166136261;
  String(text || '').split('').forEach(function (character) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function generateAnzanRounds_(config, seedText) {
  let seed = anzanSeed_(seedText);
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function pick(values) { return values[Math.floor(random() * values.length)]; }
  function magnitude() {
    const digits = config.digitMin + Math.floor(random() * (config.digitMax - config.digitMin + 1));
    const firstPool = config.allowedDigits.filter(function (value) { return value > 0; });
    let result = String(pick(firstPool));
    for (let index = 1; index < digits; index += 1) result += String(pick(config.allowedDigits));
    return Number(result);
  }
  const rounds = [];
  for (let roundIndex = 0; roundIndex < config.roundCount; roundIndex += 1) {
    const values = []; let running = magnitude(); values.push(running);
    for (let itemIndex = 1; itemIndex < config.itemCount; itemIndex += 1) {
      let amount = magnitude(); let value = amount;
      if (config.operationMode === 'SUBTRACTION') {
        value = -amount;
      } else if (config.operationMode === 'MIXED' && random() >= 0.5) {
        value = running - amount < 0 ? amount : -amount;
      }
      values.push(value); running += value;
    }
    rounds.push({ id: 'P' + (roundIndex + 1), values: values, correct: running });
  }
  return rounds;
}

function anzanRecordConfig_(record, content) {
  return normalizeAnzanConfig_(record && record.config, content);
}

function anzanRecordRounds_(record, content) {
  if (!record || !Array.isArray(record.rounds) || !record.rounds.length) return content.rounds;
  return record.rounds.map(function (round, index) {
    const values = Array.isArray(round.values) ? round.values.map(Number) : [];
    if (values.length < 2 || values.some(function (value) { return !Number.isInteger(value); })) {
      throw new Error('Anzan seans dizisi okunamadı. Veri değiştirilmedi; yöneticinize bildirin.');
    }
    return {
      id: cleanContentText_(round.id, 20) || ('P' + (index + 1)),
      values: values,
      correct: values.reduce(function (total, value) { return total + value; }, 0),
    };
  });
}

function publicAnzanCatalog_() {
  return anzanLibrary_().map(function (content) {
    return {
      id: content.id, version: content.version, title: content.title,
      description: content.description, level: content.level,
      intervalMs: content.intervalMs, roundCount: content.rounds.length,
      itemCount: content.rounds[0].values.length, skillId: content.skillId,
      operationMode: content.operationMode, operationLabel: content.operationLabel,
      digitMin: content.digitMin, digitMax: content.digitMax,
      displayMode: content.displayMode,
      pilot: true,
    };
  });
}

function anzanActive_(record) {
  return record.phase === 'ACTIVE';
}

function anzanSummary_(record) {
  const content = anzanContent_(record.contentId, record.contentVersion);
  const config = anzanRecordConfig_(record, content);
  const rounds = anzanRecordRounds_(record, content);
  return {
    id: record.id, moduleId: 'soroban_anzan', skillId: 'ZI01', title: record.title,
    contentId: record.contentId, contentVersion: record.contentVersion,
    phase: record.phase, pilot: true,
    source: record.source || 'FREE_PILOT', assignmentId: record.assignmentId || '',
    level: content.level, operationMode: config.operationMode,
    operationLabel: config.operationLabel, intervalMs: config.intervalMs,
    itemCount: config.itemCount, roundCount: rounds.length,
    digitMin: config.digitMin, digitMax: config.digitMax,
    presentationMode: config.presentationMode,
    presentationLabel: config.presentationLabel,
    transitionMode: config.transitionMode, theme: config.theme,
    countdownSeconds: config.countdownSeconds,
    showSorobanCue: config.showSorobanCue,
    tempoPerMinute: Math.round(60000 / config.intervalMs),
    startedAt: new Date(record.startedAtMs).toISOString(),
    completedAt: record.completedAtMs ? new Date(record.completedAtMs).toISOString() : '',
    result: record.result || null,
  };
}

function publicAnzanSession_(record) {
  const content = anzanContent_(record.contentId, record.contentVersion);
  const config = anzanRecordConfig_(record, content);
  const rounds = anzanRecordRounds_(record, content);
  const data = anzanSummary_(record);
  data.revision = record.revision;
  data.level = content.level;
  data.intervalMs = config.intervalMs;
  data.operationMode = config.operationMode;
  data.operationLabel = config.operationLabel;
  data.digitMin = config.digitMin;
  data.digitMax = config.digitMax;
  data.displayMode = config.presentationMode;
  data.presentationMode = config.presentationMode;
  data.presentationLabel = config.presentationLabel;
  data.allowedDigits = config.allowedDigits.slice();
  data.rounds = rounds.map(function (round) {
    return { id: round.id, values: round.values.slice() };
  });
  if (record.phase === 'COMPLETED') {
    data.review = rounds.map(function (round) {
      return {
        id: round.id, values: round.values.slice(),
        selected: record.answers[round.id], correct: round.correct,
        isCorrect: record.answers[round.id] === round.correct,
      };
    });
  }
  return data;
}

function anzanRecommendation_(content, accuracyPercent) {
  const catalog = anzanLibrary_().slice().sort(function (left, right) { return left.level - right.level; });
  if (accuracyPercent >= 90) {
    const next = catalog.filter(function (item) { return item.level > content.level; })[0];
    return next
      ? { code: 'ADVANCE', label: 'Bir üst seviyeye geç', message: 'Doğruluğun güçlü. Sonraki çalışmada hızı veya işlem yükünü kontrollü biçimde artır.', suggestedContentId: next.id }
      : { code: 'MASTERY', label: 'Ustalığı pekiştir', message: 'En yüksek hazır seviyede güçlü sonuç aldın. Farklı sayı dizileriyle istikrarını koru.', suggestedContentId: content.id };
  }
  if (accuracyPercent >= 70) {
    return { code: 'REPEAT', label: 'Aynı seviyeyi pekiştir', message: 'Temel akış yerleşiyor. Aynı hızda bir seans daha tamamlayıp doğruluğu %90 üzerine çıkar.', suggestedContentId: content.id };
  }
  const previous = catalog.slice().reverse().filter(function (item) { return item.level < content.level; })[0];
  return {
    code: 'FOUNDATION', label: 'Soroban temeline dön',
    message: 'Hızdan önce doğru boncuk hareketi ve basamak değerini güçlendir. Ardından daha yavaş Anzan seansıyla yeniden dene.',
    suggestedContentId: previous ? previous.id : content.id,
  };
}

function getAnzanHistory_(studentCode, limit) {
  return workshopRecordsForStudent_(studentCode, 'soroban_anzan')
    .sort(function (a, b) { return b.startedAtMs - a.startedAtMs; })
    .slice(0, limit).map(anzanSummary_);
}

function getWorkshopHistory_(studentCode, limit) {
  return getReadingHistory_(studentCode, limit).concat(getAnzanHistory_(studentCode, limit))
    .sort(function (left, right) { return new Date(right.startedAt) - new Date(left.startedAt); })
    .slice(0, limit);
}

function writeAnzanRecord_(sheet, row, record) {
  const values = [record.id, safeSheetValue_(record.studentCode), 'soroban_anzan', 'ZI01', record.contentId,
    record.contentVersion, record.phase, new Date(record.startedAtMs), new Date(record.updatedAtMs),
    record.completedAtMs ? new Date(record.completedAtMs) : '', JSON.stringify(record)];
  if (row) sheet.getRange(row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function getAnzanSession(token, sessionId) {
  const student = requireSession_(token);
  const entry = readingOwnedEntries_(readingRows_(), student.code).filter(function (item) {
    if (item.values[0] !== sessionId) return false;
    return readingRecord_(item).moduleId === 'soroban_anzan';
  })[0];
  if (!entry) throw new Error('Bu hesaba ait Soroban–Anzan seansı bulunamadı.');
  return publicAnzanSession_(readingRecord_(entry));
}

function startAnzanSession(token, contentId, requestId, assignmentId) {
  const student = requireSession_(token);
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{12,80}$/.test(requestId)) {
    throw new Error('Geçerli başlatma kimliği gerekli. Atölyeyi yeniden aç.');
  }
  const content = anzanContent_(contentId);
  const requestedAssignmentId = cleanContentText_(assignmentId, 80);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const data = readingRows_();
    const owned = readingOwnedEntries_(data, student.code).map(readingRecord_).filter(function (record) {
      return record.moduleId === 'soroban_anzan';
    });
    const existing = owned.filter(function (item) { return item.startRequestId === requestId; })[0]
      || owned.filter(anzanActive_)[0];
    if (existing) return publicAnzanSession_(existing);
    let assignment = null;
    if (requestedAssignmentId) {
      assignment = workshopAssignmentRows_().entries.map(function (entry) {
        return entry.assignment;
      }).filter(function (item) {
        return item.id === requestedAssignmentId
          && item.studentCode === normalizeCode_(student.code)
          && item.moduleId === 'soroban_anzan';
      })[0];
      if (!assignment) throw new Error('Bu hesaba ait Soroban–Anzan ataması bulunamadı.');
      if (assignment.status !== 'AKTİF') throw new Error('Bu Soroban–Anzan ataması eğitimci tarafından kapatılmış.');
      const nowDate = new Date();
      if (assignment.startAt && assignment.startAt.getTime() > nowDate.getTime()) {
        throw new Error('Bu Soroban–Anzan atamasının başlangıç tarihi henüz gelmedi.');
      }
      if (assignment.endAt && assignment.endAt.getTime() < nowDate.getTime()) {
        throw new Error('Bu Soroban–Anzan atamasının süresi dolmuş. Eğitimcinle görüş.');
      }
      if (assignment.contentId !== content.id || assignment.contentVersion !== content.version) {
        throw new Error('Atama ile Soroban–Anzan düzeyi uyuşmuyor. Eğitimcine bildir.');
      }
      const completed = owned.filter(function (item) {
        return item.assignmentId === requestedAssignmentId && item.phase === 'COMPLETED';
      }).sort(function (left, right) { return right.startedAtMs - left.startedAtMs; });
      if (completed.length >= (assignment.repeatTarget || 1)) return publicAnzanSession_(completed[0]);
    }
    const config = assignment
      ? anzanConfigForAssignment_(assignment, content)
      : normalizeAnzanConfig_(null, content);
    const customRounds = assignment && assignment.anzanConfig
      ? generateAnzanRounds_(config, assignment.id + ':' + requestId)
      : null;
    const now = Date.now();
    const record = {
      id: createCzaId_('ATOLYE'), studentCode: student.code,
      moduleId: 'soroban_anzan', skillId: 'ZI01',
      contentId: content.id, contentVersion: content.version, title: content.title,
      source: assignment ? 'ASSIGNED' : 'FREE_PILOT',
      assignmentId: assignment ? assignment.id : '', startRequestId: requestId,
      phase: 'ACTIVE', revision: 0, startedAtMs: now, updatedAtMs: now,
      completedAtMs: null, answers: null, result: null,
      config: customRounds ? config : null,
      rounds: customRounds,
    };
    const sheet = data.sheet || ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.WORKSHOP_SESSIONS_SHEET, CZA_HEADERS.workshopSessions
    );
    writeAnzanRecord_(sheet, null, record);
    return publicAnzanSession_(record);
  } finally { lock.releaseLock(); }
}

function updateAnzanSession(token, sessionId, expectedRevision, action, answers) {
  const student = requireSession_(token);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error('Seans sürümü geçersiz. Kaydı yeniden yükle.');
  }
  if (['submit', 'cancel'].indexOf(action) < 0) throw new Error('Geçersiz Soroban–Anzan işlemi.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const data = readingRows_();
    const entry = readingOwnedEntries_(data, student.code).filter(function (item) {
      if (item.values[0] !== sessionId) return false;
      return readingRecord_(item).moduleId === 'soroban_anzan';
    })[0];
    if (!entry) throw new Error('Bu hesaba ait Soroban–Anzan seansı bulunamadı.');
    const record = readingRecord_(entry);
    const now = Date.now();
    if (record.revision !== expectedRevision || !anzanActive_(record)) {
      return { session: publicAnzanSession_(record), stale: true };
    }
    if (action === 'cancel') {
      record.phase = 'CANCELLED';
    } else {
      const content = anzanContent_(record.contentId, record.contentVersion);
      const config = anzanRecordConfig_(record, content);
      const rounds = anzanRecordRounds_(record, content);
      if (!answers || Array.isArray(answers) || typeof answers !== 'object'
          || Object.keys(answers).length !== rounds.length) {
        throw new Error('Bütün Anzan turlarının sonucunu yaz.');
      }
      const clean = {}; let correct = 0;
      rounds.forEach(function (round) {
        const answer = answers[round.id];
        if (!Object.prototype.hasOwnProperty.call(answers, round.id)
            || !Number.isInteger(answer) || answer < -99999 || answer > 99999) {
          throw new Error('Her tur için -99999 ile 99999 arasında tam sayı gerekli.');
        }
        clean[round.id] = answer;
        if (answer === round.correct) correct += 1;
      });
      record.answers = clean;
      record.phase = 'COMPLETED';
      record.completedAtMs = now;
      record.result = {
        correct: correct, total: rounds.length,
        accuracyPercent: Math.round(correct * 100 / rounds.length),
        durationSeconds: Math.round((now - record.startedAtMs) / 100) / 10,
        level: content.level, intervalMs: config.intervalMs,
        operationMode: config.operationMode, operationLabel: config.operationLabel,
        digitMin: config.digitMin, digitMax: config.digitMax,
        itemCount: config.itemCount, roundCount: rounds.length,
        presentationMode: config.presentationMode,
        presentationLabel: config.presentationLabel,
        tempoPerMinute: Math.round(60000 / config.intervalMs),
        timingNote: 'Süre sunucu saatinden hesaplanır. Bu atölye çalışması standartlaştırılmış bir beceri puanı değildir.',
      };
      record.result.recommendation = anzanRecommendation_(content, record.result.accuracyPercent);
    }
    record.revision += 1;
    record.updatedAtMs = now;
    writeAnzanRecord_(data.sheet, entry.row, record);
    return { session: publicAnzanSession_(record), stale: false };
  } finally { lock.releaseLock(); }
}

function workshopAssignmentRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.WORKSHOP_ASSIGNMENTS_SHEET);
  if (!sheet) return { sheet: null, entries: [] };
  const headers = sheet.getRange(
    1, 1, 1, CZA_HEADERS.workshopAssignments.length
  ).getDisplayValues()[0];
  if (headers.join('|') !== CZA_HEADERS.workshopAssignments.join('|')) {
    throw new Error('Atölye atama kayıt yapısı uyuşmuyor. Veri değiştirilmedi; yöneticinize bildirin.');
  }
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.workshopAssignments.length
  ).getValues();
  return {
    sheet: sheet,
    entries: rows.map(function (row, index) {
      const assignedAt = row[10] instanceof Date ? row[10] : null;
      const metadata = parseWorkshopAssignmentMetadata_(row[11]);
      return {
        row: index + 2,
        assignment: {
          id: String(row[0] || ''), studentCode: normalizeCode_(row[1]),
          moduleId: String(row[2] || ''), skillId: String(row[3] || ''),
          contentId: String(row[4] || ''), contentVersion: Number(row[5]) || 0,
          status: String(row[6] || ''),
          startAt: row[7] instanceof Date ? row[7] : null,
          endAt: row[8] instanceof Date ? row[8] : null,
          educatorCode: String(row[9] || ''), assignedAt: assignedAt,
          assignedAtMs: assignedAt ? assignedAt.getTime() : 0,
          note: metadata.note, repeatTarget: metadata.repeatTarget,
          anzanConfig: metadata.anzanConfig,
        },
      };
    }).filter(function (entry) { return entry.assignment.id; }),
  };
}

function parseWorkshopAssignmentMetadata_(value) {
  const raw = String(value || '');
  if (raw.indexOf('CZA_META:') !== 0) return { note: raw, repeatTarget: 1, anzanConfig: null };
  try {
    const data = JSON.parse(raw.slice(9));
    const repeatTarget = Number(data.repeatTarget);
    return {
      note: cleanContentText_(data.note, 300),
      repeatTarget: Number.isInteger(repeatTarget) && repeatTarget >= 1 && repeatTarget <= 10
        ? repeatTarget : 1,
      anzanConfig: data.anzanConfig && typeof data.anzanConfig === 'object'
        && !Array.isArray(data.anzanConfig) ? data.anzanConfig : null,
    };
  } catch (error) {
    throw new Error('Atölye atama ayarları okunamadı. Veri değiştirilmedi; yöneticinize bildirin.');
  }
}

function workshopAssignmentMetadataValue_(note, repeatTarget, anzanConfig) {
  const cleanNote = cleanContentText_(note, 300);
  const target = Number(repeatTarget);
  if (!Number.isInteger(target) || target < 1 || target > 10) {
    throw new Error('Tekrar hedefi 1 ile 10 arasında tam sayı olmalıdır.');
  }
  if (target === 1 && !anzanConfig) return safeSheetValue_(cleanNote);
  return safeSheetValue_('CZA_META:' + JSON.stringify({
    note: cleanNote, repeatTarget: target, anzanConfig: anzanConfig || null,
  }));
}

function workshopAssignmentSessionMap_() {
  const result = {};
  readingRows_().entries.map(readingRecord_).forEach(function (record) {
    if (!record.assignmentId) return;
    if (!result[record.assignmentId]) result[record.assignmentId] = [];
    result[record.assignmentId].push(record);
  });
  Object.keys(result).forEach(function (assignmentId) {
    result[assignmentId].sort(function (left, right) {
      return right.startedAtMs - left.startedAtMs;
    });
  });
  return result;
}

function workshopAssignmentProgress_(assignment, sessions, now) {
  if (assignment.status !== 'AKTİF') return 'KAPATILDI';
  const current = now instanceof Date ? now : new Date();
  if (assignment.startAt && assignment.startAt.getTime() > current.getTime()) return 'PLANLANDI';
  if (assignment.endAt && assignment.endAt.getTime() < current.getTime()) return 'SÜRESİ DOLDU';
  const linked = sessions || [];
  const completedCount = linked.filter(function (record) { return record.phase === 'COMPLETED'; }).length;
  if (completedCount >= (assignment.repeatTarget || 1)) return 'TAMAMLANDI';
  if (linked.some(function (record) { return readingActive_(record) || anzanActive_(record); })) return 'DEVAM EDİYOR';
  return 'BEKLİYOR';
}

function publicWorkshopAssignment_(assignment, sessions, studentMap, now) {
  const isAnzan = assignment.moduleId === 'soroban_anzan';
  if (!isAnzan && assignment.moduleId !== 'reading') {
    throw new Error('Desteklenmeyen atölye ataması bulundu. Veri değiştirilmedi.');
  }
  const content = isAnzan
    ? anzanContent_(assignment.contentId, assignment.contentVersion)
    : readingContent_(assignment.contentId, assignment.contentVersion);
  const linked = sessions || [];
  const latest = linked[0] || null;
  const progress = workshopAssignmentProgress_(assignment, linked, now);
  const student = studentMap && studentMap[normalizeCode_(assignment.studentCode)];
  const completedCount = linked.filter(function (record) { return record.phase === 'COMPLETED'; }).length;
  const result = {
    id: assignment.id, assignmentId: assignment.id,
    studentCode: assignment.studentCode,
    studentName: student ? student.name : assignment.studentCode,
    moduleId: assignment.moduleId, skillId: assignment.skillId,
    contentId: content.id, contentVersion: content.version,
    title: content.title, description: content.description,
    status: progress, assignmentStatus: assignment.status,
    assignedAt: formatOptionalEducatorDate_(assignment.assignedAt),
    assignedAtMs: assignment.assignedAtMs,
    startAt: formatOptionalEducatorDate_(assignment.startAt),
    dueAt: formatOptionalEducatorDate_(assignment.endAt),
    note: assignment.note, educatorCode: assignment.educatorCode,
    repeatTarget: assignment.repeatTarget || 1,
    completedCount: completedCount,
    remainingCount: Math.max(0, (assignment.repeatTarget || 1) - completedCount),
    sessionId: latest ? latest.id : '',
    session: latest ? (isAnzan ? anzanSummary_(latest) : readingSummary_(latest)) : null,
    canClose: assignment.status === 'AKTİF'
      && progress !== 'TAMAMLANDI' && progress !== 'KAPATILDI',
  };
  if (isAnzan) {
    const config = anzanConfigForAssignment_(assignment, content);
    result.level = content.level;
    result.intervalMs = config.intervalMs;
    result.itemCount = config.itemCount;
    result.roundCount = config.roundCount;
    result.operationMode = config.operationMode;
    result.operationLabel = config.operationLabel;
    result.digitMin = config.digitMin;
    result.digitMax = config.digitMax;
    result.presentationMode = config.presentationMode;
    result.presentationLabel = config.presentationLabel;
    result.transitionMode = config.transitionMode;
    result.theme = config.theme;
    result.countdownSeconds = config.countdownSeconds;
    result.allowedDigits = config.allowedDigits.slice();
    result.showSorobanCue = config.showSorobanCue;
    result.tempoPerMinute = Math.round(60000 / config.intervalMs);
    result.professionalConfig = !!assignment.anzanConfig;
  } else {
    result.wordCount = readingWordCount_(content);
    result.questionCount = content.questions.length;
  }
  return result;
}

function getWorkshopAssignmentsForStudent_(studentCode, includeClosed) {
  const code = normalizeCode_(studentCode);
  const now = new Date();
  const sessionMap = workshopAssignmentSessionMap_();
  return workshopAssignmentRows_().entries.map(function (entry) {
    return entry.assignment;
  }).filter(function (assignment) {
    return assignment.studentCode === code
      && (includeClosed || assignment.status === 'AKTİF');
  }).sort(function (left, right) {
    return right.assignedAtMs - left.assignedAtMs;
  }).map(function (assignment) {
    return publicWorkshopAssignment_(assignment, sessionMap[assignment.id] || [], null, now);
  });
}

function getEducatorWorkshopAssignmentOverview_() {
  const students = readPublicStudents_();
  const studentMap = {};
  students.forEach(function (student) { studentMap[normalizeCode_(student.code)] = student; });
  const now = new Date();
  const sessionMap = workshopAssignmentSessionMap_();
  const assignments = workshopAssignmentRows_().entries.map(function (entry) {
    return publicWorkshopAssignment_(
      entry.assignment, sessionMap[entry.assignment.id] || [], studentMap, now
    );
  }).sort(function (left, right) {
    return right.assignedAtMs - left.assignedAtMs;
  });
  return {
    catalog: publicReadingCatalog_(),
    anzanCatalog: publicAnzanCatalog_(),
    students: students.map(function (student) {
      return { code: student.code, name: student.name, grade: student.grade };
    }),
    metrics: {
      active: assignments.filter(function (item) {
        return item.status === 'BEKLİYOR' || item.status === 'DEVAM EDİYOR'
          || item.status === 'PLANLANDI';
      }).length,
      pending: assignments.filter(function (item) { return item.status === 'BEKLİYOR'; }).length,
      inProgress: assignments.filter(function (item) { return item.status === 'DEVAM EDİYOR'; }).length,
      completed: assignments.filter(function (item) { return item.status === 'TAMAMLANDI'; }).length,
    },
    recent: assignments.slice(0, 20),
  };
}

function parseWorkshopAssignmentDate_(value, endOfDay) {
  const clean = cleanContentText_(value, 10);
  if (!clean) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error('Atama tarihi geçersiz.');
  const parts = clean.split('-').map(Number);
  const date = new Date(
    parts[0], parts[1] - 1, parts[2], endOfDay ? 23 : 0,
    endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0
  );
  if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1
      || date.getDate() !== parts[2]) throw new Error('Atama tarihi geçersiz.');
  return date;
}

function getEducatorWorkshopAssignments(token) {
  requireEducatorSession_(token);
  return getEducatorWorkshopAssignmentOverview_();
}

function assignReadingWorkshop(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = payload || {};
  const studentCode = normalizeCode_(data.studentCode);
  const contentId = cleanContentText_(data.contentId, 80);
  const student = findStudent_(studentCode);
  if (!student) throw new Error('Atama yapılacak öğrenci bulunamadı.');
  const content = readingContent_(contentId);
  const startAt = parseWorkshopAssignmentDate_(data.startDate, false);
  const endAt = parseWorkshopAssignmentDate_(data.dueDate, true);
  if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
    throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
  }
  const note = cleanContentText_(data.note, 300);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const assignmentData = workshopAssignmentRows_();
    const sessionMap = workshopAssignmentSessionMap_();
    const duplicate = assignmentData.entries.map(function (entry) {
      return entry.assignment;
    }).filter(function (assignment) {
      if (assignment.studentCode !== studentCode || assignment.moduleId !== 'reading'
          || assignment.contentId !== content.id
          || assignment.contentVersion !== content.version || assignment.status !== 'AKTİF') return false;
      const progress = workshopAssignmentProgress_(
        assignment, sessionMap[assignment.id] || [], new Date()
      );
      return progress !== 'TAMAMLANDI' && progress !== 'SÜRESİ DOLDU';
    })[0];
    if (duplicate) {
      throw new Error('Bu okuma çalışması öğrenciye zaten atanmış ve henüz tamamlanmamış.');
    }
    const now = new Date();
    const assignmentId = createCzaId_('ATAMA');
    const sheet = assignmentData.sheet || ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.WORKSHOP_ASSIGNMENTS_SHEET,
      CZA_HEADERS.workshopAssignments
    );
    sheet.appendRow([
      assignmentId, safeSheetValue_(student.code), 'reading', 'AO02', content.id,
      content.version, 'AKTİF', startAt || '', endAt || '', educator.code,
      now, workshopAssignmentMetadataValue_(note, 1),
    ]);
    return {
      ok: true,
      message: content.title + ' öğrencinin kişisel rotasına atandı.',
      assignmentId: assignmentId,
      workshopAssignments: getEducatorWorkshopAssignmentOverview_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function assignAnzanWorkshop(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = payload || {};
  const studentCode = normalizeCode_(data.studentCode);
  const contentId = cleanContentText_(data.contentId, 80);
  const repeatTarget = Number(data.repeatTarget);
  const student = findStudent_(studentCode);
  if (!student) throw new Error('Atama yapılacak öğrenci bulunamadı.');
  const content = anzanContent_(contentId);
  const anzanConfig = data.anzanConfig == null ? null : normalizeAnzanConfig_(data.anzanConfig, content);
  if (!Number.isInteger(repeatTarget) || repeatTarget < 1 || repeatTarget > 10) {
    throw new Error('Tekrar hedefi 1 ile 10 arasında tam sayı olmalıdır.');
  }
  const startAt = parseWorkshopAssignmentDate_(data.startDate, false);
  const endAt = parseWorkshopAssignmentDate_(data.dueDate, true);
  if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
    throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
  }
  const note = cleanContentText_(data.note, 300);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const assignmentData = workshopAssignmentRows_();
    const sessionMap = workshopAssignmentSessionMap_();
    const duplicate = assignmentData.entries.map(function (entry) {
      return entry.assignment;
    }).filter(function (assignment) {
      if (assignment.studentCode !== studentCode || assignment.moduleId !== 'soroban_anzan'
          || assignment.contentId !== content.id || assignment.contentVersion !== content.version
          || assignment.status !== 'AKTİF') return false;
      const progress = workshopAssignmentProgress_(
        assignment, sessionMap[assignment.id] || [], new Date()
      );
      return progress !== 'TAMAMLANDI' && progress !== 'SÜRESİ DOLDU';
    })[0];
    if (duplicate) {
      throw new Error('Bu Soroban–Anzan düzeyi öğrenciye zaten atanmış ve henüz tamamlanmamış.');
    }
    const now = new Date();
    const assignmentId = createCzaId_('ATAMA');
    const sheet = assignmentData.sheet || ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.WORKSHOP_ASSIGNMENTS_SHEET,
      CZA_HEADERS.workshopAssignments
    );
    sheet.appendRow([
      assignmentId, safeSheetValue_(student.code), 'soroban_anzan', 'ZI01', content.id,
      content.version, 'AKTİF', startAt || '', endAt || '', educator.code,
      now, workshopAssignmentMetadataValue_(note, repeatTarget, anzanConfig),
    ]);
    return {
      ok: true,
      message: content.title + ' • ' + repeatTarget + ' seans hedefi'
        + (anzanConfig ? ' • ' + anzanConfig.presentationLabel : '')
        + ' öğrencinin kişisel rotasına atandı.',
      assignmentId: assignmentId,
      workshopAssignments: getEducatorWorkshopAssignmentOverview_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function closeReadingWorkshopAssignment(token, assignmentId) {
  requireEducatorSession_(token);
  const id = cleanContentText_(assignmentId, 80);
  if (!id) throw new Error('Kapatılacak atama bulunamadı.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = workshopAssignmentRows_();
    const entry = data.entries.filter(function (item) {
      return item.assignment.id === id;
    })[0];
    if (!entry) throw new Error('Atölye ataması bulunamadı.');
    if (entry.assignment.status !== 'AKTİF') {
      return {
        ok: true, message: 'Atama zaten kapalı.',
        workshopAssignments: getEducatorWorkshopAssignmentOverview_(),
      };
    }
    data.sheet.getRange(entry.row, 7, 1, 1).setValues([['KAPATILDI']]);
    return {
      ok: true, message: 'Atama kapatıldı; geçmiş seans ve sonuç kayıtları korundu.',
      workshopAssignments: getEducatorWorkshopAssignmentOverview_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function getStudentWorkshops(token) {
  const student = requireSession_(token);
  const records = workshopRecordsForStudent_(student.code, 'reading')
    .sort(function (a, b) { return b.startedAtMs - a.startedAtMs; });
  const active = records.filter(readingActive_)[0];
  const anzanRecords = workshopRecordsForStudent_(student.code, 'soroban_anzan')
    .sort(function (a, b) { return b.startedAtMs - a.startedAtMs; });
  const activeAnzan = anzanRecords.filter(anzanActive_)[0];
  return {
    catalog: publicReadingCatalog_(),
    anzanCatalog: publicAnzanCatalog_(),
    assignments: getWorkshopAssignmentsForStudent_(student.code, false),
    activeSession: active ? publicReadingSession_(active, Date.now()) : null,
    activeAnzan: activeAnzan ? publicAnzanSession_(activeAnzan) : null,
    history: records.slice(0, 10).map(readingSummary_),
    anzanHistory: anzanRecords.slice(0, 10).map(anzanSummary_),
  };
}

function getReadingSession(token, sessionId) {
  const student = requireSession_(token);
  const entry = readingOwnedEntries_(readingRows_(), student.code).filter(function (item) {
    return item.values[0] === sessionId && readingRecord_(item).moduleId === 'reading';
  })[0];
  if (!entry) throw new Error('Bu hesaba ait seans bulunamadı.');
  return publicReadingSession_(readingRecord_(entry), Date.now());
}

function writeReadingRecord_(sheet, row, record) {
  const values = [record.id, safeSheetValue_(record.studentCode), 'reading', 'AO02', record.contentId,
    record.contentVersion, record.phase, new Date(record.startedAtMs), new Date(record.updatedAtMs),
    record.completedAtMs ? new Date(record.completedAtMs) : '', JSON.stringify(record)];
  if (row) sheet.getRange(row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function startReadingSession(token, contentId, requestId, assignmentId) {
  const student = requireSession_(token);
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{12,80}$/.test(requestId)) throw new Error('Geçerli başlatma kimliği gerekli. Atölyeyi yeniden aç.');
  const content = readingContent_(contentId);
  const requestedAssignmentId = cleanContentText_(assignmentId, 80);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const data = readingRows_();
    const owned = readingOwnedEntries_(data, student.code).map(readingRecord_).filter(function (record) {
      return record.moduleId === 'reading';
    });
    // A lost response and retry must not create a second attempt, even after completion.
    const existing = owned.filter(function (item) { return item.startRequestId === requestId; })[0] || owned.filter(readingActive_)[0];
    if (existing) return publicReadingSession_(existing, Date.now());
    let assignment = null;
    if (requestedAssignmentId) {
      assignment = workshopAssignmentRows_().entries.map(function (entry) {
        return entry.assignment;
      }).filter(function (item) {
        return item.id === requestedAssignmentId
          && item.studentCode === normalizeCode_(student.code)
          && item.moduleId === 'reading';
      })[0];
      if (!assignment) throw new Error('Bu hesaba ait okuma ataması bulunamadı.');
      if (assignment.status !== 'AKTİF') throw new Error('Bu okuma ataması eğitimci tarafından kapatılmış.');
      const nowDate = new Date();
      if (assignment.startAt && assignment.startAt.getTime() > nowDate.getTime()) {
        throw new Error('Bu okuma atamasının başlangıç tarihi henüz gelmedi.');
      }
      if (assignment.endAt && assignment.endAt.getTime() < nowDate.getTime()) {
        throw new Error('Bu okuma atamasının süresi dolmuş. Eğitimcinle görüş.');
      }
      if (assignment.contentId !== content.id || assignment.contentVersion !== content.version) {
        throw new Error('Atama ile okuma içeriği uyuşmuyor. Eğitimcine bildir.');
      }
      const linked = owned.filter(function (item) {
        return item.assignmentId === requestedAssignmentId;
      }).sort(function (left, right) { return right.startedAtMs - left.startedAtMs; });
      const completed = linked.filter(function (item) { return item.phase === 'COMPLETED'; })[0];
      if (completed) return publicReadingSession_(completed, Date.now());
    }
    const now = Date.now();
    const record = {
      id: createCzaId_('ATOLYE'), studentCode: student.code, moduleId: 'reading', skillId: 'AO02',
      contentId: content.id, contentVersion: content.version, title: content.title,
      source: assignment ? 'ASSIGNED' : 'FREE_PILOT',
      assignmentId: assignment ? assignment.id : '',
      startRequestId: requestId, phase: 'READING', revision: 0,
      startedAtMs: now, updatedAtMs: now, completedAtMs: null,
      readingMs: 0, segmentStartedAtMs: now, paused: false,
      wordCount: readingWordCount_(content), answers: null, result: null,
    };
    // Additive table only; never modify skill scores, academic answers or assignments.
    const sheet = data.sheet || ensureSheet_(getSpreadsheet_(), CZA_CONFIG.WORKSHOP_SESSIONS_SHEET, CZA_HEADERS.workshopSessions);
    writeReadingRecord_(sheet, null, record);
    return publicReadingSession_(record, now);
  } finally { lock.releaseLock(); }
}

function updateReadingSession(token, sessionId, expectedRevision, action, answers) {
  const student = requireSession_(token);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('Seans sürümü geçersiz. Kaydı yeniden yükle.');
  if (['pause', 'resume', 'finishReading', 'submit', 'cancel'].indexOf(action) < 0) throw new Error('Geçersiz atölye işlemi.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const data = readingRows_();
    const entry = readingOwnedEntries_(data, student.code).filter(function (item) {
      return item.values[0] === sessionId && readingRecord_(item).moduleId === 'reading';
    })[0];
    if (!entry) throw new Error('Bu hesaba ait seans bulunamadı.');
    const record = readingRecord_(entry);
    const now = Date.now();
    // Optimistic concurrency also makes double taps and network retries safe.
    if (record.revision !== expectedRevision || !readingActive_(record)) {
      return { session: publicReadingSession_(record, now), stale: true };
    }
    if (action === 'cancel') {
      record.readingMs = readingElapsed_(record, now); record.phase = 'CANCELLED'; record.paused = true;
    } else if (action === 'submit') {
      if (record.phase !== 'QUIZ') throw new Error('Önce okumayı bitirip anlama sorularına geç.');
      const content = readingContent_(record.contentId, record.contentVersion);
      if (!answers || Array.isArray(answers) || typeof answers !== 'object' || Object.keys(answers).length !== content.questions.length) throw new Error('Bütün soruları yanıtla.');
      const clean = {}; let correct = 0;
      content.questions.forEach(function (question) {
        const answer = answers[question.id];
        if (!Object.prototype.hasOwnProperty.call(answers, question.id) || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length) throw new Error('Bütün sorular için geçerli bir seçenek gerekli.');
        clean[question.id] = answer; if (answer === question.correct) correct += 1;
      });
      record.answers = clean; record.phase = 'COMPLETED'; record.completedAtMs = now;
      record.result = {
        readingSeconds: Math.round(record.readingMs / 100) / 10,
        wordsPerMinute: Math.round(record.wordCount * 60000 / record.readingMs),
        correct: correct, total: content.questions.length, comprehensionPercent: Math.round(correct * 100 / content.questions.length),
        timingNote: 'Mola dışı geçen süre sunucu saatinden hesaplanır; ağ gecikmesi ve kaydedilmeyen molalar sonucu etkileyebilir. Pilot sonuç, standart bir beceri ölçümü değildir.',
      };
    } else {
      if (record.phase !== 'READING') throw new Error('Bu işlem yalnız okuma adımında kullanılabilir.');
      if (action === 'pause' && !record.paused) {
        record.readingMs = readingElapsed_(record, now); record.paused = true;
      } else if (action === 'resume' && record.paused) {
        record.segmentStartedAtMs = now; record.paused = false;
      } else if (action === 'finishReading') {
        const elapsed = readingElapsed_(record, now);
        if (elapsed < 1000) throw new Error('Okuma süresi henüz ölçülemedi. Metni okuduktan sonra devam et.');
        if (elapsed > 30 * 60 * 1000) throw new Error('Bu okuma 30 dakikalık pilot süre sınırını aştı. Seansı sonlandırıp yeniden başlat.');
        record.readingMs = elapsed; record.paused = true; record.phase = 'QUIZ';
      }
    }
    record.revision += 1; record.updatedAtMs = now;
    writeReadingRecord_(data.sheet, entry.row, record);
    return { session: publicReadingSession_(record, now), stale: false };
  } finally { lock.releaseLock(); }
}

function getEducatorContentStudio(token) {
  requireEducatorSession_(token);
  return getEducatorContentOverview_();
}

function saveEducatorIntervention(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = validateEducatorInterventionPayload_(payload || {});
  const student = findStudent_(data.studentCode);
  if (!student) throw new Error('Müdahale planı oluşturulacak öğrenci bulunamadı.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.INTERVENTIONS_SHEET, CZA_HEADERS.interventions
    );
    const now = new Date();
    const interventionId = createCzaId_('MUDAHALE');
    sheet.appendRow([
      interventionId, student.code, data.type, safeSheetValue_(data.title),
      safeSheetValue_(data.description), data.priority, 'AÇIK', now,
      data.reviewDate || '', '', educator.code, now,
      safeSheetValue_(data.successCriterion), '', '', '', '',
    ]);
    appendEducatorInterventionHistory_({
      interventionId: interventionId,
      studentCode: student.code,
      eventType: 'PLAN OLUŞTURULDU',
      previousStatus: '',
      nextStatus: 'AÇIK',
      note: data.description,
      resultLevel: '',
      reviewDate: data.reviewDate,
      educatorCode: educator.code,
      createdAt: now,
    });
    return {
      ok: true,
      message: 'Müdahale planı kaydedildi ve takip süreci başlatıldı.',
      interventions: getEducatorInterventionsForStudent_(student.code),
    };
  } finally {
    lock.releaseLock();
  }
}

function updateEducatorIntervention(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = payload || {};
  const interventionId = cleanContentText_(data.interventionId, 80);
  const action = cleanContentText_(data.action, 30).toLocaleUpperCase('tr-TR');
  if (!interventionId) throw new Error('Güncellenecek müdahale planı bulunamadı.');
  if (['REOPEN', 'ARCHIVE'].indexOf(action) === -1) {
    throw new Error('Geçersiz müdahale planı işlemi.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.INTERVENTIONS_SHEET, CZA_HEADERS.interventions
    );
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Müdahale planı bulunamadı.');
    const rows = sheet.getRange(
      2, 1, sheet.getLastRow() - 1, CZA_HEADERS.interventions.length
    ).getValues();
    const offset = rows.findIndex(function (row) {
      return String(row[0] || '') === interventionId;
    });
    if (offset < 0) throw new Error('Müdahale planı bulunamadı.');
    const rowNumber = offset + 2;
    const studentCode = normalizeCode_(rows[offset][1]);
    const currentStatus = String(rows[offset][6] || 'AÇIK');
    let nextStatus = currentStatus;
    let completedAt = rows[offset][9] instanceof Date ? rows[offset][9] : '';
    if (action === 'REOPEN') {
      nextStatus = 'AÇIK';
      completedAt = '';
    }
    if (action === 'ARCHIVE') nextStatus = 'ARŞİV';
    sheet.getRange(rowNumber, 7).setValue(nextStatus);
    sheet.getRange(rowNumber, 10).setValue(completedAt);
    sheet.getRange(rowNumber, 11).setValue(educator.code);
    const now = new Date();
    sheet.getRange(rowNumber, 12).setValue(now);
    if (action === 'REOPEN') {
      sheet.getRange(rowNumber, 14, 1, 4).clearContent();
    }
    appendEducatorInterventionHistory_({
      interventionId: interventionId,
      studentCode: studentCode,
      eventType: action === 'REOPEN' ? 'YENİDEN AÇILDI' : 'ARŞİVLENDİ',
      previousStatus: currentStatus,
      nextStatus: nextStatus,
      note: action === 'REOPEN'
        ? 'Müdahale planı yeni bir takip döngüsü için yeniden açıldı.'
        : 'Müdahale planı arşive alındı.',
      resultLevel: '',
      reviewDate: rows[offset][8] instanceof Date ? rows[offset][8] : null,
      educatorCode: educator.code,
      createdAt: now,
    });
    return {
      ok: true,
      message: nextStatus === 'AÇIK'
        ? 'Müdahale planı yeniden takibe alındı.'
        : 'Müdahale planı arşivlendi.',
      interventions: getEducatorInterventionsForStudent_(studentCode),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveEducatorInterventionFollowUp(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = validateEducatorInterventionFollowUpPayload_(payload || {});
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.INTERVENTIONS_SHEET, CZA_HEADERS.interventions
    );
    if (sheet.getLastRow() < 2) throw new Error('Müdahale planı bulunamadı.');
    const rows = sheet.getRange(
      2, 1, sheet.getLastRow() - 1, CZA_HEADERS.interventions.length
    ).getValues();
    const offset = rows.findIndex(function (row) {
      return String(row[0] || '') === data.interventionId;
    });
    if (offset < 0) throw new Error('Müdahale planı bulunamadı.');
    const row = rows[offset];
    const rowNumber = offset + 2;
    const studentCode = normalizeCode_(row[1]);
    const currentStatus = String(row[6] || 'AÇIK');
    if (currentStatus === 'ARŞİV') throw new Error('Arşivlenmiş plana takip kaydı eklenemez.');

    const now = new Date();
    let nextStatus = currentStatus;
    let reviewDate = row[8] instanceof Date ? row[8] : null;
    if (data.reviewDate) {
      reviewDate = data.reviewDate;
      sheet.getRange(rowNumber, 9).setValue(reviewDate);
    }
    if (data.mode === 'COMPLETE') {
      nextStatus = 'TAMAMLANDI';
      sheet.getRange(rowNumber, 7).setValue(nextStatus);
      sheet.getRange(rowNumber, 10).setValue(now);
      sheet.getRange(rowNumber, 14).setValue(data.resultLevel);
      sheet.getRange(rowNumber, 15).setValue(safeSheetValue_(data.note));
      sheet.getRange(rowNumber, 16).setValue(safeSheetValue_(data.nextStep));
      sheet.getRange(rowNumber, 17).setValue(now);
    }
    sheet.getRange(rowNumber, 11).setValue(educator.code);
    sheet.getRange(rowNumber, 12).setValue(now);
    appendEducatorInterventionHistory_({
      interventionId: data.interventionId,
      studentCode: studentCode,
      eventType: data.mode === 'COMPLETE' ? 'SONUÇLANDIRILDI' : 'TAKİP NOTU',
      previousStatus: currentStatus,
      nextStatus: nextStatus,
      note: data.note,
      resultLevel: data.resultLevel,
      reviewDate: reviewDate,
      educatorCode: educator.code,
      createdAt: now,
    });
    return {
      ok: true,
      message: data.mode === 'COMPLETE'
        ? 'Müdahale sonucu ve başarı düzeyi kaydedildi.'
        : 'Eğitimci takip notu zaman çizelgesine eklendi.',
      interventions: getEducatorInterventionsForStudent_(studentCode),
    };
  } finally {
    lock.releaseLock();
  }
}

function archiveEducatorWeeklyReport(token) {
  const educator = requireEducatorSession_(token);
  const dashboard = getEducatorDashboardData_();
  const report = dashboard.weeklyReport || {};
  const metrics = report.metrics || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.WEEKLY_REPORT_ARCHIVE_SHEET,
      CZA_HEADERS.weeklyReportArchive
    );
    const now = new Date();
    const reportId = createCzaId_('RAPOR');
    const reportJson = JSON.stringify({ metrics: metrics, students: report.students || [] }).slice(0, 45000);
    sheet.appendRow([
      reportId, report.periodStart || '', report.periodEnd || '',
      Number(metrics.totalStudents) || 0, Number(metrics.activeStudents) || 0,
      Number(metrics.totalAnswers) || 0, Number(metrics.averageAccuracy) || 0,
      Number(metrics.completedInterventions) || 0, Number(metrics.followUpEntries) || 0,
      educator.code, now, safeSheetValue_(reportJson),
    ]);
    return {
      ok: true,
      message: 'Haftalık eğitimci raporu arşivlendi.',
      archives: getRecentEducatorWeeklyReports_(8),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveEducatorContent(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = validateEducatorContentPayload_(payload || {});
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    let driveFileId = '';
    let sourceUrl = data.sourceUrl;
    let fileName = data.fileName;
    let mimeType = data.mimeType;
    let byteSize = 0;

    if (data.sourceType === 'DOSYA') {
      let bytes;
      try {
        bytes = Utilities.base64Decode(data.fileBase64);
      } catch (error) {
        throw new Error('Dosya okunamadı. Lütfen belgeyi yeniden seçin.');
      }
      byteSize = bytes.length;
      if (!byteSize || byteSize > CZA_CONFIG.MAX_UPLOAD_BYTES) {
        throw new Error('Dosya boyutu 5 MB sınırını aşmamalıdır.');
      }
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const file = ensureCzaContentFolder_().createFile(blob);
      file.setDescription('CZA içerik kaydı • ' + data.title + ' • ' + educator.code);
      driveFileId = file.getId();
      sourceUrl = file.getUrl();
    }

    const now = new Date();
    const documentId = createCzaId_('BELGE');
    const status = data.publish ? 'YAYINDA' : 'TASLAK';
    const ss = getSpreadsheet_();
    const documents = ss.getSheetByName(CZA_CONFIG.DOCUMENTS_SHEET);
    const assignments = ss.getSheetByName(CZA_CONFIG.ASSIGNMENTS_SHEET);
    if (!documents || !assignments) {
      throw new Error('Belge veri yapısı hazır değil. setupCzaOgrenciApp işlevini çalıştırın.');
    }

    documents.appendRow([
      documentId, driveFileId, data.sourceType, sourceUrl, safeSheetValue_(fileName),
      mimeType, byteSize, safeSheetValue_(data.title), safeSheetValue_(data.grade),
      safeSheetValue_(data.lesson), safeSheetValue_(data.topic),
      safeSheetValue_(data.outcome), data.skillId, safeSheetValue_(data.skillName),
      data.stage, data.duration, safeSheetValue_(data.packageName), status,
      educator.code, now, now, safeSheetValue_(data.description),
    ]);

    if (data.publish) {
      assignments.appendRow([
        createCzaId_('ATAMA'), documentId, data.targetType, safeSheetValue_(data.targetValue),
        now, '', 'AKTİF', educator.code, now, safeSheetValue_(data.assignmentNote),
      ]);
    }

    return {
      ok: true,
      message: data.publish
        ? 'İçerik onaylandı ve hedef öğrencilere yayımlandı.'
        : 'İçerik taslak olarak kaydedildi.',
      documentId: documentId,
      status: status,
      content: getEducatorContentOverview_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function publishEducatorDraft(token, payload) {
  const educator = requireEducatorSession_(token);
  const data = payload || {};
  const documentId = cleanContentText_(data.documentId, 80);
  const targetType = normalizeContentTargetType_(data.targetType);
  let targetValue = cleanContentText_(data.targetValue, 160);
  const assignmentNote = cleanContentText_(data.assignmentNote, 300);

  if (!documentId) throw new Error('Yayımlanacak taslak bulunamadı.');
  if (!targetType) throw new Error('Yayın için hedef türünü seçin.');
  if (targetType === 'TÜM ÖĞRENCİLER') targetValue = 'TÜMÜ';
  if (!targetValue) throw new Error('Yayın hedefini seçin.');
  if (targetType === 'ÖĞRENCİ') {
    const student = findStudent_(normalizeCode_(targetValue));
    if (!student) throw new Error('Atanacak öğrenci bulunamadı.');
    targetValue = student.code;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const documents = ss.getSheetByName(CZA_CONFIG.DOCUMENTS_SHEET);
    const assignments = ss.getSheetByName(CZA_CONFIG.ASSIGNMENTS_SHEET);
    if (!documents || !assignments) {
      throw new Error('Belge veri yapısı hazır değil. setupCzaOgrenciApp işlevini çalıştırın.');
    }

    const ids = documents.getLastRow() < 2
      ? []
      : documents.getRange(2, 1, documents.getLastRow() - 1, 1).getValues();
    const offset = ids.findIndex(function (row) { return String(row[0] || '') === documentId; });
    if (offset < 0) throw new Error('Yayımlanacak taslak bulunamadı.');
    const rowNumber = offset + 2;
    const status = String(documents.getRange(rowNumber, 18).getValue() || '');
    if (status !== 'TASLAK') throw new Error('Bu içerik artık taslak durumunda değil.');

    const alreadyAssigned = readAssignmentRows_().some(function (item) {
      return item.documentId === documentId && item.status === 'AKTİF';
    });
    if (alreadyAssigned) throw new Error('Bu içerik için zaten aktif bir atama bulunuyor.');

    const now = new Date();
    const assignmentId = createCzaId_('ATAMA');
    assignments.appendRow([
      assignmentId, documentId, targetType, safeSheetValue_(targetValue),
      now, '', 'AKTİF', educator.code, now, safeSheetValue_(assignmentNote),
    ]);
    try {
      documents.getRange(rowNumber, 18).setValue('YAYINDA');
      documents.getRange(rowNumber, 21).setValue(now);
    } catch (error) {
      const lastRow = assignments.getLastRow();
      if (lastRow >= 2 && String(assignments.getRange(lastRow, 1).getValue() || '') === assignmentId) {
        assignments.deleteRow(lastRow);
      }
      throw error;
    }

    return {
      ok: true,
      message: 'Taslak onaylandı ve seçilen hedefe yayımlandı.',
      documentId: documentId,
      status: 'YAYINDA',
      content: getEducatorContentOverview_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function manageEducatorDocument(token, payload) {
  requireEducatorSession_(token);
  const data = payload || {};
  const documentId = cleanContentText_(data.documentId, 80);
  const action = cleanContentText_(data.action, 30).toUpperCase();
  if (!documentId) throw new Error('Yönetilecek içerik bulunamadı.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const documents = ss.getSheetByName(CZA_CONFIG.DOCUMENTS_SHEET);
    const assignments = ss.getSheetByName(CZA_CONFIG.ASSIGNMENTS_SHEET);
    if (!documents || !assignments) {
      throw new Error('Belge veri yapısı hazır değil. setupCzaOgrenciApp işlevini çalıştırın.');
    }

    const documentRows = documents.getLastRow() < 2
      ? []
      : documents.getRange(
        2, 1, documents.getLastRow() - 1, CZA_HEADERS.documents.length
      ).getValues();
    const offset = documentRows.findIndex(function (row) {
      return String(row[0] || '') === documentId;
    });
    if (offset < 0) throw new Error('Yönetilecek içerik bulunamadı.');

    const row = documentRows[offset];
    const rowNumber = offset + 2;
    const sourceType = String(row[2] || '');
    const currentStatus = String(row[17] || '');
    const transition = resolveEducatorDocumentTransition_(action, currentStatus, sourceType);
    const now = new Date();

    if (transition.action === 'UPDATE_LINK') {
      const sourceUrl = validateEducatorLink_(data.sourceUrl);
      documents.getRange(rowNumber, 4).setValue(sourceUrl);
    }

    // Status is changed before assignments are closed. If a later write fails,
    // the student feed still excludes the document and access remains closed.
    if (transition.nextStatus !== currentStatus) {
      documents.getRange(rowNumber, 18).setValue(transition.nextStatus);
    }
    documents.getRange(rowNumber, 21).setValue(now);

    if (transition.deactivateAssignments && assignments.getLastRow() >= 2) {
      const assignmentRows = assignments.getRange(
        2, 1, assignments.getLastRow() - 1, CZA_HEADERS.assignments.length
      ).getValues();
      assignmentRows.forEach(function (assignmentRow, assignmentOffset) {
        if (String(assignmentRow[1] || '') !== documentId) return;
        if (String(assignmentRow[6] || '') !== 'AKTİF') return;
        assignments.getRange(assignmentOffset + 2, 6, 1, 2)
          .setValues([[now, 'PASİF']]);
      });
    }

    return {
      ok: true,
      message: transition.message,
      documentId: documentId,
      status: transition.nextStatus,
      content: getEducatorContentOverview_(),
    };
  } finally {
    lock.releaseLock();
  }
}

function getAssignedContentFile(token, documentId) {
  const session = requireSession_(token);
  const document = readDocumentRows_().find(function (item) {
    return item.id === String(documentId || '').trim() && item.status === 'YAYINDA';
  });
  if (!document) throw new Error('İçerik bulunamadı veya yayında değil.');

  const assignedItem = getAssignedContentsForStudent_(session.code).find(function (item) {
    return item.id === document.id;
  });
  if (!assignedItem) throw new Error('Bu içerik öğrenci hesabınıza atanmadı.');

  if (document.sourceType === 'BAĞLANTI') {
    const progress = recordAssignedContentProgress_(
      session.code, document.id, assignedItem.assignmentId, 'AÇILDI'
    );
    return {
      sourceType: 'BAĞLANTI', name: document.fileName || document.title,
      mimeType: document.mimeType, externalUrl: document.sourceUrl,
      progress: publicAssignedContentProgress_(progress),
    };
  }
  if (!document.driveFileId) throw new Error('Belge dosyası bulunamadı.');
  const file = DriveApp.getFileById(document.driveFileId);
  const blob = file.getBlob();
  if (blob.getBytes().length > CZA_CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('Belge öğrenci ekranında açılamayacak kadar büyük.');
  }
  const progress = recordAssignedContentProgress_(
    session.code, document.id, assignedItem.assignmentId, 'AÇILDI'
  );
  return {
    sourceType: 'DOSYA', name: document.fileName || file.getName(),
    mimeType: document.mimeType || blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes()),
    progress: publicAssignedContentProgress_(progress),
  };
}

function completeAssignedContent(token, documentId) {
  const session = requireSession_(token);
  const assignedItem = getAssignedContentsForStudent_(session.code).find(function (item) {
    return item.id === String(documentId || '').trim();
  });
  if (!assignedItem) throw new Error('Bu içerik öğrenci hesabınıza atanmadı.');
  if (!assignedItem.progress || assignedItem.progress.status === 'BEKLİYOR') {
    throw new Error('Tamamlamadan önce içeriği en az bir kez açın.');
  }
  recordAssignedContentProgress_(
    session.code, assignedItem.id, assignedItem.assignmentId, 'TAMAMLANDI'
  );
  return {
    ok: true,
    message: 'İçerik tamamlandı. Eğitimcin ilerlemeni görebilir.',
    assignedContent: getAssignedContentsForStudent_(session.code),
  };
}

function getDashboard(token) {
  const session = requireSession_(token);
  return getDashboardForCode_(session.code);
}

function getSkillCampus(token) {
  const session = requireSession_(token);
  return getHolisticProfile_(session.code, true);
}

function completeOnboarding(token) {
  const session = requireSession_(token);
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.CAMPUS_STATE_SHEET);
  if (!sheet) throw new Error('Kampüs durumu henüz hazırlanmadı.');

  const rowNumber = findCampusStateRow_(sheet, session.code);
  if (rowNumber) {
    sheet.getRange(rowNumber, 3, 1, 2).setValues([[new Date(), true]]);
  } else {
    sheet.appendRow([session.code, new Date(), new Date(), true, '', 0]);
  }
  return { ok: true };
}

function getNextQuestion(token) {
  const session = requireSession_(token);
  const questionRows = readQuestionRows_().filter(function (question) {
    return question.active;
  });

  if (!questionRows.length) {
    throw new Error('Aktif soru bulunamadı.');
  }

  const target = findTargetSkill_(session.code, questionRows);
  if (!target) {
    return { completed: true, message: 'Tüm etkin kazanımlar tamamlandı.' };
  }

  const candidates = questionRows.filter(function (question) {
    return question.lesson === target.lesson && question.skill === target.skill;
  });
  const attempts = getAttemptCounts_(session.code);
  candidates.sort(function (left, right) {
    const countDiff = (attempts[left.id] || 0) - (attempts[right.id] || 0);
    return countDiff || left.id.localeCompare(right.id, 'tr');
  });

  const selected = candidates[0];
  return {
    completed: false,
    question: {
      id: selected.id,
      lesson: selected.lesson,
      skill: selected.skill,
      level: selected.level,
      prompt: selected.prompt,
      options: {
        A: selected.optionA,
        B: selected.optionB,
        C: selected.optionC,
        D: selected.optionD,
      },
    },
  };
}

function submitAnswer(token, questionId, answer, durationSeconds) {
  const session = requireSession_(token);
  const selectedAnswer = String(answer || '').trim().toUpperCase();
  if (!/^[ABCD]$/.test(selectedAnswer)) {
    throw new Error('Lütfen A, B, C veya D seçeneklerinden birini işaretleyin.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const question = readQuestionRows_().find(function (row) {
      return row.id === String(questionId || '').trim();
    });
    if (!question || !question.active) {
      throw new Error('Soru bulunamadı veya artık aktif değil.');
    }

    const isCorrect = selectedAnswer === question.correctAnswer;
    const seconds = Math.max(0, Math.min(Number(durationSeconds) || 0, 3600));
    const ss = getSpreadsheet_();
    const answersSheet = ss.getSheetByName(CZA_CONFIG.ANSWERS_SHEET);
    answersSheet.appendRow([
      new Date(), session.code, question.id, question.lesson, question.skill,
      selectedAnswer, isCorrect, Math.round(seconds), Utilities.getUuid(),
    ]);

    const mastery = updateMastery_(session.code, question.lesson, question.skill);
    return {
      correct: isCorrect,
      selectedAnswer: selectedAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      mastery: mastery,
      dashboard: getDashboardForCode_(session.code),
    };
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CZA_CONFIG.SPREADSHEET_ID);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const needsHeaders = headers.some(function (header, index) {
    return currentHeaders[index] !== header;
  });
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#123A63')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function ensureStudentPins_(sheet) {
  const pinColumn = 8;
  if (sheet.getRange(1, pinColumn).getDisplayValue() !== 'Giriş PIN') {
    sheet.getRange(1, pinColumn).setValue('Giriş PIN');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const codes = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  const pins = sheet.getRange(2, pinColumn, lastRow - 1, 1).getDisplayValues();
  const updatedPins = pins.map(function (row, index) {
    if (!codes[index][0]) return [''];
    return [/^\d{6}$/.test(row[0]) ? row[0] : generatePin_()];
  });
  sheet.getRange(2, pinColumn, updatedPins.length, 1).setValues(updatedPins).setNumberFormat('@');
  sheet.getRange(1, 1, 1, pinColumn).setFontWeight('bold');
}

function generatePin_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function seedEducatorAccount_(sheet) {
  if (sheet.getLastRow() > 1) return;
  const pin = String(Math.floor(10000000 + Math.random() * 90000000));
  sheet.appendRow(['CZA-YONETICI', 'CZA Yöneticisi', 'YÖNETİCİ', pin, 'EVET']);
  sheet.getRange(2, 4).setNumberFormat('@');
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 130);
}

function seedQuestions_(sheet) {
  if (sheet.getLastRow() > 1) return;

  const rows = [
    ['EK001', 'Matematik', 'EKOK • Üçlü Döngü', 'Temel', 'Üç düzenek 12, 18 ve 30 dakikada bir çalışıyor. Saat 09.20’de birlikte çalıştıklarına göre yeniden birlikte saat kaçta çalışırlar?', '10.20', '10.35', '10.50', '11.00', 'C', 'EKOK(12,18,30)=90 dakika=1 saat 30 dakika. 09.20+1 saat 30 dakika=10.50.', 'EVET'],
    ['EK002', 'Matematik', 'EKOK • Üçlü Döngü', 'Orta', 'Üç sistem 16, 20 ve 24 dakikada bir çalışıyor. Saat 08.45’te birlikte çalıştıklarına göre yeniden birlikte saat kaçta çalışırlar?', '11.45', '12.45', '13.05', '13.45', 'B', 'EKOK(16,20,24)=240 dakika=4 saat. 08.45+4 saat=12.45.', 'EVET'],
    ['EK003', 'Matematik', 'EKOK • Üçlü Döngü', 'Orta', 'Üç zil 14, 21 ve 28 dakikada bir çalıyor. Saat 13.10’da birlikte çaldıklarına göre yeniden birlikte saat kaçta çalarlar?', '14.10', '14.24', '14.28', '14.34', 'D', 'EKOK(14,21,28)=84 dakika=1 saat 24 dakika. 13.10+1 saat 24 dakika=14.34.', 'EVET'],
    ['EK004', 'Matematik', 'EKOK • Tekrar Sayısı', 'Temel', 'İki etkinlik 6 ve 8 günde bir yapılıyor. Bugün birlikte yapıldıklarına göre bugünden sonraki üçüncü ortak etkinlik kaç gün sonra yapılır?', '48', '72', '96', '120', 'B', 'EKOK(6,8)=24 gündür. Üçüncü ortak etkinlik 3×24=72 gün sonradır.', 'EVET'],
    ['EK005', 'Matematik', 'EKOK • Tekrar Sayısı', 'Orta', 'İki bakım 10 ve 15 günde bir yapılıyor. Bugün birlikte yapıldıklarına göre bugünden sonraki dördüncü ortak bakım kaç gün sonra yapılır?', '90', '100', '120', '150', 'C', 'EKOK(10,15)=30 gündür. Dördüncü ortak bakım 4×30=120 gün sonradır.', 'EVET'],
    ['EK006', 'Matematik', 'EKOK • Tekrar Sayısı', 'Orta', 'İki kurs 12 ve 18 günde bir yapılıyor. Bugün birlikte yapıldıklarına göre bugünden sonraki ikinci ortak kurs kaç gün sonra yapılır?', '72', '54', '60', '90', 'A', 'EKOK(12,18)=36 gündür. İkinci ortak kurs 2×36=72 gün sonradır.', 'EVET'],
    ['EK007', 'Matematik', 'EKOK • Saniye Hesabı', 'Temel', 'Üç ışık 30, 45 ve 75 saniyede bir birlikte yanıyor. Saat 10.12.20’de birlikte yandıklarına göre yeniden birlikte saat kaçta yanarlar?', '10.18.50', '10.19.20', '10.19.35', '10.19.50', 'D', 'EKOK(30,45,75)=450 saniye=7 dakika 30 saniye. Sonuç 10.19.50.', 'EVET'],
    ['EK008', 'Matematik', 'EKOK • Saniye Hesabı', 'Temel', 'Üç uyarı 24, 40 ve 60 saniyede bir birlikte çalıyor. Saat 14.05.45’te birlikte çaldıklarına göre yeniden birlikte saat kaçta çalarlar?', '14.06.45', '14.07.45', '14.08.05', '14.08.45', 'B', 'EKOK(24,40,60)=120 saniye=2 dakika. Sonuç 14.07.45.', 'EVET'],
    ['EK009', 'Matematik', 'EKOK • Saniye Hesabı', 'Orta', 'Üç sistem 36, 48 ve 60 saniyede bir birlikte çalışıyor. Saat 16.27.15’te birlikte çalıştıklarına göre yeniden birlikte saat kaçta çalışırlar?', '16.37.15', '16.38.15', '16.39.15', '16.40.15', 'C', 'EKOK(36,48,60)=720 saniye=12 dakika. Sonuç 16.39.15.', 'EVET'],
  ];

  // Time-like options such as 10.20 must remain text; otherwise Sheets may
  // display them as 10.2 and change the meaning for the student.
  sheet.getRange(2, 6, rows.length, 4).setNumberFormat('@');
  sheet.getRange(2, 1, rows.length, CZA_HEADERS.questions.length).setValues(rows);
  sheet.getRange(2, 12, rows.length, 1).setHorizontalAlignment('center');
  sheet.setColumnWidth(5, 420);
  sheet.setColumnWidth(11, 420);
  sheet.getRange(2, 5, rows.length, 1).setWrap(true);
  sheet.getRange(2, 11, rows.length, 1).setWrap(true);
}

function seedHolisticSkills_(sheet) {
  if (sheet.getLastRow() > 1) return;

  const rows = [
    ['ZI01', 'Zihinsel Potansiyel', 'Zihinsel İşlem Hızı', 'İşlem akışını doğru, hızlı ve bağımsız sürdürebilme.', 'Anzan + Soroban + işlem stratejileri', '/learncycle → /levels → /speed → /adaptive → /mistakes', 'CZA Bütüncül Gelişim', 1, '#5267F7', 'EVET'],
    ['ZI02', 'Zihinsel Potansiyel', 'Sayısal Mantık', 'Sayı ilişkilerini, örüntüleri ve kuralları keşfederek çıkarım yapma.', 'Sayısal mantık + örüntü + problem çözme', '/teachme → /conceptsurgery → /minimalpairs → /levels → /adaptive', 'CZA Bütüncül Gelişim', 2, '#6175F8', 'EVET'],
    ['ZI03', 'Zihinsel Potansiyel', 'Görsel-Mekânsal Algı', 'Şekil, yön, parça-bütün ve zihinsel döndürme ilişkilerini kullanma.', 'Zihin Haritaları + görsel kodlama', '/visualcode → /mindmap → /attentionhunt → /levels', 'CZA Zihin Gelişim', 3, '#7184FA', 'EVET'],
    ['ZI04', 'Zihinsel Potansiyel', 'İşitsel Dikkat ve Hafıza', 'Sözel yönergeyi dinleme, bellekte tutma ve doğru sırayla uygulama.', 'İşitsel dikkat + yönerge çalışmaları', '/attentionhunt → /memory → /spaced → /adaptive', 'CZA Zihin Gelişim', 4, '#35C7DF', 'EVET'],
    ['AO01', 'Akademik Öğrenme', 'Matematik Tutumu ve Özgüven', 'Matematik görevine başlama, hata sonrası sürdürme ve güvenle yeniden deneme.', 'Soroban + Anzan + başarı basamaklandırma', '/teachme → /learncycle → /mistakes → /studymode → /adaptive → /errorbank', 'CZA Bütüncül Gelişim', 5, '#FFB052', 'EVET'],
    ['AO02', 'Akademik Öğrenme', 'Okuma Becerisi', 'Okuma doğruluğu, anlama, akıcılık ve hızı birlikte sürdürebilme.', 'Hızlı Okuma + anlama + paragraf stratejileri', '/readthink → /speed → /quizme → /adaptive → /retention', 'CZA Zihin Gelişim', 6, '#F39A46', 'EVET'],
    ['ZI05', 'Zihinsel Potansiyel', 'Hafıza ve Hatırlama', 'Bilgiyi kodlama, geri çağırma ve daha sonra yeniden kullanma.', 'Zihin Sarayı + Hikâye + Askı + Fonetik', '/visualcode → /flashcards → /memory → /memorytricks → /produce → /spaced', 'CZA Zihin Gelişim', 7, '#30B897', 'EVET'],
    ['OY01', 'Öğrenme ve Öz Yönetim', 'Organize Etme', 'Bilgiyi sınıflandırma, sıraya koyma ve çalışma sürecini yapılandırma.', 'Zihin Haritaları + planlama + çalışma düzeni', '/mindmap → /cheatsheet → /studymode → /produce → /selfcheck', 'CZA Zihin Gelişim', 8, '#28A985', 'EVET'],
    ['ZI06', 'Zihinsel Potansiyel', 'Dikkat ve Odaklanma', 'Dikkati başlatma, sürdürme ve dikkat dağıtıcılar sonrası yeniden odaklanma.', 'Derin Odak + dikkat egzersizleri', '/attentionhunt → /speed → /adaptive → /spaced → /selfcheck', 'CZA Zihin Gelişim', 9, '#22A1B8', 'EVET'],
    ['ZI07', 'Zihinsel Potansiyel', 'Düşünme ve Problem Çözme', 'Problemi parçalama, strateji seçme, çözme ve sonucu kontrol etme.', 'Problem çözme stratejileri + hata analizi', '/conceptsurgery → /minimalpairs → /distractors → /mistakes → /reversetest → /produce', 'CZA Bütüncül Gelişim', 10, '#765BE8', 'EVET'],
    ['DD01', 'Duygusal ve Değer Gelişimi', 'Duygusal Farkındalık', 'Duyguyu tanıma, nedenini anlamlandırma ve uygun tepki geliştirme.', 'Duygu farkındalığı + öz değerlendirme', '/feynman → /produce → /selfcheck', 'CZA Bütüncül Gelişim', 11, '#EB6D88', 'EVET'],
    ['OY02', 'Öğrenme ve Öz Yönetim', 'Koçluk ve Öz Liderlik', 'Hedef belirleme, sorumluluk alma ve kendi gelişimini yönetme.', 'Hedef koyma + görev takibi + öz liderlik', '/studymode → /adaptive → /errorbank → /selfcheck → /profile', 'CZA Bütüncül Gelişim', 12, '#9A67E8', 'EVET'],
    ['DD02', 'Duygusal ve Değer Gelişimi', 'Karakter ve Ahlaki Gelişim', 'Seçim-sonuç ilişkisi kurma, sorumluluk alma ve değer temelli karar verme.', 'Sorumluluk + seçim-sonuç + değer temelli karar', '/feynman → /reversetest → /produce → /selfcheck', 'CZA Bütüncül Gelişim', 13, '#D57955', 'EVET'],
    ['DD03', 'Duygusal ve Değer Gelişimi', 'Manevi Farkındalık ve Değerler', 'Şükür, merhamet, sabır, niyet ve anlam üzerine gerekçeli düşünme.', 'Şükür + sabır + merhamet + niyet ve anlam', '/feynman → /produce → /selfcheck', 'CZA Bütüncül Gelişim', 14, '#8E7A57', 'EVET'],
  ];

  sheet.getRange(2, 1, rows.length, CZA_HEADERS.holisticSkills.length).setValues(rows);
  sheet.getRange(2, 4, rows.length, 3).setWrap(true);
  sheet.setColumnWidth(2, 190);
  sheet.setColumnWidth(3, 240);
  sheet.setColumnWidth(4, 380);
  sheet.setColumnWidth(5, 310);
  sheet.setColumnWidth(6, 430);
  sheet.setColumnWidth(7, 210);
}

function seedContentCatalog_(sheet) {
  if (sheet.getLastRow() > 1) return;

  const skills = readHolisticSkills_();
  const rows = [];
  skills.forEach(function (skill) {
    const modules = skill.modules.split('→').map(function (item) { return item.trim(); });
    const activeWorkshop = skill.id === 'ZI01' || skill.id === 'ZI07';
    const activeSource = skill.id === 'ZI01'
      ? CZA_CONFIG.WORKSHOP_SESSIONS_SHEET : 'CZA_SORU_BANKASI';
    const stages = [
      ['KEŞFET', skill.name + ' Başlangıç Keşfi', 'Kısa Tanı', 6, '/pretest', 'MİMARİ HAZIR', '', 'Mevcut düzeyi ve başlangıç davranışını görünür kılar.'],
      ['ÖĞREN', skill.name + ' Mini Öğrenme', 'Mini Anlatım', 8, modules[0] || '/teachme', 'İÇERİK PLANLANDI', '', skill.description],
      ['UYGULA', skill.name + ' Uygulama Atölyesi', 'Etkileşimli Çalışma', 12, modules[1] || '/adaptive', activeWorkshop ? 'AKTİF' : 'İÇERİK PLANLANDI', activeWorkshop ? activeSource : '', skill.methods + ' yaklaşımıyla yönlendirmeli uygulama.'],
      ['USTALAŞ', skill.name + ' Ustalık Kontrolü', 'Ustalık Kontrolü', 7, '/mastery', 'İÇERİK PLANLANDI', '', 'Bağımsız kullanım, aktarım ve kalıcılık ölçümü.'],
    ];
    stages.forEach(function (stage, index) {
      rows.push([
        skill.id + '-' + String(index + 1).padStart(2, '0'),
        skill.id, skill.name, stage[0], stage[1], stage[2],
        'Başlangıç', stage[3], stage[4], skill.packageName,
        stage[5], stage[6], stage[7],
      ]);
    });
  });

  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, CZA_HEADERS.contentCatalog.length).setValues(rows);
  sheet.getRange(2, 5, rows.length, 9).setWrap(true);
  sheet.setColumnWidth(3, 240);
  sheet.setColumnWidth(5, 300);
  sheet.setColumnWidth(9, 160);
  sheet.setColumnWidth(10, 210);
  sheet.setColumnWidth(13, 390);
}

function findStudent_(normalizedCode) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.STUDENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const width = Math.max(sheet.getLastColumn(), 8);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    if (normalizeCode_(row[0]) === normalizedCode) {
      return {
        code: String(row[0]).trim(),
        name: String(row[1] || '').trim(),
        grade: String(row[2] || '').trim(),
        packageName: String(row[3] || '').trim(),
        pin: String(row[7] || '').trim(),
      };
    }
  }
  return null;
}

function findEducator_(normalizedCode) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.EDUCATORS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.educators.length
  ).getDisplayValues();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const active = ['EVET', 'TRUE', '1', 'AKTİF', 'AKTIF'].indexOf(
      String(row[4] || '').toUpperCase()
    ) !== -1;
    if (normalizeEducatorCode_(row[0]) === normalizedCode && active) {
      return {
        code: String(row[0] || '').trim(),
        name: String(row[1] || '').trim(),
        role: String(row[2] || 'EĞİTİMCİ').trim(),
        pin: String(row[3] || '').trim(),
      };
    }
  }
  return null;
}

function publicStudent_(student) {
  return {
    code: student.code,
    name: student.name,
    grade: student.grade,
    packageName: student.packageName,
  };
}

function publicEducator_(educator) {
  return { code: educator.code, name: educator.name, role: educator.role };
}

function requireSession_(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yapın.');

  const cache = CacheService.getScriptCache();
  const key = CZA_CONFIG.SESSION_PREFIX + cleanToken;
  const stored = cache.get(key);
  if (!stored) throw new Error('Oturum süresi doldu. Lütfen yeniden giriş yapın.');

  cache.put(key, stored, CZA_CONFIG.SESSION_SECONDS);
  return JSON.parse(stored);
}

function requireEducatorSession_(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Eğitimci oturumu bulunamadı.');
  const cache = CacheService.getScriptCache();
  const key = CZA_CONFIG.EDUCATOR_SESSION_PREFIX + cleanToken;
  const stored = cache.get(key);
  if (!stored) throw new Error('Eğitimci oturumunun süresi doldu. Lütfen yeniden giriş yapın.');
  cache.put(key, stored, CZA_CONFIG.EDUCATOR_SESSION_SECONDS);
  return JSON.parse(stored);
}

function readQuestionRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.QUESTIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CZA_HEADERS.questions.length)
    .getDisplayValues()
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      return {
        id: row[0], lesson: row[1], skill: row[2], level: row[3], prompt: row[4],
        optionA: row[5], optionB: row[6], optionC: row[7], optionD: row[8],
        correctAnswer: String(row[9]).toUpperCase(), explanation: row[10],
        active: ['EVET', 'TRUE', '1', 'AKTİF', 'AKTIF'].indexOf(String(row[11]).toUpperCase()) !== -1,
      };
    });
}

function getAttemptCounts_(studentCode) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.ANSWERS_SHEET);
  const counts = {};
  if (!sheet || sheet.getLastRow() < 2) return counts;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, CZA_HEADERS.answers.length).getDisplayValues();
  rows.forEach(function (row) {
    if (normalizeCode_(row[1]) === normalizeCode_(studentCode)) {
      counts[row[2]] = (counts[row[2]] || 0) + 1;
    }
  });
  return counts;
}

function findTargetSkill_(studentCode, questions) {
  const orderedSkills = [];
  questions.forEach(function (question) {
    const key = question.lesson + '||' + question.skill;
    if (!orderedSkills.some(function (item) { return item.key === key; })) {
      orderedSkills.push({ key: key, lesson: question.lesson, skill: question.skill });
    }
  });

  const mastery = getMasteryRows_(studentCode);
  for (let index = 0; index < orderedSkills.length; index += 1) {
    const skill = orderedSkills[index];
    const existing = mastery.find(function (row) {
      return row.lesson === skill.lesson && row.skill === skill.skill;
    });
    if (!existing || existing.status !== 'Tamamlandı') return skill;
  }
  return null;
}

function updateMastery_(studentCode, lesson, skill) {
  const ss = getSpreadsheet_();
  const answersSheet = ss.getSheetByName(CZA_CONFIG.ANSWERS_SHEET);
  const masterySheet = ss.getSheetByName(CZA_CONFIG.MASTERY_SHEET);
  const answerRows = answersSheet.getLastRow() < 2
    ? []
    : answersSheet.getRange(2, 1, answersSheet.getLastRow() - 1, CZA_HEADERS.answers.length).getValues();

  const matching = answerRows.filter(function (row) {
    return normalizeCode_(row[1]) === normalizeCode_(studentCode)
      && String(row[3]) === lesson
      && String(row[4]) === skill;
  });
  const recent = matching.slice(-3);
  const correctCount = recent.filter(function (row) { return row[6] === true; }).length;
  const total = recent.length;
  const rate = total ? correctCount / total : 0;
  let status = 'Çalışıyor';
  if (total === 3 && correctCount === 3) status = 'Tamamlandı';
  if (total === 3 && correctCount < 3) status = 'Telafi gerekli';

  const existingRows = masterySheet.getLastRow() < 2
    ? []
    : masterySheet.getRange(2, 1, masterySheet.getLastRow() - 1, CZA_HEADERS.mastery.length).getDisplayValues();
  let targetRow = masterySheet.getLastRow() + 1;
  for (let index = 0; index < existingRows.length; index += 1) {
    const row = existingRows[index];
    if (normalizeCode_(row[0]) === normalizeCode_(studentCode)
        && row[1] === lesson && row[2] === skill) {
      targetRow = index + 2;
      break;
    }
  }

  masterySheet.getRange(targetRow, 1, 1, CZA_HEADERS.mastery.length).setValues([[
    studentCode, lesson, skill, correctCount, total, rate, status, new Date(),
  ]]);
  masterySheet.getRange(targetRow, 6).setNumberFormat('0%');

  return {
    lesson: lesson,
    skill: skill,
    correct: correctCount,
    total: total,
    rate: rate,
    status: status,
  };
}

function getMasteryRows_(studentCode) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.MASTERY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CZA_HEADERS.mastery.length)
    .getValues()
    .filter(function (row) {
      return normalizeCode_(row[0]) === normalizeCode_(studentCode);
    })
    .map(function (row) {
      return {
        lesson: String(row[1]), skill: String(row[2]),
        correct: Number(row[3]) || 0, total: Number(row[4]) || 0,
        rate: Number(row[5]) || 0, status: String(row[6] || 'Çalışıyor'),
      };
    });
}

function readHolisticSkills_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.HOLISTIC_SKILLS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.holisticSkills.length
  ).getDisplayValues()
    .filter(function (row) {
      return row[0] && ['EVET', 'TRUE', '1', 'AKTİF', 'AKTIF'].indexOf(
        String(row[9]).toUpperCase()
      ) !== -1;
    })
    .map(function (row) {
      return {
        id: row[0], category: row[1], name: row[2], description: row[3],
        methods: row[4], modules: row[5], packageName: row[6],
        order: Number(row[7]) || 999, color: row[8] || '#5267F7',
      };
    })
    .sort(function (left, right) { return left.order - right.order; });
}

function readContentCatalog_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.CONTENT_CATALOG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.contentCatalog.length
  ).getDisplayValues()
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      return {
        id: row[0], skillId: row[1], skillName: row[2], stage: row[3],
        title: row[4], type: row[5], level: row[6],
        duration: Number(row[7]) || 0, module: row[8], packageName: row[9],
        status: row[10], reference: row[11], description: row[12],
      };
    });
}

function getHolisticProfile_(studentCode, includeContent) {
  const definitions = readHolisticSkills_();
  const scoreSheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.SKILL_SCORES_SHEET);
  let scoreRow = null;
  if (scoreSheet && scoreSheet.getLastRow() >= 2) {
    const rows = scoreSheet.getRange(
      2, 1, scoreSheet.getLastRow() - 1, Math.max(scoreSheet.getLastColumn(), 17)
    ).getValues();
    scoreRow = rows.find(function (row) {
      return normalizeCode_(row[0]) === normalizeCode_(studentCode);
    }) || null;
  }

  const content = readContentCatalog_();
  return buildHolisticProfileFromData_(definitions, scoreRow, content, includeContent);
}

function holisticScoreValue_(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  const score = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(score) && score >= 1 && score <= 5 ? score : 0;
}

function buildHolisticProfileFromData_(definitions, scoreRow, content, includeContent) {
  const skills = definitions.map(function (definition, index) {
    const score = scoreRow ? holisticScoreValue_(scoreRow[index + 2]) : 0;
    const items = content.filter(function (item) { return item.skillId === definition.id; });
    const result = {
      id: definition.id,
      category: definition.category,
      name: definition.name,
      description: definition.description,
      methods: definition.methods,
      modules: definition.modules,
      packageName: definition.packageName,
      order: definition.order,
      color: definition.color,
      score: score,
      status: holisticScoreStatus_(score),
      contentCount: items.length,
      activeContentCount: items.filter(function (item) { return item.status === 'AKTİF'; }).length,
    };
    if (includeContent) result.content = items;
    return result;
  });

  const assessed = skills.filter(function (skill) { return skill.score > 0; });
  const assessmentComplete = skills.length > 0 && assessed.length === skills.length;
  const strengths = assessed.slice().sort(function (left, right) {
    return right.score - left.score || left.order - right.order;
  }).slice(0, 3);
  const priorities = assessed.slice().sort(function (left, right) {
    return left.score - right.score || left.order - right.order;
  }).slice(0, 3);
  const categories = [];
  skills.forEach(function (skill) {
    let group = categories.find(function (item) { return item.name === skill.category; });
    if (!group) {
      group = { name: skill.category, total: 0, scored: 0, count: 0, skills: 0 };
      categories.push(group);
    }
    group.skills += 1;
    if (skill.score) {
      group.total += skill.score;
      group.scored += 1;
    }
  });
  categories.forEach(function (group) {
    group.average = group.scored ? group.total / group.scored : 0;
    delete group.total;
    delete group.scored;
  });

  const average = assessed.length
    ? assessed.reduce(function (sum, skill) { return sum + skill.score; }, 0) / assessed.length
    : 0;
  return {
    hasAssessment: assessmentComplete,
    assessmentComplete: assessmentComplete,
    assessedSkills: assessed.length,
    profileLabel: assessmentComplete && scoreRow ? String(scoreRow[16] || '') : '',
    average: average,
    totalSkills: skills.length,
    categories: categories,
    strengths: assessmentComplete ? strengths : [],
    priorities: assessmentComplete ? priorities : [],
    skills: skills,
  };
}

function getHolisticProfilesMap_(studentCodes) {
  const definitions = readHolisticSkills_();
  const content = readContentCatalog_();
  const scoreSheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.SKILL_SCORES_SHEET);
  const scoreRows = !scoreSheet || scoreSheet.getLastRow() < 2
    ? []
    : scoreSheet.getRange(
      2, 1, scoreSheet.getLastRow() - 1, Math.max(scoreSheet.getLastColumn(), 17)
    ).getValues();
  const result = {};
  studentCodes.forEach(function (studentCode) {
    const scoreRow = scoreRows.find(function (row) {
      return normalizeCode_(row[0]) === normalizeCode_(studentCode);
    }) || null;
    result[normalizeCode_(studentCode)] = buildHolisticProfileFromData_(
      definitions, scoreRow, content, false
    );
  });
  return result;
}

function buildDailyRoute_(profile, todayAnswers, dailyGoal, todayKey) {
  profile = profile || {};
  const skills = profile.skills || [];
  const assessed = skills.filter(function (skill) { return holisticScoreValue_(skill.score) > 0; });
  // A populated score row or content catalogue is not a completed assessment.
  // Both portals receive this same gate; no unmeasured skill may become a strength.
  if (!profile.hasAssessment || !skills.length || assessed.length !== skills.length
      || profile.assessmentComplete === false) {
    const partial = assessed.length > 0;
    return {
      ready: false,
      assessmentRequired: true,
      assessedSkills: assessed.length,
      totalSkills: skills.length,
      title: partial ? 'Başlangıç değerlendirmeni tamamlayalım' : 'Önce seni tanıyalım',
      summary: partial
        ? assessed.length + '/' + skills.length + ' beceri alanı değerlendirildi. Kişisel rotan için kalan değerlendirmelerin tamamlanması gerekiyor.'
        : 'Başlangıç değerlendirmen henüz hazır değil. Güçlü alanların ve kişisel rotan değerlendirme sonuçlarına göre belirlenecek.',
      guidance: 'Başlangıç değerlendirmesini eğitimcinle tamamla. Sonuçlar kaydedildikten sonra ana ekranını yenile. Genel alıştırmalar ve sana atanan içerikler bu sırada kullanılabilir.',
      educatorSummary: partial
        ? 'Başlangıç değerlendirmesi eksik: ' + assessed.length + '/' + skills.length + ' beceri alanı değerlendirildi.'
        : 'Başlangıç değerlendirmesi bekleniyor.',
      educatorGuidance: 'Önce başlangıç değerlendirmesini tamamlayıp beceri puanlarını kaydedin. Tamamlanana kadar kişisel rota ve güçlü alan seçimi yapılmaz.',
      totalMinutes: 0,
      progress: 0,
      completed: false,
      steps: [],
    };
  }
  const strengths = (profile.strengths || []).map(function (item) {
    return assessed.find(function (skill) { return skill.id === item.id; });
  }).filter(Boolean);
  const priorities = (profile.priorities || []).map(function (item) {
    return assessed.find(function (skill) { return skill.id === item.id; });
  }).filter(Boolean);
  const dayNumber = Number(String(todayKey || '').slice(-2)) || 1;
  const strength = strengths.length
    ? strengths[(dayNumber - 1) % strengths.length]
    : (skills[0] || null);

  // Live workshops include problem solving plus the Soroban–Anzan ZI01 pilot.
  // The same rule selects the student's lowest-scoring live priority.
  const liveSkills = skills.filter(function (skill) { return skill.activeContentCount > 0; })
    .sort(function (left, right) {
      const leftScore = left.score || 99;
      const rightScore = right.score || 99;
      return leftScore - rightScore || left.order - right.order;
    });
  const focus = priorities.find(function (skill) { return skill.activeContentCount > 0; })
    || liveSkills[0]
    || priorities[0]
    || skills[0]
    || null;
  const remainingPriorities = priorities.filter(function (skill) {
    return !focus || skill.id !== focus.id;
  });
  const balance = remainingPriorities.length
    ? remainingPriorities[(dayNumber - 1) % remainingPriorities.length]
    : (priorities[0] || skills[1] || focus);

  if (!strength || !focus || !balance) {
    return {
      ready: false,
      title: 'Bugünkü kişisel rota hazırlanıyor',
      summary: 'Beceri değerlendirmeleri tamamlandığında güçlü alanların günlük çalışmalarına bağlanacak.',
      totalMinutes: 0,
      progress: 0,
      steps: [],
    };
  }

  const completedQuestions = Math.min(Number(todayAnswers) || 0, dailyGoal);
  const routeProgress = dailyGoal ? completedQuestions / dailyGoal : 0;
  return {
    ready: true,
    assessmentRequired: false,
    dateLabel: turkishDateLabel_(new Date()),
    title: 'Güçlü yönünden güç alan bugünkü rota',
    summary: strength.name + ' gücünü ' + focus.name
      + ' çalışmasına bağlıyoruz; günü ' + balance.name + ' ile dengeliyoruz.',
    connection: strength.name + ' → ' + focus.name + ' → ' + balance.name,
    totalMinutes: 20,
    progress: routeProgress,
    completed: completedQuestions >= dailyGoal,
    steps: [
      {
        id: 'prepare', number: 1, kind: 'strength', eyebrow: 'GÜÇLÜ KAYNAĞIN',
        title: strength.name + ' ile zemini hazırla',
        description: routePreparationText_(strength.name),
        meta: '3 dk • ' + strength.name + ' • ' + strength.score + '/5',
        skillId: strength.id, action: 'skill', actionLabel: 'Yöntemi gör',
      },
      {
        id: 'practice', number: 2, kind: 'focus', eyebrow: 'ANA GELİŞİM GÖREVİN',
        title: routeFocusTitle_(focus.name),
        description: routeFocusText_(focus.name, dailyGoal, completedQuestions),
        meta: '12 dk • ' + completedQuestions + '/' + dailyGoal + ' soru • ' + focus.name,
        skillId: focus.id, action: focus.activeContentCount ? 'learning' : 'skill',
        actionLabel: completedQuestions >= dailyGoal ? 'Pekiştirmeye devam et' : 'Ana çalışmayı aç',
        progress: routeProgress,
      },
      {
        id: 'reflect', number: 3, kind: 'balance', eyebrow: 'GÜNÜN KAPANIŞI',
        title: routeReflectionTitle_(balance.name),
        description: routeReflectionText_(balance.name),
        meta: '5 dk • ' + balance.name + ' • ' + balance.score + '/5',
        skillId: balance.id, action: 'skill', actionLabel: 'Beceri yolunu gör',
      },
    ],
  };
}

function routePreparationText_(skillName) {
  const texts = {
    'Hafıza ve Hatırlama': 'Çözüm yolunu beş anahtar kelimeyle kodla; her adımdan sonra sırayı zihninden geri çağır.',
    'Organize Etme': 'Soruyu “verilenler – istenen – plan” şeklinde üç küçük bölüme ayır.',
    'Zihinsel İşlem Hızı': 'İşleme başlamadan önce yaklaşık sonucu tahmin et; sonra doğruluk öncelikli ilerle.',
    'Görsel-Mekânsal Algı': 'Bilgiyi küçük bir şema veya oklarla görünür hâle getir.',
    'Okuma Becerisi': 'Soru kökünü bir kez anlam için, ikinci kez anahtar bilgiler için oku.',
    'Duygusal Farkındalık': 'Başlamadan önce duygunu adlandır ve çalışmayı bitireceğin küçük hedefi söyle.',
  };
  return texts[skillName]
    || skillName + ' gücünü kullanarak görevin ana parçalarını önce görünür hâle getir.';
}

function routeFocusTitle_(skillName) {
  if (skillName === 'Düşünme ve Problem Çözme') {
    return 'Verilen → İstenen → Plan → Çöz → Kontrol';
  }
  if (skillName === 'Matematik Tutumu ve Özgüven') return 'Başarı basamağı: küçük adım, güvenli tekrar';
  return skillName + ' uygulama atölyesi';
}

function routeFocusText_(skillName, dailyGoal, completedQuestions) {
  if (skillName === 'Düşünme ve Problem Çözme') {
    return 'Her soruda önce verilenleri ve isteneni ayır; stratejini seç, çöz ve sonucun mantığını kontrol et.';
  }
  return skillName + ' alanında ' + Math.max(dailyGoal - completedQuestions, 0)
    + ' kısa uygulama ile bugünkü hedefini tamamla.';
}

function routeReflectionTitle_(skillName) {
  const titles = {
    'Matematik Tutumu ve Özgüven': 'Yeniden deneme notu',
    'Karakter ve Ahlaki Gelişim': 'Seçim → sonuç günlüğü',
    'Duygusal Farkındalık': 'Duygu → neden → tepki günlüğü',
    'Koçluk ve Öz Liderlik': 'Bugünün küçük liderlik kararı',
    'Manevi Farkındalık ve Değerler': 'Niyet ve şükür durağı',
  };
  return titles[skillName] || skillName + ' öz değerlendirmesi';
}

function routeReflectionText_(skillName) {
  const texts = {
    'Matematik Tutumu ve Özgüven': 'Zorlandığın bir anı seç: “Nerede durdum, neyi değiştirip yeniden denedim?” cümlesini tamamla.',
    'Karakter ve Ahlaki Gelişim': 'Bugünkü bir seçimini, ortaya çıkan sonucu ve yarın vereceğin daha güçlü kararı düşün.',
    'Duygusal Farkındalık': 'Çalışma sırasında hissettiğin duyguyu, nedenini ve seçtiğin tepkiyi adlandır.',
    'Koçluk ve Öz Liderlik': 'Bugün sorumluluğunu aldığın tek davranışı ve yarınki küçük hedefini belirle.',
    'Manevi Farkındalık ve Değerler': 'Bugünkü çalışmanın niyetini ve şükrettiğin bir gelişmeyi kısa bir cümleyle ifade et.',
  };
  return texts[skillName]
    || 'Bugün bu beceriyi nerede kullandığını ve yarın atacağın küçük adımı düşün.';
}

function turkishDateLabel_(date) {
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  return days[date.getDay()] + ' • ' + date.getDate() + ' ' + months[date.getMonth()];
}

function holisticScoreStatus_(score) {
  if (!score) return 'Değerlendirme bekliyor';
  if (score <= 1) return 'Yoğun destek';
  if (score === 2) return 'Gelişim önceliği';
  if (score === 3) return 'Gelişiyor';
  if (score === 4) return 'Güçlü';
  return 'Çok güçlü';
}

function recordCampusLogin_(studentCode) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.CAMPUS_STATE_SHEET);
  if (!sheet) return;
  const rowNumber = findCampusStateRow_(sheet, studentCode);
  if (rowNumber) {
    sheet.getRange(rowNumber, 3).setValue(new Date());
  } else {
    sheet.appendRow([studentCode, new Date(), new Date(), false, '', 0]);
  }
}

function findCampusStateRow_(sheet, studentCode) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const codes = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let index = 0; index < codes.length; index += 1) {
    if (normalizeCode_(codes[index][0]) === normalizeCode_(studentCode)) return index + 2;
  }
  return 0;
}

function getCampusState_(studentCode) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.CAMPUS_STATE_SHEET);
  const rowNumber = findCampusStateRow_(sheet, studentCode);
  if (!rowNumber) {
    return { onboardingCompleted: false, firstLogin: true, completedTasks: 0 };
  }
  const row = sheet.getRange(rowNumber, 1, 1, CZA_HEADERS.campusState.length).getValues()[0];
  return {
    onboardingCompleted: row[3] === true,
    firstLogin: false,
    completedTasks: Number(row[5]) || 0,
  };
}

function getDashboardForCode_(studentCode) {
  const questions = readQuestionRows_().filter(function (question) { return question.active; });
  const uniqueSkills = [];
  questions.forEach(function (question) {
    const key = question.lesson + '||' + question.skill;
    if (!uniqueSkills.some(function (item) { return item.key === key; })) {
      uniqueSkills.push({ key: key, lesson: question.lesson, skill: question.skill });
    }
  });

  const mastery = getMasteryRows_(studentCode);
  const skills = uniqueSkills.map(function (item) {
    const row = mastery.find(function (existing) {
      return existing.lesson === item.lesson && existing.skill === item.skill;
    });
    return row || {
      lesson: item.lesson, skill: item.skill, correct: 0, total: 0,
      rate: 0, status: 'Başlanmadı',
    };
  });
  const completed = skills.filter(function (item) { return item.status === 'Tamamlandı'; }).length;

  const ss = getSpreadsheet_();
  const answerSheet = ss.getSheetByName(CZA_CONFIG.ANSWERS_SHEET);
  const answerRows = !answerSheet || answerSheet.getLastRow() < 2
    ? []
    : answerSheet.getRange(2, 1, answerSheet.getLastRow() - 1, CZA_HEADERS.answers.length)
      .getValues()
      .filter(function (row) {
        return normalizeCode_(row[1]) === normalizeCode_(studentCode);
      });

  const timeZone = Session.getScriptTimeZone() || 'Europe/Istanbul';
  const todayKey = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  const totalAnswers = answerRows.length;
  const totalCorrect = answerRows.filter(function (row) { return row[6] === true; }).length;
  const todayAnswers = answerRows.filter(function (row) {
    return row[0] instanceof Date
      && Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') === todayKey;
  }).length;
  const dailyGoal = 5;
  const xp = (totalCorrect * 25) + (completed * 100);
  const levelSize = 250;
  const level = Math.floor(xp / levelSize) + 1;
  const nextSkill = skills.find(function (item) { return item.status !== 'Tamamlandı'; }) || null;
  const holisticProfile = getHolisticProfile_(studentCode, false);
  const dailyRoute = buildDailyRoute_(holisticProfile, todayAnswers, dailyGoal, todayKey);

  const weeklyActivity = [];
  const dayLabels = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const key = Utilities.formatDate(day, timeZone, 'yyyy-MM-dd');
    const count = answerRows.filter(function (row) {
      return row[0] instanceof Date
        && Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') === key;
    }).length;
    weeklyActivity.push({ label: dayLabels[day.getDay()], count: count });
  }

  return {
    completedSkills: completed,
    totalSkills: skills.length,
    progress: skills.length ? completed / skills.length : 0,
    skills: skills,
    totalAnswers: totalAnswers,
    totalCorrect: totalCorrect,
    accuracy: totalAnswers ? totalCorrect / totalAnswers : 0,
    xp: xp,
    level: level,
    levelProgress: (xp % levelSize) / levelSize,
    xpToNextLevel: levelSize - (xp % levelSize),
    streak: calculateStreak_(answerRows, timeZone),
    todayAnswers: todayAnswers,
    dailyGoal: dailyGoal,
    dailyProgress: Math.min(todayAnswers / dailyGoal, 1),
    nextSkill: nextSkill ? {
      lesson: nextSkill.lesson,
      skill: nextSkill.skill,
      status: nextSkill.status,
    } : null,
    weeklyActivity: weeklyActivity,
    holisticProfile: holisticProfile,
    dailyRoute: dailyRoute,
    campusState: getCampusState_(studentCode),
    assignedContent: getAssignedContentsForStudent_(studentCode),
    assignedWorkshops: getWorkshopAssignmentsForStudent_(studentCode, false),
    educatorAssessmentStatus: getStudentEducatorAssessmentStatus_(studentCode),
  };
}

function getStudentEducatorAssessmentStatus_(studentCode) {
  const code = normalizeCode_(studentCode);
  const records = readEducatorAssessmentRows_().filter(function (item) {
    return item.studentCode === code;
  }).sort(function (left, right) { return right.updatedAtMs - left.updatedAtMs; });
  const completed = records.find(function (item) { return item.status === 'TAMAMLANDI'; });
  const current = completed || records[0];
  if (!current) {
    return {
      code: 'BEKLİYOR', label: 'Eğitmen değerlendirmesi bekleniyor',
      message: 'Standart görevler eğitimcin tarafından uygulandığında değerlendirme durumu burada görünecek.',
    };
  }
  if (current.status !== 'TAMAMLANDI') {
    return {
      code: 'SÜRÜYOR', label: 'Eğitmen değerlendirmen hazırlanıyor',
      message: 'Form ' + current.form + ' taslak olarak kaydedildi. Eğitimcin tamamladığında sonraki hedefin burada görünecek.',
      updatedAt: formatOptionalEducatorDate_(current.updatedAt),
    };
  }
  const nextTarget = current.data && current.data.notes
    ? cleanContentText_(current.data.notes.nextTarget, 400) : '';
  return {
    code: 'TAMAMLANDI', label: 'Eğitmen değerlendirmen tamamlandı',
    message: nextTarget ? 'Sonraki çalışma hedefin: ' + nextTarget : 'Sonuçların eğitimcin tarafından öğrenci dosyana bağlandı.',
    form: current.form, completedAt: formatOptionalEducatorDate_(current.completedAt),
  };
}

function getEducatorDashboardData_() {
  const students = readPublicStudents_();
  const studentCodes = students.map(function (student) { return student.code; });
  const profiles = getHolisticProfilesMap_(studentCodes);
  const answerRows = readAllAnswerRows_();
  const campusRows = readCampusRowsMap_();
  const timeZone = Session.getScriptTimeZone() || 'Europe/Istanbul';
  const now = new Date();
  const todayKey = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd');
  const answerMap = {};
  answerRows.forEach(function (row) {
    const code = normalizeCode_(row[1]);
    if (!answerMap[code]) answerMap[code] = [];
    answerMap[code].push(row);
  });

  const studentRows = students.map(function (student) {
    const code = normalizeCode_(student.code);
    const studentAnswers = answerMap[code] || [];
    const profile = profiles[code] || buildHolisticProfileFromData_([], null, [], false);
    const totalAnswers = studentAnswers.length;
    const totalCorrect = studentAnswers.filter(function (row) { return row[6] === true; }).length;
    const todayAnswers = studentAnswers.filter(function (row) {
      return row[0] instanceof Date
        && Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') === todayKey;
    }).length;
    const answerDates = studentAnswers
      .map(function (row) { return row[0]; })
      .filter(function (value) { return value instanceof Date; });
    const campus = campusRows[code] || null;
    if (campus && campus.lastLogin instanceof Date) answerDates.push(campus.lastLogin);
    const lastActivity = answerDates.length
      ? new Date(Math.max.apply(null, answerDates.map(function (date) { return date.getTime(); })))
      : null;
    const daysSince = lastActivity
      ? Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / 86400000))
      : 999;
    let status = 'İlgi gerekli';
    if (todayAnswers > 0) status = 'Bugün aktif';
    else if (daysSince <= 7) status = 'Takipte';
    const route = buildDailyRoute_(profile, todayAnswers, 5, todayKey);
    const risk = calculateStudentRisk_({
      hasAssessment: profile.hasAssessment,
      daysSinceLastActivity: daysSince,
      totalAnswers: totalAnswers,
      accuracy: totalAnswers ? totalCorrect / totalAnswers : 0,
      priorities: profile.priorities,
    });

    return {
      code: student.code,
      name: student.name,
      grade: student.grade,
      packageName: student.packageName,
      hasAssessment: profile.hasAssessment,
      profileLabel: profile.profileLabel,
      average: profile.average,
      strengths: profile.strengths.map(function (skill) {
        return { id: skill.id, name: skill.name, score: skill.score };
      }),
      priorities: profile.priorities.map(function (skill) {
        return { id: skill.id, name: skill.name, score: skill.score };
      }),
      totalAnswers: totalAnswers,
      accuracy: totalAnswers ? totalCorrect / totalAnswers : 0,
      todayAnswers: todayAnswers,
      streak: calculateStreak_(studentAnswers, timeZone),
      status: status,
      risk: risk,
      daysSinceLastActivity: daysSince,
      lastActivity: lastActivity ? formatEducatorDate_(lastActivity, timeZone) : 'Henüz etkinlik yok',
      route: route.ready ? {
        connection: route.connection,
        focusTitle: route.steps[1] ? route.steps[1].title : '',
        progress: route.progress,
      } : null,
    };
  });

  const skillStats = [];
  const skillNames = {};
  studentRows.forEach(function (student) {
    const profile = profiles[normalizeCode_(student.code)];
    (profile && profile.skills || []).forEach(function (skill) {
      if (!skillNames[skill.id]) {
        skillNames[skill.id] = {
          id: skill.id, name: skill.name, category: skill.category,
          color: skill.color, total: 0, count: 0, supportCount: 0,
        };
      }
      if (skill.score > 0) {
        skillNames[skill.id].total += skill.score;
        skillNames[skill.id].count += 1;
        if (skill.score <= 2) skillNames[skill.id].supportCount += 1;
      }
    });
  });
  Object.keys(skillNames).forEach(function (id) {
    const item = skillNames[id];
    skillStats.push({
      id: item.id, name: item.name, category: item.category, color: item.color,
      average: item.count ? item.total / item.count : 0,
      assessedCount: item.count, supportCount: item.supportCount,
    });
  });
  skillStats.sort(function (left, right) {
    return right.supportCount - left.supportCount || left.average - right.average;
  });

  const totalAnswers = studentRows.reduce(function (sum, student) {
    return sum + student.totalAnswers;
  }, 0);
  const weightedCorrect = studentRows.reduce(function (sum, student) {
    return sum + (student.accuracy * student.totalAnswers);
  }, 0);
  const interventionRows = readEducatorInterventionRows_();
  const interventionHistoryRows = readEducatorInterventionHistoryRows_();
  const interventionCenter = buildEducatorInterventionCenter_(
    interventionRows, students, now, timeZone, interventionHistoryRows
  );
  const weeklyReport = buildEducatorWeeklyReport_(
    studentRows, answerMap, interventionCenter, now, timeZone, interventionHistoryRows
  );
  weeklyReport.archives = getRecentEducatorWeeklyReports_(8);
  return {
    generatedAt: formatEducatorDate_(now, timeZone),
    metrics: {
      totalStudents: studentRows.length,
      activeToday: studentRows.filter(function (student) { return student.todayAnswers > 0; }).length,
      activeSevenDays: studentRows.filter(function (student) {
        return student.daysSinceLastActivity <= 7;
      }).length,
      needsAttention: studentRows.filter(function (student) {
        return student.risk.level === 'YÜKSEK' || student.risk.level === 'ORTA';
      }).length,
      highRisk: studentRows.filter(function (student) {
        return student.risk.level === 'YÜKSEK';
      }).length,
      assessedStudents: studentRows.filter(function (student) { return student.hasAssessment; }).length,
      totalAnswers: totalAnswers,
      averageAccuracy: totalAnswers ? weightedCorrect / totalAnswers : 0,
    },
    students: studentRows,
    skillAlerts: skillStats.slice(0, 6),
    content: getEducatorContentOverview_(),
    workshopAssignments: getEducatorWorkshopAssignmentOverview_(),
    interventionCenter: interventionCenter,
    weeklyReport: weeklyReport,
  };
}

function calculateStudentRisk_(input) {
  const data = input || {};
  const reasons = [];
  let score = 0;
  if (!data.hasAssessment) {
    score += 3;
    reasons.push('Başlangıç değerlendirmesi tamamlanmadı');
  }
  const daysSince = Number(data.daysSinceLastActivity);
  if (daysSince >= 14) {
    score += 4;
    reasons.push('14 günden uzun süredir etkinlik yok');
  } else if (daysSince >= 7) {
    score += 2;
    reasons.push('Son 7 günde etkinlik görülmedi');
  } else if (daysSince >= 3) {
    score += 1;
    reasons.push('Çalışma ritmi zayıflıyor');
  }
  const totalAnswers = Number(data.totalAnswers) || 0;
  const accuracy = Number(data.accuracy) || 0;
  if (!totalAnswers) {
    score += 1;
    reasons.push('Yeterli çalışma verisi oluşmadı');
  } else if (totalAnswers >= 3 && accuracy < 0.5) {
    score += 3;
    reasons.push('Doğruluk yüzde 50’nin altında');
  } else if (totalAnswers >= 3 && accuracy < 0.65) {
    score += 1;
    reasons.push('Doğruluk destek eşiğinde');
  }
  const priorityScores = (data.priorities || []).map(function (skill) {
    return Number(skill.score) || 0;
  }).filter(function (scoreValue) { return scoreValue > 0; });
  const lowestPriority = priorityScores.length ? Math.min.apply(null, priorityScores) : 0;
  if (lowestPriority && lowestPriority <= 1) {
    score += 2;
    reasons.push('Öncelikli beceri puanı 1/5 düzeyinde');
  } else if (lowestPriority && lowestPriority <= 2) {
    score += 1;
    reasons.push('Öncelikli beceri desteğe ihtiyaç duyuyor');
  }
  return {
    score: score,
    level: score >= 7 ? 'YÜKSEK' : (score >= 3 ? 'ORTA' : 'DÜŞÜK'),
    reasons: reasons.slice(0, 3),
  };
}

function getEducatorStudentRisk_(studentCode, dashboard) {
  const code = normalizeCode_(studentCode);
  const answerDates = readAllAnswerRows_().filter(function (row) {
    return normalizeCode_(row[1]) === code && row[0] instanceof Date;
  }).map(function (row) { return row[0]; });
  const campus = readCampusRowsMap_()[code];
  if (campus && campus.lastLogin instanceof Date) answerDates.push(campus.lastLogin);
  const now = new Date();
  const lastActivity = answerDates.length
    ? new Date(Math.max.apply(null, answerDates.map(function (date) { return date.getTime(); })))
    : null;
  const daysSince = lastActivity
    ? Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / 86400000))
    : 999;
  return calculateStudentRisk_({
    hasAssessment: dashboard.holisticProfile && dashboard.holisticProfile.hasAssessment,
    daysSinceLastActivity: daysSince,
    totalAnswers: dashboard.totalAnswers,
    accuracy: dashboard.accuracy,
    priorities: dashboard.holisticProfile && dashboard.holisticProfile.priorities,
  });
}

function buildEducatorDocumentTracking_(documents, assignments, students, progressRows, now) {
  const published = {};
  documents.forEach(function (document) {
    if (document.status === 'YAYINDA') published[document.id] = true;
  });
  const currentTargets = {};
  assignments.forEach(function (assignment) {
    if (!published[assignment.documentId] || assignment.status !== 'AKTİF') return;
    students.forEach(function (student) {
      if (!assignmentMatchesStudent_(assignment, student, now)) return;
      const key = assignment.documentId + '|' + normalizeCode_(student.code);
      const existing = currentTargets[key];
      if (!existing || assignment.assignedAtMs >= existing.assignedAtMs) {
        currentTargets[key] = {
          assignmentId: assignment.id, documentId: assignment.documentId,
          studentCode: student.code, assignedAtMs: assignment.assignedAtMs,
        };
      }
    });
  });
  const progressMap = {};
  progressRows.forEach(function (progress) {
    progressMap[assignedContentProgressKey_(progress.studentCode, progress.assignmentId)] = progress;
  });
  const result = {};
  documents.forEach(function (document) {
    result[document.id] = { assigned: 0, opened: 0, completed: 0 };
  });
  Object.keys(currentTargets).forEach(function (key) {
    const target = currentTargets[key];
    const summary = result[target.documentId]
      || (result[target.documentId] = { assigned: 0, opened: 0, completed: 0 });
    const progress = progressMap[
      assignedContentProgressKey_(target.studentCode, target.assignmentId)
    ];
    summary.assigned += 1;
    if (progress && (progress.status === 'AÇILDI' || progress.status === 'TAMAMLANDI')) {
      summary.opened += 1;
    }
    if (progress && progress.status === 'TAMAMLANDI') summary.completed += 1;
  });
  Object.keys(result).forEach(function (documentId) {
    const summary = result[documentId];
    summary.completionRate = summary.assigned ? summary.completed / summary.assigned : 0;
  });
  return result;
}

function getEducatorContentOverview_() {
  const catalog = readContentCatalog_();
  const documents = readDocumentRows_();
  const assignments = readAssignmentRows_();
  const tracking = buildEducatorDocumentTracking_(
    documents, assignments, readPublicStudents_(),
    readAssignedContentProgressRows_(), new Date()
  );
  const statusCounts = {};
  const stageCounts = {};
  catalog.forEach(function (item) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    stageCounts[item.stage] = (stageCounts[item.stage] || 0) + 1;
  });
  return {
    total: catalog.length,
    active: statusCounts['AKTİF'] || 0,
    planned: statusCounts['İÇERİK PLANLANDI'] || 0,
    architectureReady: statusCounts['MİMARİ HAZIR'] || 0,
    statusCounts: statusCounts,
    stageCounts: stageCounts,
    recent: catalog.slice(-8).reverse(),
    documents: {
      total: documents.length,
      published: documents.filter(function (item) { return item.status === 'YAYINDA'; }).length,
      drafts: documents.filter(function (item) { return item.status === 'TASLAK'; }).length,
    },
    assignments: {
      active: assignments.filter(function (item) { return item.status === 'AKTİF'; }).length,
    },
    library: documents.slice().sort(function (left, right) {
      return right.createdAtMs - left.createdAtMs;
    }).slice(0, 20).map(function (item) {
      const document = publicEducatorDocument_(item);
      document.tracking = tracking[item.id]
        || { assigned: 0, opened: 0, completed: 0, completionRate: 0 };
      return document;
    }),
    recentAssignments: assignments.slice().sort(function (left, right) {
      return right.assignedAtMs - left.assignedAtMs;
    }).slice(0, 12).map(function (item) {
      return {
        id: item.id, documentId: item.documentId, targetType: item.targetType,
        targetValue: item.targetValue, status: item.status,
        assignedAt: formatOptionalEducatorDate_(item.assignedAt),
      };
    }),
    skills: readHolisticSkills_().map(function (skill) {
      return { id: skill.id, name: skill.name, category: skill.category, color: skill.color };
    }),
  };
}

function validateEducatorInterventionPayload_(payload) {
  const studentCode = normalizeCode_(payload.studentCode);
  const type = cleanContentText_(payload.type, 60).toLocaleUpperCase('tr-TR');
  const title = cleanContentText_(payload.title, 180);
  const description = cleanContentText_(payload.description, 1000);
  const successCriterion = cleanContentText_(payload.successCriterion, 500);
  const priority = cleanContentText_(payload.priority, 30).toLocaleUpperCase('tr-TR');
  const allowedTypes = [
    'AKADEMİK', 'BECERİ', 'ÇALIŞMA DÜZENİ',
    'DUYGUSAL DESTEK', 'İÇERİK TAKİBİ', 'VELİ İLETİŞİMİ',
  ];
  if (!studentCode) throw new Error('Müdahale planı için öğrenci seçin.');
  if (allowedTypes.indexOf(type) === -1) throw new Error('Geçerli bir müdahale türü seçin.');
  if (title.length < 5) throw new Error('Müdahale başlığı en az 5 karakter olmalıdır.');
  if (description.length < 10) throw new Error('Müdahale açıklaması en az 10 karakter olmalıdır.');
  if (successCriterion.length < 5) {
    throw new Error('Başarı ölçütü en az 5 karakter olmalıdır.');
  }
  if (['YÜKSEK', 'ORTA', 'DÜŞÜK'].indexOf(priority) === -1) {
    throw new Error('Geçerli bir müdahale önceliği seçin.');
  }
  let reviewDate = null;
  const reviewDateText = cleanContentText_(payload.reviewDate, 20);
  if (reviewDateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDateText)) {
      throw new Error('Kontrol tarihi geçerli değil.');
    }
    reviewDate = new Date(reviewDateText + 'T12:00:00');
    if (Number.isNaN(reviewDate.getTime())) throw new Error('Kontrol tarihi geçerli değil.');
  }
  return {
    studentCode: studentCode,
    type: type,
    title: title,
    description: description,
    successCriterion: successCriterion,
    priority: priority,
    reviewDate: reviewDate,
  };
}

function validateEducatorInterventionFollowUpPayload_(payload) {
  const interventionId = cleanContentText_(payload.interventionId, 80);
  const mode = cleanContentText_(payload.mode, 30).toLocaleUpperCase('tr-TR');
  const note = cleanContentText_(payload.note, 1500);
  const resultLevel = cleanContentText_(payload.resultLevel, 40).toLocaleUpperCase('tr-TR');
  const nextStep = cleanContentText_(payload.nextStep, 700);
  if (!interventionId) throw new Error('Takip kaydı eklenecek müdahale planı bulunamadı.');
  if (['NOTE', 'COMPLETE'].indexOf(mode) === -1) {
    throw new Error('Geçerli bir takip işlemi seçin.');
  }
  if (mode === 'NOTE' && note.length < 5) {
    throw new Error('Eğitimci takip notu en az 5 karakter olmalıdır.');
  }
  if (mode === 'COMPLETE') {
    if (['BAŞARILI', 'KISMEN BAŞARILI', 'HEDEFE ULAŞILAMADI'].indexOf(resultLevel) === -1) {
      throw new Error('Geçerli bir sonuç düzeyi seçin.');
    }
    if (note.length < 10) throw new Error('Sonuç notu en az 10 karakter olmalıdır.');
    if (resultLevel !== 'BAŞARILI' && nextStep.length < 5) {
      throw new Error('Kısmi veya başarısız sonuç için sonraki adımı yazın.');
    }
  }
  let reviewDate = null;
  const reviewDateText = cleanContentText_(payload.reviewDate, 20);
  if (reviewDateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDateText)) {
      throw new Error('Yeni kontrol tarihi geçerli değil.');
    }
    reviewDate = new Date(reviewDateText + 'T12:00:00');
    if (Number.isNaN(reviewDate.getTime())) throw new Error('Yeni kontrol tarihi geçerli değil.');
  }
  return {
    interventionId: interventionId,
    mode: mode,
    note: note,
    resultLevel: mode === 'COMPLETE' ? resultLevel : '',
    nextStep: mode === 'COMPLETE' ? nextStep : '',
    reviewDate: reviewDate,
  };
}

function validateEducatorContentPayload_(payload) {
  const title = cleanContentText_(payload.title, 180);
  const grade = cleanContentText_(payload.grade, 50);
  const lesson = cleanContentText_(payload.lesson, 100);
  const topic = cleanContentText_(payload.topic, 160);
  const outcome = cleanContentText_(payload.outcome, 350);
  const skillId = cleanContentText_(payload.skillId, 30).toUpperCase();
  const stage = cleanContentText_(payload.stage, 30).toLocaleUpperCase('tr-TR');
  const packageName = cleanContentText_(payload.packageName, 120);
  const description = cleanContentText_(payload.description, 700);
  const assignmentNote = cleanContentText_(payload.assignmentNote, 300);
  const duration = Math.round(Number(payload.duration) || 0);
  const publish = payload.publish === true;

  if (!title || !grade || !lesson || !topic || !outcome || !skillId) {
    throw new Error('Başlık, sınıf, ders, konu, kazanım ve CZA becerisi zorunludur.');
  }
  if (['KEŞFET', 'ÖĞREN', 'UYGULA', 'USTALAŞ'].indexOf(stage) === -1) {
    throw new Error('Geçerli bir içerik aşaması seçin.');
  }
  if (duration < 1 || duration > 180) {
    throw new Error('Çalışma süresi 1 ile 180 dakika arasında olmalıdır.');
  }

  const skill = readHolisticSkills_().find(function (item) { return item.id === skillId; });
  if (!skill) throw new Error('Seçilen CZA becerisi bulunamadı.');

  const fileBase64 = String(payload.fileBase64 || '').trim();
  let sourceUrl = String(payload.sourceUrl || '').trim();
  let sourceType = cleanContentText_(payload.sourceType, 20).toLocaleUpperCase('tr-TR');
  if (!sourceType) sourceType = fileBase64 ? 'DOSYA' : 'BAĞLANTI';
  if (['DOSYA', 'BAĞLANTI'].indexOf(sourceType) === -1) {
    throw new Error('Belge kaynağı dosya veya bağlantı olmalıdır.');
  }

  let fileName = sanitizeContentFileName_(payload.fileName || title);
  let mimeType = cleanContentText_(payload.mimeType, 120).toLowerCase();
  if (sourceType === 'DOSYA') {
    if (!fileBase64 || !fileName) throw new Error('Yüklenecek dosyayı seçin.');
    if (!mimeType) mimeType = inferContentMimeType_(fileName);
    if (fileBase64.length > Math.ceil(CZA_CONFIG.MAX_UPLOAD_BYTES * 4 / 3) + 16) {
      throw new Error('Dosya boyutu 5 MB sınırını aşmamalıdır.');
    }
    const allowedMimeTypes = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/webp',
    ];
    if (allowedMimeTypes.indexOf(mimeType) === -1) {
      throw new Error('PDF, Word, Excel, JPG, PNG veya WebP dosyası yükleyin.');
    }
  } else {
    sourceUrl = validateEducatorLink_(sourceUrl);
    fileName = fileName || title + ' bağlantısı';
    mimeType = 'text/uri-list';
  }

  const targetType = normalizeContentTargetType_(payload.targetType);
  let targetValue = cleanContentText_(payload.targetValue, 160);
  if (publish) {
    if (!targetType) throw new Error('Yayın için hedef türünü seçin.');
    if (targetType === 'TÜM ÖĞRENCİLER') targetValue = 'TÜMÜ';
    if (!targetValue) throw new Error('Yayın hedefini seçin.');
    if (targetType === 'ÖĞRENCİ') {
      const student = findStudent_(normalizeCode_(targetValue));
      if (!student) throw new Error('Atanacak öğrenci bulunamadı.');
      targetValue = student.code;
    }
  }

  return {
    title: title, grade: grade, lesson: lesson, topic: topic, outcome: outcome,
    skillId: skill.id, skillName: skill.name, stage: stage, duration: duration,
    packageName: packageName, description: description, assignmentNote: assignmentNote,
    publish: publish, targetType: targetType, targetValue: targetValue,
    sourceType: sourceType, sourceUrl: sourceUrl, fileName: fileName,
    mimeType: mimeType, fileBase64: fileBase64,
  };
}

function validateEducatorLink_(value) {
  const sourceUrl = String(value || '').trim();
  if (!sourceUrl || sourceUrl.length > 500 || !/^https:\/\/\S+$/i.test(sourceUrl)) {
    throw new Error('Bağlantı eksiksiz olmalı ve https:// ile başlamalıdır.');
  }
  return sourceUrl;
}

function resolveEducatorDocumentTransition_(action, currentStatus, sourceType) {
  const normalizedAction = cleanContentText_(action, 30).toUpperCase();
  const status = cleanContentText_(currentStatus, 30).toLocaleUpperCase('tr-TR');
  const type = cleanContentText_(sourceType, 30).toLocaleUpperCase('tr-TR');

  if (normalizedAction === 'UPDATE_LINK') {
    if (type !== 'BAĞLANTI') {
      throw new Error('Yalnız bağlantı türündeki içeriklerin adresi düzenlenebilir.');
    }
    if (status === 'ARŞİV') {
      throw new Error('Bağlantıyı düzenlemek için önce içeriği arşivden çıkarın.');
    }
    return {
      action: normalizedAction, nextStatus: status, deactivateAssignments: false,
      message: 'İçerik bağlantısı güncellendi.',
    };
  }
  if (normalizedAction === 'UNPUBLISH') {
    if (status !== 'YAYINDA') throw new Error('Yalnız yayındaki içerik yayından kaldırılabilir.');
    return {
      action: normalizedAction, nextStatus: 'TASLAK', deactivateAssignments: true,
      message: 'İçerik yayından kaldırıldı; aktif atamaları kapatıldı ve taslağa alındı.',
    };
  }
  if (normalizedAction === 'ARCHIVE') {
    if (status === 'YAYINDA') {
      return {
        action: normalizedAction, nextStatus: 'ARŞİV', deactivateAssignments: true,
        message: 'İçerik yayından kaldırıldı, aktif atamaları kapatıldı ve arşivlendi.',
      };
    }
    if (status !== 'TASLAK') throw new Error('Yalnız taslak içerik arşivlenebilir.');
    return {
      action: normalizedAction, nextStatus: 'ARŞİV', deactivateAssignments: false,
      message: 'İçerik arşivlendi. Geçmiş kayıtları korunuyor.',
    };
  }
  if (normalizedAction === 'RESTORE') {
    if (status !== 'ARŞİV') throw new Error('Yalnız arşivdeki içerik geri alınabilir.');
    return {
      action: normalizedAction, nextStatus: 'TASLAK', deactivateAssignments: false,
      message: 'İçerik arşivden çıkarıldı ve taslağa alındı.',
    };
  }
  throw new Error('Geçersiz belge yönetim işlemi.');
}

function cleanContentText_(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength || 500);
}

function sanitizeContentFileName_(value) {
  return cleanContentText_(value, 180).replace(/[\\/:*?"<>|]+/g, '_');
}

function inferContentMimeType_(fileName) {
  const extension = String(fileName || '').toLowerCase().split('.').pop();
  const types = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  };
  return types[extension] || '';
}

function normalizeContentTargetType_(value) {
  const target = cleanContentText_(value, 40).toLocaleUpperCase('tr-TR');
  const aliases = {
    'TÜMÜ': 'TÜM ÖĞRENCİLER', 'TÜM ÖĞRENCİLER': 'TÜM ÖĞRENCİLER',
    'ÖĞRENCİ': 'ÖĞRENCİ', 'SINIF': 'SINIF', 'PAKET': 'PAKET',
  };
  return aliases[target] || '';
}

function safeSheetValue_(value) {
  const clean = String(value == null ? '' : value);
  return /^[=+\-@]/.test(clean) ? "'" + clean : clean;
}

function createCzaId_(prefix) {
  const timeZone = Session.getScriptTimeZone() || 'Europe/Istanbul';
  const stamp = Utilities.formatDate(new Date(), timeZone, 'yyyyMMddHHmmss');
  return prefix + '-' + stamp + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function ensureCzaContentFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty(CZA_CONFIG.CONTENT_FOLDER_PROPERTY);
  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (error) {
      properties.deleteProperty(CZA_CONFIG.CONTENT_FOLDER_PROPERTY);
    }
  }
  const existing = DriveApp.getFoldersByName(CZA_CONFIG.CONTENT_FOLDER_NAME);
  const folder = existing.hasNext()
    ? existing.next()
    : DriveApp.createFolder(CZA_CONFIG.CONTENT_FOLDER_NAME);
  properties.setProperty(CZA_CONFIG.CONTENT_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function readDocumentRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.DOCUMENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.documents.length
  ).getValues().filter(function (row) { return row[0]; }).map(function (row) {
    const createdAt = row[19] instanceof Date ? row[19] : null;
    return {
      id: String(row[0] || ''), driveFileId: String(row[1] || ''),
      sourceType: String(row[2] || ''), sourceUrl: String(row[3] || ''),
      fileName: String(row[4] || ''), mimeType: String(row[5] || ''),
      byteSize: Number(row[6]) || 0, title: String(row[7] || ''),
      grade: String(row[8] || ''), lesson: String(row[9] || ''),
      topic: String(row[10] || ''), outcome: String(row[11] || ''),
      skillId: String(row[12] || ''), skillName: String(row[13] || ''),
      stage: String(row[14] || ''), duration: Number(row[15]) || 0,
      packageName: String(row[16] || ''), status: String(row[17] || ''),
      educatorCode: String(row[18] || ''), createdAt: createdAt,
      createdAtMs: createdAt ? createdAt.getTime() : 0,
      updatedAt: row[20] instanceof Date ? row[20] : null,
      description: String(row[21] || ''),
    };
  });
}

function readAssignmentRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.ASSIGNMENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.assignments.length
  ).getValues().filter(function (row) { return row[0]; }).map(function (row) {
    const assignedAt = row[8] instanceof Date ? row[8] : null;
    return {
      id: String(row[0] || ''), documentId: String(row[1] || ''),
      targetType: String(row[2] || ''), targetValue: String(row[3] || ''),
      startAt: row[4] instanceof Date ? row[4] : null,
      endAt: row[5] instanceof Date ? row[5] : null,
      status: String(row[6] || ''), educatorCode: String(row[7] || ''),
      assignedAt: assignedAt, assignedAtMs: assignedAt ? assignedAt.getTime() : 0,
      note: String(row[9] || ''),
    };
  });
}

function assignedContentProgressKey_(studentCode, assignmentId) {
  return normalizeCode_(studentCode) + '|' + String(assignmentId || '').trim();
}

function readAssignedContentProgressRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.CONTENT_PROGRESS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.contentProgress.length
  ).getValues().filter(function (row) { return row[0] && row[2]; }).map(function (row) {
    return {
      studentCode: normalizeCode_(row[0]), documentId: String(row[1] || ''),
      assignmentId: String(row[2] || ''), status: String(row[3] || ''),
      firstOpenedAt: row[4] instanceof Date ? row[4] : null,
      lastOpenedAt: row[5] instanceof Date ? row[5] : null,
      completedAt: row[6] instanceof Date ? row[6] : null,
      openCount: Number(row[7]) || 0,
      updatedAt: row[8] instanceof Date ? row[8] : null,
    };
  });
}

function publicAssignedContentProgress_(progress) {
  if (!progress) return {
    status: 'BEKLİYOR', openedAt: '', completedAt: '', openCount: 0,
  };
  return {
    status: progress.status || 'BEKLİYOR',
    openedAt: formatOptionalEducatorDate_(progress.firstOpenedAt),
    completedAt: formatOptionalEducatorDate_(progress.completedAt),
    openCount: Number(progress.openCount) || 0,
  };
}

function recordAssignedContentProgress_(studentCode, documentId, assignmentId, nextStatus) {
  const code = normalizeCode_(studentCode);
  const safeDocumentId = cleanContentText_(documentId, 80);
  const safeAssignmentId = cleanContentText_(assignmentId, 80);
  const status = cleanContentText_(nextStatus, 30).toLocaleUpperCase('tr-TR');
  if (!code || !safeDocumentId || !safeAssignmentId) {
    throw new Error('İçerik ilerlemesi kaydedilemedi.');
  }
  if (status !== 'AÇILDI' && status !== 'TAMAMLANDI') {
    throw new Error('Geçersiz içerik ilerleme durumu.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ensureSheet_(
      getSpreadsheet_(), CZA_CONFIG.CONTENT_PROGRESS_SHEET, CZA_HEADERS.contentProgress
    );
    const rowCount = Math.max(sheet.getLastRow() - 1, 0);
    const rows = rowCount
      ? sheet.getRange(2, 1, rowCount, CZA_HEADERS.contentProgress.length).getValues()
      : [];
    const offset = rows.findIndex(function (row) {
      return normalizeCode_(row[0]) === code
        && String(row[2] || '') === safeAssignmentId;
    });
    const now = new Date();
    const existing = offset >= 0 ? rows[offset] : null;
    const existingStatus = existing ? String(existing[3] || '') : '';
    const firstOpenedAt = existing && existing[4] instanceof Date ? existing[4] : now;
    const lastOpenedAt = status === 'AÇILDI'
      ? now
      : (existing && existing[5] instanceof Date ? existing[5] : now);
    const completedAt = status === 'TAMAMLANDI'
      ? (existing && existing[6] instanceof Date ? existing[6] : now)
      : (existing && existing[6] instanceof Date ? existing[6] : '');
    const storedStatus = existingStatus === 'TAMAMLANDI' ? 'TAMAMLANDI' : status;
    const openCount = (Number(existing && existing[7]) || 0) + (status === 'AÇILDI' ? 1 : 0);
    const values = [[
      code, safeDocumentId, safeAssignmentId, storedStatus, firstOpenedAt,
      lastOpenedAt, completedAt, openCount, now,
    ]];
    if (offset >= 0) {
      sheet.getRange(offset + 2, 1, 1, CZA_HEADERS.contentProgress.length).setValues(values);
    } else {
      sheet.appendRow(values[0]);
    }
    return {
      studentCode: code, documentId: safeDocumentId, assignmentId: safeAssignmentId,
      status: storedStatus, firstOpenedAt: firstOpenedAt, lastOpenedAt: lastOpenedAt,
      completedAt: completedAt instanceof Date ? completedAt : null,
      openCount: openCount, updatedAt: now,
    };
  } finally {
    lock.releaseLock();
  }
}

function readEducatorInterventionRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.INTERVENTIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.interventions.length
  ).getValues().filter(function (row) { return row[0] && row[1]; }).map(function (row) {
    const updatedAt = row[11] instanceof Date ? row[11] : null;
    return {
      id: String(row[0] || ''), studentCode: normalizeCode_(row[1]),
      type: String(row[2] || ''), title: String(row[3] || ''),
      description: String(row[4] || ''), priority: String(row[5] || ''),
      status: String(row[6] || ''), plannedAt: row[7] instanceof Date ? row[7] : null,
      reviewDate: row[8] instanceof Date ? row[8] : null,
      completedAt: row[9] instanceof Date ? row[9] : null,
      educatorCode: String(row[10] || ''), updatedAt: updatedAt,
      updatedAtMs: updatedAt ? updatedAt.getTime() : 0,
      successCriterion: String(row[12] || ''),
      resultLevel: String(row[13] || ''), resultNote: String(row[14] || ''),
      nextStep: String(row[15] || ''), resultAt: row[16] instanceof Date ? row[16] : null,
    };
  });
}

function readEducatorInterventionHistoryRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.INTERVENTION_HISTORY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.interventionHistory.length
  ).getValues().filter(function (row) { return row[0] && row[1]; }).map(function (row) {
    const createdAt = row[10] instanceof Date ? row[10] : null;
    return {
      id: String(row[0] || ''), interventionId: String(row[1] || ''),
      studentCode: normalizeCode_(row[2]), eventType: String(row[3] || ''),
      previousStatus: String(row[4] || ''), nextStatus: String(row[5] || ''),
      note: String(row[6] || ''), resultLevel: String(row[7] || ''),
      reviewDate: row[8] instanceof Date ? row[8] : null,
      educatorCode: String(row[9] || ''), createdAt: createdAt,
      createdAtMs: createdAt ? createdAt.getTime() : 0,
    };
  });
}

function appendEducatorInterventionHistory_(entry) {
  const data = entry || {};
  const sheet = ensureSheet_(
    getSpreadsheet_(), CZA_CONFIG.INTERVENTION_HISTORY_SHEET,
    CZA_HEADERS.interventionHistory
  );
  sheet.appendRow([
    createCzaId_('TAKIP'), data.interventionId || '', data.studentCode || '',
    data.eventType || 'TAKİP NOTU', data.previousStatus || '', data.nextStatus || '',
    safeSheetValue_(data.note || ''), data.resultLevel || '', data.reviewDate || '',
    data.educatorCode || '', data.createdAt || new Date(),
  ]);
}

function getRecentEducatorWeeklyReports_(limit) {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.WEEKLY_REPORT_ARCHIVE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.weeklyReportArchive.length
  ).getValues().filter(function (row) { return row[0]; });
  return rows.map(function (row) {
    const archivedAt = row[10] instanceof Date ? row[10] : null;
    return {
      id: String(row[0] || ''), periodStart: String(row[1] || ''),
      periodEnd: String(row[2] || ''), totalStudents: Number(row[3]) || 0,
      activeStudents: Number(row[4]) || 0, totalAnswers: Number(row[5]) || 0,
      averageAccuracy: Number(row[6]) || 0,
      completedInterventions: Number(row[7]) || 0,
      followUpEntries: Number(row[8]) || 0,
      educatorCode: String(row[9] || ''),
      archivedAt: formatOptionalEducatorDate_(archivedAt),
      archivedAtMs: archivedAt ? archivedAt.getTime() : 0,
    };
  }).sort(function (left, right) {
    return right.archivedAtMs - left.archivedAtMs;
  }).slice(0, Math.max(1, Number(limit) || 8)).map(function (item) {
    const result = Object.assign({}, item);
    delete result.archivedAtMs;
    return result;
  });
}

function publicEducatorInterventionHistory_(item) {
  return {
    id: item.id, eventType: item.eventType,
    previousStatus: item.previousStatus, nextStatus: item.nextStatus,
    note: item.note, resultLevel: item.resultLevel,
    reviewDate: item.reviewDate instanceof Date
      ? Utilities.formatDate(
        item.reviewDate, Session.getScriptTimeZone() || 'Europe/Istanbul', 'dd.MM.yyyy'
      )
      : '',
    educatorCode: item.educatorCode,
    createdAt: formatOptionalEducatorDate_(item.createdAt),
  };
}

function publicEducatorIntervention_(item) {
  return {
    id: item.id, studentCode: item.studentCode, type: item.type,
    title: item.title, description: item.description, priority: item.priority,
    status: item.status, plannedAt: formatOptionalEducatorDate_(item.plannedAt),
    reviewDate: item.reviewDate instanceof Date
      ? Utilities.formatDate(
        item.reviewDate, Session.getScriptTimeZone() || 'Europe/Istanbul', 'dd.MM.yyyy'
      )
      : '',
    completedAt: formatOptionalEducatorDate_(item.completedAt),
    educatorCode: item.educatorCode,
    successCriterion: item.successCriterion,
    resultLevel: item.resultLevel,
    resultNote: item.resultNote,
    nextStep: item.nextStep,
    resultAt: formatOptionalEducatorDate_(item.resultAt),
    history: (item.history || []).map(publicEducatorInterventionHistory_),
  };
}

function getEducatorInterventionsForStudent_(studentCode) {
  const code = normalizeCode_(studentCode);
  const historyMap = {};
  readEducatorInterventionHistoryRows_().filter(function (entry) {
    return entry.studentCode === code;
  }).forEach(function (entry) {
    if (!historyMap[entry.interventionId]) historyMap[entry.interventionId] = [];
    historyMap[entry.interventionId].push(entry);
  });
  Object.keys(historyMap).forEach(function (id) {
    historyMap[id].sort(function (left, right) { return right.createdAtMs - left.createdAtMs; });
  });
  return readEducatorInterventionRows_().filter(function (item) {
    return item.studentCode === code && item.status !== 'ARŞİV';
  }).sort(function (left, right) {
    if (left.status === 'AÇIK' && right.status !== 'AÇIK') return -1;
    if (right.status === 'AÇIK' && left.status !== 'AÇIK') return 1;
    return right.updatedAtMs - left.updatedAtMs;
  }).map(function (item) {
    item.history = historyMap[item.id] || [];
    return publicEducatorIntervention_(item);
  });
}

function educatorCalendarDay_(date, timeZone) {
  if (!(date instanceof Date)) return null;
  const parts = Utilities.formatDate(date, timeZone, 'yyyy-MM-dd')
    .split('-').map(function (value) { return Number(value); });
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}

function classifyInterventionDueState_(item, now, timeZone) {
  const status = String(item && item.status || '').toLocaleUpperCase('tr-TR');
  if (status === 'TAMAMLANDI') {
    return { code: 'TAMAMLANDI', label: 'Tamamlandı', rank: 5, daysToReview: null };
  }
  if (status !== 'AÇIK') {
    return { code: 'DİĞER', label: status || 'Belirsiz', rank: 6, daysToReview: null };
  }
  if (!(item.reviewDate instanceof Date)) {
    return { code: 'TARİHSİZ', label: 'Kontrol tarihi yok', rank: 4, daysToReview: null };
  }
  const todayDay = educatorCalendarDay_(now, timeZone);
  const reviewDay = educatorCalendarDay_(item.reviewDate, timeZone);
  const daysToReview = reviewDay - todayDay;
  if (daysToReview < 0) {
    return {
      code: 'GECİKTİ', label: Math.abs(daysToReview) + ' gün gecikti',
      rank: 0, daysToReview: daysToReview,
    };
  }
  if (daysToReview === 0) {
    return { code: 'BUGÜN', label: 'Bugün kontrol edilecek', rank: 1, daysToReview: 0 };
  }
  if (daysToReview <= 7) {
    return {
      code: 'YAKLAŞIYOR', label: daysToReview + ' gün kaldı',
      rank: 2, daysToReview: daysToReview,
    };
  }
  return {
    code: 'PLANLI', label: daysToReview + ' gün kaldı',
    rank: 3, daysToReview: daysToReview,
  };
}

function buildEducatorInterventionCenter_(interventions, students, now, timeZone, historyRows) {
  const zone = timeZone || 'Europe/Istanbul';
  const current = now instanceof Date ? now : new Date();
  const studentMap = {};
  const historyMap = {};
  (students || []).forEach(function (student) {
    studentMap[normalizeCode_(student.code)] = student;
  });
  (historyRows || []).forEach(function (entry) {
    if (!historyMap[entry.interventionId]) historyMap[entry.interventionId] = [];
    historyMap[entry.interventionId].push(entry);
  });
  Object.keys(historyMap).forEach(function (id) {
    historyMap[id].sort(function (left, right) { return right.createdAtMs - left.createdAtMs; });
  });
  const items = (interventions || []).filter(function (item) {
    return item && item.status !== 'ARŞİV';
  }).map(function (item) {
    const student = studentMap[normalizeCode_(item.studentCode)] || {};
    const due = classifyInterventionDueState_(item, current, zone);
    const publicItem = publicEducatorIntervention_(item);
    publicItem.studentName = student.name || item.studentCode;
    publicItem.studentGrade = student.grade || '';
    publicItem.reviewDateKey = item.reviewDate instanceof Date
      ? Utilities.formatDate(item.reviewDate, zone, 'yyyy-MM-dd')
      : '';
    publicItem.dueState = due.code;
    publicItem.dueLabel = due.label;
    publicItem.daysToReview = due.daysToReview;
    publicItem.sortRank = due.rank;
    publicItem.updatedAtMs = Number(item.updatedAtMs) || 0;
    const itemHistory = historyMap[item.id] || [];
    const latestFollowUp = itemHistory.find(function (entry) {
      return entry.eventType !== 'PLAN OLUŞTURULDU';
    }) || null;
    publicItem.historyCount = itemHistory.length;
    publicItem.latestFollowUp = latestFollowUp
      ? publicEducatorInterventionHistory_(latestFollowUp)
      : null;
    return publicItem;
  });
  const priorityRank = { 'YÜKSEK': 0, 'ORTA': 1, 'DÜŞÜK': 2 };
  items.sort(function (left, right) {
    return left.sortRank - right.sortRank
      || (priorityRank[left.priority] == null ? 3 : priorityRank[left.priority])
        - (priorityRank[right.priority] == null ? 3 : priorityRank[right.priority])
      || (left.daysToReview == null ? 9999 : left.daysToReview)
        - (right.daysToReview == null ? 9999 : right.daysToReview)
      || right.updatedAtMs - left.updatedAtMs;
  });
  const todayDay = educatorCalendarDay_(current, zone);
  const completedThisWeek = items.filter(function (item) {
    const source = (interventions || []).find(function (raw) { return raw.id === item.id; });
    const completedDay = source ? educatorCalendarDay_(source.completedAt, zone) : null;
    return item.status === 'TAMAMLANDI'
      && completedDay != null && completedDay >= todayDay - 6 && completedDay <= todayDay;
  }).length;
  return {
    generatedAt: formatEducatorDate_(current, zone),
    metrics: {
      total: items.length,
      open: items.filter(function (item) { return item.status === 'AÇIK'; }).length,
      overdue: items.filter(function (item) { return item.dueState === 'GECİKTİ'; }).length,
      dueToday: items.filter(function (item) { return item.dueState === 'BUGÜN'; }).length,
      dueNextSevenDays: items.filter(function (item) {
        return item.dueState === 'BUGÜN' || item.dueState === 'YAKLAŞIYOR';
      }).length,
      highPriorityOpen: items.filter(function (item) {
        return item.status === 'AÇIK' && item.priority === 'YÜKSEK';
      }).length,
      completed: items.filter(function (item) { return item.status === 'TAMAMLANDI'; }).length,
      completedThisWeek: completedThisWeek,
    },
    items: items.map(function (item) {
      const result = Object.assign({}, item);
      delete result.sortRank;
      delete result.updatedAtMs;
      return result;
    }),
  };
}

function buildEducatorWeeklyReport_(
  studentRows, answerMap, interventionCenter, now, timeZone, historyRows
) {
  const zone = timeZone || 'Europe/Istanbul';
  const current = now instanceof Date ? now : new Date();
  const todayDay = educatorCalendarDay_(current, zone);
  const startDay = todayDay - 6;
  const centerItems = interventionCenter && interventionCenter.items || [];
  const weeklyHistory = (historyRows || []).filter(function (entry) {
    const day = educatorCalendarDay_(entry.createdAt, zone);
    return entry.eventType !== 'PLAN OLUŞTURULDU'
      && day != null && day >= startDay && day <= todayDay;
  });
  const students = (studentRows || []).map(function (student) {
    const weeklyRows = (answerMap && answerMap[normalizeCode_(student.code)] || []).filter(function (row) {
      const day = educatorCalendarDay_(row[0], zone);
      return day != null && day >= startDay && day <= todayDay;
    });
    const correct = weeklyRows.filter(function (row) { return row[6] === true; }).length;
    const activeDays = {};
    weeklyRows.forEach(function (row) {
      activeDays[Utilities.formatDate(row[0], zone, 'yyyy-MM-dd')] = true;
    });
    const plans = centerItems.filter(function (item) {
      return normalizeCode_(item.studentCode) === normalizeCode_(student.code);
    });
    const overduePlans = plans.filter(function (item) { return item.dueState === 'GECİKTİ'; }).length;
    const openPlans = plans.filter(function (item) { return item.status === 'AÇIK'; }).length;
    const followUpEntries = weeklyHistory.filter(function (entry) {
      return normalizeCode_(entry.studentCode) === normalizeCode_(student.code);
    }).length;
    const weeklyAccuracy = weeklyRows.length ? correct / weeklyRows.length : 0;
    let signal = 'İlerleme izleniyor';
    let suggestedAction = 'Mevcut rota ve çalışma düzenini sürdürün.';
    if (overduePlans) {
      signal = 'Geciken müdahale';
      suggestedAction = 'Geciken planı bugün değerlendirip yeni kontrol tarihi belirleyin.';
    } else if (student.risk && student.risk.level === 'YÜKSEK') {
      signal = 'Yüksek risk';
      suggestedAction = 'Öğrenci 360 üzerinden öncelikli müdahale planını gözden geçirin.';
    } else if (!weeklyRows.length) {
      signal = 'Bu hafta etkinlik yok';
      suggestedAction = 'Kısa bir başlangıç görevi veya içerik ataması yapın.';
    } else if (weeklyAccuracy < 0.5) {
      signal = 'Doğruluk desteği';
      suggestedAction = 'Yanlış örüntülerini inceleyip hedefli tekrar planlayın.';
    }
    return {
      code: student.code, name: student.name, grade: student.grade,
      riskLevel: student.risk && student.risk.level || 'DÜŞÜK',
      riskScore: Number(student.risk && student.risk.score) || 0,
      answers: weeklyRows.length, correct: correct, accuracy: weeklyAccuracy,
      activeDays: Object.keys(activeDays).length,
      openPlans: openPlans, overduePlans: overduePlans,
      followUpEntries: followUpEntries,
      signal: signal, suggestedAction: suggestedAction,
    };
  });
  students.sort(function (left, right) {
    return right.overduePlans - left.overduePlans
      || right.riskScore - left.riskScore
      || left.answers - right.answers
      || left.name.localeCompare(right.name, 'tr');
  });
  const totalAnswers = students.reduce(function (sum, student) { return sum + student.answers; }, 0);
  const totalCorrect = students.reduce(function (sum, student) { return sum + student.correct; }, 0);
  const startDate = new Date(current.getTime());
  startDate.setDate(startDate.getDate() - 6);
  return {
    periodStart: Utilities.formatDate(startDate, zone, 'dd.MM.yyyy'),
    periodEnd: Utilities.formatDate(current, zone, 'dd.MM.yyyy'),
    metrics: {
      totalStudents: students.length,
      activeStudents: students.filter(function (student) { return student.answers > 0; }).length,
      totalAnswers: totalAnswers,
      averageAccuracy: totalAnswers ? totalCorrect / totalAnswers : 0,
      completedInterventions: Number(
        interventionCenter && interventionCenter.metrics
          && interventionCenter.metrics.completedThisWeek
      ) || 0,
      followUpEntries: weeklyHistory.length,
      successfulInterventions: weeklyHistory.filter(function (entry) {
        return entry.eventType === 'SONUÇLANDIRILDI' && entry.resultLevel === 'BAŞARILI';
      }).length,
      partialInterventions: weeklyHistory.filter(function (entry) {
        return entry.eventType === 'SONUÇLANDIRILDI' && entry.resultLevel === 'KISMEN BAŞARILI';
      }).length,
      unsuccessfulInterventions: weeklyHistory.filter(function (entry) {
        return entry.eventType === 'SONUÇLANDIRILDI' && entry.resultLevel === 'HEDEFE ULAŞILAMADI';
      }).length,
    },
    students: students,
  };
}

function publicEducatorDocument_(item) {
  return {
    id: item.id, title: item.title, fileName: item.fileName,
    sourceType: item.sourceType, sourceUrl: item.sourceUrl,
    mimeType: item.mimeType, byteSize: item.byteSize,
    grade: item.grade, lesson: item.lesson, topic: item.topic, outcome: item.outcome,
    skillId: item.skillId, skillName: item.skillName, stage: item.stage,
    duration: item.duration, packageName: item.packageName, status: item.status,
    educatorCode: item.educatorCode, createdAt: formatOptionalEducatorDate_(item.createdAt),
    description: item.description,
  };
}

function formatOptionalEducatorDate_(date) {
  if (!(date instanceof Date)) return '';
  const timeZone = Session.getScriptTimeZone() || 'Europe/Istanbul';
  return formatEducatorDate_(date, timeZone);
}

function assignmentMatchesStudent_(assignment, student, now) {
  if (assignment.status !== 'AKTİF') return false;
  if (assignment.startAt && assignment.startAt.getTime() > now.getTime()) return false;
  if (assignment.endAt && assignment.endAt.getTime() < now.getTime()) return false;
  const targetType = normalizeContentTargetType_(assignment.targetType);
  if (targetType === 'TÜM ÖĞRENCİLER') return true;
  if (targetType === 'ÖĞRENCİ') {
    return normalizeCode_(assignment.targetValue) === normalizeCode_(student.code);
  }
  if (targetType === 'SINIF') {
    return cleanContentText_(assignment.targetValue, 160).toLocaleUpperCase('tr-TR')
      === cleanContentText_(student.grade, 160).toLocaleUpperCase('tr-TR');
  }
  if (targetType === 'PAKET') {
    return cleanContentText_(assignment.targetValue, 160).toLocaleUpperCase('tr-TR')
      === cleanContentText_(student.packageName, 160).toLocaleUpperCase('tr-TR');
  }
  return false;
}

function getAssignedContentsForStudent_(studentCode) {
  const student = findStudent_(normalizeCode_(studentCode));
  if (!student) return [];
  const now = new Date();
  const progressMap = {};
  readAssignedContentProgressRows_().forEach(function (progress) {
    progressMap[assignedContentProgressKey_(progress.studentCode, progress.assignmentId)] = progress;
  });
  const documents = {};
  readDocumentRows_().forEach(function (item) {
    if (item.status === 'YAYINDA') documents[item.id] = item;
  });
  const seen = {};
  return readAssignmentRows_().filter(function (assignment) {
    return documents[assignment.documentId]
      && assignmentMatchesStudent_(assignment, student, now);
  }).sort(function (left, right) {
    return right.assignedAtMs - left.assignedAtMs;
  }).map(function (assignment) {
    if (seen[assignment.documentId]) return null;
    seen[assignment.documentId] = true;
    const document = documents[assignment.documentId];
    const progress = progressMap[
      assignedContentProgressKey_(student.code, assignment.id)
    ] || null;
    return {
      id: document.id, assignmentId: assignment.id,
      title: document.title, fileName: document.fileName,
      sourceType: document.sourceType, mimeType: document.mimeType,
      grade: document.grade, lesson: document.lesson, topic: document.topic,
      outcome: document.outcome, skillId: document.skillId,
      skillName: document.skillName, stage: document.stage,
      duration: document.duration, description: document.description,
      assignedAt: formatOptionalEducatorDate_(assignment.assignedAt),
      assignmentNote: assignment.note,
      progress: publicAssignedContentProgress_(progress),
    };
  }).filter(function (item) { return item; });
}

function readPublicStudents_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.STUDENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues()
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      return {
        code: String(row[0] || '').trim(), name: String(row[1] || '').trim(),
        grade: String(row[2] || '').trim(), packageName: String(row[3] || '').trim(),
      };
    });
}

function readAllAnswerRows_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.ANSWERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.answers.length
  ).getValues();
}

function readCampusRowsMap_() {
  const sheet = getSpreadsheet_().getSheetByName(CZA_CONFIG.CAMPUS_STATE_SHEET);
  const result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  const rows = sheet.getRange(
    2, 1, sheet.getLastRow() - 1, CZA_HEADERS.campusState.length
  ).getValues();
  rows.forEach(function (row) {
    result[normalizeCode_(row[0])] = {
      firstLogin: row[1], lastLogin: row[2], onboardingCompleted: row[3] === true,
      activeRoute: String(row[4] || ''), completedTasks: Number(row[5]) || 0,
    };
  });
  return result;
}

function getRecentStudentAnswers_(studentCode, limit) {
  const timeZone = Session.getScriptTimeZone() || 'Europe/Istanbul';
  return readAllAnswerRows_()
    .filter(function (row) {
      return normalizeCode_(row[1]) === normalizeCode_(studentCode);
    })
    .slice(-Math.max(Number(limit) || 10, 1))
    .reverse()
    .map(function (row) {
      return {
        time: row[0] instanceof Date ? formatEducatorDate_(row[0], timeZone) : '',
        questionId: String(row[2] || ''), lesson: String(row[3] || ''),
        skill: String(row[4] || ''), answer: String(row[5] || ''),
        correct: row[6] === true, duration: Number(row[7]) || 0,
      };
    });
}

function formatEducatorDate_(date, timeZone) {
  return Utilities.formatDate(date, timeZone, 'dd.MM.yyyy HH:mm');
}

function calculateStreak_(answerRows, timeZone) {
  const activeDays = {};
  answerRows.forEach(function (row) {
    if (row[0] instanceof Date) {
      activeDays[Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd')] = true;
    }
  });

  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  let key = Utilities.formatDate(cursor, timeZone, 'yyyy-MM-dd');
  if (!activeDays[key]) {
    cursor.setDate(cursor.getDate() - 1);
    key = Utilities.formatDate(cursor, timeZone, 'yyyy-MM-dd');
    if (!activeDays[key]) return 0;
  }

  let streak = 0;
  while (activeDays[key]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
    key = Utilities.formatDate(cursor, timeZone, 'yyyy-MM-dd');
  }
  return streak;
}

function normalizeCode_(value) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR');
}

function normalizeEducatorCode_(value) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR');
}

