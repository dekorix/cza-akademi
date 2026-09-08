import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../components/central-student-report.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
} }).outputText;
const compiled = { exports: {} };
new Function('require', 'module', 'exports', js)((id) => {
  if (id.startsWith('@/')) return {};
  return require(id);
}, compiled, compiled.exports);

test('initial educator render never mounts protected dashboard or student data', () => {
  function PrivateDashboard() { throw new Error('Protected dashboard was mounted'); }
  const html = renderToStaticMarkup(React.createElement(compiled.exports.CentralStudentReport, null,
    React.createElement(PrivateDashboard)));
  assert.match(html, /oturumu kontrol ediliyor/);
  assert.doesNotMatch(html, /Zeynep|582946|zeynep7|Habip/);
});

test('standalone report also waits for authentication before rendering controls', () => {
  const html = renderToStaticMarkup(React.createElement(compiled.exports.CentralStudentReport));
  assert.doesNotMatch(html, /studentCode|Son soru kayıtları/);
});
