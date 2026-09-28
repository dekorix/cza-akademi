/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

test(
  'real CentralStudentReport and Button submit via click and Enter (isolated transport)',
  { timeout: 60000 },
  async () => {
    const server = spawn(
      process.execPath,
      ['tests/u7-learning-profile-e2e-server.mjs'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let browser;
    try {
      await new Promise((ok, bad) => {
        const timer = setTimeout(() => bad(Error('server timeout')), 20000);
        server.stdout.on('data', (d) => {
          if (d.toString().includes('CZA_U7_E2E_READY')) {
            clearTimeout(timer);
            ok();
          }
        });
        server.once('exit', () => {
          clearTimeout(timer);
          bad(Error('server exited'));
        });
      });
      const binary =
        process.platform === 'win32'
          ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
          : await inflate(
              resolve(
                dirname(
                  fileURLToPath(import.meta.resolve('@sparticuz/chromium')),
                ),
                '../bin/chromium.br',
              ),
            );
      browser = await puppeteer.launch({
        executablePath: binary,
        headless: true,
        args: ['--no-sandbox'],
      });
      const page = await browser.newPage();
      let loginCount = 0;
      await page.setRequestInterception(true);
      page.on('request', async (r) => {
        const url = new URL(r.url());
        if (url.pathname === '/api/educator-auth') {
          const body = JSON.parse((await r.fetchPostData()) || '{}');
          if (body.action === 'login') {
            loginCount++;
            assert.equal(body.email, 'test@example.invalid');
            assert.equal(body.password, 'isolated-test-password');
          }
          void r.respond({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: 'invalid_credentials' }),
          });
        } else if (url.origin === 'http://127.0.0.1:4187') void r.continue();
        else void r.abort();
      });
      for (const action of ['click', 'enter']) {
        await page.goto('http://127.0.0.1:4187/educator', {
          waitUntil: 'networkidle0',
        });
        await page.waitForSelector('#educatorEmail');
        await page.type('#educatorEmail', 'test@example.invalid');
        await page.type('#educatorPassword', 'isolated-test-password');
        const response = page.waitForResponse(
          async (r) =>
            r.url().endsWith('/api/educator-auth') &&
            JSON.parse((await r.request().fetchPostData()) || '{}').action ===
              'login',
          { timeout: 3000 },
        );
        if (action === 'click') await page.click('form button');
        if (action === 'enter') await page.keyboard.press('Enter');
        await response;
      }
      assert.equal(loginCount, 2);
    } finally {
      if (browser) await browser.close();
      server.kill('SIGTERM');
    }
  },
);
