'use strict';

// oxlint-disable typescript/no-require-imports -- NODE_OPTIONS --require needs a CommonJS preload
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
// oxlint-enable typescript/no-require-imports

const auditFile = process.env.CZA_NETWORK_AUDIT_FILE || '';
const allowedHostSha256 = (
  process.env.CZA_ALLOWED_POSTGRES_HOST_SHA256 || ''
).trim();
const originalConnect = net.Socket.prototype.connect;
const installationMarker = Symbol.for('cza.postgresNetworkAuditInstalled');

if (globalThis[installationMarker]) {
  throw new Error('CZA_NETWORK_AUDIT_ALREADY_INSTALLED');
}
if (!auditFile || !/^[0-9a-f]{64}$/.test(allowedHostSha256)) {
  throw new Error('CZA_NETWORK_AUDIT_CONFIG_INVALID');
}
globalThis[installationMarker] = true;

function connectionHost(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first && typeof first === 'object') {
    return typeof first.host === 'string' ? first.host : '';
  }
  return typeof args[1] === 'string' ? args[1] : '';
}

net.Socket.prototype.connect = function auditedConnect(...args) {
  const host = connectionHost(args).trim().toLowerCase();
  if (host) {
    const hostSha256 = createHash('sha256').update(host).digest('hex');
    const blocked = hostSha256 !== allowedHostSha256;
    if (auditFile) {
      fs.appendFileSync(
        auditFile,
        `${JSON.stringify({ hostSha256, blocked })}\n`,
        { mode: 0o600 },
      );
    }
    if (blocked) {
      const error = new Error('CZA_NON_TEMPORARY_NETWORK_BLOCKED');
      error.code = 'CZA_NON_TEMPORARY_NETWORK_BLOCKED';
      throw error;
    }
  }
  return originalConnect.apply(this, args);
};
