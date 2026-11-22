// ¿Se mueve una mascota muerta? Toma dos capturas separadas y compara los píxeles.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn('node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5182 --strictPort', { cwd: ROOT, shell: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Vite')), 60000); server.stdout.on('data', (d) => { if (/ready in/.test(d.toString())) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// Compara dos capturas PNG (base64) en una página en blanco, sin librerías de imagen.
const util = await browser.newPage();
await util.goto('about:blank');
const compare = (a, b) => util.evaluate(async ([x, y]) => {
  const load = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
  const [ia, ib] = await Promise.all([load(x), load(y)]);
  const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const A = px(ia), B = px(ib); let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let p = 0; p < A.length; p += 4) if (Math.abs(A[p] - B[p]) + Math.abs(A[p + 1] - B[p + 1]) + Math.abs(A[p + 2] - B[p + 2]) > 30) {
    const q = p / 4, x = q % ia.width, y = Math.floor(q / ia.width); if (x > 330) continue; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { n, box: [x0, y0, x1, y1], size: [ia.width, ia.height] };
}, [a, b]);
const AGES = { bebe: 60_000, adolescente: 90 * 60_000, adulto: 30 * 24 * 3_600_000 };
let moving = 0;
for (let petId = 0; petId < 5; petId++) for (const [stage, age] of Object.entries(AGES)) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const now = Date.now();
  const pet = { version: 2, petId, name: 'M', bornAt: now - age, updatedAt: now, needs: { hunger: 90, thirst: 90, energy: 90, happiness: 90, cleanliness: 90 }, sleeping: false, diedAt: now - 1000, lifeHours: 7, peaceful: false, variant: null };
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ['tamagotchi-polkadot-pet-v2', JSON.stringify(pet)]);
  await page.goto('http://127.0.0.1:5182');
  await page.waitForSelector('.game-screen:not([hidden])');
  await page.waitForTimeout(3500);
  const frame = async () => (await page.locator('canvas').first().screenshot()).toString('base64');
  const shots = [];
  for (let i = 0; i < 4; i++) { shots.push(await frame()); await page.waitForTimeout(430); }
  let max = 0, box = null, size = null;
  for (let i = 1; i < shots.length; i++) { const r = await compare(shots[0], shots[i]); if (r.n > max) { max = r.n; box = r.box; size = r.size; } }
  if (max > 40) moving++;
  console.log(`${petId} ${stage}: ${max} píxeles cambian en ${JSON.stringify(box)} de ${JSON.stringify(size)} ${max > 40 ? '← SE MUEVE' : 'quieta'}`);
  await page.close();
}
await browser.close(); spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
console.log(moving ? `${moving} combinaciones se mueven muertas` : 'Todas quedan quietas');
process.exit(0);
