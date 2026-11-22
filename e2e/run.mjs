// Pruebas de punta a punta (E2E) de PolkaPets v2.
//
// Levanta un nodo Hardhat, despliega los contratos v2 con un calendario de temporadas controlado,
// arranca el juego en modo `hardhat` y recorre los flujos en Chrome sin ventana (playwright-core con
// el Chrome instalado: no descarga navegadores). Cada paso se comprueba en la interfaz y, cuando
// aplica, directamente en la cadena. La wallet es de prueba: se inyecta por EIP-6963 y firma con las
// cuentas públicas de desarrollo de Hardhat (nunca usar con fondos reales).
//
// Uso: pnpm e2e        (capturas en e2e/out/)
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createPublicClient, encodeFunctionData, http } from 'viem';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e', 'out');
const RPC = 'http://127.0.0.1:8545';
const APP = 'http://127.0.0.1:5175';
const DAY = 86_400;
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------ utilidades */

const procs = [];
function start(cmd, cwd, ready, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, ...env } });
    procs.push(child);
    let log = '';
    const timer = setTimeout(() => reject(new Error(`No arrancó: ${cmd}\n${log.slice(-800)}`)), 120_000);
    const onData = (d) => {
      log += d.toString();
      if (ready.test(log)) { clearTimeout(timer); resolve(child); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => { clearTimeout(timer); if (!ready.test(log)) reject(new Error(`Terminó (${code}): ${cmd}\n${log.slice(-800)}`)); });
  });
}
function stopAll() {
  for (const p of procs) {
    try { execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' }); } catch { try { p.kill(); } catch { /* ya terminó */ } }
  }
}
async function rpc(method, params = []) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const chainNow = async () => parseInt((await rpc('eth_getBlockByNumber', ['latest', false])).timestamp, 16);
async function travel(seconds) { await rpc('evm_increaseTime', [seconds]); await rpc('evm_mine', []); }
/** Cuenta 0 de Hardhat (pública, solo para pruebas). */
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ACCOUNTS = [ADMIN, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'];
/** Firma una transacción directa al contrato con una cuenta desbloqueada del nodo (para preparar o comprobar estados). */
async function chainSend(which, functionName, args, from = ADMIN) {
  const data = encodeFunctionData({ abi: C[which].abi, functionName, args });
  const hash = await rpc('eth_sendTransaction', [{ from, to: C[which].address, data }]);
  for (let i = 0; i < 50; i++) {
    const r = await rpc('eth_getTransactionReceipt', [hash]);
    if (r) { if (r.status !== '0x1') throw new Error(`La transacción ${functionName} revirtió`); return hash; }
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error(`Sin recibo de ${functionName}`);
}
async function until(fn, what, ms = 20_000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Tiempo agotado esperando: ${what} (último: ${last instanceof Error ? last.message : JSON.stringify(last)})`);
}

const results = [];
let current = '';
function check(cond, text) {
  results.push({ scenario: current, ok: !!cond, text });
  console.log(`${cond ? '  ✓' : '  ✗'} ${text}`);
  if (!cond) throw new Error(`Falló: ${text}`);
}

/* -------------------------------------------------- cadena: lectura viem */

const artifact = (name) => JSON.parse(readFileSync(join(ROOT, 'contrato', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`), 'utf8')).abi;
let C;
const chain = createPublicClient({ transport: http(RPC) });
const read = (which, functionName, args = []) => chain.readContract({ address: C[which].address, abi: C[which].abi, functionName, args });

/* ------------------------------------------------ navegador y wallet falsa */

const providerScript = (accountIndex) => `
(() => {
  const rpc = async (method, params = []) => {
    const r = await fetch('${RPC}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
    return j.result;
  };
  const provider = { request: async ({ method, params }) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') { const all = await rpc('eth_accounts'); return [all[${accountIndex}]]; }
    if (method === 'eth_sendTransaction') { const all = await rpc('eth_accounts'); params = [{ ...params[0], from: all[${accountIndex}] }]; }
    return rpc(method, params ?? []);
  }, on() {}, removeListener() {} };
  const info = { uuid: '00000000-0000-4000-8000-00000000000${accountIndex}', name: 'Wallet de prueba ${accountIndex}', icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E', rdns: 'test.hardhat' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
})();`;

let browser;
async function newPage(accountIndex = 0) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(providerScript(accountIndex));
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const text = (page, sel) => page.locator(sel).first().innerText();
async function clickText(page, sel, t, timeout = 15_000) {
  try {
    await page.locator(sel, { hasText: t }).first().click({ timeout });
  } catch (e) {
    const open = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => d.getAttribute('aria-label')).join(', ')).catch(() => '?');
    throw new Error(`No pude hacer clic en "${t}" (${sel}); ventanas abiertas: ${open || 'ninguna'}. ${String(e.message).split(String.fromCharCode(10))[0]}`);
  }
}
const storage = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const setStorage = (page, key, value) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
const PET = 'tamagotchi-polkadot-pet-v2';

/** Mueve la partida guardada `ms` hacia el pasado (como si hubiera pasado ese tiempo) y recarga. */
async function ageLocalPet(page, ms) {
  await page.evaluate(([k, d]) => { const p = JSON.parse(localStorage.getItem(k)); p.bornAt -= d; p.updatedAt -= d; localStorage.setItem(k, JSON.stringify(p)); }, [PET, ms]);
  await page.reload();
  await page.waitForSelector('.game-screen:not([hidden])');
}

async function createPet(page, { name, pet, color, hours }) {
  await page.goto(APP);
  await page.waitForSelector('.start-screen input');
  await page.fill('.start-screen input', name);
  await page.locator('.start-screen form').evaluate((f) => f.requestSubmit());
  await page.locator(`input[name="pet"][value="${pet}"]`).check({ force: true });
  if (color) await clickText(page, '.pet-options .choice', color);
  if (hours) await clickText(page, '.pet-options .choice', `${hours} h`);
  await page.click('.select-form button[type=submit]');
  await page.waitForSelector('.mint-screen:not([hidden])');
}

/* ------------------------------------------------------------- escenarios */

async function scenario(name, fn) {
  current = name;
  console.log(`\n▶ ${name}`);
  try { await fn(); } catch (e) { results.push({ scenario: name, ok: false, text: String(e.message ?? e).split('\n')[0] }); console.log(`  ✗ ${e.message}`); }
}

async function main() {
  console.log('Nodo Hardhat…');
  await start('npx hardhat node --port 8545', join(ROOT, 'contrato'), /Started HTTP and WebSocket JSON-RPC server/);
  // Semana 0 empezó hace 5 días y 1 hora: ahora es "sábado" (temporada cerrada), sin depender del día real.
  const inicio = (await chainNow()) - 5 * DAY - 3600;
  console.log('Despliegue v2…');
  execSync('npx hardhat run scripts/deployV2.ts --network localhost', { cwd: join(ROOT, 'contrato'), env: { ...process.env, INICIO_TEMPORADA: String(inicio) }, stdio: 'pipe' });
  const d = JSON.parse(readFileSync(join(ROOT, 'contrato', 'deployments', 'localhost-v2.json'), 'utf8'));
  C = {
    pets: { address: d.pets, abi: artifact('PolkaPets') },
    items: { address: d.items, abi: artifact('PolkaPetsItems') },
    seasons: { address: d.temporadas, abi: artifact('PolkaPetsTemporadas') },
    pagos: { address: d.pagos, abi: artifact('PolkaPetsPagos') },
  };
  console.log('Juego (vite --mode hardhat)…');
  await start(`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort --mode hardhat`, ROOT, /ready in/);
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  await scenario('Validaciones del inicio y de la selección', async () => {
    const page = await newPage();
    await page.goto(APP);
    await page.waitForSelector('.start-screen input');
    await page.fill('.start-screen input', '   ');
    await page.locator('.start-screen form').evaluate((f) => f.requestSubmit());
    check(await page.locator('.start-screen:not([hidden])').count() === 1, 'un nombre vacío no avanza');
    await page.fill('.start-screen input', 'ÑñÑñÑñÑñÑñÑñÑñ'); // 14 letras, 28 bytes
    await page.locator('.start-screen form').evaluate((f) => f.requestSubmit());
    check(await page.locator('.start-screen:not([hidden])').count() === 1, 'un nombre de más de 24 bytes no avanza');
    await page.fill('.start-screen input', 'Luna');
    await page.locator('.start-screen form').evaluate((f) => f.requestSubmit());
    await page.waitForSelector('.select-screen:not([hidden])');
    check(await page.locator('.select-form button[type=submit]').isDisabled(), 'sin mascota elegida no se puede confirmar');
    check(await page.locator('.select-form .pet-options').isHidden(), 'las opciones de color y dificultad aparecen solo al elegir mascota');
    await page.locator('input[name="pet"][value="1"]').check({ force: true });
    check(await page.locator('.pet-options .choice', { hasText: 'Ártico' }).count() === 1, 'el lobo ofrece sus variantes (Ártico)');
    check((await text(page, '.select-form .pet-options')).includes('Aguanta 7 horas'), 'la dificultad por defecto es Normal (7 h)');
    await page.locator('input[name="pet"][value="4"]').check({ force: true });
    check(await page.locator('.pet-options .choice', { hasText: 'Lavanda' }).count() === 1, 'al cambiar de especie cambian las variantes (manatí)');
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Pacífico sin cartera: color, dificultad y guardado', async () => {
    const page = await newPage();
    await createPet(page, { name: 'Luna', pet: 1, color: 'Ártico', hours: 12 });
    const portrait = await page.locator('.mint-frame img').getAttribute('src');
    check(portrait?.startsWith('data:image/png'), 'el retrato del paso 3 ya lleva el color elegido');
    await clickText(page, '.mint-screen button', 'Jugar sin cartera');
    await page.waitForSelector('.game-screen:not([hidden])');
    check((await text(page, '.mode-badge')) === 'Pacífico · 12 h · Ártico', 'insignia: Pacífico · 12 h · Ártico (sin emoji)');
    const saved = JSON.parse(await storage(page, PET));
    check(saved.lifeHours === 12 && saved.peaceful === true && saved.variant === 'artico', 'la partida guarda dificultad, modo y color');
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    check((await text(page, '.mode-badge')).includes('Ártico'), 'al recargar conserva el color');
    await page.waitForTimeout(1500);
    await shot(page, '01-pacifico-lobo-artico');
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Pacífico: no muere, regalos, comida, tienda y sombrero', async () => {
    const page = await newPage();
    await createPet(page, { name: 'Osa', pet: 2, color: 'Polar', hours: 1 });
    await clickText(page, '.mint-screen button', 'Jugar sin cartera');
    await page.waitForSelector('.game-screen:not([hidden])');
    await ageLocalPet(page, 60 * 3600_000);
    check(await page.locator('.death-panel').isHidden(), 'tras 60 veces su dificultad sigue viva (sin panel de muerte)');
    check((await text(page, '.meter-row.health')).includes('0%'), 'la vida llega a 0 %: está enferma');
    const gifts = await until(async () => { const t = await text(page, '.extras button:has-text("Despensa")'); return /\d/.test(t) && t; }, 'contador de regalos');
    check(/Despensa\s*120/.test(gifts), `120 regalos acumulados en 60 h (${gifts.replace(/\s+/g, ' ')})`);
    await clickText(page, '.extras button', 'Despensa');
    await clickText(page, 'dialog[open] button', 'Abrir regalo');
    await until(async () => JSON.parse(await storage(page, 'tamagotchi-polkadot-pantry-v1')).items.length === 1, 'regalo en la despensa');
    await page.locator('dialog[open] .inv-item').first().click();
    await until(async () => !(await text(page, '.meter-row.health')).startsWith('❤️ Vida\n0%') && !(await text(page, '.meter-row.health')).includes(' 0%'), 'la comida le sube la vida');
    await page.locator('dialog[open] .dialog-close').click().catch(() => {});
    // Tienda: comprar comida con pesitos.
    await setStorage(page, 'tamagotchi-polkadot-purse-v1', JSON.stringify({ coins: 100, lastPlayAt: 0, best: { catch: 0, pong: 0 } }));
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await clickText(page, '.extras button', 'Tienda');
    await clickText(page, 'dialog[open] [role=tab]', 'Comida');
    check(await page.locator('dialog[open] .shop-item').count() === 5, 'la tienda vende 5 comidas (las de drop no se venden)');
    check(await page.locator('dialog[open] .inv-icon img').count() >= 5, 'los íconos de la tienda son pixel art (imagen), no emoji');
    await clickText(page, 'dialog[open] .shop-item', 'Chocolate');
    await clickText(page, 'dialog[open] button', 'Comprar por');
    await until(async () => (await text(page, '.coin-pill')).includes('55'), 'cobra 45 pesitos');
    check(JSON.parse(await storage(page, 'tamagotchi-polkadot-pantry-v1')).items.some((i) => i.foodId === 'food:chocolate'), 'el chocolate queda en la despensa');
    await clickText(page, 'dialog[open] [role=tab]', 'Comida');
    await clickText(page, 'dialog[open] .shop-item', 'Chocolate');
    await clickText(page, 'dialog[open] button', 'Comprar por');
    await clickText(page, 'dialog[open] [role=tab]', 'Comida');
    await clickText(page, 'dialog[open] .shop-item', 'Chocolate');
    check(await page.locator('dialog[open] button:has-text("Comprar por")').isDisabled(), 'sin pesitos suficientes no deja comprar');
    await page.locator('dialog[open] .dialog-close').click();
    // Sombrero de pixel art con color.
    await setStorage(page, 'tamagotchi-polkadot-equipped-v1', JSON.stringify({ accessory: 'demo:sombrero', wall: null, floor: null, furniture: [], decor: [] }));
    await page.goto(`${APP}/?demo=1`);
    await page.waitForSelector('.game-screen:not([hidden])');
    await clickText(page, '.extras button', 'Accesorios');
    await clickText(page, 'dialog[open] .choice', 'Turquesa');
    check((await storage(page, 'tamagotchi-polkadot-hat-palette-v1')) === 'turquesa', 'guarda el color del sombrero');
    await page.locator('dialog[open] .dialog-close').click();
    await page.waitForTimeout(1500);
    await shot(page, '02-pacifico-oso-polar-sombrero');
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Robustez: datos corruptos y clics repetidos', async () => {
    const page = await newPage();
    await page.goto(APP);
    await setStorage(page, PET, '{"version":2,"petId":99');
    await page.reload();
    await page.waitForSelector('.start-screen', { state: 'attached' });
    check(await page.locator('.start-screen:not([hidden])').count() === 1, 'una partida corrupta vuelve al inicio sin romper');
    await setStorage(page, PET, JSON.stringify({ version: 2, petId: 0, name: 'Axo', bornAt: Date.now() - 600_000, updatedAt: Date.now() - 600_000, needs: { hunger: 60, thirst: 60, energy: 40, happiness: 60, cleanliness: 60 }, sleeping: false, diedAt: null, lifeHours: 99, variant: '<img onerror=alert(1)>' }));
    for (const [k, v] of [['tamagotchi-polkadot-pantry-v1', '{basura'], ['tamagotchi-polkadot-purse-v1', '{"coins":-50}'], ['tamagotchi-polkadot-equipped-v1', 'null'], ['tamagotchi-polkadot-hat-palette-v1', '<script>']]) await setStorage(page, k, v);
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    const coins = Number((await text(page, '.coin-pill')).replace(/[^0-9-]/g, ''));
    check(coins >= 0 && coins <= 10, `pesitos negativos se leen como 0 (más el trofeo de 10 min: ${coins})`);
    check(!(await text(page, '.mode-badge')).includes('99'), 'una dificultad inválida se ignora');
    for (let i = 0; i < 15; i++) await page.locator('.actions button').nth(2).click({ force: true }).catch(() => {});
    for (let i = 0; i < 6; i++) await page.locator('.actions button').first().click({ force: true }).catch(() => {});
    check(await page.locator('dialog[open]').count() <= 1, 'clics repetidos no abren ventanas duplicadas');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Mis animales, dibujo pixel real y sueño', async () => {
    const page = await newPage();
    await createPet(page, { name: 'Primero', pet: 3, color: 'Albino', hours: 7 });
    await clickText(page, '.mint-screen button', 'Jugar sin cartera');
    await page.waitForSelector('.game-screen:not([hidden])');
    check(!/\p{Extended_Pictographic}/u.test(await text(page, '.extras')), 'los botones extra no usan emoji');
    check((await page.locator('.actions .action-icon img').count()) >= 5, 'los botones de cuidado usan íconos de pixel art');
    await page.click('.menu-button');
    await clickText(page, '.game-menu button', 'Elegir otra mascota');
    await page.waitForSelector('.start-screen:not([hidden])');
    check(JSON.parse(await storage(page, 'tamagotchi-polkadot-history-v1')).length === 1, 'la mascota reemplazada queda en el historial');
    await createPet(page, { name: 'Segundo', pet: 4, color: 'Lavanda', hours: 1 });
    await clickText(page, '.mint-screen button', 'Jugar sin cartera');
    await page.waitForSelector('.game-screen:not([hidden])');
    await page.click('.menu-button');
    await clickText(page, '.game-menu button', 'Mis animales');
    await until(async () => (await page.locator('dialog[open] .pet-record').count()) === 2, 'Mis animales muestra la actual y la anterior');
    const txt = await text(page, 'dialog[open]');
    check(txt.includes('Segundo') && txt.includes('ahora') && txt.includes('Primero') && txt.includes('Albino'), 'cada registro muestra nombre, color y cuál es la actual');
    await shot(page, '06-mis-animales');
    await page.locator('dialog[open] .dialog-close').click();
    await page.click('.menu-button');
    await clickText(page, '.game-menu button', 'Dibujo');
    check((await storage(page, 'tamagotchi-polkadot-style-v1')) === 'pixel', 'el estilo pixel real se guarda');
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    check((await text(page, '.game-menu button:has-text("Dibujo")')) === 'Dibujo: Pixel real', 'al recargar sigue en pixel real');
    await clickText(page, '.actions button', 'Dormir');
    await until(async () => (await text(page, '.pet-caption')).includes('Zzz'), 'dormido dice Zzz');
    await page.waitForTimeout(1500);
    await shot(page, '07-pixel-real-dormido');
    check(!/\p{Extended_Pictographic}/u.test(await text(page, '.feedback')), 'la mascota habla sin emoji');
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Accesorios puestos y Atrapa la pelota', async () => {
    const page = await newPage();
    await page.goto(`${APP}/?demo=1`);
    const now = Date.now();
    await page.evaluate(([k, n]) => {
      localStorage.setItem(k, JSON.stringify({ version: 2, petId: 0, name: 'Bebe', bornAt: n - 600_000, updatedAt: n - 10_000, needs: { hunger: 90, thirst: 90, energy: 90, happiness: 90, cleanliness: 90 }, sleeping: false, diedAt: null, lifeHours: 7, peaceful: true }));
      localStorage.setItem('tamagotchi-polkadot-purchases-v1', JSON.stringify(['shop:lentes', 'shop:medalla', 'shop:corona', 'shop:mono']));
      localStorage.setItem('tamagotchi-polkadot-equipped-v1', JSON.stringify({ accessory: 'shop:lentes', wall: null, floor: null, furniture: [], decor: [] }));
    }, [PET, now]);
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await page.waitForTimeout(1500);
    await shot(page, '08-ajolote-lentes');
    for (const item of ['Corona', 'Medalla', 'Moño']) {
      await clickText(page, '.extras button', 'Accesorios');
      await clickText(page, 'dialog[open] .inv-item', item);
      await page.locator('dialog[open] .dialog-close').click();
      check(JSON.parse(await storage(page, 'tamagotchi-polkadot-equipped-v1')).accessory !== null, `se puede poner ${item}`);
    }
    await page.waitForTimeout(800);
    await shot(page, '09-ajolote-mono');
    // Ropa mexicana: sombrero charro en la cabeza y poncho en el cuerpo, al mismo tiempo.
    await page.evaluate(() => {
      localStorage.setItem('tamagotchi-polkadot-purchases-v1', JSON.stringify(['shop:charro', 'shop:poncho', 'shop:rebozo']));
      localStorage.setItem('tamagotchi-polkadot-equipped-v1', JSON.stringify({ accessory: null, outfit: null, wall: null, floor: null, furniture: [], decor: [] }));
    });
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await clickText(page, '.extras button', 'Accesorios');
    check((await text(page, 'dialog[open]')).includes('ROPA'), 'Accesorios muestra la sección Ropa');
    await clickText(page, 'dialog[open] .inv-item', 'Sombrero de charro');
    await clickText(page, 'dialog[open] .inv-item', 'Poncho');
    await page.locator('dialog[open] .dialog-close').click();
    const worn = JSON.parse(await storage(page, 'tamagotchi-polkadot-equipped-v1'));
    check(worn.accessory === 'shop:charro' && worn.outfit === 'shop:poncho', 'lleva sombrero charro y poncho a la vez');
    await page.waitForTimeout(800);
    await shot(page, '10-charro-y-poncho');
    // Jugar en la misma habitación, sin ventana.
    await clickText(page, '.actions button', 'Jugar');
    await page.waitForTimeout(500);
    check(await page.locator('dialog[open]').count() === 0, 'Jugar no abre ventana: se juega en la habitación');
    await shot(page, '11-jugar-en-la-habitacion');
    await until(async () => (JSON.parse((await storage(page, 'tamagotchi-polkadot-purse-v1')) ?? '{}').lastPlayAt ?? 0) > 0, 'la partida en la habitación termina y se cobra', 25_000);
    // Los demás minijuegos siguen en el Menú.
    await page.click('.menu-button');
    await clickText(page, '#game-menu button', 'Más minijuegos');
    check(await page.locator('dialog[open] button', { hasText: 'Atrapa la pelota' }).count() === 1, 'Más minijuegos ofrece los tres juegos');
    await page.locator('dialog[open] .dialog-close').click();
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Competencia en cadena: temporada, NFT, comida, regalos, muerte y registro', async () => {
    const page = await newPage(0);
    await createPet(page, { name: 'Campeona', pet: 0, color: 'Dorado', hours: 1 });
    await clickText(page, '.chain-wallet', 'Wallet de prueba 0');
    await page.waitForSelector('.mode-option');
    check(await page.locator('.mode-option', { hasText: 'competencia' }).isDisabled(), 'en "sábado" la Competencia está cerrada');
    check((await text(page, '.mode-option:has-text("competencia")')).includes('cerrada'), 'explica que la temporada está cerrada');
    await travel(2 * DAY); // lunes de la semana 1
    await clickText(page, '.mint-screen button', 'Cambiar mascota');
    await page.click('.select-form button[type=submit]');
    await clickText(page, '.chain-wallet', 'Wallet de prueba 0');
    await until(async () => !(await page.locator('.mode-option', { hasText: 'competencia' }).isDisabled()), 'Competencia abierta el lunes');
    await clickText(page, '.mode-option', 'competencia');
    await clickText(page, '.mint-screen .primary', 'ADOPTAR');
    await page.waitForSelector('.mint-screen[data-step="done"]', { timeout: 30_000 });
    check((await text(page, '.mint-screen')).includes('Hardhat local'), 'muestra la red real (Hardhat local)');
    const m1 = await read('pets', 'verMascota', [1n]);
    check(m1.horas === 1 && m1.modo === 1 && m1.nombre === 'Campeona', 'el NFT guarda 1 h y modo Competencia en la cadena');
    await clickText(page, '.mint-screen .primary', 'ENTRAR');
    await page.waitForSelector('.game-screen:not([hidden])');
    check((await text(page, '.mode-badge')) === 'Competencia · 1 h · Dorado', 'insignia: Competencia · 1 h · Dorado');
    // Cuidado firmado.
    await page.locator('.actions button').first().click();
    await page.locator('dialog[open] input[value=apple]').check({ force: true });
    await page.locator('dialog[open] form').evaluate((f) => f.requestSubmit());
    await until(async () => (await read('pets', 'verMascota', [1n])).xp === 10, 'el cuidado se firma (xp 10 en la cadena)');
    // Comida NFT.
    // Los pesitos viven en el contrato: editar el navegador no da dinero.
    await setStorage(page, 'tamagotchi-polkadot-purse-v1', JSON.stringify({ coins: 9999, lastPlayAt: 0, best: { catch: 0, pong: 0 } }));
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await until(async () => (await text(page, '.coin-pill')).replace(/[^0-9]/g, '') === '0', 'los 9999 pesitos inventados en el navegador no cuentan: la cadena dice 0');
    check(Number(await read('items', 'pesitos', [1n])) === 0, 'la mascota tiene 0 pesitos en el contrato');
    await clickText(page, '.extras button', 'Tienda');
    await clickText(page, 'dialog[open] [role=tab]', 'Comida');
    await clickText(page, 'dialog[open] .shop-item', 'Tamal');
    check(await page.locator('dialog[open] button', { hasText: 'Comprar por' }).first().isDisabled(), 'sin pesitos en la cadena el botón de comprar está desactivado');
    check(/Te faltan/.test(await text(page, 'dialog[open]')), 'la tienda dice cuántos pesitos faltan');
    await page.locator('dialog[open] .dialog-close').click().catch(() => {});
    // Gana pesitos de verdad: el contrato los acredita (con su cupo) y la tienda ya puede cobrarlos.
    await chainSend('items', 'cobrarPesitos', [1n, 60]);
    check(Number(await read('items', 'pesitos', [1n])) === 60, 'cobrar suma 60 pesitos en el contrato');
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await until(async () => (await text(page, '.coin-pill')).replace(/[^0-9]/g, '') === '60', 'el juego muestra los pesitos de la cadena (60)');
    await clickText(page, '.extras button', 'Tienda');
    await clickText(page, 'dialog[open] [role=tab]', 'Comida');
    await clickText(page, 'dialog[open] .shop-item', 'Tamal');
    await clickText(page, 'dialog[open] button', 'Comprar por');
    await clickText(page, 'dialog[open] button', 'Wallet de prueba 0');
    await until(async () => (await read('items', 'despensaDe', [1n]))[0].length === 1, 'el Tamal es un NFT en la despensa de la cadena');
    check(Number(await read('items', 'pesitos', [1n])) === 30, 'la compra cobra el precio (30) en el contrato');
    await until(async () => JSON.parse(await storage(page, 'tamagotchi-polkadot-pantry-v1')).items.filter((i) => i.foodId === 'food:tamal').length === 1, 'sin duplicados en la despensa local');
    await page.locator('dialog[open] .dialog-close').click().catch(() => {});
    // Regalo NFT: con la cadena 31 min adelante.
    await travel(31 * 60);
    await clickText(page, '.extras button', 'Despensa');
    await until(async () => (await text(page, 'dialog[open]')).includes('1 regalo'), 'la despensa lee 1 regalo del contrato');
    await clickText(page, 'dialog[open] button', 'Abrir regalo');
    await until(async () => (await read('items', 'despensaDe', [1n]))[0].length === 2, 'el regalo es una comida NFT nueva');
    check(Number(await read('items', 'dropsTomados', [1n])) === 1, 'el contrato cuenta el regalo reclamado');
    // Usar el Tamal NFT: se quema y cura en la cadena.
    await clickText(page, '.extras button', 'Despensa');
    await until(async () => (await page.locator('dialog[open] .inv-item', { hasText: 'Tamal' }).count()) >= 1, 'el Tamal aparece en la despensa');
    const tamales = async () => (await read('items', 'despensaDe', [1n]))[1].filter((a) => Number(a) === 53).length;
    const tamalesAntes = await tamales(); // el regalo pudo ser otro Tamal
    const vidaAntes = (await read('pets', 'verMascota', [1n])).vida;
    await clickText(page, 'dialog[open] .inv-item', 'Tamal');
    await until(async () => (await tamales()) === tamalesAntes - 1, 'el NFT del Tamal se quemó');
    check((await read('items', 'despensaDe', [1n]))[0].length === 1, 'en la despensa de la cadena queda solo el regalo');
    const vidaDespues = (await read('pets', 'verMascota', [1n])).vida;
    check(vidaDespues >= vidaAntes, `la vida en la cadena no baja al usarlo (${vidaAntes} → ${vidaDespues})`);
    // Muerte en la cadena y en el juego, y registro.
    await travel(2 * 3600);
    check((await read('pets', 'verMascota', [1n])).viva === false, 'sin cuidados muere en la cadena');
    await ageLocalPet(page, 3 * 3600_000);
    await until(async () => page.locator('.death-panel:not([hidden])').count(), 'panel de muerte');
    // Al morir el juego abre solo el aviso de registro; si no aparece, se usa el botón del panel.
    const auto = await until(async () => (await page.locator('dialog[open] button:has-text("REGISTRA")').count()) > 0, 'aviso de registro', 4000).catch(() => false);
    if (!auto) await clickText(page, '.death-panel button', 'Registrar');
    await clickText(page, 'dialog[open] button', 'REGISTRA');
    await clickText(page, 'dialog[open] button', 'Wallet de prueba 0').catch(() => {});
    await until(async () => (await text(page, 'dialog[open]')).includes('registrada'), 'partida registrada');
    const semana = (await read('seasons', 'semanaActual'))[0];
    const filas = await read('seasons', 'registros', [semana, 0n, 10n]);
    check(filas.length === 1 && filas[0].horas === 1 && filas[0].duracion === (await read('pets', 'verMascota', [1n])).duracion, 'la temporada guarda la duración exacta de la cadena');
    await clickText(page, 'dialog[open] button', 'LEADERBOARD');
    await until(async () => (await text(page, 'dialog[open]')).includes('(tú)'), 'el ranking semanal muestra la partida propia');
    check((await text(page, 'dialog[open]')).includes('Abierta'), 'la temporada aparece abierta');
    await shot(page, '03-competencia-ranking');
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Pesitos, sueño, vida y billetera en la cadena (Pacífico)', async () => {
    const page = await newPage(2);
    await createPet(page, { name: 'Dormilona', pet: 1, hours: 12 });
    await clickText(page, '.chain-wallet', 'Wallet de prueba 2');
    await page.waitForSelector('.mode-option');
    await clickText(page, '.mode-option', 'pacífico');
    await clickText(page, '.mint-screen .primary', 'ADOPTAR');
    await page.waitForSelector('.mint-screen[data-step="done"]', { timeout: 30_000 });
    await clickText(page, '.mint-screen .primary', 'ENTRAR');
    await page.waitForSelector('.game-screen:not([hidden])');
    const id = (await read('pets', 'mascotasDe', [ACCOUNTS[2]])).at(-1);
    const nftKey = 'tamagotchi-polkadot-nft-v1';

    // La vida y las necesidades las manda la cadena: inventarse datos en el navegador no sirve.
    await travel(3 * 3600);
    await page.evaluate(([k]) => { const p = JSON.parse(localStorage.getItem(k)); p.needs = { hunger: 100, thirst: 100, energy: 100, happiness: 100, cleanliness: 100 }; p.bornAt -= 999 * 3600_000; p.updatedAt = Date.now(); localStorage.setItem(k, JSON.stringify(p)); }, [PET]);
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    const onChain = await read('pets', 'verMascota', [id]);
    await until(async () => {
      const saved = JSON.parse(await storage(page, PET));
      return Math.abs(saved.needs.hunger - Number(onChain.hambre)) < 3 && saved.bornAt === Number(onChain.nacimiento) * 1000;
    }, 'el juego vuelve a los datos de la cadena (hambre y edad) aunque se editó el navegador');

    // Sueño: la cadena guarda cuándo se durmió y cuándo despertó.
    await clickText(page, '.actions button', 'Dormir');
    await clickText(page, 'dialog[open] button', 'Wallet de prueba 2').catch(() => {});
    await until(async () => Number(await read('pets', 'durmiendoDesde', [id])) > 0, 'dormir guarda desde cuándo duerme en el contrato');
    const desde = Number(await read('pets', 'durmiendoDesde', [id]));
    await travel(120);
    check(Number((await read('pets', 'verMascota', [id])).energia) > 0, 'la lectura ya cuenta la energía de lo dormido');
    await clickText(page, '.actions button', 'Despertar').catch(async () => { await clickText(page, '.actions button', 'Dormir'); });
    await clickText(page, 'dialog[open] button', 'Wallet de prueba 2').catch(() => {});
    await until(async () => Number(await read('pets', 'durmiendoDesde', [id])) === 0, 'despertar queda registrado en la cadena');
    check(desde > 0, 'la cadena guardó la hora en que se durmió');

    // Pesitos: no hay forma de ponérselos; el cupo limita lo que se cobra.
    check(Number(await read('items', 'pesitos', [id])) === 0, 'empieza con 0 pesitos en el contrato');
    await chainSend('items', 'cobrarPesitos', [id, 60000], ACCOUNTS[2]);
    check(Number(await read('items', 'pesitos', [id])) === 60, 'pedir 60000 solo da lo que permite el cupo (60)');
    let rechazado = false;
    try { await chainSend('items', 'cobrarPesitos', [id, 1], ACCOUNTS[2]); } catch { rechazado = true; }
    check(rechazado, 'sin cupo el contrato rechaza cobrar más');
    let ajeno = false;
    try { await chainSend('items', 'cobrarPesitos', [id, 1], ACCOUNTS[1]); } catch { ajeno = true; }
    check(ajeno, 'otra cuenta no puede cobrar pesitos de esta mascota');

    // Billetera de cobro y pagos trackeables.
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await clickText(page, '.extras button', 'Billetera');
    await until(async () => (await text(page, 'dialog[open]')).includes('Todavía no guardas una wallet'), 'avisa que falta la wallet de cobro');
    await page.fill('dialog[open] input[placeholder^="0x"]', ACCOUNTS[1]);
    await clickText(page, 'dialog[open] button', 'Guardar en la cadena');
    await clickText(page, 'dialog[open] button', 'Wallet de prueba 2');
    await until(async () => (await read('pagos', 'billeteraDe', [ACCOUNTS[2]])).toLowerCase() === ACCOUNTS[1].toLowerCase(), 'la wallet de cobro queda guardada en el contrato');
    let sinWallet = false;
    try { await chainSend('pagos', 'registrarPago', [0, 1, ACCOUNTS[0], 20n, '0x' + '11'.repeat(32)]); } catch { sinWallet = true; }
    check(sinWallet, 'no se anota un pago a quien no registró su wallet');
    const hash = '0x' + 'ab'.repeat(32);
    await chainSend('pagos', 'registrarPago', [0, 1, ACCOUNTS[2], 20n, hash]);
    check((await read('pagos', 'pagoDe', [0, 1])).txHash === hash, 'el pago queda en el contrato con su hash');
    await page.locator('dialog[open] .dialog-close').click().catch(() => {});
    await clickText(page, '.extras button', 'Billetera');
    await until(async () => (await text(page, 'dialog[open]')).includes('$20'), 'Mi billetera muestra el premio pagado');
    check(await page.locator('dialog[open] a[href*="' + hash + '"]').count() >= 1, 'el pago enlaza a su transacción en el explorador');
    await shot(page, '12-billetera-y-pagos');
    check(page.errors.length === 0, `sin errores en la consola (${page.errors.join(' | ')})`);
  });

  await scenario('Admin: permisos, drops, pausa y cierre con podio', async () => {
    const intruso = await newPage(1);
    await intruso.goto(`${APP}/?admin=1`);
    await intruso.waitForSelector('.admin-screen');
    await until(async () => (await text(intruso, '.admin-screen')).includes('Temporada'), 'el admin carga los datos');
    await clickText(intruso, '.admin-screen button', 'Wallet de prueba 1');
    await until(async () => (await text(intruso, '.admin-screen')).includes('solo lectura'), 'otra cuenta queda en solo lectura');
    check(await intruso.locator('.admin-screen button', { hasText: 'Pausar' }).isDisabled(), 'una cuenta que no es dueña no puede pausar');

    const page = await newPage(0);
    await page.goto(`${APP}/?admin=1`);
    await until(async () => (await text(page, '.admin-screen')).includes('v2'), 'el admin detecta contratos v2');
    await clickText(page, '.admin-screen button', 'Wallet de prueba 0');
    await until(async () => (await text(page, '.admin-screen')).includes('administradora'), 'la dueña queda como administradora');
    await until(async () => !(await text(page, '.admin-screen')).includes('Leyendo'), 'el panel termina de cargar');
    await page.fill('.admin-screen input', '10');
    await clickText(page, '.admin-screen button', 'Cambiar');
    await until(async () => Number(await read('items', 'intervaloDrop')) === 600, 'intervalo de drops en 10 min');
    await clickText(page, '.admin-screen button', 'Pausar registros');
    await until(async () => (await read('seasons', 'pausada')) === true, 'pausa en la cadena');
    await until(async () => (await text(page, '.admin-screen')).includes('detenidos'), 'el panel muestra la pausa');
    await clickText(page, '.admin-screen button', 'Reanudar registros');
    await until(async () => (await read('seasons', 'pausada')) === false, 'reanuda en la cadena');
    await travel(5 * DAY); // sábado: la semana 1 terminó
    await clickText(page, '.admin-screen button', 'Actualizar');
    await until(async () => page.locator('.admin-screen button', { hasText: 'Cerrar temporada' }).count(), 'ofrece cerrar la temporada terminada');
    await clickText(page, '.admin-screen button', 'Cerrar temporada');
    const semana = (await read('seasons', 'semanaActual'))[0];
    await until(async () => (await read('seasons', 'cerrada', [semana])) === true, 'temporada cerrada en la cadena');
    const podio = await read('seasons', 'podio', [semana]);
    check(podio.length === 1 && podio[0].nombre === 'Campeona', 'el podio guarda a la campeona');
    check(Number(await read('seasons', 'total', [semana])) === 0, 'el resto del historial se borró');
    await shot(page, '04-admin');
    check(page.errors.length === 0 && intruso.errors.length === 0, `sin errores en la consola (${[...page.errors, ...intruso.errors].join(' | ')})`);
  });

  await scenario('Salón de campeones y semana nueva', async () => {
    const page = await newPage(0);
    await page.goto(APP);
    await page.evaluate(([k]) => localStorage.setItem(k, JSON.stringify({ version: 2, petId: 0, name: 'X', bornAt: Date.now(), updatedAt: Date.now(), needs: { hunger: 80, thirst: 80, energy: 80, happiness: 80, cleanliness: 80 }, sleeping: false, diedAt: null, lifeHours: 12, peaceful: true })), [PET]);
    // Se enlaza a la mascota viva #2 (la #1 murió en la cadena y el juego ya no le cree al navegador).
    await page.evaluate(([address]) => localStorage.setItem('tamagotchi-polkadot-nft-v1', JSON.stringify({ tokenId: '2', address, mode: 'ranking' })), [ACCOUNTS[2].toLowerCase()]);
    await page.reload();
    await page.waitForSelector('.game-screen:not([hidden])');
    await clickText(page, '.actions button', 'Ranking');
    await until(async () => (await text(page, 'dialog[open]')).includes('SALÓN DE CAMPEONES') && (await text(page, 'dialog[open]')).includes('Campeona'), 'el salón muestra a la campeona');
    check((await text(page, 'dialog[open]')).includes('Cerrada'), 'en sábado la temporada se ve cerrada');
    await travel(2 * DAY); // lunes
    await page.locator('dialog[open] .dialog-close').click();
    await clickText(page, '.actions button', 'Ranking');
    await until(async () => (await text(page, 'dialog[open]')).includes('Abierta') && (await text(page, 'dialog[open]')).includes('Todavía nadie'), 'el lunes el ranking empieza vacío');
    await shot(page, '05-salon-campeones');
  });

  await browser.close();
}

main()
  .catch((e) => { results.push({ scenario: 'preparación', ok: false, text: e.message }); console.error(e); })
  .finally(() => {
    stopAll();
    const ok = results.filter((r) => r.ok).length;
    const bad = results.filter((r) => !r.ok);
    writeFileSync(join(OUT, 'resultados.json'), JSON.stringify(results, null, 2));
    console.log(`\n${ok} comprobaciones correctas, ${bad.length} fallidas.`);
    for (const b of bad) console.log(`  ✗ [${b.scenario}] ${b.text}`);
    process.exit(bad.length ? 1 : 0);
  });
