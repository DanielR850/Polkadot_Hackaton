// Captura de la habitación con muebles y adornos puestos (revisión visual del tamaño).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e', 'out'); mkdirSync(OUT, { recursive: true });
const server = spawn('node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5183 --strictPort', { cwd: ROOT, shell: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Vite')), 60000); server.stdout.on('data', (d) => { if (/ready in/.test(d.toString())) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const now = Date.now();
const pet = { version: 2, petId: 1, name: 'M', bornAt: now - 90 * 60000, updatedAt: now, needs: { hunger: 90, thirst: 90, energy: 90, happiness: 90, cleanliness: 90 }, sleeping: false, diedAt: null, lifeHours: 7, peaceful: true, variant: null };
const furniture = ['shop:puff', 'shop:librero', 'shop:tele', 'shop:girasol'];
const decor = ['shop:poster', 'shop:espejo', 'shop:florero', 'shop:foquitos'];
await page.addInitScript(([p, f, d]) => {
  localStorage.setItem('tamagotchi-polkadot-pet-v2', p);
  localStorage.setItem('tamagotchi-polkadot-equipped-v1', JSON.stringify({ accessory: null, outfit: null, wall: null, floor: null, furniture: f, decor: d }));
  localStorage.setItem('tamagotchi-polkadot-purchases-v1', JSON.stringify([...f, ...d]));
}, [JSON.stringify(pet), furniture, decor]);
await page.goto('http://127.0.0.1:5183');
await page.waitForSelector('.game-screen:not([hidden])');
await page.waitForTimeout(3500);
await page.locator('canvas').first().screenshot({ path: join(OUT, 'muebles.png') });
await browser.close(); spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
console.log('listo');
process.exit(0);
