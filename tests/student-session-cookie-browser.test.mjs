import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { inflate } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

test('browser sends student session to core, assessment and history, then removes it on logout', { timeout: 60000 }, async () => {
  const source = readFileSync(new URL('../app/api/core/route.ts', import.meta.url), 'utf8');
  const functions = source.slice(source.indexOf('function cookie('), source.indexOf('function assessmentSessionCookie('));
  const sessionCookie = vm.runInNewContext(ts.transpileModule(functions + '\nsessionCookie;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, { COOKIE_NAME: 'cza_student_session', encodeURIComponent });
  const server = createServer((request, response) => {
    if (request.url === '/login') response.setHeader('Set-Cookie', sessionCookie('isolated-student-token', 300, false));
    if (request.url === '/logout') response.setHeader('Set-Cookie', sessionCookie('', 0, false));
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ cookie: request.headers.cookie || '' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const executablePath = process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : await inflate(resolve(dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium'))), '../bin/chromium.br'));
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin + '/login');
    const cookie = (await browser.cookies()).find(cookie => cookie.name === 'cza_student_session');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    for (const path of ['/api/core/me', '/api/assessment', '/api/student-history']) {
      const response = await page.goto(origin + path);
      assert.equal((await response.json()).cookie, 'cza_student_session=isolated-student-token', path);
    }
    assert.equal((await (await page.goto(origin + '/educator')).json()).cookie, '');
    await page.goto(origin + '/logout');
    assert.equal((await (await page.goto(origin + '/api/student-history')).json()).cookie, '');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
