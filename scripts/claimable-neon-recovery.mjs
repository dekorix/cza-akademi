import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function secureWrite(file, value) {
  fs.mkdirSync(path.dirname(file), {
    recursive: true,
    mode: 0o700,
  });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function captureRecoveryRecord(createOutput) {
  if (
    !createOutput ||
    typeof createOutput !== 'object' ||
    Array.isArray(createOutput) ||
    !PROJECT_ID_PATTERN.test(createOutput.project_id || '') ||
    typeof createOutput.project_expires_at !== 'string'
  ) {
    throw new Error('claimable-recovery-input-invalid');
  }
  const expiresAt = new Date(createOutput.project_expires_at);
  if (Number.isNaN(expiresAt.valueOf())) {
    throw new Error('claimable-recovery-input-invalid');
  }
  return Object.freeze({
    schemaVersion: 1,
    projectId: createOutput.project_id,
    projectExpiresAt: expiresAt.toISOString(),
    cleanupStatus: 'pending',
  });
}

export function captureContextRecoveryRecord(context) {
  if (
    !context ||
    typeof context !== 'object' ||
    Array.isArray(context) ||
    !PROJECT_ID_PATTERN.test(context.projectId || '')
  ) {
    throw new Error('claimable-recovery-input-invalid');
  }
  return Object.freeze({
    schemaVersion: 1,
    projectId: context.projectId,
    projectExpiresAt: null,
    cleanupStatus: 'pending',
  });
}

export function updateRecoveryStatus(record, status) {
  if (
    !record ||
    typeof record !== 'object' ||
    !PROJECT_ID_PATTERN.test(record.projectId || '') ||
    !['deleted', 'orphaned'].includes(status)
  ) {
    throw new Error('claimable-recovery-status-invalid');
  }
  return Object.freeze({ ...record, cleanupStatus: status });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const [command, sourceFile, target] = process.argv.slice(2);
  if (command === 'capture' && sourceFile && target) {
    secureWrite(target, captureRecoveryRecord(readJson(sourceFile)));
    return;
  }
  if (command === 'capture-context' && sourceFile && target) {
    secureWrite(target, captureContextRecoveryRecord(readJson(sourceFile)));
    return;
  }
  if (command === 'status' && sourceFile && target) {
    secureWrite(sourceFile, updateRecoveryStatus(readJson(sourceFile), target));
    return;
  }
  if (command === 'project-id' && sourceFile && !target) {
    const record = readJson(sourceFile);
    if (!PROJECT_ID_PATTERN.test(record.projectId || '')) {
      throw new Error('claimable-recovery-status-invalid');
    }
    process.stdout.write(record.projectId);
    return;
  }
  throw new Error('claimable-recovery-command-invalid');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'claimable-recovery-failed'}\n`,
    );
    process.exitCode = 1;
  }
}
