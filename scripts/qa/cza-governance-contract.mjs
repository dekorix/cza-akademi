// CZA Governance PR contract. Read-only validator; never deploys or mutates production.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_SECTIONS = Object.freeze([
  'Kapsam ve dışarıda kalanlar',
  'Önce/sonra envanteri ve eksiltme kontrolü',
  'Veri, kimlik ve yetki sözleşmesi',
  'İçerik, tasarım ve erişilebilirlik',
  'Testler ve kanıtlar',
  'Yayın etkisi ve geri dönüş',
  'Checkpoint ve sıradaki tek adım',
]);
export const ENFORCEMENT_START = '2026-10-08T21:15:00Z';

function plainText(input) {
  return input
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter(line => !/^\s*-\s*\[[ xX]\]\s*/.test(line))
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}
function sectionContent(body, heading) {
  const lines = body.split('\n');
  const match = lines.findIndex(line => line.trim() === '## ' + heading);
  if (match < 0) return null;
  let end = match + 1;
  while (end < lines.length && !/^##\s+/.test(lines[end])) end++;
  return plainText(lines.slice(match + 1, end).join('\n'));
}

export function validateGovernancePR({body = '', createdAt, strict = false} = {}) {
  const start = Date.parse(ENFORCEMENT_START);
  const created = Date.parse(createdAt || '');
  if (!strict && Number.isFinite(created) && created < start) {
    return {pass: true, legacy: true, errors: [], note: 'Legacy PR: informational only, no retroactive blocker.'};
  }
  const errors = [];
  if (!Number.isFinite(created) && !strict) errors.push('Missing or invalid PR creation timestamp');
  const normalized = String(body).replace(/\r\n/g, '\n');
  const scrubbed = normalized.replace(/<!--[\s\S]*?-->/g, '');

  if (!/^CZA-GATE-V1\s*$/m.test(scrubbed)) errors.push('Missing CZA-GATE-V1 identifier');
  if (!/^KAPSAM SAPMASI:\s*(YOK|VAR)\s*$/m.test(scrubbed)) errors.push('Specify KAPSAM SAPMASI: YOK|VAR');
  if (!/^PRODUCTION_YETKISI:\s*(YOK|ONAY:[A-Za-z0-9_-]+)\s*$/m.test(scrubbed)) errors.push('Specify PRODUCTION_YETKISI: YOK or ONAY:reference');
  const impact = scrubbed.match(/^YAYIN_ETKISI:\s*(YOK|BELIRSIZ|VAR)\s*$/m);
  if (!impact) errors.push('Specify YAYIN_ETKISI: YOK|BELIRSIZ|VAR');
  if (impact?.[1] === 'BELIRSIZ') errors.push('Publish impact remains BELIRSIZ; manual review required before merge');
  for (const name of REQUIRED_SECTIONS) {
    const content = sectionContent(normalized, name);
    if (content === null) errors.push('Missing section: ' + name);
    else if (content.length < 24 || /(?:\bTODO\b|DOLDURULACAK|^\.\.\.$)/i.test(content)) {
      errors.push('Section needs concrete explanation: ' + name);
    }
  }
  if (/^KAPSAM SAPMASI:\s*VAR\s*$/m.test(scrubbed)) {
    errors.push('KAPSAM SAPMASI=VAR: stop and request an architecture decision');
  }
  return {pass: errors.length === 0, legacy: false, errors};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateGovernancePR({
    body: process.env.CZA_PR_BODY,
    createdAt: process.env.CZA_PR_CREATED_AT,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}
