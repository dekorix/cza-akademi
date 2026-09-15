import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, readlink, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const digest = async path => createHash('sha256').update(await readFile(path)).digest('hex');

export async function inventoryDirectory(directory, { exclude = [] } = {}) {
  const base = await realpath(resolve(directory));
  const excluded = new Set(exclude);
  const pending = [{ absolute: base, prefix: '' }];
  const entries = [];
  while (pending.length) {
    const current = pending.pop();
    const children = await readdir(current.absolute, { withFileTypes: true });
    for (const child of children) {
      const path = current.prefix ? `${current.prefix}/${child.name}` : child.name;
      if (excluded.has(path)) continue;
      const absolute = resolve(current.absolute, child.name);
      if (child.isDirectory()) pending.push({ absolute, prefix: path });
      else if (child.isFile()) entries.push({ path, type: 'file', absolute });
      else if (child.isSymbolicLink()) {
        const target = await readlink(absolute);
        const resolvedTarget = resolve(dirname(absolute), target);
        if (target.startsWith('/') || (resolvedTarget !== base && !resolvedTarget.startsWith(`${base}${sep}`))) throw new Error(`TOOLCHAIN_SYMLINK_ESCAPE:${path}`);
        entries.push({ path, type: 'symlink', target });
      } else throw new Error(`TOOLCHAIN_FILE_TYPE_FORBIDDEN:${path}`);
    }
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  for (let offset = 0; offset < entries.length; offset += 64) {
    await Promise.all(entries.slice(offset, offset + 64).map(async entry => {
      if (entry.type !== 'file') return;
      const stat = await lstat(entry.absolute);
      entry.size = stat.size;
      entry.mode = stat.mode & 0o777;
      entry.sha256 = await digest(entry.absolute);
      delete entry.absolute;
    }));
  }
  return entries;
}

export async function createToolchainInventory(root) {
  const nodeModules = await inventoryDirectory(resolve(root, 'node_modules'), { exclude: ['.vite'] });
  const tools = await inventoryDirectory(resolve(root, 'delivery/toolchain'), { exclude: ['inventory.json'] });
  return { schemaVersion: 'CZA-OFFLINE-TOOLCHAIN-INVENTORY-V4', platform: { os: 'linux', arch: 'x64' }, node: { minimum: '22.13.0' }, nodeModules, tools };
}

export async function writeToolchainInventory(root, output) {
  const inventory = await createToolchainInventory(root);
  await writeFile(output, `${JSON.stringify(inventory)}\n`, { mode: 0o644 });
  return inventory;
}

export async function verifyToolchainInventory(root, expected) {
  assert.equal(expected.schemaVersion, 'CZA-OFFLINE-TOOLCHAIN-INVENTORY-V4');
  assert.deepEqual(expected.platform, { os: process.platform, arch: process.arch });
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || (major === 22 && minor >= 13), 'NODE_VERSION_TOO_OLD');
  const actual = await createToolchainInventory(root);
  assert.deepEqual(actual, expected, 'VENDORED_TOOLCHAIN_INVENTORY_MISMATCH');
  return { result: 'PASS', nodeModules: actual.nodeModules.length, tools: actual.tools.length };
}
