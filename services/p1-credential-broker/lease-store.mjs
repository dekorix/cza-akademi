import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const EMPTY = Object.freeze({ schemaVersion: 'CZA-P1-NEON-LEASE-STORE-V1', leases: [] });

export class MemoryLeaseStore {
  constructor() { this.leases = []; }
  async list() { return structuredClone(this.leases); }
  async create(lease) {
    if (this.leases.some(item => item.leaseId === lease.leaseId)) throw new Error('LEASE_ID_COLLISION');
    this.leases.push(structuredClone(lease));
    return structuredClone(lease);
  }
  async update(leaseId, update) {
    const index = this.leases.findIndex(item => item.leaseId === leaseId);
    if (index < 0) return null;
    this.leases[index] = { ...this.leases[index], ...structuredClone(update) };
    return structuredClone(this.leases[index]);
  }
}

export class JsonLeaseStore {
  constructor(file) {
    this.file = resolve(file);
    this.lockFile = `${this.file}.lock`;
  }

  async #read() {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed?.schemaVersion !== EMPTY.schemaVersion || !Array.isArray(parsed.leases)) throw new Error('LEASE_STORE_INVALID');
      return parsed;
    } catch (error) {
      if (error?.code === 'ENOENT') return structuredClone(EMPTY);
      throw error;
    }
  }

  async #withLock(callback) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    let lock;
    try {
      lock = await open(this.lockFile, 'wx', 0o600);
    } catch (error) {
      if (error?.code === 'EEXIST') throw new Error('LEASE_STORE_BUSY');
      throw error;
    }
    try { return await callback(); }
    finally {
      await lock.close();
      await unlink(this.lockFile).catch(error => { if (error?.code !== 'ENOENT') throw error; });
    }
  }

  async #write(value) {
    const temporary = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(value)}\n`);
      await handle.sync();
    } finally { await handle.close(); }
    await rename(temporary, this.file);
    const directory = await open(dirname(this.file), 'r');
    try { await directory.sync(); }
    finally { await directory.close(); }
  }

  async list() { return structuredClone((await this.#read()).leases); }

  async create(lease) {
    return this.#withLock(async () => {
      const ledger = await this.#read();
      if (ledger.leases.some(item => item.leaseId === lease.leaseId)) throw new Error('LEASE_ID_COLLISION');
      ledger.leases.push(structuredClone(lease));
      await this.#write(ledger);
      return structuredClone(lease);
    });
  }

  async update(leaseId, update) {
    return this.#withLock(async () => {
      const ledger = await this.#read();
      const index = ledger.leases.findIndex(item => item.leaseId === leaseId);
      if (index < 0) return null;
      ledger.leases[index] = { ...ledger.leases[index], ...structuredClone(update) };
      await this.#write(ledger);
      return structuredClone(ledger.leases[index]);
    });
  }
}
