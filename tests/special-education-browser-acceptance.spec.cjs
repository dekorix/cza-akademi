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
    if (msg.type() === 'error') errors.push('console: ' + msg.text());
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
      await page.locator('.special-card[data-code="' + code + '"]').click();

      await expect(page.locator('.profile-coverage')).toBeVisible();
      await expect(page.locator('.coverage-grid > div')).toHaveCount(10);
      await expect(page.locator('.coverage-head')).toContainText('10/10 alan dolu');
      await expect(page.locator('.three-layer-flow span')).toHaveCount(3);
      await expect(page.getByText('Ortak Temel Tarama', { exact: true })).toBeVisible();
      await expect(page.getByText('Alan Derinleştirme', { exact: true })).toBeVisible();
      await expect(page.getByText('Adaptif İnceleme + Transfer', { exact: true })).toBeVisible();
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
    await expect(page.locator('.clinical-boundary')).toContainText('tanı');
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
});
