import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const gitHash = (type, bytes) => createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest();

function treeHash(entries) {
  const root = { children: new Map() };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map() });
      node = node.children.get(part);
    }
    node.children.set(parts.at(-1), { mode: entry.mode, hash: Buffer.from(entry.blob, 'hex') });
  }
  const calculate = node => {
    const values = [];
    for (const [name, child] of node.children) {
      const directory = child.children instanceof Map;
      const hash = directory ? calculate(child) : child.hash;
      values.push({ name, sortName: `${name}${directory ? '/' : ''}`, mode: directory ? '40000' : child.mode, hash });
    }
    values.sort((a, b) => Buffer.from(a.sortName).compare(Buffer.from(b.sortName)));
    return gitHash('tree', Buffer.concat(values.map(value => Buffer.concat([Buffer.from(`${value.mode} ${value.name}\0`), value.hash]))));
  };
  return calculate(root).toString('hex');
}

export async function verifyGitIdentity(root, index, commitObject) {
  for (const entry of index.entries) {
    const bytes = await readFile(resolve(root, entry.path));
    if (gitHash('blob', bytes).toString('hex') !== entry.blob) throw new Error(`GIT_BLOB_MISMATCH:${entry.path}`);
  }
  const tree = treeHash(index.entries);
  if (tree !== index.tree) throw new Error('GIT_TREE_MISMATCH');
  const commitBytes = Buffer.from(commitObject, 'utf8');
  const commit = gitHash('commit', commitBytes).toString('hex');
  if (commit !== index.commit) throw new Error('GIT_COMMIT_MISMATCH');
  const declaredTree = /^tree ([0-9a-f]{40})$/m.exec(commitObject)?.[1];
  if (declaredTree !== tree) throw new Error('GIT_COMMIT_TREE_BINDING_MISMATCH');
  return { result: 'PASS', commit, tree, files: index.entries.length };
}
