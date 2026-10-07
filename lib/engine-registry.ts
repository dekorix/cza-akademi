import { anzanEngineAdapter } from './anzan-engine-adapter';
import type { EngineCapability, EngineDefinition } from './engine-contract';

export const engineRegistry = Object.freeze([anzanEngineAdapter] satisfies readonly EngineDefinition[]);

export function engineDefinition(engineId: string, engineVersion: string) {
  const versions = engineRegistry.filter(definition => definition.engineId === engineId);
  if (!versions.length) throw new Error('unknown_engine');
  const definition = versions.find(candidate => candidate.engineVersion === engineVersion);
  if (!definition) throw new Error('unknown_engine_version');
  return definition;
}

export function requireEngineCapability(engineId: string, engineVersion: string, capability: string) {
  const definition = engineDefinition(engineId, engineVersion);
  if (!definition.capabilities.includes(capability as EngineCapability)) {
    throw new Error('unsupported_engine_capability');
  }
  return definition;
}
