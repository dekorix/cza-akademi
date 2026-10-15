/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Full `npm test` starts this file beside hundreds of other processes. The old
// transport booted tests/u7-learning-profile-e2e-server.mjs (Vite on port 4187)
// and opened /educator. Vite then answered the prebundled React import with
// 504 Outdated Optimize Dep, so
// /@id/__x00__virtual:vinext-app-browser-entry never evaluated. The SSR shell
// stayed on "Eğitimci oturumu kontrol ediliyor…" and #educatorEmail, which is
// rendered only after that client effect finishes, never appeared. Product
// login code is unchanged. This mounts the same CentralStudentReport and Button
// through the esbuild + ephemeral-port harness the other browser tests in this
// suite already use.
test(
  'real CentralStudentReport and Button submit via click and Enter (isolated transport)',
  { timeout: 60000 },
  async () => {
    const bundle = await build({
      stdin: {
        contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {CentralStudentReport} from './components/central-student-report';
        createRoot(document.getElementById('root')).render(React.createElement(CentralStudentReport));`,
        resolveDir: process.cwd(),
        loader: 'tsx',
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"test"' },
    });
    const server = createServer((req, res) => {
      if (req.url === '/entry.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(bundle.outputFiles[0].text);
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.end(
          '<html><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
        );
      }
    });
    let browser;
    try {
      await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
      const origin = `http://127.0.0.1:${server.address().port}`;
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
      page.setDefaultTimeout(10000);
      let loginCount = 0;
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/api/educator-auth') {
          const body = JSON.parse((await request.fetchPostData()) || '{}');
          if (body.action === 'login') {
            loginCount += 1;
            assert.equal(body.email, 'test@example.invalid');
            assert.equal(body.password, 'isolated-test-password');
          }
          await request.respond({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: 'invalid_credentials',
            }),
          });
          return;
        }
        if (url.origin === origin) await request.continue();
        else await request.abort();
      });
      for (const action of ['click', 'enter']) {
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
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
      server.close();
    }
  },
);
