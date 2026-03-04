import { spawnSync } from 'node:child_process';

const MINOR_REQUIRED = 11;
const candidates = ['python3.11', 'python3', 'python'];

function pickPython() {
  for (const cmd of candidates) {
    const probe = spawnSync(
      cmd,
      [
        '-c',
        [
          'import sys',
          'major,minor=sys.version_info[:2]',
          `print(f"{major}.{minor}")`,
          `raise SystemExit(0 if (major > 3 or (major == 3 and minor >= ${MINOR_REQUIRED})) else 1)`,
        ].join(';'),
      ],
      { encoding: 'utf-8' },
    );
    if (probe.status === 0) return cmd;
  }
  return null;
}

const python = pickPython();
if (!python) {
  console.error('Python 3.11+ is required. Install Python 3.11 and retry.');
  console.error('Checked commands: python3.11, python3, python');
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
