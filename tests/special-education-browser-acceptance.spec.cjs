const { test, expect } = require('@playwright/test');

const BASE = process.env.CZA_BASE_URL || 'http://127.0.0.1:4173';

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 2);
}

async function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.startsWith('Failed to load resource:')) {
      errors.push('console: ' + text);
    }
  });
  page.on('response', response => {
    if (response.status() < 400) return;
    const url = response.url();
    if (url.includes('/api/educator-students')) return;
    if (response.status() === 501 && url.includes('/api/educator-auth')) return;
    errors.push('http: ' + response.status() + ' ' + url);
  });
  return errors;
}

test.describe('CZA Özel Eğitim Başlangıç Değerlendirmesi V1 kabul', () => {
  test('masaüstü: 10/10 profil aktif ve bütün başlıklar dolu', async ({ page }) => {
    const errors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(BASE, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'CZA Değerlendirme Merkezi' })).toBeVisible();
    const special = page.locator('.special-area');
    await expect(special).toBeVisible();
    await expect(special.locator('.special-card')).toHaveCount(10);
    await expect(special.locator('.special-card.active')).toHaveCount(10);
    await expect(special.locator('.special-card:disabled')).toHaveCount(0);
    await expect(special.getByText('TAM PROFİL AKTİF', { exact: true })).toHaveCount(10);
    await expect(special.getByText(/HAZIRLANIYOR|İÇERİK SIRADA/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.screenshot({ path: 'test-results/desktop-special-home.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('masaüstü: dokuz genel profilin her biri 10/10 alt başlık açıyor', async ({ page }) => {
    const errors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    const codes = ['SP-SLD','SP-DYSC','SP-DYSG','SP-ASD','SP-LANG','SP-ATTN','SP-DELAY','SP-COG','SP-MIX'];
    for (const code of codes) {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.special-card[data-code="' + code + '"]').click();

      await expect(page.locator('.profile-coverage')).toBeVisible();
      await expect(page.locator('.coverage-grid > div')).toHaveCount(10);
      await expect(page.locator('.coverage-head')).toContainText('10/10 alan dolu');
      await expect(page.locator('.three-layer-flow span')).toHaveCount(3);
      await expect(page.locator('.three-layer-flow span').nth(0)).toContainText('Ortak Temel Tarama');
      await expect(page.locator('.three-layer-flow span').nth(1)).toContainText('Alan Derinleştirme');
      await expect(page.locator('.three-layer-flow span').nth(2)).toContainText('Adaptif İnceleme + Transfer');
      await expectNoHorizontalOverflow(page);
    }

    expect(errors).toEqual([]);
  });

  test('masaüstü: disleksi 12/12 harita, gelişmiş görev ve bütüncül profil', async ({ page }) => {
    const errors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(BASE, { waitUntil: 'networkidle' });

    await page.locator('.special-card[data-code="SP-DYS"]').click();
    await expect(page.getByRole('heading', { name: 'Okuma sisteminin nerede zorlandığını ayıralım' })).toBeVisible();

    await page.locator('#name').fill('SENTETİK QA ÇOCUK');
    await page.locator('#grade').selectOption('2. sınıf');
    await page.locator('#readingStage').selectOption('Cümle/metin okuyor');
    await page.locator('#concerns').fill('Sentetik kabul testi: harf karışması örneği.');
    await page.locator('#startDys').click();

    await expect(page.getByRole('heading', { name: '12 alan, tek bir okuma sistemi haritası' })).toBeVisible();
    await expect(page.locator('.domain-grid .domain-card')).toHaveCount(12);
    await expect(page.locator('.domain-grid .domain-state', { hasText: 'CANLI' })).toHaveCount(12);
    await expect(page.locator('.route-score.dys-score')).toContainText('12/12');
    await expect(page.locator('#openFullProfile')).toBeVisible();

    await page.screenshot({ path: 'test-results/desktop-dyslexia-map.png', fullPage: true });

    await page.locator('.domain-grid .domain-card').nth(2).click();
    await expect(page.getByRole('heading', { name: 'Görsel / Ortografik Ayırt Etme' })).toBeVisible();
    await expect(page.locator('.educator-panel')).toBeVisible();
    await expect(page.locator('.child-stage')).toBeVisible();
    await expect(page.locator('#advNext')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.locator('#advBackMap').click();
    await page.locator('#openFullProfile').click();
    await expect(page.getByRole('heading', { name: '12 alanın birlikte okunduğu profil' })).toBeVisible();
    await expect(page.locator('.mini-domain-result')).toHaveCount(12);
    await expect(page.getByRole('heading', { name: 'Çocukla yarın ne çalışacağız?' })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('masaüstü: genel profil görev akışı sonuç ekranına kadar ilerliyor', async ({ page }) => {
    const errors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(BASE, { waitUntil: 'networkidle' });

    await page.locator('.special-card[data-code="SP-DYSC"]').click();
    await page.locator('#sgName').fill('SENTETİK QA ÇOCUK');
    await page.locator('#sgGrade').fill('2. sınıf');
    await page.locator('#sgConcern').fill('Sentetik matematik kabul testi.');
    await page.locator('#sgStart').click();

    await expect(page.locator('.educator-panel')).toBeVisible();
    await expect(page.locator('.special-child-stage')).toBeVisible();

    const response = page.locator('#sgResponse');
    if (await response.count()) await response.fill('7');
    const choice = page.locator('[data-sg-choice]').first();
    if (await choice.count()) await choice.click();

    await page.locator('[data-sg-verdict="MATCH"]').click();
    await page.locator('[data-sg-support="INDEPENDENT"]').click();
    await page.locator('#sgNext').click();

    for (let i = 0; i < 12; i++) {
      const skip = page.locator('#sgSkip');
      if (!(await skip.count())) break;
      await skip.click();
    }

    await expect(page.getByText('Eğitsel profil özeti', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Diskalkuli/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Çocukla yarın ne çalışacağız?' })).toBeVisible();
    await expect(page.locator('.clinical-boundary')).toContainText(/tanı/i);
    await expectNoHorizontalOverflow(page);

    await page.screenshot({ path: 'test-results/desktop-dyscalculia-summary.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('mobil: ana ekran, disleksi haritası ve görev ekranı taşmıyor', async ({ page }) => {
    const errors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE, { waitUntil: 'networkidle' });

    const special = page.locator('.special-area');
    await expect(special.locator('.special-card.active')).toHaveCount(10);
    await expectNoHorizontalOverflow(page);

    await page.locator('.special-card[data-code="SP-DYS"]').click();
    await page.locator('#name').fill('SENTETİK MOBİL');
    await page.locator('#grade').selectOption('2. sınıf');
    await page.locator('#readingStage').selectOption('Kelime okuyor');
    await page.locator('#startDys').click();

    await expect(page.locator('.domain-grid .domain-card')).toHaveCount(12);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/mobile-dyslexia-map.png', fullPage: true });

    await page.locator('.domain-grid .domain-card').nth(2).click();
    await expect(page.locator('.educator-panel')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/mobile-orthographic-task.png', fullPage: true });

    expect(errors).toEqual([]);
  });

  test('oturumsuz eğitmen aynı değerlendirme formunda giriş yapıp kayıt öncesi başlayabilir', async ({ page }) => {
    let signedIn = false;
    await page.route('**/api/educator-auth', async route => {
      const input = JSON.parse(route.request().postData() || '{}');
      if (input.action === 'login') {
        expect(input.email).toBe('test@example.invalid');
        expect(input.password).toBe('sentetik-parola');
        signedIn = true;
      }
      await route.fulfill({ status: signedIn ? 200 : 401, contentType: 'application/json', body: JSON.stringify(signedIn ? { ok: true, user: { id: 'educator' } } : { ok: false, error: 'educator_session_required' }) });
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('.special-card[data-code="SP-DYS"]').click();
    await expect(page.locator('#centralEducatorLogin')).toBeVisible();
    await page.locator('#centralEducatorLogin [name="email"]').fill('test@example.invalid');
    await page.locator('#centralEducatorLogin [name="password"]').fill('sentetik-parola');
    await page.locator('#centralEducatorLogin button').click();
    await expect(page.locator('#centralEducatorLogin')).toHaveCount(0);
    await expect(page.locator('#centralStudentDys')).toHaveCount(0);
    await expect(page.locator('.central-link-panel')).toContainText('Kayıtlı öğrenci hesabı gerekmez');
    await expect(page.locator('#name')).toBeVisible();
  });

  test('giriş hatasında gerçek katman anlaşılır ve parola temizlenir', async ({ page }) => {
    await page.route('**/api/educator-auth', async route => {
      const input = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: input.action === 'me' ? 401 : 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: input.action === 'me'
          ? 'educator_session_required' : 'auth_unavailable' })
      });
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('.special-card[data-code="SP-DYS"]').click();
    await page.locator('#centralEducatorLogin [name="email"]').fill('test@example.invalid');
    await page.locator('#centralEducatorLogin [name="password"]').fill('sentetik-parola');
    await page.locator('#centralEducatorLogin button').click();
    await expect(page.locator('#centralLoginError')).toContainText('AUTH-503');
    await expect(page.locator('#centralEducatorLogin [name="password"]')).toHaveValue('');
  });

  test('merkezi bağlantı: öğrenci hesabı olmadan session oluşturma ve görev kanıtı APIye gider', async ({ page }) => {
    const errors = await collectRuntimeErrors(page);
    const requests = [];
    const sessionId = '22222222-2222-4222-8222-222222222222';
    let failFirstAttempt = true;

    await page.route('**/api/educator-auth', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, user: { id: 'educator' } }) }));

    await page.route('**/api/assessment-special-linked', async route => {
      const request = route.request();
      const payload = JSON.parse(request.postData() || '{}');
      requests.push(payload);

      if (payload.action === 'create') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            resumed: false,
            session: {
              id: sessionId,
              student_id: null,
              template_code: 'CZA_SPECIAL_V1_DYS',
              status: 'active',
              metadata: { profileCode: 'SP-DYS', centralStudentId: null }
            },
            attempts: [],
            observations: [],
            student: { id: null, name: 'Sentetik Aday' }
          })
        });
        return;
      }

      if (payload.action === 'attempt') {
        if (failFirstAttempt) {
          failFirstAttempt = false;
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'sync_unavailable' }) });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, updated: false })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(BASE, { waitUntil: 'networkidle' });

    await page.locator('.special-card[data-code="SP-DYS"]').click();
    await expect(page.locator('#centralStudentDys')).toHaveCount(0);
    await page.locator('#name').fill('Sentetik Aday');

    await page.locator('#grade').selectOption('2. sınıf');
    await page.locator('#readingStage').selectOption('Kelime okuyor');
    await page.locator('#startDys').click();

    await expect(page.getByRole('heading', { name: '12 alan, tek bir okuma sistemi haritası' })).toBeVisible();

    expect(requests.some(item =>
      item.action === 'create' &&
      !item.studentId && item.studentLabel === 'Sentetik Aday' &&
      item.profileCode === 'SP-DYS'
    )).toBeTruthy();

    await page.locator('.domain-grid .domain-card').first().click();
    await page.locator('#dysResponse').fill('al');
    await page.locator('[data-verdict="MATCH"]').click();
    await page.locator('[data-support="INDEPENDENT"]').click();
    await page.locator('#dysNext').click();
    await expect(page.locator('.central-save-error')).toContainText('sync_unavailable');
    await expect(page.getByText('Görev 1/8')).toBeVisible();
    await page.locator('#dysNext').click();
    await expect(page.getByText('Görev 2/8')).toBeVisible();

    await expect.poll(() => requests.filter(item => item.action === 'attempt').length).toBeGreaterThan(0);

    const attempt = requests.find(item => item.action === 'attempt');
    expect(attempt.sessionId).toBe(sessionId);
    expect(attempt.taskCode).toBe('DYS-PH01');
    expect(attempt.verdict).toBe('MATCH');
    expect(attempt.supportLevel).toBe('INDEPENDENT');
    expect(attempt.answerText).toBe('al');

    expect(errors.filter(value => !value.includes('503') || !value.includes('/api/assessment-special-linked'))).toEqual([]);
  });


  test('merkezi başlangıç ekranı parametreleri öğrenciyi ve özel profili otomatik taşır', async ({ page }) => {
    const studentId = '11111111-1111-4111-8111-111111111111';

    await page.route('**/api/educator-auth', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, user: { id: 'educator' } }) }));

    await page.goto(BASE + '/?studentId=' + encodeURIComponent(studentId) + '&profile=SP-DYS', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Okuma sisteminin nerede zorlandığını ayıralım' })).toBeVisible();
    await expect(page.locator('#centralStudentDys')).toHaveCount(0);
    await expect(page.locator('#name')).toBeVisible();
  });

});
