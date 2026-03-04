import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const outDir = '.tmp-frontend-tests';

rmSync(outDir, { recursive: true, force: true });

await build({
  entryPoints: [
    'src/domain/cases/workflow.ts',
    'src/domain/scoring/scoreApplication.ts',
  ],
  outdir: outDir,
  outbase: 'src/domain',
  entryNames: '[name]',
  platform: 'node',
  format: 'esm',
  bundle: true,
  target: 'node20',
});

const tests = spawnSync('node', ['--test', 'tests/frontend/*.test.mjs'], {
  stdio: 'inherit',
  shell: true,
});

rmSync(outDir, { recursive: true, force: true });

if (tests.status !== 0) {
  process.exit(tests.status ?? 1);
}
