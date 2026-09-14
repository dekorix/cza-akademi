import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const AAD = Buffer.from('cza-neon-cleanup-recovery-v1', 'utf8');

function plainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype,
  );
}

function decodeBase64(value, maximumBytes = 1024 * 1024) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumBytes * 2 ||
    !BASE64_PATTERN.test(value)
  ) {
    throw new Error('cleanup-recovery-base64-invalid');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 0 || decoded.length > maximumBytes) {
    throw new Error('cleanup-recovery-base64-invalid');
  }
  return decoded;
}

function rsaPublicKey(value) {
  const key = value?.type === 'public' ? value : createPublicKey(value);
  if (
    key.asymmetricKeyType !== 'rsa' ||
    (key.asymmetricKeyDetails?.modulusLength || 0) < 3072
  ) {
    throw new Error('cleanup-recovery-public-key-invalid');
  }
  return key;
}

function publicKeyFingerprint(key) {
  return createHash('sha256')
    .update(key.export({ type: 'spki', format: 'der' }))
    .digest('hex');
}

export function publicKeyFromEnvironment(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 32_768) {
    throw new Error('cleanup-recovery-public-key-invalid');
  }
  try {
    return rsaPublicKey(decodeBase64(encoded, 16_384));
  } catch {
    throw new Error('cleanup-recovery-public-key-invalid');
  }
}

function validateRecoveryInputs(recovery, context, credential) {
  if (
    !plainObject(recovery) ||
    !PROJECT_ID_PATTERN.test(recovery.projectId || '') ||
    !plainObject(context) ||
    context.projectId !== recovery.projectId ||
    !plainObject(credential) ||
    credential.version !== 1 ||
    credential.projectId !== recovery.projectId ||
    typeof credential.identityAssertion !== 'string' ||
    credential.identityAssertion.length < 16 ||
    typeof credential.expiresAt !== 'string' ||
    Number.isNaN(Date.parse(credential.expiresAt)) ||
    typeof credential.assertionExpires !== 'number' ||
    !Number.isFinite(credential.assertionExpires) ||
    credential.assertionExpires <= 0
  ) {
    throw new Error('cleanup-recovery-input-invalid');
  }
}

export function sealRecoveryBundle({
  recovery,
  context,
  credential,
  publicKey,
}) {
  validateRecoveryInputs(recovery, context, credential);
  const rsaKey = rsaPublicKey(publicKey);
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  cipher.setAAD(AAD);
  const plaintext = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      projectId: recovery.projectId,
      context,
      credential,
    }),
    'utf8',
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedKey = publicEncrypt(
    {
      key: rsaKey,
      oaepHash: 'sha256',
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    dataKey,
  );
  dataKey.fill(0);
  plaintext.fill(0);
  return Object.freeze({
    schemaVersion: 1,
    algorithm: 'RSA-OAEP-256+A256GCM',
    publicKeySha256: publicKeyFingerprint(rsaKey),
    projectId: recovery.projectId,
    projectExpiresAt: recovery.projectExpiresAt || credential.expiresAt,
    authorityExpiresAt: new Date(
      credential.assertionExpires * 1000,
    ).toISOString(),
    cleanupStatus: 'orphaned',
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

export function openRecoveryBundle(bundle, privateKeyValue) {
  if (
    !plainObject(bundle) ||
    bundle.schemaVersion !== 1 ||
    bundle.algorithm !== 'RSA-OAEP-256+A256GCM' ||
    !PROJECT_ID_PATTERN.test(bundle.projectId || '') ||
    !/^[0-9a-f]{64}$/.test(bundle.publicKeySha256 || '') ||
    typeof bundle.authorityExpiresAt !== 'string' ||
    Number.isNaN(Date.parse(bundle.authorityExpiresAt))
  ) {
    throw new Error('cleanup-recovery-bundle-invalid');
  }
  try {
    const privateKey = createPrivateKey(privateKeyValue);
    const publicKey = rsaPublicKey(createPublicKey(privateKey));
    if (publicKeyFingerprint(publicKey) !== bundle.publicKeySha256) {
      throw new Error('cleanup-recovery-key-mismatch');
    }
    const dataKey = privateDecrypt(
      {
        key: privateKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      decodeBase64(bundle.encryptedKey, 2048),
    );
    const decipher = createDecipheriv(
      'aes-256-gcm',
      dataKey,
      decodeBase64(bundle.iv, 64),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(decodeBase64(bundle.authTag, 64));
    const plaintext = Buffer.concat([
      decipher.update(decodeBase64(bundle.ciphertext)),
      decipher.final(),
    ]);
    const payload = JSON.parse(plaintext.toString('utf8'));
    dataKey.fill(0);
    plaintext.fill(0);
    validateRecoveryInputs(
      { projectId: bundle.projectId },
      payload.context,
      payload.credential,
    );
    if (payload.schemaVersion !== 1 || payload.projectId !== bundle.projectId) {
      throw new Error('cleanup-recovery-bundle-invalid');
    }
    if (
      new Date(payload.credential.assertionExpires * 1000).toISOString() !==
      bundle.authorityExpiresAt
    ) {
      throw new Error('cleanup-recovery-bundle-invalid');
    }
    return Object.freeze(payload);
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'cleanup-recovery-key-mismatch',
        'cleanup-recovery-bundle-invalid',
      ].includes(error.message)
    ) {
      throw error;
    }
    throw new Error('cleanup-recovery-decryption-failed');
  }
}

function secureWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, value, { mode: 0o600 });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function credentialPath(configDirectory, projectId) {
  return path.join(configDirectory, `claimable-credential.${projectId}.json`);
}

export function sealRecoveryFiles({
  recoveryFile,
  contextFile,
  configDirectory,
  outputFile,
  encodedPublicKey,
}) {
  const recovery = readJson(recoveryFile);
  const context = readJson(contextFile);
  const credential = readJson(
    credentialPath(configDirectory, recovery.projectId),
  );
  const bundle = sealRecoveryBundle({
    recovery,
    context,
    credential,
    publicKey: publicKeyFromEnvironment(encodedPublicKey),
  });
  secureWrite(outputFile, `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

export function generateRecoveryDrillKeyFiles({
  publicKeyFile,
  privateKeyFile,
}) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  secureWrite(
    publicKeyFile,
    `${Buffer.from(publicKey, 'utf8').toString('base64')}\n`,
  );
  secureWrite(privateKeyFile, privateKey);
}

export function verifyDeleteResult(result, expectedProjectId) {
  if (
    !plainObject(result) ||
    result.project_id !== expectedProjectId ||
    result.state !== 'deleted'
  ) {
    throw new Error('cleanup-delete-not-confirmed');
  }
  return true;
}

export function recoverAndDelete({ bundleFile, privateKeyFile, neonBin }) {
  if (!path.isAbsolute(neonBin)) {
    throw new Error('cleanup-recovery-neon-bin-invalid');
  }
  fs.accessSync(neonBin, fs.constants.X_OK);
  const privateKeyStat = fs.statSync(privateKeyFile);
  if ((privateKeyStat.mode & 0o077) !== 0) {
    throw new Error('cleanup-recovery-private-key-permissions-invalid');
  }
  const bundleBytes = fs.readFileSync(bundleFile);
  const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');
  const bundle = JSON.parse(bundleBytes.toString('utf8'));
  if (Date.parse(bundle.authorityExpiresAt) <= Date.now()) {
    throw new Error('cleanup-recovery-authority-expired');
  }
  const payload = openRecoveryBundle(
    bundle,
    fs.readFileSync(privateKeyFile, 'utf8'),
  );
  const recoveryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cza-neon-cleanup-'),
  );
  const contextFile = path.join(recoveryDirectory, '.neon');
  const configDirectory = path.join(recoveryDirectory, 'config');
  try {
    secureWrite(contextFile, `${JSON.stringify(payload.context, null, 2)}\n`);
    secureWrite(
      credentialPath(configDirectory, payload.projectId),
      `${JSON.stringify(payload.credential)}\n`,
    );
    const result = spawnSync(
      neonBin,
      [
        '--no-analytics',
        '--no-color',
        '--output',
        'json',
        '--config-dir',
        configDirectory,
        '--context-file',
        contextFile,
        'claim',
        'delete',
        payload.projectId,
        '--yes',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NEON_API_KEY: '',
          NEON_PROFILE: '',
        },
        maxBuffer: 1024 * 1024,
      },
    );
    if (result.status !== 0) {
      throw new Error('cleanup-recovery-delete-failed');
    }
    verifyDeleteResult(JSON.parse(result.stdout), payload.projectId);
    return Object.freeze({
      projectId: payload.projectId,
      state: 'deleted',
      recoveryMode: 'encrypted-claimable-bundle',
      bundleSha256,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'cleanup-recovery-delete-failed',
        'cleanup-delete-not-confirmed',
      ].includes(error.message)
    ) {
      throw error;
    }
    throw new Error('cleanup-recovery-delete-failed');
  } finally {
    fs.rmSync(recoveryDirectory, { recursive: true, force: true });
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'validate-public-key' && args.length === 0) {
    publicKeyFromEnvironment(
      process.env.CZA_NEON_RECOVERY_PUBLIC_KEY_B64 || '',
    );
    process.stdout.write('Cleanup recovery public key accepted.\n');
    return;
  }
  if (command === 'seal' && args.length === 4) {
    const [recoveryFile, contextFile, configDirectory, outputFile] = args;
    sealRecoveryFiles({
      recoveryFile,
      contextFile,
      configDirectory,
      outputFile,
      encodedPublicKey: process.env.CZA_NEON_RECOVERY_PUBLIC_KEY_B64 || '',
    });
    process.stdout.write('Encrypted cleanup recovery bundle created.\n');
    return;
  }
  if (command === 'generate-drill-key' && args.length === 2) {
    generateRecoveryDrillKeyFiles({
      publicKeyFile: args[0],
      privateKeyFile: args[1],
    });
    return;
  }
  if (command === 'verify-delete' && args.length === 2) {
    verifyDeleteResult(readJson(args[0]), args[1]);
    return;
  }
  if (command === 'discard' && args.length === 1) {
    fs.rmSync(args[0], { force: true });
    return;
  }
  if (command === 'recover-delete' && args.length === 3) {
    const result = recoverAndDelete({
      bundleFile: args[0],
      privateKeyFile: args[1],
      neonBin: path.resolve(args[2]),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  throw new Error('cleanup-recovery-command-invalid');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'cleanup-recovery-failed'}\n`,
    );
    process.exitCode = 1;
  }
}
