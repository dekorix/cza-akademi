/* oxlint-disable typescript/no-floating-promises -- node:test lifecycle declarations register synchronously. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let core;
let server;
let vite;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  core = await vite.ssrLoadModule('/lib/book-preparation-core.ts');
  server = await vite.ssrLoadModule('/lib/book-preparation-server.ts');
});

after(async () => {
  await vite.close();
});

function syntheticDraft() {
  return structuredClone(core.SYNTHETIC_BOOK_DRAFT);
}

test('synthetic schema and server-verified content summary are recursively frozen', () => {
  const summary = server.SYNTHETIC_BOOK_CONTENT_SUMMARY;
  assert.equal(Object.isFrozen(core.SYNTHETIC_BOOK_DRAFT), true);
  assert.equal(Object.isFrozen(core.SYNTHETIC_BOOK_DRAFT.targetWpm), true);
  assert.equal(Object.isFrozen(core.SYNTHETIC_BOOK_DRAFT.blocks), true);
  assert.equal(Object.isFrozen(core.SYNTHETIC_BOOK_DRAFT.blocks[0]), true);
  assert.equal(Object.isFrozen(summary), true);
  assert.equal(Object.isFrozen(summary.draft.blocks[0]), true);
  assert.equal(summary.summaryType, 'server_verified_content_summary');
  assert.equal(Object.hasOwn(summary, 'previewId'), false);
  assert.match(summary.contentHash, /^[0-9a-f]{64}$/);
  assert.equal(summary.serverValidated, true);
  assert.equal(summary.persistenceEnabled, false);
  assert.equal(summary.productionLedgerEligible, false);
  assert.throws(() => {
    summary.draft.targetWpm.preferred = 999;
  }, TypeError);
});

test('server normalizes canonical text before producing a stable content hash', () => {
  const first = syntheticDraft();
  const second = syntheticDraft();
  second.title = `  ${second.title}  `;
  second.blocks[1].text = second.blocks[1].text.replaceAll(' ', '   ');
  assert.equal(
    server.buildServerVerifiedContentSummary(first).contentHash,
    server.buildServerVerifiedContentSummary(second).contentHash,
  );
  assert.ok(server.buildServerVerifiedContentSummary(first).wordCount > 10);
});

test('server rejects trust-field, HTML and prototype injection attempts', () => {
  const trustInjection = {
    ...syntheticDraft(),
    serverValidated: true,
  };
  assert.throws(
    () => server.buildServerVerifiedContentSummary(trustInjection),
    /book_draft_invalid/,
  );

  const htmlInjection = syntheticDraft();
  htmlInjection.blocks[1].text = '<script>globalThis.pwned=true</script>';
  assert.throws(
    () => server.buildServerVerifiedContentSummary(htmlInjection),
    /book_block_text_invalid/,
  );

  const polluted = JSON.parse(
    '{"title":"x","language":"tr-TR","difficulty":"foundation","targetWpm":{"minimum":80,"preferred":120,"maximum":160},"blocks":[],"__proto__":{"serverValidated":true}}',
  );
  assert.throws(
    () => server.buildServerVerifiedContentSummary(polluted),
    /book_draft_invalid/,
  );
});

test('server enforces ordered WPM bounds and unique structured blocks', () => {
  const reversedWpm = syntheticDraft();
  reversedWpm.targetWpm = { minimum: 200, preferred: 120, maximum: 160 };
  assert.throws(
    () => server.buildServerVerifiedContentSummary(reversedWpm),
    /book_target_wpm_order_invalid/,
  );

  const duplicateBlock = syntheticDraft();
  duplicateBlock.blocks[1].clientBlockId =
    duplicateBlock.blocks[0].clientBlockId;
  assert.throws(
    () => server.buildServerVerifiedContentSummary(duplicateBlock),
    /book_block_id_invalid/,
  );
});

test('future persistence contract normalizes untrusted content before adapters', async () => {
  const identity = {
    draft_id: '11111111-1111-4111-8111-111111111111',
    academy_id: '22222222-2222-4222-8222-222222222222',
    educator_id: '33333333-3333-4333-8333-333333333333',
  };
  let capturedCreate;
  let capturedUpdate;
  class TestAdapter extends server.BookDraftPersistenceContract {
    async createRevisionTransactionally(command) {
      capturedCreate = command;
      return { revision: {}, replayed: false };
    }

    async updateRevisionTransactionally(command) {
      capturedUpdate = command;
      return { revision: {}, replayed: false };
    }
  }
  const adapter = new TestAdapter();
  await adapter.createServerOwnedDraft({
    owner: {
      academy_id: identity.academy_id.toUpperCase(),
      educator_id: identity.educator_id.toUpperCase(),
    },
    idempotency_key: '44444444-4444-4444-8444-444444444444',
    untrusted_draft: syntheticDraft(),
  });
  assert.equal(capturedCreate.owner.academy_id, identity.academy_id);
  assert.equal(capturedCreate.audit_action, 'created');
  assert.equal(capturedCreate.summary.serverValidated, true);
  assert.equal(Object.isFrozen(capturedCreate.summary.draft.blocks[0]), true);

  await assert.rejects(
    adapter.createServerOwnedDraft({
      owner: identity,
      idempotency_key: '55555555-5555-4555-8555-555555555555',
      untrusted_draft: server.SYNTHETIC_BOOK_CONTENT_SUMMARY,
    }),
    /book_draft_invalid/,
  );

  const contentHash = server.SYNTHETIC_BOOK_CONTENT_SUMMARY.contentHash;
  const first = server.buildBookDraftEtag(identity, 1, contentHash);
  const second = server.buildBookDraftEtag(identity, 2, contentHash);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
  await adapter.updateOwnedDraft({
    identity,
    expected_version: 1,
    expected_etag: first,
    expected_status: 'draft',
    target_status: 'review',
    untrusted_draft: syntheticDraft(),
  });
  assert.equal(capturedUpdate.target_status, 'review');
  assert.equal(capturedUpdate.audit_action, 'submitted');
  assert.equal(capturedUpdate.summary.contentHash, contentHash);

  assert.throws(
    () => server.buildBookDraftEtag(identity, 0, contentHash),
    /book_draft_revision_invalid/,
  );
  assert.throws(
    () => server.assertBookDraftStatusTransition('published', 'draft'),
    (error) =>
      error.status === 409 && error.code === 'book_draft_status_conflict',
  );
  const conflict = new server.BookDraftOptimisticConflictError();
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, 'book_draft_version_conflict');
  const idempotencyConflict = new server.BookDraftIdempotencyConflictError();
  assert.equal(idempotencyConflict.status, 409);
  assert.equal(idempotencyConflict.code, 'book_draft_idempotency_conflict');
});
