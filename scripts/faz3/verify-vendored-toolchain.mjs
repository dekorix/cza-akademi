#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToolchainInventory } from './toolchain-inventory.mjs';

const inventoryPath = resolve(process.argv[2] || 'delivery/toolchain/inventory.json');
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const expected = JSON.parse(await readFile(inventoryPath, 'utf8'));
process.stdout.write(`${JSON.stringify(await verifyToolchainInventory(root, expected))}\n`);
