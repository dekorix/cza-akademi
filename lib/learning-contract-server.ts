export const CZA_CONTRACT_VERSION = '1.0.0';
export const CZA_SCHEMA_VERSION = 'CZA_MODULE_RECORD_V1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SUPPORT_LEVELS = new Set(['independent', 'prompted', 'guided', 'modeled', 'unknown']);
const RECORD_FIELDS = new Set([
  'recordType',
  'schemaVersion',
  'contractVersion',
  'clientRecordId',
  'trainingSessionId',
  'moduleId',
  'moduleVersion',
  'activityType',
  'startedAt',
  'completedAt',
  'supportLevel',
  'performance',
  'skills',
  'metadata',
]);

export type CanonicalLearningRecord = {
  recordType: 'module_record';
  schemaVersion: typeof CZA_SCHEMA_VERSION;
  contractVersion: typeof CZA_CONTRACT_VERSION;
  clientRecordId: string;
  trainingSessionId: string;
  moduleId: string;
  moduleVersion: string;
  activityType: string;
  startedAt: string;
  completedAt: string;
  supportLevel: 'independent' | 'prompted' | 'guided' | 'modeled' | 'unknown';
  performance: Record<string, unknown>;
  skills: string[];
  metadata: Record<string, unknown>;
};

export class LearningContractError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'LearningContractError';
  }
}

function fail(code: string): never {
  throw new LearningContractError(code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function text(value: unknown, code: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) fail(code);
  return value.trim();
}

function isoTime(value: unknown, code: string) {
  const raw = text(value, code, 64);
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) fail(code);
  return new Date(time).toISOString();
}

function assertSafeJson(
  value: unknown,
  state = { nodes: 0 },
  depth = 0,
): void {
  state.nodes += 1;
  if (state.nodes > 1200 || depth > 10) fail('cza_record_json_too_complex');

  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('cza_record_json_invalid');
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 4000) fail('cza_record_json_value_too_long');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) fail('cza_record_json_array_too_long');
    value.forEach(item => assertSafeJson(item, state, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > 200) fail('cza_record_json_object_too_large');
    for (const [key, item] of entries) {
      if (!key || key.length > 120) fail('cza_record_json_key_invalid');
      assertSafeJson(item, state, depth + 1);
    }
    return;
  }

  fail('cza_record_json_invalid');
}

export function parseCanonicalLearningRecord(
  value: unknown,
  requestContractVersion: string | null,
): CanonicalLearningRecord {
  if (!isPlainObject(value)) fail('cza_record_invalid');

  for (const field of Object.keys(value)) {
    if (!RECORD_FIELDS.has(field)) fail('cza_record_unknown_field');
  }

  if (value.recordType !== 'module_record') fail('cza_record_type_invalid');
  if (value.schemaVersion !== CZA_SCHEMA_VERSION) fail('cza_schema_version_invalid');
  if (value.contractVersion !== CZA_CONTRACT_VERSION) fail('cza_contract_version_invalid');
  if (requestContractVersion && requestContractVersion !== value.contractVersion) {
    fail('cza_contract_header_mismatch');
  }

  const clientRecordId = text(value.clientRecordId, 'cza_client_record_id_invalid', 100);
  const trainingSessionId = text(value.trainingSessionId, 'cza_training_session_id_invalid', 100);
  if (!UUID_PATTERN.test(clientRecordId)) fail('cza_client_record_id_invalid');
  if (!UUID_PATTERN.test(trainingSessionId)) fail('cza_training_session_id_invalid');

  const moduleId = text(value.moduleId, 'cza_module_id_invalid', 80);
  const activityType = text(value.activityType, 'cza_activity_type_invalid', 80);
  if (!MODULE_ID_PATTERN.test(moduleId)) fail('cza_module_id_invalid');
  if (!MODULE_ID_PATTERN.test(activityType)) fail('cza_activity_type_invalid');

  const moduleVersion = text(value.moduleVersion, 'cza_module_version_invalid', 40);
  if (!VERSION_PATTERN.test(moduleVersion)) fail('cza_module_version_invalid');

  const startedAt = isoTime(value.startedAt, 'cza_started_at_invalid');
  const completedAt = isoTime(value.completedAt, 'cza_completed_at_invalid');
  if (Date.parse(completedAt) < Date.parse(startedAt)) fail('cza_record_time_order_invalid');

  const supportLevel = text(value.supportLevel, 'cza_support_level_invalid', 32);
  if (!SUPPORT_LEVELS.has(supportLevel)) fail('cza_support_level_invalid');

  if (!isPlainObject(value.performance)) fail('cza_performance_invalid');
  if (!isPlainObject(value.metadata)) fail('cza_metadata_invalid');
  if (!Array.isArray(value.skills) || value.skills.length > 32) fail('cza_skills_invalid');

  const skills = Array.from(new Set(value.skills.map(skill => {
    const normalized = text(skill, 'cza_skill_invalid', 80);
    if (!MODULE_ID_PATTERN.test(normalized)) fail('cza_skill_invalid');
    return normalized;
  })));

  assertSafeJson(value.performance);
  assertSafeJson(value.metadata);

  return {
    recordType: 'module_record',
    schemaVersion: CZA_SCHEMA_VERSION,
    contractVersion: CZA_CONTRACT_VERSION,
    clientRecordId,
    trainingSessionId,
    moduleId,
    moduleVersion,
    activityType,
    startedAt,
    completedAt,
    supportLevel: supportLevel as CanonicalLearningRecord['supportLevel'],
    performance: value.performance,
    skills,
    metadata: value.metadata,
  };
}
