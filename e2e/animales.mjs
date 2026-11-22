// Revisión visual de las animaciones: las 5 especies × 3 etapas × 7 estados (reposo, triste, dormir,
// muerta, comer, jugar y baño). Guarda una captura de cada combinación en e2e/out/animales/ y un
// resumen de errores de consola. Uso: node e2e/animales.mjs   (lo mira una persona: no hay "pasa/falla" de imagen)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e', 'out', 'animales');
const APP = 'http://127.0.0.1:5181';
const PET_KEY = 'tamagotchi-polkadot-pet-v2';
mkdirSync(OUT, { recursive: true });

const server = spawn('node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5181 --strictPort', { cwd: ROOT, shell: true });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Vite no arrancó')), 60_000);
  server.stdout.on('data', (d) => { if (/ready in/.test(d.toString())) { clearTimeout(t); resolve(); } });
});

const SPECIES = ['ajolote', 'lobo', 'oso', 'tlacuache', 'manati'];
const STAGES = { bebe: 60_000, adolescente: 90 * 60_000, adulto: 30 * 24 * 3_600_000 };
const STATES = ['reposo', 'triste', 'dormir', 'muerta', 'comer', 'jugar', 'bano'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
let shots = 0;

async function shot(species, stage, state, petId, age) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', (e) => errors.push(`${species}/${stage}/${state}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${species}/${stage}/${state}: ${m.text()}`); });
  const now = Date.now();
  const needs = { hunger: 90, thirst: 90, energy: 90, happiness: 90, cleanliness: 90 };
  if (state === 'triste') needs.hunger = 5;
  const pet = {
    version: 2, petId, name: 'Prueba', bornAt: now - age, updatedAt: now, needs,
    sleeping: state === 'dormir', diedAt: state === 'muerta' ? now - 1000 : null, lifeHours: 7, peaceful: state !== 'muerta', variant: null,
  };
  await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [PET_KEY, JSON.stringify(pet)]);
  await page.goto(APP);
  await page.waitForSelector('.game-screen:not([hidden])', { timeout: 20_000 });
  await page.waitForTimeout(2500);
  if (state === 'comer') {
    await page.getByRole('button', { name: 'Alimentar' }).click();
    await page.getByText('Manzana').first().click();
    await page.getByRole('button', { name: 'Dar' }).click();
    await page.waitForTimeout(650);
  } else if (state === 'jugar') {
    await page.getByRole('button', { name: 'Jugar', exact: true }).click();
    await page.waitForTimeout(900);
  } else if (state === 'bano') {
    await page.getByRole('button', { name: 'Bañar' }).click();
    await page.waitForTimeout(1200);
  } else {
    await page.waitForTimeout(500);
  }
  await page.locator('canvas').first().screenshot({ path: join(OUT, `${petId}-${species}-${stage}-${state}.png`) });
  shots++;
  await page.close();
}

for (const [petId, species] of SPECIES.entries()) {
  for (const [stage, age] of Object.entries(STAGES)) {
    for (const state of STATES) {
      try { await shot(species, stage, state, petId, age); } catch (e) { errors.push(`${species}/${stage}/${state}: ${e.message.split('\n')[0]}`); }
    }
  }
  console.log(`${species} listo`);
}
await browser.close();
server.kill();
console.log(`${shots} capturas en ${OUT}`);
console.log(errors.length ? `Errores (${errors.length}):\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'Sin errores de consola.');
process.exit(0);
