import { validateWorldContract } from './world-contract.js';

const validId = value => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);

// Explicit factories keep one world instance from being initialized twice.
export function createWorldRegistry(entries) {
  if (!Array.isArray(entries)) throw new Error('Wereldregister moet een lijst met factories zijn.');
  const factories = new Map();
  const usedInstances = new WeakSet();
  for (const entry of entries) {
    if (!entry || !validId(entry.id) || typeof entry.create !== 'function') throw new Error('Wereldregister vereist een geldige id en create-functie.');
    if (factories.has(entry.id)) throw new Error(`Dubbele wereld-ID: ${entry.id}.`);
    factories.set(entry.id, entry.create);
  }
  return Object.freeze({
    ids: () => [...factories.keys()],
    create(id) {
      if (!factories.has(id)) throw new Error(`Onbekende wereld-ID: ${id}.`);
      const world = factories.get(id)();
      if (world && typeof world === 'object' && usedInstances.has(world)) throw new Error(`Factory voor ${id} moet bij elke activatie een nieuwe wereldinstantie maken.`);
      try {
        validateWorldContract(world);
        if (world.config.id !== id) throw new Error(`Wereld-ID ${world.config.id} komt niet overeen met register-ID ${id}.`);
      } catch (error) {
        try { world?.dispose?.(); } catch (cleanupError) { console.error('Ongeldige wereld opruimen:', cleanupError); }
        throw error;
      }
      usedInstances.add(world);
      return world;
    }
  });
}
