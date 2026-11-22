// Captura de un minijuego en curso (revisión visual del texto y la nitidez).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e', 'out'); mkdirSync(OUT, { recursive: true });
const server = spawn('node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort', { cwd: ROOT, shell: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Vite')), 60000); server.stdout.on('data', (d) => { if (/ready in/.test(d.toString())) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const now = Date.now();
const pet = { version: 2, petId: 2, name: 'M', bornAt: now - 90 * 60000, updatedAt: now, needs: { hunger: 90, thirst: 90, energy: 90, happiness: 90, cleanliness: 90 }, sleeping: false, diedAt: null, lifeHours: 7, peaceful: true, variant: null };
await page.addInitScript((p) => localStorage.setItem('tamagotchi-polkadot-pet-v2', p), JSON.stringify(pet));
await page.goto('http://127.0.0.1:5184');
await page.waitForSelector('.game-screen:not([hidden])');
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /Menú/ }).click();
await page.getByRole('button', { name: /Más minijuegos/ }).click();
const names = await page.locator('.minigame-options button').allInnerTexts();
console.log('juegos:', names.map((n) => n.split('\n')[0]).join(' | '));
for (let i = 0; i < names.length; i++) {
  if (i > 0) { await page.getByRole('button', { name: /Menú/ }).click().catch(() => {}); await page.getByRole('button', { name: /Más minijuegos/ }).click().catch(() => {}); }
  await page.locator('.minigame-options button').nth(i).click();
  await page.waitForSelector('.minigame-stage canvas', { timeout: 10000 });
  await page.waitForTimeout(5200);
  await page.locator('.minigame-stage').screenshot({ path: join(OUT, `minijuego-${i}.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForSelector('.game-screen:not([hidden])'); await page.waitForTimeout(1500);
}
console.log(errors.length ? 'errores: ' + errors.join(' | ') : 'sin errores');
await browser.close(); spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
process.exit(0);
