const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function assertIJsonString(value) {
  if (LONE_SURROGATE.test(value)) {
    throw new TypeError('JCS_LONE_SURROGATE_REJECTED');
  }
}

export function canonicalizeJcs(value) {
  if (value === null) return 'null';

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('JCS_NON_FINITE_NUMBER_REJECTED');
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    assertIJsonString(value);
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJcs).join(',')}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map(key => {
        assertIJsonString(key);
        return `${JSON.stringify(key)}:${canonicalizeJcs(value[key])}`;
      })
      .join(',')}}`;
  }

  throw new TypeError('JCS_UNSUPPORTED_JSON_VALUE');
}

export function withoutTopLevelAttestation(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
    throw new TypeError('MANIFEST_ROOT_INVALID');
  }

  const { attestation: _excluded, ...payload } = manifest;
  return payload;
}
