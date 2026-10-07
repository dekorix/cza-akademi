/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const studentId = 'c8612ac1-6d04-4990-8385-e7c60234efbc';
const recipeId = 'c4fa49d8-a26e-4799-be31-f97309b0d4c6';
const sessionId = '8a26ff75-ba32-4863-b734-7f4c884560a8';
const recordId = 'afb86e4f-3c6e-4317-9169-06f7375e3908';
const report = {
  ok: true,
  student: { id: studentId, name: 'Sentetik Öğrenci', campusCode: '' },
  summary: { total: 13, correct: 1, wrong: 12, accuracy: 8 },
  modules: [{ module_code: 'finger_read', total: 1, correct: 0 }],
  recent: [],
};
const detail = {
  ok: true,
  student: { id: studentId },
  work: {
    completed: [
      {
        id: recipeId,
        name: 'Sentetik Ödev',
        moduleCode: 'finger_read',
        source: 'teacher_assignment',
        session: { id: sessionId, status: 'completed', completedAt: null },
      },
    ],
  },
  attempts: [
    { id: 'attempt-1', sessionId },
    { id: 'unrelated-attempt', sessionId: 'other-session' },
  ],
  history: [
    { id: recordId, sessionId },
    { id: 'unrelated-record', sessionId: 'other-session' },
  ],
  evidence: [
    {
      id: 'evidence-1',
      learningRecordId: recordId,
      verificationStatus: 'server_verified',
    },
    {
      id: 'unrelated-evidence',
      learningRecordId: 'unrelated-record',
      verificationStatus: 'server_verified',
    },
  ],
};

test(
  'central report links authorized assignment, session and exact result after reload',
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
      let denied = false;
      const requestedIds = [];
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        const url = new URL(request.url());
        const send = (body, status = 200) =>
          request.respond({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
        if (url.pathname === '/api/educator-auth') await send({ ok: true });
        else if (url.pathname === '/api/educator-report') await send(report);
        else if (url.pathname === '/api/educator-student-detail') {
          requestedIds.push(url.searchParams.get('studentId'));
          await send(
            denied ? { ok: false, error: 'student_not_authorized' } : detail,
            denied ? 403 : 200,
          );
        } else if (url.origin === origin) await request.continue();
        else await request.abort();
      });
      const load = async () => {
        await page.waitForSelector('#studentCode');
        await page.type('#studentCode', studentId);
        await page.$eval('#studentCode', (el) =>
          el.closest('form').requestSubmit(),
        );
      };
      const card = `[data-assignment-id="${recipeId}"]`;
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await load();
      await page.waitForSelector(card);
      const text = await page.$eval(card, (el) => el.textContent);
      assert.match(text, new RegExp(sessionId));
      assert.match(text, /1 deneme \/ 1 öğrenme kaydı \/ 1 kanıt/);
      assert.match(text, /1 sunucu doğrulamalı/);
      assert.match(
        await page.$eval('body', (el) => el.textContent),
        /Öğrenci geneli toplamları/,
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await load();
      await page.waitForSelector(card);
      assert.deepEqual(requestedIds, [studentId, studentId]);
      denied = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await load();
      await page.waitForFunction(() =>
        document.body.textContent.includes(
          'Ödev ve oturum dökümü yetkili öğrenci kaydından alınamadı.',
        ),
      );
      assert.equal(await page.$(card), null);
      assert.deepEqual(requestedIds, [studentId, studentId, studentId]);
    } finally {
      if (browser) await browser.close();
      server.close();
    }
  },
);
