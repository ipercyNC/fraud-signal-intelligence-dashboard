import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium, devices } from 'playwright';

const BASE_URL = 'http://127.0.0.1:4173';
const API_HEALTH_URL = 'http://127.0.0.1:8000/health';
const LOGIN_EMAIL = process.env.DEMO_USER_EMAIL ?? 'investigator@local.test';
const LOGIN_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'change-me-demo-password';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function spawnWithEnv(cmd, args, stdio = 'ignore') {
  return spawn(cmd, args, {
    stdio,
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

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(LOGIN_EMAIL);
  await page.getByLabel('Password').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForSelector('text=Live Queue');
}

async function runDesktopChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await login(page);

  // Navigation and main view checks
  await page.getByRole('button', { name: 'Signal Library' }).click();
  await page.waitForSelector('text=Rule Editor');
  await page.getByRole('button', { name: 'Run Test' }).click();
  const testHarnessOutput = await page.locator('p', { hasText: /FIRED|NOT FIRED|Invalid JSON|not found/ }).first().textContent();
  assert(Boolean(testHarnessOutput), 'Signal test harness did not render result');

  await page.getByRole('button', { name: 'Live Queue' }).click();
  await page.waitForSelector('text=Live Queue');
  await page.selectOption('select:has(option:text("Risk: All"))', 'High');

  const firstQueueRow = page.locator('tbody tr').first();
  await firstQueueRow.click();

  const noteText = `QA note ${Date.now()}`;
  await page.getByPlaceholder('Add investigation note').fill(noteText);
  await page.getByRole('button', { name: 'Add Note' }).click();
  await page.waitForSelector(`text=${noteText}`);

  const escalateButton = page.getByRole('button', { name: 'Escalate to SIU' }).first();
  if (await escalateButton.isEnabled()) {
    await escalateButton.click();
  }

  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.waitForSelector('text=Fraud Rate Trend');

  const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const downloadName = download.suggestedFilename();
  assert(downloadName.endsWith('.csv'), 'CSV export did not produce a CSV file');

  await page.getByRole('button', { name: 'Case History' }).click();
  await page.waitForSelector('text=Closed Cases');
  const historyRows = await page.locator('tbody tr').count();
  assert(historyRows > 0, 'Case history table has no rows');

  assert(pageErrors.length === 0, `Page errors encountered: ${pageErrors.join('; ')}`);

  await context.close();

  return {
    signalHarness: testHarnessOutput,
    historyRows,
    csvDownload: downloadName,
  };
}

async function runMobileChecks(browser) {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await login(page);

  // Ensure app shell renders and view switching still works on mobile viewport.
  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.waitForSelector('text=Analytics');
  await page.getByRole('button', { name: 'Case History' }).click();
  await page.waitForSelector('text=Case History');
  await page.getByRole('button', { name: 'Live Queue' }).click();
  await page.waitForSelector('text=Live Queue');

  const visibleNavButtons = await page.locator('aside button').count();
  assert(visibleNavButtons >= 4, 'Mobile layout did not render navigation controls');
  assert(pageErrors.length === 0, `Mobile page errors encountered: ${pageErrors.join('; ')}`);

  await context.close();

  return {
    visibleNavButtons,
  };
}

async function main() {
  const api = spawnWithEnv('npm', ['run', 'api:dev']);
  const vite = spawnWithEnv('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173']);

  try {
    await waitForServer(BASE_URL);
    await waitForServer(API_HEALTH_URL);

    const browser = await chromium.launch({ headless: true });
    try {
      const desktop = await runDesktopChecks(browser);
      const mobile = await runMobileChecks(browser);

      const report = {
        passed: true,
        timestamp: new Date().toISOString(),
        desktop,
        mobile,
      };

      console.log(JSON.stringify(report, null, 2));
    } finally {
      await browser.close();
    }
  } finally {
    api.kill('SIGTERM');
    vite.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
