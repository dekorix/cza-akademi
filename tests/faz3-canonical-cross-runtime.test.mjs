import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { canonicalEdgeRequest, canonicalTarget, serializeHmacMessage } from '../infra/staging/worker/src/canonical-edge.mjs';
import { canonicalOriginRequest, originCanonicalTarget, originHmacMessage } from '../security/faz3/hmac/canonical-origin.mjs';

const validGrammar = /^\/(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})*(?:\/(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})*)*(?:\?(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+=(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})*(?:&(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+=(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})*)*)?$/;

test('edge and origin produce byte-identical canonical requests and HMAC messages', () => {
  const input = {
    method: 'POST',
    publicAuthority: 'phase2-staging.example.invalid',
    expectedPublicAuthority: 'phase2-staging.example.invalid',
    rawTarget: '/phase2/%C3%A7al%C4%B1%C5%9Fma?b=2&a=1&a=0',
    profile: 'json-required',
    contentTypeValues: [' application/json ; charset="UTF-8" '],
    bodyLength: 2,
  };
  assert.deepEqual(canonicalEdgeRequest(input), canonicalOriginRequest(input));
  const fields = {
    v: '2', kid: 'staging-2026-09', ts: '1789440000', nonce: 'a'.repeat(32), method: 'POST',
    'public-authority': input.publicAuthority, 'raw-target': input.rawTarget,
    target: canonicalTarget(input.rawTarget), 'route-id': 'phase2-staging-v1',
    'origin-service-authority': 'phase2-origin.internal', 'content-type': 'application/json;charset=utf-8',
    'body-sha256': 'b'.repeat(64), 'access-jwt-sha256': 'c'.repeat(64), audience: 'aud-staging',
    'subject-hash': 'edge-authn-only', 'role-metadata': 'edge-authn-only', 'client-ip-hash': 'd'.repeat(64),
    'request-id': '00000000-0000-4000-8000-000000000000',
  };
  assert.equal(Buffer.from(serializeHmacMessage(fields)).compare(Buffer.from(originHmacMessage(fields))), 0);
});

test('all literal C0/DEL and percent-decoded controls fail closed in both runtimes', () => {
  const controls = [...Array.from({ length: 32 }, (_, value) => value), 0x7f];
  for (const value of controls) {
    const literal = `/phase2/a${String.fromCharCode(value)}b`;
    assert.throws(() => canonicalTarget(literal));
    assert.throws(() => originCanonicalTarget(literal));
    const encoded = `/phase2/a%${value.toString(16).padStart(2, '0')}b`;
    assert.throws(() => canonicalTarget(encoded));
    assert.throws(() => originCanonicalTarget(encoded));
  }
});

test('canonical output satisfies the normative grammar, not just runtime parity', () => {
  const atoms = ['alpha', 'Z9', '~x', '%C3%A7', '%E2%82%AC', 'a%20b'];
  for (let iteration = 0; iteration < 512; iteration += 1) {
    const bytes = randomBytes(6);
    const left = atoms[bytes[0] % atoms.length];
    const right = atoms[bytes[1] % atoms.length];
    const raw = `/phase2/${left}/${right}?b=${bytes[2]}&a=${bytes[3]}&a=${bytes[4]}`;
    const edge = canonicalTarget(raw);
    const origin = originCanonicalTarget(raw);
    assert.equal(edge, origin);
    assert.match(edge, validGrammar);
    for (const escape of edge.match(/%[0-9A-Fa-f]{2}/g) || []) assert.equal(escape, escape.toUpperCase());
    assert.equal(/[\u0000-\u001f\u007f]/.test(edge), false);
  }
});

test('malformed separators, empty members, literal plus, cross authority and truncated headers fail closed', () => {
  for (const raw of ['/phase2//x', '/phase2/%2Fx', '/phase2/x?&a=1', '/phase2/x?a+b=1', '/phase2/..']) {
    assert.throws(() => canonicalTarget(raw));
    assert.throws(() => originCanonicalTarget(raw));
  }
  for (const implementation of [canonicalEdgeRequest, canonicalOriginRequest]) {
    assert.throws(() => implementation({
      method: 'GET', publicAuthority: 'attacker.invalid', expectedPublicAuthority: 'phase2-staging.example.invalid',
      rawTarget: '/phase2', profile: 'body-forbidden', contentTypeValues: [], bodyLength: 0,
    }));
    assert.throws(() => implementation({
      method: 'GET', publicAuthority: 'phase2-staging.example.invalid', expectedPublicAuthority: 'phase2-staging.example.invalid',
      rawTarget: '/phase2', headersTruncated: true, profile: 'body-forbidden', contentTypeValues: [], bodyLength: 0,
    }));
  }
});
