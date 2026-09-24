/*
 * CZA Core Init v1.1.0
 * Registry, Learning Contract ve Transport katmanlarını tek public runtime'da bağlar.
 */

import {
  CZA_MODULES,
  CZA_LEARNING
} from "./cza-core-runtime.js";

import {
  CzaCoreTransportAdapter
} from "./cza-core-transport.js";

const CZA_INIT_VERSION = "1.1.0";
const READY_EVENT = "cza:ready";
const ERROR_EVENT = "cza:error";
const MODULE_REGISTERED_EVENT = "cza:module-registered";

function emitCzaEvent(name, detail = {}) {
  if (typeof globalThis.dispatchEvent !== "function") {
    return;
  }

  const event = typeof globalThis.CustomEvent === "function"
    ? new globalThis.CustomEvent(name, { detail })
    : { type: name, detail };

  globalThis.dispatchEvent(event);
}

function setRuntimeState(state) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.czaRuntime = state;
  }
}

class CzaCoreInitializer {
  #runtime = null;
  #transport = null;

  constructor({
    modules = CZA_MODULES,
    learning = CZA_LEARNING,
    TransportAdapter = CzaCoreTransportAdapter,
    transportOptions = {}
  } = {}) {
    if (
      !modules ||
      typeof modules.register !== "function" ||
      typeof modules.get !== "function" ||
      typeof modules.list !== "function"
    ) {
      throw new Error("cza_module_registry_unavailable");
    }

    if (
      !learning ||
      typeof learning.createRecord !== "function" ||
      typeof learning.publish !== "function"
    ) {
      throw new Error("cza_learning_contract_unavailable");
    }

    if (typeof TransportAdapter !== "function") {
      throw new Error("cza_transport_adapter_unavailable");
    }

    this.modules = modules;
    this.learning = learning;
    this.TransportAdapter = TransportAdapter;
    this.transportOptions = transportOptions;
  }

  start() {
    if (this.#runtime) {
      return this.#runtime;
    }

    if (globalThis.CZA_APP?.ready === true) {
      this.#runtime = globalThis.CZA_APP;
      return this.#runtime;
    }

    const contractVersion = this.modules.contractVersion;
    if (typeof contractVersion !== "string" || !contractVersion) {
      throw new Error("cza_contract_version_unavailable");
    }

    this.#transport = new this.TransportAdapter({
      ...this.transportOptions,
      contractVersion
    });

    const publishRecord = record =>
      this.learning.publish(record, payload => this.#transport.publish(payload));

    const registerModule = manifest => {
      const registered = this.modules.register(manifest);

      emitCzaEvent(MODULE_REGISTERED_EVENT, {
        moduleId: registered.id,
        moduleVersion: registered.version,
        contractVersion: registered.contractVersion
      });

      return registered;
    };

    const runtime = Object.freeze({
      ready: true,
      initVersion: CZA_INIT_VERSION,
      contractVersion,
      modules: this.modules,
      learning: this.learning,
      registerModule,
      hasModule: moduleId => this.modules.has(moduleId),
      getModule: moduleId => this.modules.get(moduleId),
      listModules: options => this.modules.list(options),
      createRecord: input => this.learning.createRecord(input),
      publishRecord,
      record: async input => {
        const record = this.learning.createRecord(input);
        const result = await publishRecord(record);
        return Object.freeze({ record, result });
      }
    });

    Object.defineProperty(globalThis, "CZA_APP", {
      value: runtime,
      writable: false,
      configurable: false,
      enumerable: true
    });

    this.#runtime = runtime;
    setRuntimeState("ready");

    emitCzaEvent(READY_EVENT, {
      initVersion: runtime.initVersion,
      contractVersion: runtime.contractVersion
    });

    console.info(
      `[CZA] Core Runtime hazır — Contract ${runtime.contractVersion}`
    );

    return runtime;
  }
}

const CZA_INIT = new CzaCoreInitializer();

function bootCza() {
  try {
    return CZA_INIT.start();
  } catch (error) {
    setRuntimeState("failed");

    const code = error instanceof Error
      ? error.message
      : "cza_init_failed";

    console.error("[CZA] Core Runtime başlatılamadı:", code);
    emitCzaEvent(ERROR_EVENT, { stage: "core_init", code });
    return null;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCza, { once: true });
  } else {
    queueMicrotask(bootCza);
  }
}

export {
  CZA_INIT_VERSION,
  CzaCoreInitializer,
  CZA_INIT,
  bootCza
};
