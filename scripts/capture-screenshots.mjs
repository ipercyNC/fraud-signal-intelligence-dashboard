import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:4173';
const SCREENSHOT_DIR = 'docs/screenshots';
const LOGIN_EMAIL = process.env.DEMO_USER_EMAIL ?? 'investigator@local.test';
const LOGIN_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'change-me-demo-password';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnWithEnv(cmd, args) {
  return spawn(cmd, args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      DEMO_MODE: process.env.DEMO_MODE ?? 'true',
      JWT_SECRET: process.env.JWT_SECRET ?? 'demo-jwt-secret-change-me',
      DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL ?? 'investigator@local.test',
      DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD ?? 'change-me-demo-password',
      DEMO_USER_NAME: process.env.DEMO_USER_NAME ?? 'Demo Investigator',
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? '/api',
      AI_MODE: process.env.AI_MODE ?? 'demo',
    },
  });
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const api = spawnWithEnv('npm', ['run', 'api:dev']);
  const web = spawnWithEnv('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173']);

  try {
    await waitForServer(`${BASE_URL}/`);
    await waitForServer('http://127.0.0.1:8000/health');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(LOGIN_EMAIL);
    await page.getByLabel('Password').fill(LOGIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForSelector('text=Live Queue');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/live-queue.png`, fullPage: true });

    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: 'Generate AI Brief' }).click();
    await page.waitForSelector('text=Recommended Action', { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/case-detail-ai-brief.png`, fullPage: true });

    await page.getByRole('button', { name: 'Analytics' }).click();
    await page.waitForSelector('text=Fraud Rate Trend');
    await page.waitForSelector('text=Geography (Flagged by State)');
    await sleep(3500);
    const geographyRows = await page.locator('div.flex.justify-between.border-b.border-slate-100.py-1').count();
    console.log(`Geography rows rendered: ${geographyRows}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/analytics.png`, fullPage: true });

    await context.close();
    await browser.close();
    console.log('Captured screenshots in docs/screenshots');
  } finally {
    api.kill('SIGTERM');
    web.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
