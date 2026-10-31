import './style.css';
import { createChainClient, isInsideContainer, SignerManager } from '@parity/product-sdk';
import { toH160 } from '@parity/product-sdk/address';
import { ContractManager, ensureContractAccountMapped } from '@parity/product-sdk/contracts';
import type { SignerAccount } from '@parity/product-sdk/wallet';
import { paseo_asset_hub } from '@parity/product-sdk-descriptors/paseo-asset-hub';
import { createPetScene, type PetSceneHandle } from '../../src/game/petScene.ts';
import { portraitUrl } from '../../src/game/assets.ts';
import { findPet, PETS } from '../../src/game/catalog.ts';
import { buildTheme } from '../../src/ui/theme.ts';
import manifest from './cdm.json';

const PRODUCT_ID = 'tamagotchiaxolotl.paseo';
const CONTRACT_ID = '@tamagotchiaxolotl/polkapets';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const root = document.querySelector<HTMLElement>('#app')!;

type Action = 'alimentar' | 'jugar' | 'dormir' | 'banar';
type Pet = {
  tokenId: bigint; nombre: string; especie: number; nivel: number; etapa: number; viva: boolean;
  hambre: number; sed: number; energia: number; felicidad: number; limpieza: number; vida: number;
};

const shell = document.createElement('main');
shell.className = 'product-shell';
shell.innerHTML = `
  <img class="product-logo" src="./app-logo.jpeg" alt="Logo de Tamagotchi Axolotl" />
  <h1>Tamagotchi Axolotl</h1>
  <p class="product-status" role="status" aria-live="polite"></p>
  <div class="product-actions"><button id="connect" type="button">Conectar con Polkadot App</button></div>
  <form id="adopt" hidden>
    <label>Nombre de tu mascota <input name="name" maxlength="24" required /></label>
    <fieldset class="product-species"><legend>Elige tu mascota NFT</legend></fieldset>
    <button type="submit">Adoptar NFT</button>
  </form>
  <section id="pet" hidden>
    <h2 id="pet-name"></h2>
    <div class="product-scene" id="scene"></div>
    <div class="product-stats" id="stats"></div>
    <div class="product-actions" id="care"></div>
    <div class="product-actions"><button id="rename" type="button">Cambiar nombre</button><button id="new-pet" type="button">Adoptar otro ajolote</button></div>
    <form id="rename-form" hidden><label>Nuevo nombre <input name="name" maxlength="24" required /></label> <button type="submit">Guardar nombre</button></form>
  </section>
  <div class="product-actions"><button id="ranking" type="button">Ver ranking</button></div>
  <ol id="ranking-list" hidden></ol>`;
root.append(shell);

const status = shell.querySelector<HTMLElement>('.product-status')!;
const connectButton = shell.querySelector<HTMLButtonElement>('#connect')!;
const adoptForm = shell.querySelector<HTMLFormElement>('#adopt')!;
const speciesField = adoptForm.querySelector<HTMLElement>('.product-species')!;
for (const pet of PETS) {
  const label = document.createElement('label');
  label.className = 'product-species-option';
  const radio = document.createElement('input');
  radio.type = 'radio'; radio.name = 'species'; radio.value = String(pet.id);
  radio.required = true;
  if (pet.id === 0) radio.checked = true;
  const portrait = document.createElement('img');
  portrait.src = portraitUrl(pet.slug); portrait.alt = '';
  const title = document.createElement('span'); title.textContent = pet.label;
  label.append(radio, portrait, title);
  speciesField.append(label);
}
const renameForm = shell.querySelector<HTMLFormElement>('#rename-form')!;
const petSection = shell.querySelector<HTMLElement>('#pet')!;
const sceneHost = shell.querySelector<HTMLElement>('#scene')!;
const statsHost = shell.querySelector<HTMLElement>('#stats')!;
const careHost = shell.querySelector<HTMLElement>('#care')!;
const rankingList = shell.querySelector<HTMLOListElement>('#ranking-list')!;
let scene: PetSceneHandle | null = null;
let reactionTimer = 0;
let busy = false;
let currentPet: Pet | null = null;
let owner: `0x${string}` | null = null;
let contract: ReturnType<ContractManager['getContract']> | null = null;
let signer: ReturnType<SignerAccount['getSigner']> | null = null;

function say(message: string) { status.textContent = message; }
function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
function petFrom(raw: unknown): Pet {
  const value = raw as Record<string, unknown>;
  return {
    tokenId: BigInt(value.tokenId as bigint), nombre: String(value.nombre), especie: Number(value.especie),
    nivel: Number(value.nivel), etapa: Number(value.etapa), viva: Boolean(value.viva),
    hambre: Number(value.hambre), sed: Number(value.sed), energia: Number(value.energia),
    felicidad: Number(value.felicidad), limpieza: Number(value.limpieza), vida: Number(value.vida),
  };
}
async function query(method: string, ...args: unknown[]): Promise<unknown> {
  if (!contract) throw new Error('Conecta tu cuenta primero.');
  const result = await contract[method].query(...args);
  if (!result.success) throw new Error(`Falló la lectura ${method}: ${errorMessage(result.value)}`);
  return result.value;
}
async function transact(method: string, ...args: unknown[]): Promise<void> {
  if (!contract || !signer) throw new Error('Conecta tu cuenta primero.');
  const result = await contract[method].tx(...args, { signer });
  if (!result.ok) throw new Error(result.error.message);
}
async function operation(label: string, action: () => Promise<void>) {
  if (busy) return;
  busy = true;
  shell.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = true; });
  say(label);
  try { await action(); }
  catch (cause) { say(errorMessage(cause)); }
  finally {
    busy = false;
    shell.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
  }
}
function showPet(pet: Pet | null) {
  currentPet = pet;
  petSection.hidden = !pet;
  adoptForm.hidden = !!pet;
  if (!pet) return;
  shell.querySelector<HTMLElement>('#pet-name')!.textContent = `${pet.nombre} · NFT #${pet.tokenId}`;
  scene ??= createPetScene(sceneHost, () => {});
  scene.setRoomColors(buildTheme(findPet(pet.especie)?.theme ?? 0xe4007c).room);
  const stage = pet.nivel >= 10 ? 'adult' : pet.nivel >= 2 ? 'teen' : 'baby';
  scene.show({ petId: pet.especie, stage, anim: !pet.viva ? 'dead' : pet.etapa === 3 ? 'sad' : 'idle' });
  statsHost.replaceChildren();
  for (const [label, value] of Object.entries({ Vida: pet.vida, Hambre: pet.hambre, Sed: pet.sed, Energía: pet.energia, Felicidad: pet.felicidad, Limpieza: pet.limpieza })) {
    const stat = document.createElement('div');
    stat.className = 'product-stat';
    stat.textContent = `${label}: ${value}`;
    const meter = document.createElement('meter');
    meter.min = 0; meter.max = 100; meter.value = value;
    stat.append(meter); statsHost.append(stat);
  }
  careHost.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = !pet.viva; });
}
function reactToCare(anim: 'eat' | 'play' | 'sleep' | 'bath', icon: string) {
  if (!currentPet || !scene) return;
  const stage = currentPet.nivel >= 10 ? 'adult' : currentPet.nivel >= 2 ? 'teen' : 'baby';
  scene.show({ petId: currentPet.especie, stage, anim });
  scene.react(icon);
  window.clearTimeout(reactionTimer);
  reactionTimer = window.setTimeout(() => showPet(currentPet), 1400);
}
async function reloadPet() {
  if (!owner) return;
  const ids = await query('mascotasDe', owner) as bigint[];
  const latest = [...ids].reverse();
  for (const id of latest) {
    const pet = petFrom(await query('verMascota', id));
    if (pet.viva) { showPet(pet); return; }
  }
  showPet(null);
}

for (const [label, action, icon] of [
  ['Alimentar', 'alimentar', '🍓'], ['Jugar', 'jugar', '🎾'],
  ['Dormir', 'dormir', '🌙'], ['Bañar', 'banar', '🫧'],
] as const) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = `${icon} ${label}`;
  button.addEventListener('click', () => void operation(`${label}…`, async () => {
    if (!currentPet) return;
    await transact(action, currentPet.tokenId);
    await reloadPet();
    reactToCare(action === 'alimentar' ? 'eat' : action === 'jugar' ? 'play' : action === 'dormir' ? 'sleep' : 'bath', icon);
    say(`${label}: transacción confirmada.`);
  }));
  careHost.append(button);
}

connectButton.addEventListener('click', () => void operation('Conectando con el Host…', async () => {
  const manager = new SignerManager({ ss58Prefix: 0, dappName: PRODUCT_ID });
  const connection = await manager.connect();
  if (!connection.ok) throw connection.error;
  const productAccount = await manager.getProductAccount(PRODUCT_ID, 0);
  if (!productAccount.ok) throw productAccount.error;
  const account = productAccount.value;
  signer = account.getSigner();
  if (!signer) throw new Error('El Host no entregó un firmante para este Product.');
  owner = toH160(account.address);
  const chain = await createChainClient({ chains: { assetHub: paseo_asset_hub } });
  const contractManager = ContractManager.fromClient(manifest, chain.raw.assetHub, paseo_asset_hub, { signerManager: manager });
  const mapped = await ensureContractAccountMapped(contractManager.getRuntime(), account.address, signer);
  if (!mapped.ok) throw mapped.error;
  contract = contractManager.getContract(CONTRACT_ID);
  connectButton.hidden = true;
  await reloadPet();
  say('Cuenta conectada.');
}));

adoptForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = String(new FormData(adoptForm).get('name') ?? '').trim();
  const species = Number(new FormData(adoptForm).get('species'));
  if (!name || new TextEncoder().encode(name).length > 24) { say('El nombre debe tener entre 1 y 24 bytes.'); return; }
  if (!findPet(species)) { say('Selecciona una especie válida.'); return; }
  void operation('Adoptando mascota…', async () => {
    await transact('mint', name, species);
    await reloadPet();
    say('Mascota adoptada.');
  });
});
shell.querySelector<HTMLButtonElement>('#new-pet')!.addEventListener('click', () => showPet(null));
shell.querySelector<HTMLButtonElement>('#rename')!.addEventListener('click', () => {
  renameForm.hidden = !renameForm.hidden;
});
renameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = String(new FormData(renameForm).get('name') ?? '').trim();
  if (!name || !currentPet) return;
  if (new TextEncoder().encode(name).length > 24) { say('El nombre supera 24 bytes.'); return; }
  void operation('Cambiando nombre…', async () => {
    await transact('cambiarNombre', currentPet!.tokenId, name);
    await reloadPet();
    renameForm.hidden = true;
    say('Nombre actualizado.');
  });
});
shell.querySelector<HTMLButtonElement>('#ranking')!.addEventListener('click', () => void operation('Leyendo ranking…', async () => {
  const total = Number(await query('totalMascotas'));
  const rows = await query('ranking', 0n, BigInt(Math.min(total, 50))) as Record<string, unknown>[];
  rankingList.replaceChildren();
  for (const row of [...rows].sort((a, b) => Number(b.duracion) - Number(a.duracion))) {
    const item = document.createElement('li');
    item.textContent = `${String(row.nombre)} · ${Math.floor(Number(row.duracion) / 60)} min`;
    rankingList.append(item);
  }
  rankingList.hidden = false;
  say(`${rows.length} mascotas en el ranking.`);
}));

void (async () => {
  if (!(await isInsideContainer())) { say('Abre esta aplicación dentro de Polkadot Desktop o Polkadot App.'); connectButton.disabled = true; return; }
  if (manifest.contracts[CONTRACT_ID].address === ZERO_ADDRESS) {
    say('Contrato PolkaVM pendiente de desplegar en Paseo.'); connectButton.disabled = true; return;
  }
  say('Conecta tu cuenta de Polkadot para jugar con tu NFT.');
  window.setInterval(() => { if (owner && currentPet && !busy) void reloadPet().catch(console.error); }, 20_000);
})().catch((cause) => { say(errorMessage(cause)); });
