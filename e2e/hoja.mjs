// Fotogramas del ajolote bebé en reposo, jugar, comer y dormir, para revisar que cada cuadro salga limpio.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e', 'out', 'hoja'); mkdirSync(OUT, { recursive: true });
const server = spawn('node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5185 --strictPort', { cwd: ROOT, shell: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Vite')), 60000); server.stdout.on('data', (d) => { if (/ready in/.test(d.toString())) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const state of ['reposo', 'dormir', 'comer', 'jugar']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
  const now = Date.now();
  const pet = { version: 2, petId: 0, name: 'M', bornAt: now - 60000, updatedAt: now, needs: { hunger: 90, thirst: 90, energy: 90, happiness: 90, cleanliness: 90 }, sleeping: state === 'dormir', diedAt: null, lifeHours: 7, peaceful: true, variant: null };
  await page.addInitScript((p) => localStorage.setItem('tamagotchi-polkadot-pet-v2', p), JSON.stringify(pet));
  await page.goto('http://127.0.0.1:5185');
  await page.waitForSelector('.game-screen:not([hidden])');
  await page.waitForTimeout(2500);
  if (state === 'comer') { await page.getByRole('button', { name: 'Alimentar' }).click(); await page.getByText('Manzana').first().click(); await page.getByRole('button', { name: 'Dar' }).click(); await page.waitForTimeout(250); }
  if (state === 'jugar') { await page.getByRole('button', { name: 'Jugar', exact: true }).click(); await page.waitForTimeout(500); }
  for (let i = 0; i < 6; i++) {
    await page.locator('canvas').first().screenshot({ path: join(OUT, `${state}-${i}.png`), clip: undefined });
    await page.waitForTimeout(170);
  }
  await page.close();
}
await browser.close(); spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
process.exit(0);
