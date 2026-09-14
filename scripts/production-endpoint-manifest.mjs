import { pathToFileURL } from 'node:url';

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const REQUIRED_ENDPOINTS = new Set(['DATABASE_URL', 'DATABASE_URL_UNPOOLED']);

function plainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype,
  );
}

export function parseProductionEndpointManifest(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 16_384) {
    throw new Error('production-endpoint-manifest-invalid');
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error('production-endpoint-manifest-invalid');
  }
  if (
    !plainObject(manifest) ||
    manifest.schemaVersion !== 1 ||
    manifest.complete !== true ||
    !Array.isArray(manifest.endpoints) ||
    manifest.endpoints.length < REQUIRED_ENDPOINTS.size ||
    manifest.endpoints.length > 32
  ) {
    throw new Error('production-endpoint-manifest-invalid');
  }

  const endpoints = manifest.endpoints.map((entry) => {
    if (
      !plainObject(entry) ||
      Object.keys(entry).length !== 2 ||
      !NAME_PATTERN.test(entry.name || '') ||
      !HASH_PATTERN.test(entry.sha256 || '')
    ) {
      throw new Error('production-endpoint-manifest-invalid');
    }
    return Object.freeze({ name: entry.name, sha256: entry.sha256 });
  });
  const names = new Set(endpoints.map((entry) => entry.name));
  const hashes = new Set(endpoints.map((entry) => entry.sha256));
  if (names.size !== endpoints.length || hashes.size !== endpoints.length) {
    throw new Error('production-endpoint-manifest-duplicate');
  }
  for (const required of REQUIRED_ENDPOINTS) {
    if (!names.has(required)) {
      throw new Error(`production-endpoint-manifest-missing:${required}`);
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    complete: true,
    endpoints: Object.freeze(endpoints),
    hashes: Object.freeze([...hashes]),
  });
}

function main() {
  const manifest = parseProductionEndpointManifest(
    process.env.CZA_PRODUCTION_DB_ENDPOINT_MANIFEST || '',
  );
  process.stdout.write(
    `Production endpoint manifest accepted (${manifest.endpoints.length} hashed endpoints).\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'production-endpoint-manifest-invalid'}\n`,
    );
    process.exitCode = 1;
  }
}
