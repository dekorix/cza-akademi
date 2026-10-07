import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalizeJcs, withoutTopLevelAttestation } from './jcs.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function verifyManifestObject(manifest, publicKeyOverride) {
  const attestation = manifest?.attestation;
  if (!attestation || typeof attestation !== 'object') {
    fail('ATTESTATION_MISSING');
  }
  if (
    attestation.algorithm !== 'Ed25519' ||
    attestation.canonicalization !== 'RFC8785-JCS' ||
    attestation.digest_algorithm !== 'SHA-256' ||
    attestation.signing_purpose !== 'OFFLINE_STATIC_REAUDIT'
  ) {
    fail('ATTESTATION_CONTRACT_INVALID');
  }

  const overrideKey =
    publicKeyOverride?.type === 'public'
      ? publicKeyOverride
      : publicKeyOverride
        ? createPublicKey(publicKeyOverride)
        : null;
  const publicDer = overrideKey
    ? overrideKey.export({ type: 'spki', format: 'der' })
    : Buffer.from(attestation.public_key_spki_base64, 'base64');
  const fingerprint = sha256(publicDer).toString('hex');
  if (fingerprint !== attestation.public_key_fingerprint) {
    fail('PUBLIC_KEY_FINGERPRINT_MISMATCH');
  }

  const canonicalPayload = Buffer.from(
    canonicalizeJcs(withoutTopLevelAttestation(manifest)),
    'utf8',
  );
  const payloadDigest = sha256(canonicalPayload);
  if (payloadDigest.toString('hex') !== attestation.payload_sha256) {
    fail('PAYLOAD_SHA256_MISMATCH');
  }

  const publicKey = createPublicKey({
    key: publicDer,
    format: 'der',
    type: 'spki',
  });
  const signature = Buffer.from(attestation.signature, 'base64');
  if (!verify(null, payloadDigest, publicKey, signature)) {
    fail('ED25519_SIGNATURE_INVALID');
  }

  return {
    result: 'PASS',
    payload_sha256: attestation.payload_sha256,
    public_key_fingerprint: fingerprint,
    signing_purpose: attestation.signing_purpose,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifestPath = process.argv[2];
  const publicKeyPath = process.argv[3];
  if (!manifestPath) {
    throw new Error(
      'usage: node verify-manifest-attestation.mjs MANIFEST [PUBLIC_KEY]',
    );
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const publicKey = publicKeyPath ? await readFile(publicKeyPath) : undefined;
    process.stdout.write(`${JSON.stringify(verifyManifestObject(manifest, publicKey))}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ result: 'FAIL', error: error.code || error.message })}\n`,
    );
    process.exitCode = 1;
  }
}
