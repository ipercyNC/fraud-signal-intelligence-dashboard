import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  resolve('backend/localdb/cases.json'),
  resolve('backend/localdb/ai_cache.json'),
  resolve('backend/localdb/ai_usage.json'),
  resolve('backend/localdb/users.json'),
];

let removed = 0;
for (const target of targets) {
  if (!existsSync(target)) continue;
  rmSync(target, { force: true });
  removed += 1;
}

console.log(`Demo state reset complete. Removed ${removed} localdb file(s).`);
