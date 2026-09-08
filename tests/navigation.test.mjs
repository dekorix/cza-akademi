import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');
const files = ['app', 'components'].flatMap(directory =>
  readdirSync(new URL(`${directory}/`, root), { recursive: true })
    .filter(path => /\.[jt]sx?$/.test(path))
    .map(path => `${directory}/${path.replaceAll('\\', '/')}`));

test('cross-page navigation does not depend on the failing client router shim', () => {
  for (const file of files) {
    assert.doesNotMatch(source(file), /from\s+['"]next\/(?:link|navigation)['"]/, file);
    assert.doesNotMatch(source(file), /<\/?Link\b/, file);
  }
});

test('main routes and query-bearing teaching/program links remain native anchors', () => {
  for (const [file, hrefs] of [
    ['app/page.tsx', ['/', '/studio', '/learn', '/educator']],
    ['app/learn/page.tsx', ['/', '/educator?tab=teaching']],
    ['app/educator/page.tsx', ['/', '/studio?program=demo', '/studio']],
    ['app/studio/page.tsx', ['/', '/educator']],
    ['components/teaching-reports.tsx', ['/learn']],
  ]) {
    const text = source(file);
    for (const href of hrefs) assert.ok(text.includes(`<a href="${href}"`), `${file}: ${href}`);
  }
  assert.match(source('app/page.tsx'), /<a[^>]*href=\{module\.href\}/);
  assert.ok(source('app/page.tsx').includes('/studio?mode=flash'));
  assert.ok(source('app/page.tsx').includes('/studio?mode=audio'));
});

test('educator handoff carries the selected username but never a PIN', () => {
  const educator = source('components/educator-students.tsx');
  const paritmetik = source('app/paritmetik/page.tsx');
  assert.ok(educator.includes('/paritmetik?from=educator&username=${encodeURIComponent(student.username)}'));
  assert.doesNotMatch(educator, /zeynep7/);
  assert.doesNotMatch(educator, /[?&]pin=/i);
  assert.match(paritmetik, /params\.get\('username'\)/);
  assert.match(paritmetik, /params\.get\('from'\) === 'educator'/);
  assert.match(paritmetik, /source: 'free_practice'/);
});

test('unfinished teaching and exercise sessions guard document navigation', () => {
  for (const file of ['app/learn/page.tsx', 'app/studio/page.tsx']) {
    const text = source(file);
    assert.match(text, /addEventListener\('beforeunload',\s*warn\)/);
    assert.match(text, /removeEventListener\('beforeunload',\s*warn\)/);
  }
  assert.match(source('app/studio/page.tsx'), /if \(!active\) return;/);
});
