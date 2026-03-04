import { spawn } from 'node:child_process';
import process from 'node:process';

const api = spawn('npm', ['run', 'api:dev'], {
  stdio: 'inherit',
  shell: false,
});

const web = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
  stdio: 'inherit',
  shell: false,
});

console.log('');
console.log('Demo stack starting...');
console.log('Frontend: http://127.0.0.1:5173');
console.log('Backend:  http://127.0.0.1:8000');
console.log('Demo creds are read from .env (DEMO_USER_EMAIL / DEMO_USER_PASSWORD).');
console.log('');

function shutdown(signal = 'SIGTERM') {
  api.kill(signal);
  web.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

api.on('exit', () => shutdown('SIGTERM'));
web.on('exit', () => shutdown('SIGTERM'));
