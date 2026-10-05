import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpecialLearningProfile } from '../lib/special-learning-profile.ts';

test('builds dyslexia learning profile from canonical attempts', () => {
  const profile = buildSpecialLearningProfile({
    session: {
      id: '11111111-1111-4111-8111-111111111111',
      template_code: 'CZA_SPECIAL_V1_DYS',
      completed_at: '2026-10-05T20:00:00Z',
      metadata: { profileCode: 'SP-DYS' },
    },
    attempts: [
      { task_code: 'DYS-PH01', support_level: 0, answer_payload: { verdict: 'MATCH', supportLevel: 'INDEPENDENT', flags: [] } },
      { task_code: 'DYS-PH02', support_level: 1, answer_payload: { verdict: 'PARTIAL', supportLevel: 'VERBAL_PROMPT', flags: ['Ses atlama'] } },
      { task_code: 'DYS-LS01', support_level: 3, answer_payload: { verdict: 'DIFFERENT', supportLevel: 'MODELED', flags: ['Uzun arama / gecikme'] } },
      { task_code: 'DYS-LS02', support_level: 3, answer_payload: { verdict: 'DIFFERENT', supportLevel: 'MODELED', flags: ['Uzun arama / gecikme'] } },
    ],
    observations: [
      { task_code: 'DYS-LS02', observation_codes: ['b–d karıştı'] },
    ],
  });
  assert.ok(profile);
  assert.equal(profile?.profileCode, 'SP-DYS');
  assert.equal(profile?.evidenceCount, 4);
  assert.equal(profile?.domains.length, 2);
  assert.equal(profile?.domains[0].label, 'Harf–Ses Otomatikliği');
  assert.ok(['PRIORITY', 'EXPERT_REVIEW'].includes(profile?.domains[0].status || ''));
});

test('generic profiles group by educational area instead of diagnosis', () => {
  const profile = buildSpecialLearningProfile({
    session: {
      id: '22222222-2222-4222-8222-222222222222',
      template_code: 'CZA_SPECIAL_V1_DYSC',
      metadata: { profileCode: 'SP-DYSC' },
    },
    attempts: [
      { task_code: 'DYC01', support_level: 0, answer_payload: { verdict: 'MATCH', supportLevel: 'INDEPENDENT', area: 'Sayı Hissi' } },
      { task_code: 'DYC02', support_level: 2, answer_payload: { verdict: 'PARTIAL', supportLevel: 'VISUAL_PROMPT', area: 'Sembol–Nicelik' } },
    ],
    observations: [],
  });
  assert.ok(profile);
  assert.equal(profile?.profileCode, 'SP-DYSC');
  assert.equal(profile?.domains.some(domain => domain.label === 'Sayı Hissi'), true);
  assert.match(profile?.note || '', /klinik tanı değildir/);
});
