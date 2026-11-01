// Controlador: interpreta las intenciones de la interfaz, aplica las reglas del juego y actualiza
// la escena y las pantallas. Flujo: nombre → mascota → adoptar NFT (paso opcional) → habitación.
// Adoptar es la única firma; los cuidados son locales y gratis (ver README).
import { pickAnimation, type PetAnim } from '../game/animations.ts';
import { findItem } from '../game/catalog.ts';
import { DEFAULT_CONFIG, withSpeed } from '../game/config.ts';
import { createPetScene, type PetSceneHandle } from '../game/petScene.ts';
import { findPet } from '../game/catalog.ts';
import {
  ageMs, bathe, computeStage, computeStats, createPet, detectStageChange, feed, isDead, lowNeeds,
  markDeadIfNeeded, play, rename, sleep, wake,
} from '../game/petState.ts';
import type { RankingSource } from '../game/ranking.ts';
import { RANKING_ADDRESS } from '../../game/src/contract/config.ts';
import { createRecordDialog } from '../ui/recordDialog.ts';
import { loadNft, loadPet, parsePetState, PET_STORAGE_KEY, saveNft, savePet, type PetNft } from '../game/storage.ts';
import type { MintAccount, MintWallet, NftMinter } from '../polkadot/nftMint.ts';
import type { NeedKey, PetState, Stage } from '../game/types.ts';
import { h } from '../ui/dom.ts';
import { createFeedMenu } from '../ui/feedMenu.ts';
import { formatDuration, STAGE_LABEL } from '../ui/format.ts';
import { createGameScreen, type GameMode } from '../ui/gameScreen.ts';
import { createMintScreen } from '../ui/mintScreen.ts';
import { createSoundControl } from '../ui/soundControl.ts';
import { createMusic, loadSoundPrefs, saveSoundPrefs } from '../infrastructure/audio/music.ts';
import { createRankingDialog } from '../ui/rankingDialog.ts';
import { createRenameDialog } from '../ui/renameDialog.ts';
import { createSelectScreen } from '../ui/selectScreen.ts';
import { createStartScreen } from '../ui/startScreen.ts';
import { applyTheme, buildTheme, DEFAULT_THEME_COLOR } from '../ui/theme.ts';

const params = new URLSearchParams(location.search);
// `?speed=10` acelera el tiempo para probar etapas y muerte en la demo.
const config = withSpeed(DEFAULT_CONFIG, Number(params.get('speed') ?? 1));
const app = document.querySelector<HTMLElement>('#app')!;
const ACTION_MS = 1200;

type Screen = 'start' | 'select' | 'mint' | 'game';

let pet: PetState | null = loadPet();
let nft: PetNft | null = pet ? loadNft() : null;
let draftPetId = 0;
let minter: NftMinter | null = null;
let mintBusy = false;
let mintAccount: MintAccount | null = null;
let lastWallets: MintWallet[] = [];
let bathing = false;
let bathProgress = 0;
let action: { anim: 'eat' | 'play'; until: number } | null = null;
let lastStage: Stage | null = null;
let scene: PetSceneHandle | null = null;
let screen: Screen = 'start';
let draftName = '';
/** bornAt de la mascota sin NFT a la que ya se avisó que no puede registrarse. */
let deathNoticeFor: number | null = null;

const startScreen = createStartScreen((name) => {
  draftName = name;
  selectScreen.reset(name);
  showScreen('select');
});

const selectScreen = createSelectScreen((petId) => {
  draftPetId = petId;
  useTheme(petId);
  mintScreen.reset(draftName, petId);
  showScreen('mint');
  void prepareMint();
}, () => showScreen('start'), useTheme);

/** Crea la partida local y entra a la habitación, con o sin NFT. */
function startGame(minted: PetNft | null) {
  pet = createPet(draftPetId, draftName, Date.now());
  savePet(pet);
  nft = minted;
  saveNft(minted);
  showNftNote();
  setRecordButton();
  lastStage = 'baby';
  showScreen('game');
  gameScreen.say(minted
    ? `¡${pet.name} ya es tu NFT #${minted.tokenId}! Cuidarla es gratis.`
    : `¡Hola, ${pet.name}! Te toca cuidar de tu nueva mascota.`);
}

/* --------------------------------------------------- paso 3: adoptar NFT */

/** NFT recién adoptado, mientras se muestra la pantalla de adopción completada. */
let minted: PetNft | null = null;

const mintScreen = createMintScreen({
  connect: (walletId) => void connectWallet(walletId),
  retry: () => void prepareMint(),
  mint: () => void mintNft(),
  skip: () => { if (!mintBusy) startGame(null); },
  back: () => { if (!mintBusy) showScreen('select'); },
  enter: () => { if (minted) startGame(minted); minted = null; },
});

/** El SDK y viem se cargan solo al llegar a este paso. */
async function getMinter(): Promise<NftMinter> {
  minter ??= (await import('../polkadot/nftMint.ts')).createNftMinter();
  return minter;
}

async function prepareMint() {
  mintScreen.showError(null);
  mintScreen.sync({ step: 'searching' });
  try {
    const m = await getMinter();
    const inHost = await m.inHost();
    const wallets = inHost ? [] : await m.wallets();
    lastWallets = wallets;
    if (screen === 'mint' && !mintBusy) mintScreen.sync({ step: 'choose', inHost, wallets, suggested: m.suggested });
  } catch (error) {
    console.error('[polkapets] preparar mint', error);
    mintScreen.sync({ step: 'choose', inHost: false, wallets: [], suggested: [] });
    mintScreen.showError('No se pudo cargar la conexión con Polkadot. Reintenta o juega sin NFT.');
  }
}

async function connectWallet(walletId: string | null) {
  if (mintBusy) return;
  mintBusy = true;
  mintScreen.showError(null);
  const m = await getMinter();
  const walletName = walletId === null ? 'Polkadot App' : lastWallets.find((w) => w.id === walletId)?.name ?? 'tu wallet';
  mintScreen.sync({ step: 'connecting', inHost: walletId === null, via: walletName });
  try {
    mintAccount = await m.connect(walletId);
    mintBusy = false;
    syncConnected();
  } catch (error) {
    mintBusy = false;
    console.warn('[polkapets] conectar', error);
    await prepareMint();
    mintScreen.showError(m.explain(error), () => void connectWallet(walletId));
  }
}

function syncConnected() {
  if (!mintAccount) return;
  // Cualquier especie se puede adoptar: si el contrato no la admite, el mint usa el comodín (0).
  mintScreen.sync({ step: 'connected', via: mintAccount.via, address: mintAccount.address, inHost: mintAccount.inHost });
}

async function mintNft() {
  if (mintBusy || !minter || !mintAccount) return;
  const account = mintAccount;
  mintBusy = true;
  mintScreen.showError(null);
  mintScreen.sync({ step: 'minting', inHost: account.inHost, progress: 'simulando' });
  try {
    const tokenId = await minter.mint(draftName, draftPetId, (progress) => {
      mintScreen.sync({ step: 'minting', inHost: account.inHost, progress });
    });
    mintBusy = false;
    minted = { tokenId: tokenId.toString(), address: account.address };
    mintScreen.sync({ step: 'done', tokenId: minted.tokenId, url: minter.nftUrl(tokenId) });
  } catch (error) {
    mintBusy = false;
    console.warn('[polkapets] mint', error);
    syncConnected();
    mintScreen.showError(minter.explain(error), () => void mintNft());
  }
}

/** Nota de la habitación: dice si la mascota es NFT. */
function showNftNote() {
  if (nft) gameScreen.setNote(`Tu mascota es el NFT #${nft.tokenId} en Polkadot Hub.`, 'Cuidarla es gratis: se guarda en este dispositivo.');
  else gameScreen.setNote('Tu partida se guarda en este dispositivo.', 'Cuidarla es gratis: no pide firmas.');
}

/** Aplica el tema de la especie y sincroniza el color de la habitación Phaser. */
function useTheme(petId: number | null) {
  const theme = buildTheme(petId === null ? DEFAULT_THEME_COLOR : findPet(petId)?.theme ?? DEFAULT_THEME_COLOR);
  applyTheme(theme);
  scene?.setRoomColors(theme.room);
}

const gameScreen = createGameScreen({
  feed: () => feedMenu.open(),
  play: () => withPet((p, now) => commit(play(p, now, config), '¡Se divirtió muchísimo jugando contigo!', { anim: 'play', icon: '🎾' })),
  sleep: () => withPet((p, now) => commit(sleep(p, now, config), 'Shhh… está durmiendo.')),
  wake: () => withPet((p, now) => commit(wake(p, now, config), '¡Buenos días! Ya despertó.')),
  bath: () => {
    bathing = true;
    bathProgress = 0;
    scene?.resetBath();
    gameScreen.say('¡Hora del baño!');
    render();
  },
  exitBath: () => withPet((p, now) => {
    const progress = bathProgress;
    bathing = false;
    bathProgress = 0;
    scene?.resetBath();
    const message = progress === 0 ? 'Salió del baño sin enjabonarse.' : progress < 50 ? 'Le faltó un poco de jabón.' : '¡Quedó reluciente!';
    commit(bathe(p, progress, now, config), message);
  }),
  rename: () => { if (pet) renameDialog.open(pet.name); },
  ranking: () => rankingDialog.open(),
  record: () => openRecord(false),
  restart: () => {
    if (recordBusy) return;
    if (recordDialog.isOpen()) recordDialog.close();
    pet = null;
    savePet(null);
    nft = null;
    saveNft(null);
    setRecordButton();
    useTheme(null);
    bathing = false;
    action = null;
    draftName = '';
    startScreen.reset();
    showScreen('start');
  },
});

const feedMenu = createFeedMenu((itemId) => withPet((p, now) => {
  const item = findItem(itemId);
  if (!item) return;
  commit(feed(p, itemId, now, config), `¡Qué rico! Le diste ${item.label.toLowerCase()}.`, { anim: 'eat', icon: item.icon });
}));

const renameDialog = createRenameDialog((name) => withPet((p, now) => commit(rename(p, name, now, config), `Ahora se llama ${name}.`)));

/* ------------------------------------------------ leaderboard (datos reales) */

/**
 * Partidas reales de la blockchain: las registradas al morir (PolkaPetsRanking). Mientras ese
 * contrato no esté desplegado, las mascotas NFT del contrato PolkaPets, como en el primer deploy.
 */
const leaderboard: RankingSource = {
  async getTop() {
    const m = await getMinter();
    const me = (m.account()?.address ?? nft?.address ?? '').toLowerCase();
    const rows = await m.leaderboard();
    return rows
      .sort((a, b) => b.duracion - a.duracion || (a.tokenId < b.tokenId ? -1 : 1))
      .slice(0, 10)
      .map((r) => ({
        id: r.tokenId.toString(),
        petName: r.terminada ? `${r.nombre} 🕊️` : r.nombre,
        petId: r.especie,
        aliveMs: r.duracion * 1000,
        isMine: me !== '' && r.dueno.toLowerCase() === me,
      }));
  },
};
const rankingDialog = createRankingDialog(leaderboard, undefined, RANKING_ADDRESS
  ? 'Las 10 partidas que más duraron, registradas en la blockchain por sus dueños.'
  : 'Las 10 mascotas NFT que más han vivido, según el contrato PolkaPets.');

/* --------------------------------------- registrar la partida al morir */

let recordBusy = false;

const recordDialog = createRecordDialog({
  accept: () => void startRecord(),
  decline: () => { if (!recordBusy) recordDialog.close(); },
  connect: (walletId) => void recordConnect(walletId),
  retry: () => void recordSearch(),
  ranking: () => { recordDialog.close(); rankingDialog.open(); },
});

/** El contrato limita el nombre a 24 bytes: se recorta sin partir letras (nombres de versiones viejas). */
function nameForContract(name: string): string {
  let out = '';
  for (const ch of name) {
    if (new TextEncoder().encode(out + ch).length > 24) break;
    out += ch;
  }
  return out.trim() || 'Mascota';
}

function setRecordButton() {
  const enabled = RANKING_ADDRESS !== null && nft !== null;
  gameScreen.setRecord(!enabled ? 'hidden' : nft!.recorded ? 'recorded' : 'available');
}

function markNft(patch: Partial<PetNft>) {
  if (!nft) return;
  nft = { ...nft, ...patch };
  saveNft(nft);
  setRecordButton();
}

/** Abre el diálogo. `auto`: al morir, solo si nunca se preguntó. */
function openRecord(auto: boolean) {
  if (!pet || pet.diedAt === null) return;
  if (auto && nft?.asked) return;
  // Sin contrato de ranking no se interrumpe al jugador; se preguntará cuando esté desplegado.
  if (auto && nft && !RANKING_ADDRESS) return;
  if (nft) markNft({ asked: true });
  recordDialog.open({
    name: pet.name, petId: pet.petId, duration: formatDuration(ageMs(pet, Date.now())), tokenId: nft?.tokenId ?? '',
  });
  recordDialog.showError(null);
  if (!nft) recordDialog.sync({ step: 'noNft' });
  else if (nft.recorded) recordDialog.sync({ step: 'already' });
  else if (!RANKING_ADDRESS) recordDialog.sync({ step: 'unavailable' });
  else recordDialog.sync({ step: 'ask' });
}

/** "Sí": si ya hay cuenta conectada de la adopción, va directo a firmar. */
async function startRecord() {
  const m = await getMinter();
  if (m.account()) await recordSign();
  else await recordSearch();
}

async function recordSearch() {
  if (recordBusy) return;
  recordDialog.showError(null);
  recordDialog.sync({ step: 'searching' });
  try {
    const m = await getMinter();
    const inHost = await m.inHost();
    const wallets = inHost ? [] : await m.wallets();
    lastWallets = wallets;
    recordDialog.sync({ step: 'choose', inHost, wallets, suggested: m.suggested });
  } catch (error) {
    console.error('[polkapets] registrar: buscar cuenta', error);
    recordDialog.sync({ step: 'choose', inHost: false, wallets: [], suggested: [] });
    recordDialog.showError('No se pudo cargar la conexión con Polkadot. Revisa tu conexión y reintenta.');
  }
}

async function recordConnect(walletId: string | null) {
  if (recordBusy) return;
  recordBusy = true;
  recordDialog.showError(null);
  recordDialog.sync({ step: 'connecting', inHost: walletId === null });
  const m = await getMinter();
  try {
    mintAccount = await m.connect(walletId);
    recordBusy = false;
    await recordSign();
  } catch (error) {
    recordBusy = false;
    console.warn('[polkapets] registrar: conectar', error);
    await recordSearch();
    recordDialog.showError(m.explain(error), () => void recordConnect(walletId));
  }
}

async function recordSign() {
  if (recordBusy || !pet || !nft) return;
  const m = await getMinter();
  const account = m.account();
  if (!account) { await recordSearch(); return; }
  // Antes de firmar: el contrato solo acepta al dueño del NFT.
  if (account.address.toLowerCase() !== nft.address.toLowerCase()) {
    recordDialog.sync({ step: 'wrongAccount', connected: account.address, expected: nft.address });
    return;
  }
  const tokenId = BigInt(nft.tokenId);
  recordBusy = true;
  recordDialog.showError(null);
  recordDialog.sync({ step: 'signing', inHost: account.inHost, progress: 'simulando' });
  try {
    if (await m.isRecorded(tokenId)) {
      recordBusy = false;
      markNft({ recorded: true });
      recordDialog.sync({ step: 'already' });
      return;
    }
    await m.record(
      { tokenId, nombre: nameForContract(pet.name), especie: pet.petId, duracionSeg: ageMs(pet, Date.now()) / 1000 },
      (step) => { if (step !== 'leyendo') recordDialog.sync({ step: 'signing', inHost: account.inHost, progress: step }); },
    );
    recordBusy = false;
    markNft({ recorded: true });
    recordDialog.sync({ step: 'done' });
    gameScreen.say(`${pet.name} quedó en el leaderboard.`);
  } catch (error) {
    recordBusy = false;
    console.warn('[polkapets] registrar', error);
    const message = m.explain(error);
    if (/ya está registrada/.test(message)) { markNft({ recorded: true }); recordDialog.sync({ step: 'already' }); return; }
    recordDialog.sync({ step: 'ask' });
    recordDialog.showError(message, () => void recordSign());
  }
}

function withPet(fn: (p: PetState, now: number) => void) {
  if (pet) fn(pet, Date.now());
}

/** Guarda el estado nuevo de una acción y lanza su animación breve. */
function commit(next: PetState, message: string, reaction?: { anim: 'eat' | 'play'; icon: string }) {
  if (next === pet) { gameScreen.say('Ahora no puede hacer eso.'); render(); return; }
  pet = next;
  savePet(pet);
  if (reaction) {
    action = { anim: reaction.anim, until: Date.now() + ACTION_MS };
    scene?.react(reaction.icon, reaction.anim);
    // Reactiva los botones justo al terminar la animación, sin esperar al siguiente segundo.
    window.setTimeout(render, ACTION_MS + 20);
  }
  gameScreen.say(message);
  render();
}

const MOOD: Partial<Record<PetAnim, { icon: string; text: string }>> = {
  dead: { icon: '🕊️', text: 'Descansa en paz.' },
  sleep: { icon: '☾', text: 'Zzz… está soñando.' },
  bath: { icon: '🫧', text: '¡Burbujas por todas partes!' },
  eat: { icon: '😋', text: '¡Ñam, ñam!' },
  play: { icon: '😄', text: '¡Otra vez, otra vez!' },
};
const NEED_MOOD: Record<NeedKey, string> = {
  hunger: 'Tengo hambre…', thirst: 'Tengo sed…', energy: 'Tengo sueño…', happiness: 'Quiero jugar…', cleanliness: 'Necesito un baño…',
};

function render() {
  if (!pet || screen !== 'game') return;
  const now = Date.now();
  const stats = computeStats(pet, now, config);
  const stage = computeStage(pet, now, config);
  const dead = isDead(pet, now, config);
  const low = lowNeeds(stats, config);
  const anim = pickAnimation({ dead, sleeping: pet.sleeping, bathing, action, low, now });
  const mode: GameMode = dead ? 'dead' : pet.sleeping ? 'sleep' : bathing ? 'bath' : 'normal';
  const mood = MOOD[anim] ?? (low.length ? { icon: '☹', text: NEED_MOOD[low[0]] } : { icon: '☺', text: '¡Qué bonito día!' });
  gameScreen.update({
    name: pet.name, stageLabel: STAGE_LABEL[stage], ageLabel: formatDuration(ageMs(pet, now)),
    stats, mode, bathProgress, mood, busy: action !== null && now < action.until,
  });
  scene?.show({ petId: pet.petId, stage, anim });
}

/** Cada segundo: detecta muerte y cambio de etapa, y refresca las barras. */
function tick() {
  if (!pet || screen !== 'game') return;
  const now = Date.now();
  const checked = markDeadIfNeeded(pet, now, config);
  if (checked !== pet) {
    pet = checked;
    savePet(pet);
    bathing = false;
    gameScreen.say(`${pet.name} no recibió los cuidados que necesitaba.`);
    // Pregunta si registrar la partida. Sin NFT avisa que no se puede, solo esta vez.
    if (nft || deathNoticeFor !== pet.bornAt) { deathNoticeFor = pet.bornAt; openRecord(true); }
  }
  const stage = computeStage(pet, now, config);
  const grown = lastStage ? detectStageChange(lastStage, stage) : null;
  if (grown && pet.diedAt === null) gameScreen.showToast(`¡${pet.name} creció a ${STAGE_LABEL[grown].toLowerCase()}!`);
  lastStage = stage;
  if (action && now >= action.until) action = null;
  render();
}

function showScreen(next: Screen) {
  screen = next;
  startScreen.root.hidden = next !== 'start';
  selectScreen.root.hidden = next !== 'select';
  mintScreen.root.hidden = next !== 'mint';
  gameScreen.root.hidden = next !== 'game';
  if (next === 'start') startScreen.focus();
  if (next === 'game') {
    // Phaser se crea cuando su contenedor ya es visible, para que mida bien el tamaño.
    scene ??= createPetScene(gameScreen.gameHost, (progress) => { bathProgress = progress; render(); });
    if (pet) lastStage = computeStage(pet, Date.now(), config);
    render();
  }
}

if (params.get('outside') === '1') {
  // Vista previa del aviso para cuando la app se abra fuera de un Host. La detección real
  // (`isInsideContainer()` del Product SDK) se conectará después desde src/polkadot/.
  app.replaceChildren(h('section', { class: 'screen start-screen' },
    h('span', { class: 'eyebrow' }, 'POLKADOT'), h('h1', { class: 'title' }, 'Esta vista de Polkadot Desktop aún no está conectada'),
    h('p', { class: 'hint' }, 'El juego local funciona en el navegador. La integración con el Host todavía está pendiente.')));
} else {
  app.append(startScreen.root, selectScreen.root, mintScreen.root, gameScreen.root);

  // Música de fondo: empieza con el primer toque, clic o tecla (los navegadores no dejan antes).
  const prefs = loadSoundPrefs();
  const music = createMusic(prefs);
  const sound = createSoundControl(prefs, (next) => {
    saveSoundPrefs(next);
    music.setVolume(next.volume);
    music.setMuted(next.muted);
  });
  document.body.append(sound.root);
  const unlock = () => music.unlock();
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  startScreen.reset();
  useTheme(pet?.petId ?? null);
  showNftNote();
  setRecordButton();
  showScreen(pet ? 'game' : 'start');
  // Murió en una sesión anterior y nunca se preguntó: se pregunta ahora (solo con NFT).
  if (pet?.diedAt !== null && pet && nft && !nft.asked) openRecord(true);
  window.addEventListener('storage', (event) => {
    if (event.key !== PET_STORAGE_KEY || !app.contains(startScreen.root)) return;
    pet = parsePetState(event.newValue);
    nft = pet ? loadNft() : null;
    showNftNote();
    setRecordButton();
    bathing = false;
    bathProgress = 0;
    action = null;
    lastStage = null;
    useTheme(pet?.petId ?? null);
    showScreen(pet ? 'game' : 'start');
    if (pet) gameScreen.say('La partida se actualizó en otra pestaña.');
  });
  window.setInterval(tick, 1000);
}
