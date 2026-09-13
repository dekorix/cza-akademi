/*
 * CZA Core Runtime v1.0.0
 * Tarayıcı tarafındaki modül kayıt defteri ve ortak öğrenme sözleşmesi.
 */

const CZA_CONTRACT_VERSION = "1.0.0";
const CZA_SCHEMA_VERSION = "CZA_MODULE_RECORD_V1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SUPPORT_LEVELS = new Set([
  "independent",
  "prompted",
  "guided",
  "modeled",
  "unknown"
]);

function fail(code) {
  throw new Error(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, code) {
  if (!isPlainObject(value)) {
    fail(code);
  }
}

function requireText(value, code, maxLength = 160) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    fail(code);
  }

  return value.trim();
}

function cloneJson(value, code) {
  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      fail(code);
    }

    return JSON.parse(serialized);
  } catch {
    fail(code);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function normalizeIsoTime(value, code) {
  const text = requireText(value, code, 64);
  const timestamp = Date.parse(text);

  if (!Number.isFinite(timestamp)) {
    fail(code);
  }

  return new Date(timestamp).toISOString();
}

function createClientRecordId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  fail("cza_secure_random_unavailable");
}

function normalizeManifest(manifest, contractVersion) {
  requirePlainObject(manifest, "cza_module_manifest_invalid");

  const id = requireText(manifest.id, "cza_module_id_required", 80);
  if (!MODULE_ID_PATTERN.test(id)) {
    fail("cza_module_id_invalid");
  }

  const name = requireText(manifest.name, "cza_module_name_required", 120);
  const version = requireText(manifest.version, "cza_module_version_required", 40);
  if (!VERSION_PATTERN.test(version)) {
    fail("cza_module_version_invalid");
  }

  const declaredContractVersion = manifest.contractVersion ?? contractVersion;
  if (declaredContractVersion !== contractVersion) {
    fail("cza_module_contract_mismatch");
  }

  if (!Array.isArray(manifest.activityTypes) || manifest.activityTypes.length === 0) {
    fail("cza_module_activity_types_required");
  }

  const activityTypes = Array.from(new Set(
    manifest.activityTypes.map(activityType =>
      requireText(activityType, "cza_module_activity_type_invalid", 80)
    )
  ));

  const skills = Array.isArray(manifest.skills)
    ? Array.from(new Set(manifest.skills.map(skill =>
      requireText(skill, "cza_module_skill_invalid", 80)
    )))
    : [];

  const metadata = manifest.metadata ?? {};
  requirePlainObject(metadata, "cza_module_metadata_invalid");

  return deepFreeze({
    id,
    name,
    version,
    contractVersion,
    activityTypes,
    skills,
    metadata: cloneJson(metadata, "cza_module_metadata_not_serializable")
  });
}

class CzaModuleRegistry {
  #modules = new Map();

  constructor({ contractVersion = CZA_CONTRACT_VERSION } = {}) {
    this.contractVersion = requireText(
      contractVersion,
      "cza_contract_version_required",
      40
    );
  }

  register(manifest) {
    const normalized = normalizeManifest(manifest, this.contractVersion);
    const existing = this.#modules.get(normalized.id);

    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(normalized)) {
        return existing;
      }

      fail("cza_module_already_registered");
    }

    this.#modules.set(normalized.id, normalized);
    return normalized;
  }

  has(moduleId) {
    return this.#modules.has(String(moduleId));
  }

  get(moduleId) {
    const registeredModule = this.#modules.get(String(moduleId));
    if (!registeredModule) {
      fail("cza_module_not_found");
    }

    return registeredModule;
  }

  list({ activityType } = {}) {
    const modules = Array.from(this.#modules.values());
    const filtered = activityType
      ? modules.filter(registeredModule => registeredModule.activityTypes.includes(activityType))
      : modules;

    return Object.freeze(filtered.slice());
  }
}

class CzaLearningContract {
  constructor({ modules, now = () => new Date() } = {}) {
    if (!modules || typeof modules.get !== "function") {
      fail("cza_learning_registry_required");
    }

    if (typeof now !== "function") {
      fail("cza_learning_clock_invalid");
    }

    this.modules = modules;
    this.now = now;
    this.contractVersion = modules.contractVersion;
  }

  createRecord(input) {
    requirePlainObject(input, "cza_record_input_invalid");

    for (const forbiddenField of ["studentId", "academyId", "educatorId"]) {
      if (Object.prototype.hasOwnProperty.call(input, forbiddenField)) {
        fail("cza_untrusted_identity_field");
      }
    }

    const moduleId = requireText(input.moduleId, "cza_record_module_required", 80);
    const moduleManifest = this.modules.get(moduleId);
    const trainingSessionId = requireText(
      input.trainingSessionId,
      "cza_record_training_session_required",
      100
    );
    if (!UUID_PATTERN.test(trainingSessionId)) {
      fail("cza_record_training_session_invalid");
    }
    const activityType = requireText(
      input.activityType,
      "cza_record_activity_type_required",
      80
    );

    if (!moduleManifest.activityTypes.includes(activityType)) {
      fail("cza_record_activity_type_not_supported");
    }

    const currentIso = this.now().toISOString();
    const startedAt = normalizeIsoTime(
      input.startedAt ?? currentIso,
      "cza_record_started_at_invalid"
    );
    const completedAt = normalizeIsoTime(
      input.completedAt ?? currentIso,
      "cza_record_completed_at_invalid"
    );

    if (Date.parse(completedAt) < Date.parse(startedAt)) {
      fail("cza_record_time_order_invalid");
    }

    const supportLevel = input.supportLevel ?? "unknown";
    if (!SUPPORT_LEVELS.has(supportLevel)) {
      fail("cza_record_support_level_invalid");
    }

    const performance = input.performance ?? {};
    const metadata = input.metadata ?? {};
    requirePlainObject(performance, "cza_record_performance_invalid");
    requirePlainObject(metadata, "cza_record_metadata_invalid");

    const skills = input.skills ?? [];
    if (!Array.isArray(skills)) {
      fail("cza_record_skills_invalid");
    }

    const normalizedSkills = Array.from(new Set(skills.map(skill =>
      requireText(skill, "cza_record_skill_invalid", 80)
    )));

    const clientRecordId = input.clientRecordId === undefined
      ? createClientRecordId()
      : requireText(input.clientRecordId, "cza_record_client_id_invalid", 100);

    return deepFreeze({
      recordType: "module_record",
      schemaVersion: CZA_SCHEMA_VERSION,
      contractVersion: this.contractVersion,
      clientRecordId,
      trainingSessionId,
      moduleId: moduleManifest.id,
      moduleVersion: moduleManifest.version,
      activityType,
      startedAt,
      completedAt,
      supportLevel,
      performance: cloneJson(performance, "cza_record_performance_not_serializable"),
      skills: normalizedSkills,
      metadata: cloneJson(metadata, "cza_record_metadata_not_serializable")
    });
  }

  validateRecord(record) {
    requirePlainObject(record, "cza_record_invalid");

    if (
      record.recordType !== "module_record" ||
      record.schemaVersion !== CZA_SCHEMA_VERSION ||
      record.contractVersion !== this.contractVersion
    ) {
      fail("cza_record_contract_invalid");
    }

    requireText(record.clientRecordId, "cza_record_client_id_invalid", 100);
    if (!UUID_PATTERN.test(record.clientRecordId)) {
      fail("cza_record_client_id_invalid");
    }
    if (!UUID_PATTERN.test(
      requireText(record.trainingSessionId, "cza_record_training_session_invalid", 100)
    )) {
      fail("cza_record_training_session_invalid");
    }
    const moduleManifest = this.modules.get(record.moduleId);

    if (record.moduleVersion !== moduleManifest.version) {
      fail("cza_record_module_version_invalid");
    }

    if (!moduleManifest.activityTypes.includes(record.activityType)) {
      fail("cza_record_activity_type_not_supported");
    }

    return record;
  }

  async publish(record, sender) {
    this.validateRecord(record);

    if (typeof sender !== "function") {
      fail("cza_record_sender_required");
    }

    return sender(record);
  }
}

const CZA_MODULES = new CzaModuleRegistry();
const CZA_LEARNING = new CzaLearningContract({ modules: CZA_MODULES });

export {
  CZA_CONTRACT_VERSION,
  CZA_SCHEMA_VERSION,
  CzaModuleRegistry,
  CzaLearningContract,
  CZA_MODULES,
  CZA_LEARNING
};
