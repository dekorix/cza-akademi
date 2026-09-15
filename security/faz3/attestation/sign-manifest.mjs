import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { canonicalizeJcs, withoutTopLevelAttestation } from './jcs.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sortJson(value[key])]),
  );
}

export async function signManifest({ manifestPath, privateKeyPath, publicKeyPath }) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const privateKey = createPrivateKey(await readFile(privateKeyPath));
  const publicKey = createPublicKey(privateKey);
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const canonicalPayload = Buffer.from(
    canonicalizeJcs(withoutTopLevelAttestation(manifest)),
    'utf8',
  );
  const payloadDigest = sha256(canonicalPayload);

  manifest.attestation = {
    algorithm: 'Ed25519',
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    payload_sha256: payloadDigest.toString('hex'),
    public_key_fingerprint: sha256(publicDer).toString('hex'),
    public_key_pem_sha256: sha256(publicPem).toString('hex'),
    public_key_spki_base64: publicDer.toString('base64'),
    signature: sign(null, payloadDigest, privateKey).toString('base64'),
    signing_purpose: 'OFFLINE_STATIC_REAUDIT',
  };

  await writeFile(manifestPath, `${JSON.stringify(sortJson(manifest), null, 2)}\n`, {
    mode: 0o644,
  });
  await writeFile(
    publicKeyPath,
    publicPem,
    { mode: 0o644 },
  );

  return manifest.attestation;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , manifestPath, privateKeyPath, publicKeyPath] = process.argv;
  if (!manifestPath || !privateKeyPath || !publicKeyPath) {
    throw new Error(
      'usage: node sign-manifest.mjs MANIFEST PRIVATE_KEY PUBLIC_KEY',
    );
  }
  const attestation = await signManifest({
    manifestPath,
    privateKeyPath,
    publicKeyPath,
  });
  process.stdout.write(
    `${JSON.stringify({
      result: 'PASS',
      algorithm: attestation.algorithm,
      payload_sha256: attestation.payload_sha256,
      public_key_fingerprint: attestation.public_key_fingerprint,
      signing_purpose: attestation.signing_purpose,
    })}\n`,
  );
}
