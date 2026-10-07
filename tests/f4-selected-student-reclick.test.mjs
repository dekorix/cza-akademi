/* oxlint-disable typescript/no-floating-promises -- node:test registrations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Real component and timeline, isolated synthetic HTTP transport. No staging access.
test(
  'selected student clicks preserve detail, history and in-flight loading',
  { timeout: 60000 },
  async (t) => {
    const bundle = await build({
      stdin: {
        contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {EducatorStudentCore} from './components/educator-student-core'; createRoot(document.getElementById('root')).render(React.createElement(EducatorStudentCore));`,
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
      const executablePath =
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
        executablePath,
        headless: true,
        args: ['--no-sandbox'],
      });
      const students = ['A', 'B'].map((id) => ({
        id,
        name: `Student ${id}`,
        code: id,
        username: null,
      }));
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const requests = [];
      const pending = new Map();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', async (r) => {
        const url = new URL(r.url());
        const send = (data) =>
          r.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(data),
          });
        if (url.pathname === '/api/educator-students')
          await send({ ok: true, students });
        else if (url.pathname === '/api/educator-student-detail') {
          const id = url.searchParams.get('studentId');
          requests.push(id);
          pending.set(id, () =>
            send({
              ok: true,
              student: students.find((s) => s.id === id),
              work: { active: [], completed: [] },
              attempts: [],
              errors: [],
              evidence: [],
              history: [],
              learningProfile: {
                clientReportedSkills: [],
                serverVerifiedSkills: [],
                clientReportedRecordCount: 0,
                serverVerifiedEvidenceCount: 0,
              },
            }),
          );
        } else if (url.pathname === '/api/educator-student-history') {
          const id = url.searchParams.get('studentId');
          await send({
            ok: true,
            timeline: {
              events: [
                {
                  eventId: `history-${id}`,
                  eventType: 'WORK_COMPLETED',
                  title: `History ${id}`,
                  moduleCode: 'flash_anzan',
                  occurredAt: '2026-09-28T00:00:00Z',
                  status: 'completed',
                  verificationStatus: 'client_reported',
                },
              ],
              hasMore: false,
              nextCursor: null,
            },
          });
        } else if (url.pathname.startsWith('/api/'))
          await r.respond({
            status: 503,
            contentType: 'application/json',
            body: '{"ok":false,"error":"out_of_scope_fixture"}',
          });
        else if (url.origin === origin) await r.continue();
        else await r.abort();
      });
      const click = async (id) => {
        const button = await page.waitForSelector(
          `aside button::-p-text(Student ${id})`,
        );
        await button.click();
        await page.evaluate(
          () =>
            new Promise((ok) =>
              requestAnimationFrame(() => requestAnimationFrame(ok)),
            ),
        );
      };
      const loading = () =>
        page.evaluate(() =>
          document.body.textContent.includes('Öğrenci dosyası hazırlanıyor'),
        );
      const visible = (id) =>
        page.waitForFunction(
          (id) =>
            document.querySelector('header h2')?.textContent ===
              `Student ${id}` &&
            document.body.textContent.includes(`History ${id}`),
          { timeout: 4000 },
          id,
        );
      await page.goto(`${origin}/reclick-test`, {
        waitUntil: 'domcontentloaded',
      });
      await t.test(
        'same selection during first load leaves pending request intact',
        async () => {
          await page.waitForSelector('aside button::-p-text(Student A)');
          await click('A');
          await click('A');
          assert.equal(await loading(), true);
          assert.deepEqual(requests, ['A']);
          await pending.get('A')();
          await visible('A');
          assert.equal(await loading(), false);
        },
      );
      await t.test(
        'repeated selected clicks keep detail and history mounted',
        async () => {
          await page.evaluate(() => {
            window.savedDetail = document.querySelector('header');
            window.savedHistory = document.querySelector(
              '[aria-labelledby="learning-timeline-heading"]',
            );
          });
          await click('A');
          await click('A');
          await click('A');
          assert.equal(
            await loading(),
            false,
            'selected student must not become stuck loading',
          );
          assert.equal(
            await page.evaluate(
              () =>
                window.savedDetail.isConnected &&
                window.savedHistory.isConnected,
            ),
            true,
          );
          await visible('A');
          assert.deepEqual(requests, ['A']);
        },
      );
      await t.test(
        'different student loads correct detail and history',
        async () => {
          await click('B');
          assert.equal(await loading(), true);
          assert.deepEqual(requests, ['A', 'B']);
          await click('B');
          assert.equal(await loading(), true);
          await pending.get('B')();
          await visible('B');
          assert.equal(await loading(), false);
          assert.equal(
            await page.evaluate(() =>
              document.body.textContent.includes('History A'),
            ),
            false,
          );
          assert.deepEqual(requests, ['A', 'B']);
        },
      );
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      await new Promise((ok) => server.close(ok));
    }
  },
);
