// Controlador: interpreta las intenciones de la interfaz, aplica las reglas del juego y actualiza
// la escena y las pantallas. Flujo: nombre → mascota → adoptar NFT (paso opcional) → habitación.
// Modo local: cuidados gratis. Con NFT (pasivo o ranking): cada cuidado se simula, se firma y solo
// se aplica cuando la transacción se confirma.
import { pickAnimation, type PetAnim } from '../game/animations.ts';
import { findItem } from '../game/catalog.ts';
import { headWearFor, isWearable, loadHatPalette, saveHatPalette } from '../game/wearables.ts';
import { slotOf } from '../game/bodyPoints.ts';
import { findVariant } from '../game/variants.ts';
import {
  addToPantry, clearPantry, DROP_INTERVAL_MS, dropsAvailable, findFood, findFoodByArticle, foodEffects, loadPantry, pickDrop,
  removeFromPantry, savePantry, type PantryItem, type SpecialFood,
} from '../game/pantry.ts';
import { createPantryDialog } from '../ui/pantryDialog.ts';
import { say, sayAs, type Moment } from '../game/voice.ts';
import { createCollectionDialog } from '../ui/collectionDialog.ts';
import { addRecord, loadHistory, saveHistory, type PetRecord } from '../game/history.ts';
import { createSeasonDialog, type SeasonRow } from '../ui/seasonDialog.ts';
import { createAdminScreen, type AdminView } from '../ui/adminScreen.ts';
import type { ChainVersions, Temporada } from '../polkadot/nftMint.ts';
import { calendario } from '../../game/src/contract/temporadas.ts';
import { CHAIN_NAME, ITEMS_ADDRESS as ITEMS_ADDR, PETS_ADDRESS, TEMPORADAS_ADDRESS } from '../../game/src/contract/config.ts';
import { configForPet, DIFFICULTIES } from '../game/config.ts';
import { createPetScene, type PetSceneHandle } from '../game/petScene.ts';
import { findPet } from '../game/catalog.ts';
import {
  ageMs, bathe, computeStage, computeStats, createPet, detectStageChange, eatSpecial, feed, isAsleep, isDead, lowNeeds,
  markDeadIfNeeded, play, rename, sleep, wake,
} from '../game/petState.ts';
import type { RankingSource } from '../game/ranking.ts';
import { ITEMS_ADDRESS, RANKING_ADDRESS } from '../../game/src/contract/config.ts';
import { createRecordDialog } from '../ui/recordDialog.ts';
import { createSignDialog } from '../ui/signDialog.ts';
import { createMiniGameDialog } from '../ui/miniGameDialog.ts';
import { createAccessoriesDialog, createSpaceDialog } from '../ui/inventoryDialogs.ts';
import { loadPurse, savePurse } from '../game/coins.ts';
import { canBuy, clearPurchases, equippedArticleIds, loadPurchases, savePurchases, SHOP_CATALOG, type ShopBackend, type ShopItem } from '../game/shop.ts';
import { createShopDialog } from '../ui/shopDialog.ts';
import {
  ACHIEVEMENTS, achievementState, type AchievementDef, availableAchievements, clearClaimed, loadClaimed, saveClaimed, type Progress,
} from '../game/achievements.ts';
import { applyPercent, describeBonus, totalBonus } from '../game/bonuses.ts';
import { createAchievementsDialog } from '../ui/achievementsDialog.ts';
import { canPlay, happinessFor, PLAY_COOLDOWN_MS, pongSkill, type MiniGameResult } from '../game/minigames/rules.ts';
import { startMiniGame, type MiniGameHandle } from '../game/minigames/scenes.ts';
import {
  accessoryIcon, clearEquipped, createLocalInventory, isValidEquipment, loadEquipped, NOTHING_EQUIPPED, sanitize, saveEquipped, toDecor,
  toggle as toggleItem, type Equipped, type InventoryItem,
} from '../game/inventory.ts';
import type { CareAction } from '../polkadot/nftMint.ts';
import { loadNft, loadPet, parsePetState, PET_STORAGE_KEY, saveNft, savePet, type NftMode, type PetNft } from '../game/storage.ts';
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
import { createSelectScreen, recoloredPortrait, type PetChoice } from '../ui/selectScreen.ts';
import { createStartScreen } from '../ui/startScreen.ts';
import { applyTheme, buildTheme, DEFAULT_THEME_COLOR } from '../ui/theme.ts';

const params = new URLSearchParams(location.search);
// `?speed=10` acelera el tiempo para probar etapas y muerte en la demo.
const speed = Number(params.get('speed') ?? 1);
const app = document.querySelector<HTMLElement>('#app')!;
const ACTION_MS = 1200;
/** Prototipo: `?color=dorado` (silvestre, melanico, cobre) recolorea la mascota. Ver game/variants.ts. */
const colorVariant = params.get('color');
/** Estilo de dibujo elegido en el Menú: la ilustración original o pasada a pixel art real. */
const STYLE_KEY = 'tamagotchi-polkadot-style-v1';
let drawStyle: 'original' | 'pixel' = (() => { try { return localStorage.getItem(STYLE_KEY) === 'pixel' ? 'pixel' : 'original'; } catch { return 'original'; } })();

type Screen = 'start' | 'select' | 'mint' | 'game';

let pet: PetState | null = loadPet();
let nft: PetNft | null = pet ? loadNft() : null;
/** Reglas de la partida: dificultad (horas sin cuidados) y modo (Pacífico no muere). */
let config = configForPet(pet, speed);
/** Color, dificultad y modo elegidos para la mascota nueva. */
let draftChoice: PetChoice = { variant: null, lifeHours: 7 };
/** Versiones de los contratos desplegados (se leen al conectar). */
let versions: ChainVersions = { pets: 1, items: ITEMS_ADDRESS ? 1 : 0, seasons: TEMPORADAS_ADDRESS !== null };
/** Temporada de Competencia (v2) leída de la cadena, o null. */
let season: Temporada | null = null;
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
/** Modo elegido en el paso 3 (con cartera). Por defecto, ranking si el leaderboard existe. */
/** Hay dónde registrar una partida de Competencia: temporadas (v2) o el ranking v1. */
const recordAvailable = () => RANKING_ADDRESS !== null || TEMPORADAS_ADDRESS !== null;
let draftMode: NftMode = recordAvailable() ? 'ranking' : 'passive';

/** Modo de la partida: sin cartera es 'local'; con NFT, el que se eligió al adoptar. */
type PlayMode = 'local' | NftMode;
const playMode = (): PlayMode => (nft ? nft.mode ?? 'ranking' : 'local');

const startScreen = createStartScreen((name) => {
  draftName = name;
  selectScreen.reset(name);
  showScreen('select');
}, undefined, () => openCollection());

/* --------------------------------------------------------- mis animales */

const collectionDialog = createCollectionDialog();
let history = loadHistory();

/** Registro de la mascota actual para "Mis animales". */
function recordOf(p: PetState, now: number): PetRecord {
  return {
    id: `${p.bornAt}-${p.petId}`, name: p.name, petId: p.petId, variant: p.variant ?? null, lifeHours: p.lifeHours,
    peaceful: p.peaceful === true, bornAt: p.bornAt, endedAt: p.diedAt ?? now, diedAt: p.diedAt, aliveMs: ageMs(p, now),
    tokenId: nft?.tokenId,
  };
}

function openCollection() {
  collectionDialog.open({ current: pet ? recordOf(pet, Date.now()) : null, history });
}

/** Guarda la mascota que se va a reemplazar. */
function archivePet() {
  if (!pet) return;
  history = addRecord(history, recordOf(pet, Date.now()));
  saveHistory(history);
}

const selectScreen = createSelectScreen((petId, choice) => {
  draftPetId = petId;
  draftChoice = choice;
  useTheme(petId);
  mintScreen.reset(draftName, petId);
  // El retrato del paso 3 también lleva el color elegido.
  const slug = findPet(petId)?.slug;
  if (choice.variant && slug) void recoloredPortrait(petId, slug, choice.variant).then((url) => { if (url) mintScreen.setPortrait(url); }).catch(() => {});
  showScreen('mint');
  void prepareMint();
}, () => showScreen('start'), useTheme);

/** Crea la partida local y entra a la habitación, con o sin NFT. */
function startGame(minted: PetNft | null) {
  // Sin cartera es Pacífico ("tu mundo"); con NFT, el modo que se eligió al adoptar.
  const peaceful = minted ? minted.mode === 'passive' : true;
  pet = createPet(draftPetId, draftName, Date.now(), { lifeHours: draftChoice.lifeHours, peaceful, variant: draftChoice.variant });
  config = configForPet(pet, speed);
  savePet(pet);
  resetBelongings();
  nft = minted;
  saveNft(minted);
  showNftNote();
  setRecordButton();
  lastStage = 'baby';
  showScreen('game');
  gameScreen.say(`${sayAs(pet.name, 'hello', Date.now())} ${minted
    ? peaceful ? `Ya soy tu NFT #${minted.tokenId}. Aquí nadie se muere, pero no me dejes solito.` : `Ya soy tu NFT #${minted.tokenId}. Aguanto ${draftChoice.lifeHours} h sin ti, ¿eh?`
    : 'Cuídame bonito.'}`);
}

/* --------------------------------------------------- paso 3: adoptar NFT */

/** NFT recién adoptado, mientras se muestra la pantalla de adopción completada. */
let minted: PetNft | null = null;

const mintScreen = createMintScreen({
  setMode: (mode) => { if (!mintBusy && (mode === 'passive' || competitionState().available)) { draftMode = mode; syncConnected(); } },
  connect: (walletId) => void connectWallet(walletId),
  retry: () => void prepareMint(),
  mint: () => void mintNft(),
  // Sin cartera: modo local.
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
    chainInfo = refreshChainInfo();
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

/** Lectura de versiones ya hecha (o en curso) para las acciones de la partida. */
let chainInfo: Promise<void> | null = null;
/** Antes de decidir si algo es NFT (comida, regalos, registro) hay que saber qué contratos hay. */
function ensureChainInfo(): Promise<void> {
  chainInfo ??= refreshChainInfo();
  return chainInfo;
}

/** Lee qué contratos hay (v1 o v2) y la temporada de Competencia. Sin red, se queda con lo último. */
async function refreshChainInfo() {
  try {
    const m = await getMinter();
    versions = await m.versions();
    season = versions.seasons ? await m.season() : null;
  } catch (error) {
    console.warn('[polkapets] versiones y temporada', error);
  }
  if (screen === 'mint') syncConnected();
}

/** Si la Competencia se puede elegir ahora y el texto de la temporada. */
function competitionState(): { available: boolean; note: string } {
  if (versions.seasons && season) {
    if (season.pausada) return { available: false, note: 'La competencia está en pausa por el administrador.' };
    if (!season.abierta) return { available: false, note: 'La temporada está cerrada: abre el lunes a las 00:00 (hora de México).' };
    return { available: true, note: `Temporada ${season.semana + 1}: cierra el viernes a las 23:59.` };
  }
  return { available: RANKING_ADDRESS !== null, note: '' };
}

function syncConnected() {
  if (!mintAccount) return;
  const competition = competitionState();
  if (!competition.available && draftMode === 'ranking') draftMode = 'passive';
  // Cualquier especie se puede adoptar: si el contrato no la admite, el mint usa el comodín (0).
  mintScreen.sync({
    step: 'connected', via: mintAccount.via, address: mintAccount.address, inHost: mintAccount.inHost,
    mode: draftMode, rankingAvailable: competition.available, competitionNote: competition.note,
  });
}

async function mintNft() {
  if (mintBusy || !minter || !mintAccount) return;
  const account = mintAccount;
  mintBusy = true;
  mintScreen.showError(null);
  mintScreen.sync({ step: 'minting', inHost: account.inHost, progress: 'simulando' });
  try {
    // Con PolkaPets v2 la dificultad y el modo quedan en el NFT; con v1 solo nombre y especie.
    const options = versions.pets >= 2 ? { lifeHours: draftChoice.lifeHours, peaceful: draftMode === 'passive' } : undefined;
    const tokenId = await minter.mint(draftName, draftPetId, (progress) => {
      mintScreen.sync({ step: 'minting', inHost: account.inHost, progress });
    }, options);
    mintBusy = false;
    minted = { tokenId: tokenId.toString(), address: account.address, mode: draftMode };
    const lifeText = draftMode === 'passive' ? 'Modo pacífico: no muere, se enferma y espera tus cuidados.'
      : `Modo competencia: sin cuidados aguanta ${draftChoice.lifeHours} h.`;
    mintScreen.sync({ step: 'done', tokenId: minted.tokenId, url: minter.nftUrl(tokenId), lifeText, network: CHAIN_NAME });
  } catch (error) {
    mintBusy = false;
    console.warn('[polkapets] mint', error);
    syncConnected();
    mintScreen.showError(minter.explain(error), () => void mintNft());
  }
}

/** Nota de la habitación y botones del leaderboard según el modo. */
function showNftNote() {
  const mode = playMode();
  if (mode === 'ranking') gameScreen.setNote(`Competencia · NFT #${nft!.tokenId}`, 'Cada cuidado lleva firma. Si se te muere, registra su tiempo en la temporada.');
  else if (mode === 'passive') gameScreen.setNote(`Pacífico · NFT #${nft!.tokenId}`, 'Cada cuidado lleva firma. Aquí no se muere: si lo descuidas, se enferma.');
  else gameScreen.setNote('Pacífico, sin cartera.', 'Tu mundo: se guarda en este aparato, es gratis y no se muere.');
  gameScreen.setRankingVisible(mode === 'ranking');
  gameScreen.setBadge(badgeText());
}

/** "⚔️ Competencia · 7 h · Dorado". */
function badgeText(): string {
  if (!pet) return '';
  const mode = pet.peaceful ? 'Pacífico' : 'Competencia';
  const hours = pet.lifeHours ? `${pet.lifeHours} h` : '';
  const color = findVariant(pet.petId, pet.variant)?.name ?? '';
  return [mode, hours, color].filter(Boolean).join(' · ');
}

/** Aplica el tema de la especie y sincroniza el color de la habitación Phaser. */
function useTheme(petId: number | null) {
  const theme = buildTheme(petId === null ? DEFAULT_THEME_COLOR : findPet(petId)?.theme ?? DEFAULT_THEME_COLOR);
  applyTheme(theme);
  scene?.setRoomColors(theme.room);
}

/* ------------------------------------- firma de cada cuidado (modos con NFT) */

/** Cuidado esperando su firma: qué se firma y qué se aplica en el juego cuando se confirma. */
interface PendingSign {
  label: string;
  send: (m: NftMinter, tokenId: bigint, onStep: (step: 'simulando' | 'firma' | 'confirmando' | 'leyendo') => void) => Promise<void>;
  apply: () => void;
  /** Se llama si la persona cancela la firma (nada se aplicó). */
  cancelled?: () => void;
}
let pendingSign: PendingSign | null = null;
let signBusy = false;

const signDialog = createSignDialog({
  connect: (walletId) => void signConnect(walletId),
  retry: () => void signRun(),
  cancel: () => {
    if (signBusy) return;
    const job = pendingSign;
    pendingSign = null;
    signDialog.close();
    gameScreen.say('Cancelaste la firma: no se firmó nada.');
    job?.cancelled?.();
    render();
  },
});

/**
 * En modo local aplica el cuidado al momento. Con NFT (pasivo o ranking) primero lo comprueba en el
 * juego, después lo simula contra el contrato y pide la firma; solo si la transacción se confirma
 * con éxito se aplica en el juego. Si la simulación falla no se abre la wallet ni se cobra nada.
 */
function careWithSignature(label: string, contract: CareAction, apply: () => void) {
  signedAction(label, (m, tokenId, onStep) => m.care(tokenId, contract, onStep), apply);
}

function signedAction(label: string, send: PendingSign['send'], apply: () => void, cancelled?: () => void) {
  if (playMode() === 'local') { apply(); return; }
  if (signBusy || pendingSign) { gameScreen.say('Espera a que termine la firma en curso.'); return; }
  pendingSign = { label, send, apply, cancelled };
  signDialog.open(label);
  render();
  void signRun();
}

async function signRun() {
  if (signBusy || !pendingSign || !nft) return;
  const m = await getMinter();
  const account = m.account();
  if (!account) { await signSearch(); return; }
  // El contrato solo acepta al dueño del NFT: se revisa antes de simular.
  if (account.address.toLowerCase() !== nft.address.toLowerCase()) {
    signDialog.sync({ step: 'wrongAccount', connected: account.address, expected: nft.address });
    return;
  }
  const job = pendingSign;
  signBusy = true;
  signDialog.sync({ step: 'signing', inHost: account.inHost, progress: 'simulando' });
  try {
    await job.send(m, BigInt(nft.tokenId), (step) => {
      if (step !== 'leyendo') signDialog.sync({ step: 'signing', inHost: account.inHost, progress: step });
    });
    signBusy = false;
    pendingSign = null;
    signDialog.close();
    job.apply();
  } catch (error) {
    signBusy = false;
    console.warn('[polkapets] firmar cuidado', error);
    const message = m.explain(error);
    signDialog.showError(/ya murió/.test(message)
      ? 'Tu NFT ya murió en la blockchain, así que el contrato no acepta más cuidados. No se te cobró nada.'
      : `${message} El cuidado no se aplicó.`, () => void signRun());
  }
}

async function signSearch() {
  signDialog.sync({ step: 'searching' });
  try {
    const m = await getMinter();
    const inHost = await m.inHost();
    const wallets = inHost ? [] : await m.wallets();
    lastWallets = wallets;
    signDialog.sync({ step: 'choose', inHost, wallets, suggested: m.suggested });
  } catch (error) {
    console.error('[polkapets] firmar: buscar cuenta', error);
    signDialog.showError('No se pudo cargar la conexión con Polkadot. Revisa tu conexión y reintenta.');
  }
}

async function signConnect(walletId: string | null) {
  if (signBusy) return;
  signBusy = true;
  signDialog.sync({ step: 'connecting', inHost: walletId === null });
  const m = await getMinter();
  try {
    mintAccount = await m.connect(walletId);
    signBusy = false;
    await signRun();
  } catch (error) {
    signBusy = false;
    console.warn('[polkapets] firmar: conectar', error);
    signDialog.showError(m.explain(error), () => void signConnect(walletId));
  }
}

/** true si la acción cambia algo en el juego; si no, se avisa y no se pide firma. */
function possible(next: PetState, p: PetState): boolean {
  if (next !== p) return true;
  gameScreen.say(say('cantNow', Date.now()));
  return false;
}

/* ---------------------------------------------------- minijuegos y pesitos */

let purse = loadPurse();
let miniGame: MiniGameHandle | null = null;
/** El tiempo de espera también se acelera con `?speed=`. */
const speedFactor = Number(params.get('speed') ?? 1) > 0 ? Number(params.get('speed') ?? 1) : 1;

const endMiniGame = () => { miniGame?.destroy(); miniGame = null; };

const miniGameDialog = createMiniGameDialog({
  start: (game, host) => withPet((p, now) => {
    endMiniGame();
    const stats = computeStats(p, now, config);
    const theme = buildTheme(findPet(p.petId)?.theme ?? DEFAULT_THEME_COLOR);
    const decor = toDecor(equipped, owned);
    miniGame = startMiniGame(host, {
      game, petId: p.petId, stage: computeStage(p, now, config), skill: pongSkill(stats.happiness, stats.energy),
      colors: { wall: decor.wall ?? theme.room.wall, floor: decor.floor ?? 0x8e5a3a },
      onEnd: (result) => {
        endMiniGame();
        miniGameDialog.result(result, rewardFor(result), playMode() !== 'local');
      },
    });
  }),
  claim: (result) => claimMiniGame(result),
  close: () => { if (signBusy) return; endMiniGame(); miniGameDialog.close(); render(); },
});

/** Recompensa de la partida con los bonos de lo que tiene puesto (+% pesitos, +% felicidad). */
function rewardFor(result: MiniGameResult) {
  const bonus = totalBonus(equipped, owned);
  return {
    happiness: applyPercent(happinessFor(result), bonus.happiness),
    coins: applyPercent(result.coins, bonus.coins),
    record: result.score > purse.best[result.game],
    bonusNote: describeBonus(bonus),
  };
}

function blockedReason(p: PetState, now: number): string | null {
  const check = canPlay({
    dead: isDead(p, now, config), asleep: isAsleep(p, now, config), energy: computeStats(p, now, config).energy,
    lastPlayAt: purse.lastPlayAt, now, cooldownMs: PLAY_COOLDOWN_MS / speedFactor,
  });
  return check.ok ? null : check.reason;
}

/** Cobrar: felicidad, cansancio y pesitos. Con NFT se firma `jugar` y solo se cobra si se confirma. */
function claimMiniGame(result: MiniGameResult) {
  withPet((p, now) => {
    const reward = rewardFor(result);
    if (!possible(play(p, now, config, reward.happiness), p)) return;
    careWithSignature(`Cobrar el minijuego de ${p.name}`, 'jugar', () => withPet((q, t) => {
      purse = {
        coins: purse.coins + reward.coins,
        lastPlayAt: Date.now(),
        best: { ...purse.best, [result.game]: Math.max(purse.best[result.game], result.score) },
      };
      savePurse(purse);
      gameScreen.setCoins(purse.coins);
      miniGameDialog.close();
      commit(play(q, t, config, reward.happiness),
        `¡Se divirtió muchísimo! +${reward.happiness} de felicidad y +${reward.coins} 🪙.`, { anim: 'play', icon: '🎾' });
    }));
  });
}

/* ------------------------------------------------ inventario (NFT después) */

// Inventario: lo comprado en la tienda (y con `?demo=1`, objetos de muestra para probar).
let purchases = loadPurchases();
/** Despensa: comida especial y regalos ya abiertos (en el dispositivo; con NFT se relee de la cadena). */
let pantry = loadPantry();
const inventory = createLocalInventory(params.get('demo') === '1', () => SHOP_CATALOG.filter((i) => purchases.includes(i.id)));
let owned: InventoryItem[] = [];
let equipped: Equipped = loadEquipped();
/** Trofeos que esta mascota ya tiene (ids de logro) y los que ya se avisaron como disponibles. */
let claimed: number[] = loadClaimed();
const notified = new Set<number>();

/** Lee el inventario, quita lo que ya no se tiene y lo dibuja en la habitación. */
async function loadInventory(): Promise<boolean> {
  try {
    owned = await inventory.list();
    equipped = sanitize(equipped, owned);
    applyInventory();
    return true;
  } catch (error) {
    console.warn('[polkapets] inventario', error);
    return false;
  }
}

/** Color elegido para el sombrero de pixel art. */
let hatPalette = loadHatPalette();

function applyInventory() {
  saveEquipped(equipped);
  scene?.setDecor(toDecor(equipped, owned));
  // Las prendas de WEARABLE_ITEMS se dibujan como pixel art ajustado a cada especie; el resto, emoji.
  scene?.setAccessory(accessoryIcon(equipped, owned), headWearFor(equipped.accessory, hatPalette), slotOf(equipped.accessory));
  scene?.setOutfit(headWearFor(equipped.outfit, hatPalette));
  accessoriesDialog?.colors(isWearable(equipped.accessory) || isWearable(equipped.outfit), hatPalette);
}

/**
 * Nueva mascota: los accesorios, muebles y trofeos pertenecen a la mascota que los compró (en la cadena
 * están ligados a su tokenId), así que la siguiente empieza sin ninguno.
 */
function resetBelongings() {
  claimed = [];
  clearClaimed();
  notified.clear();
  purchases = [];
  clearPurchases();
  clearEquipped();
  pantry = { items: [], dropsTaken: 0 };
  chainDrops = null;
  clearPantry();
  owned = [];
  equipped = { ...NOTHING_EQUIPPED };
  applyInventory();
}

const inventoryIntents = {
  palette(id: string) {
    hatPalette = id;
    saveHatPalette(id);
    applyInventory();
  },
  select(kind: 'accessory' | 'outfit' | 'wall' | 'floor', id: string | null) {
    // sanitize garantiza que solo se ponga lo que se tiene, y uno por lugar.
    equipped = sanitize({ ...equipped, [kind]: id }, owned);
    applyInventory();
    accessoriesDialog.render(owned, equipped);
    spaceDialog.render(owned, equipped);
  },
  toggle(kind: 'furniture' | 'decor', id: string) {
    const result = toggleItem(equipped, kind, id, owned);
    if (!result.ok) { gameScreen.say(result.reason); return; }
    equipped = result.equipped;
    applyInventory();
    spaceDialog.render(owned, equipped);
  },
};
// `var`: applyInventory puede correr antes de que exista el diálogo.
var accessoriesDialog = createAccessoriesDialog(inventoryIntents);
const spaceDialog = createSpaceDialog(inventoryIntents);

/* --------------------------------------------------------------- tienda */

/** Con un NFT de mascota y el contrato de objetos desplegado, comprar es una firma que crea un NFT. */
const itemsAsNft = () => ITEMS_ADDRESS !== null && nft !== null && playMode() !== 'local';

/** Firma `comprar`: resuelve cuando se confirma y rechaza si la persona cancela o falla. */
function signPurchase(item: ShopItem): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!pet || signBusy || pendingSign) { reject(new Error('Espera a que termine la firma en curso.')); return; }
    signedAction(`Comprar ${item.name} para ${pet.name}`, (m, tokenId, onStep) => m.buyItem(tokenId, item.articleId, onStep),
      resolve, () => reject(new Error('Cancelaste la compra: no se firmó nada y no se cobró.')));
  });
}

/**
 * Descuenta pesitos y guarda el objeto. Sin cartera es local; con NFT primero se firma la compra
 * (que crea el NFT ligado a la mascota) y solo si se confirma se cobran los pesitos.
 */
const shopBackend: ShopBackend = {
  async buy(item) {
    if (pet?.diedAt != null) throw new Error('Tu mascota ya murió: no se pueden comprar más objetos para ella.');
    const check = canBuy(item, purse.coins, purchases);
    if (!check.ok) throw new Error(check.reason);
    if (itemsAsNft()) await signPurchase(item);
    purse = { ...purse, coins: purse.coins - item.price };
    savePurse(purse);
    purchases = [...purchases, item.id];
    savePurchases(purchases);
  },
};

let shopBusy = false;
const shopDialog = createShopDialog(SHOP_CATALOG, {
  async buy(item) {
    if (shopBusy) return;
    shopBusy = true;
    shopDialog.buying(item);
    try {
      await shopBackend.buy(item);
      gameScreen.setCoins(purse.coins);
      await loadInventory();
      shopDialog.bought(item, { coins: purse.coins, owned: purchases });
    } catch (error) {
      shopDialog.failed(error instanceof Error ? error.message : 'No se pudo completar la compra.');
    } finally {
      shopBusy = false;
    }
  },
  buyFood(food) { void buyFood(food); },
  use(item) {
    if (item.kind === 'furniture' || item.kind === 'decor') {
      if (!equipped[item.kind].includes(item.id)) {
        const result = toggleItem(equipped, item.kind, item.id, owned);
        if (!result.ok) { shopDialog.failed(`${result.reason} Hazlo en Mi espacio.`); return; }
        equipped = result.equipped;
      }
    } else {
      equipped = { ...equipped, [item.kind]: item.id };
    }
    applyInventory();
    shopDialog.close();
    gameScreen.say(`¡${item.name} ya está en tu ${item.kind === 'accessory' || item.kind === 'outfit' ? 'mascota' : 'habitación'}!`);
  },
});

async function openInventory(dialog: typeof accessoriesDialog | typeof spaceDialog) {
  dialog.open();
  dialog.loading();
  if (await loadInventory()) dialog.render(owned, equipped);
  else dialog.failed();
}

const gameScreen = createGameScreen({
  feed: () => feedMenu.open(),
  // Jugar es en la misma habitación: aparece la pelota y se juega ahí, sin abrir ventanas.
  play: () => withPet((p, now) => {
    if (pendingSign) { gameScreen.say('Espera a que termine la firma en curso.'); return; }
    if (scene?.isPlaying()) return;
    const blocked = blockedReason(p, now);
    if (blocked) { gameScreen.say(blocked); return; }
    const started = scene?.playInRoom((result) => {
      gameScreen.say(result.score >= 5 ? '¡Las atrapé todas!' : `Atrapé ${result.score}. ¡Otra vez!`);
      claimMiniGame(result);
    });
    if (started) gameScreen.say('¡Toca la pelota antes de que se acabe el tiempo!');
  }),
  moreGames: () => withPet((p, now) => {
    if (pendingSign) { gameScreen.say('Espera a que termine la firma en curso.'); return; }
    miniGameDialog.choose(purse.best, blockedReason(p, now));
  }),
  accessories: () => void openInventory(accessoriesDialog),
  space: () => void openInventory(spaceDialog),
  shop: () => shopDialog.open({ coins: purse.coins, owned: purchases, pantry: pantryCount() }),
  trophies: () => openTrophies(),
  sleep: () => withPet((p, now) => {
    if (computeStats(p, now, config).energy >= 99.5) { gameScreen.say(sayAs(p.name, 'notSleepy', now)); return; }
    if (!possible(sleep(p, now, config), p)) return;
    careWithSignature(`Mandar a dormir a ${p.name}`, 'dormir', () => withPet((q, t) =>
      commit(sleep(q, t, config), sayAs(q.name, 'goSleep', t))));
  }),
  wake: () => withPet((p, now) => commit(wake(p, now, config), sayAs(p.name, 'woke', now))),
  bath: () => {
    bathing = true;
    bathProgress = 0;
    scene?.resetBath();
    gameScreen.say('A bañarse. Talla con la esponja.');
    render();
  },
  exitBath: () => withPet((p, now) => {
    const progress = bathProgress;
    bathing = false;
    bathProgress = 0;
    scene?.resetBath();
    // Sin frotar no hay baño: no se pide firma.
    if (progress === 0) { gameScreen.say(sayAs(p.name, 'bathNone', now)); render(); return; }
    if (!possible(bathe(p, progress, now, config), p)) { render(); return; }
    const message = sayAs(p.name, progress < 50 ? 'bathHalf' : 'bathDone', now);
    careWithSignature(`Bañar a ${p.name}`, 'banar', () => withPet((q, t) => commit(bathe(q, progress, t, config), message)));
  }),
  rename: () => { if (pet && !signBusy && !pendingSign) renameDialog.open(pet.name); },
  collection: () => openCollection(),
  style: () => {
    drawStyle = drawStyle === 'pixel' ? 'original' : 'pixel';
    try { localStorage.setItem(STYLE_KEY, drawStyle); } catch { /* sin localStorage */ }
    gameScreen.setStyle(drawStyle);
    render();
  },
  ranking: () => openRanking(),
  record: () => openRecord(false),
  pantry: () => openPantry(),
  legacy: () => saveLegacy(),
  restart: () => {
    if (recordBusy || signBusy) return;
    // El legado se arma con lo que tiene puesto en este dispositivo: al empezar de nuevo se pierde.
    if (itemsAsNft() && nft && !nft.legacy && pet?.diedAt != null && purchases.length > 0
      && !window.confirm(`Aún no guardaste el legado de ${pet.name} (sus accesorios y muebles). Si empiezas de nuevo no podrás guardarlo. ¿Continuar?`)) return;
    if (signDialog.isOpen()) { pendingSign = null; signDialog.close(); }
    if (miniGameDialog.isOpen()) { endMiniGame(); miniGameDialog.close(); }
    if (recordDialog.isOpen()) recordDialog.close();
    archivePet();
    pet = null;
    savePet(null);
    config = configForPet(null, speed);
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
  if (!item || !possible(feed(p, itemId, now, config), p)) return;
  careWithSignature(`Darle ${item.label.toLowerCase()} a ${p.name}`, 'alimentar', () => withPet((q, t) =>
    commit(feed(q, itemId, t, config), sayAs(q.name, item.kind === 'drink' ? 'drank' : 'fed', t), { anim: 'eat', icon: item.icon })));
}));

const renameDialog = createRenameDialog((name) => withPet((p, now) => {
  if (!possible(rename(p, name, now, config), p)) return;
  signedAction(`Cambiar el nombre a ${name}`, (m, tokenId, onStep) => m.rename(tokenId, nameForContract(name), onStep),
    () => withPet((q, t) => commit(rename(q, name, t, config), `Ahora se llama ${name}.`)));
}));

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
/* ------------------------------------------- competencia por temporadas (v2) */

const seasonDialog = createSeasonDialog({
  async load() {
    const m = await getMinter();
    const s = await m.season();
    if (!s) throw new Error('Sin temporadas');
    season = s;
    const me = (m.account()?.address ?? nft?.address ?? '').toLowerCase();
    const toRow = (r: { tokenId: bigint; dueno: string; nombre: string; especie: number; horas: number; duracion: number }): SeasonRow => ({
      id: r.tokenId.toString(), name: r.nombre, petId: r.especie, hours: r.horas, aliveMs: r.duracion * 1000, mine: me !== '' && r.dueno.toLowerCase() === me,
    });
    const [rows, champions, admin] = await Promise.all([m.seasonRows(s.semana), m.champions(), m.admin()]);
    return {
      week: s.semana, open: s.abierta, paused: s.pausada, opensAt: s.abre, closesAt: s.cierra,
      rows: rows.map(toRow), champions: champions.map((c) => ({ week: c.semana, podium: c.podio.map(toRow) })),
      pendingClose: admin.pendingClose,
    };
  },
  async close(week) {
    const m = await getMinter();
    if (!m.account()) throw new Error('Conecta tu cuenta para guardar el podio (una firma).');
    await m.closeSeason(week);
  },
});

/** Competencia: con contrato de temporadas abre la temporada; si no, el leaderboard v1. */
function openRanking() {
  if (TEMPORADAS_ADDRESS) seasonDialog.open(pet?.lifeHours);
  else rankingDialog.open();
}

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
  ranking: () => { recordDialog.close(); openRanking(); },
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
  const enabled = recordAvailable() && playMode() === 'ranking';
  gameScreen.setRecord(!enabled ? 'hidden' : nft!.recorded ? 'recorded' : 'available');
  // El legado vale para cualquier mascota NFT (ranking o pasivo) si el contrato de objetos existe.
  gameScreen.setLegacy(!itemsAsNft() ? 'hidden' : nft!.legacy ? 'recorded' : 'available');
}

/**
 * Al morir: guarda en la cadena cuánto vivió y qué accesorios y muebles tenía puestos. Antes de
 * pedir la firma se comprueba la selección; el contrato la valida de nuevo.
 */
function saveLegacy() {
  withPet((p, now) => {
    if (!nft || p.diedAt === null || nft.legacy) return;
    if (!isValidEquipment(equipped, owned)) {
      gameScreen.say('Lo que tenía puesto no cumple las reglas: un accesorio y un mueble por categoría.');
      return;
    }
    const seconds = ageMs(p, now) / 1000;
    const articleIds = equippedArticleIds(equipped);
    signedAction(`Guardar el legado de ${p.name}`, (m, tokenId, onStep) => m.saveLegacy(tokenId, seconds, articleIds, onStep), () => {
      markNft({ legacy: true });
      gameScreen.say(`El legado de ${p.name} quedó guardado: ${formatDuration(ageMs(p, now))}, ${purchases.length} objetos y ${claimed.length} trofeos.`);
    });
  });
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
  // Solo el modo ranking guarda resultados; en local y pasivo no se pregunta.
  if (playMode() !== 'ranking') return;
  if (auto && nft?.asked) return;
  // Sin contrato de ranking no se interrumpe al jugador; se preguntará cuando esté desplegado.
  if (auto && nft && !recordAvailable()) return;
  if (nft) markNft({ asked: true });
  recordDialog.open({
    name: pet.name, petId: pet.petId, duration: formatDuration(ageMs(pet, Date.now())), tokenId: nft?.tokenId ?? '',
  });
  recordDialog.showError(null);
  if (!nft) recordDialog.sync({ step: 'noNft' });
  else if (nft.recorded) recordDialog.sync({ step: 'already' });
  else if (!recordAvailable()) recordDialog.sync({ step: 'unavailable' });
  else recordDialog.sync({ step: 'ask' });
}

/** "Sí": si ya hay cuenta conectada de la adopción, va directo a firmar. */
async function startRecord() {
  await ensureChainInfo();
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
    const onStep = (step: 'simulando' | 'firma' | 'confirmando' | 'leyendo') => {
      if (step !== 'leyendo') recordDialog.sync({ step: 'signing', inHost: account.inHost, progress: step });
    };
    // v2: la temporada lee la duración exacta de la cadena; v1: el ranking recibe la del juego.
    const seasons = versions.seasons && versions.pets >= 2;
    if (seasons ? await m.isSeasonRecorded(tokenId) : await m.isRecorded(tokenId)) {
      recordBusy = false;
      markNft({ recorded: true });
      recordDialog.sync({ step: 'already' });
      return;
    }
    if (seasons) await m.recordSeason(tokenId, onStep);
    else await m.record({ tokenId, nombre: nameForContract(pet.name), especie: pet.petId, duracionSeg: ageMs(pet, Date.now()) / 1000 }, onStep);
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

/* -------------------------------------------------------------- trofeos */

/** Lo que da un trofeo, en texto: "+40 🪙 y 🏅 Medalla (+10% pesitos)". */
function rewardLabel(def: AchievementDef): string {
  const item = def.rewardItem ? SHOP_CATALOG.find((i) => i.id === def.rewardItem) : undefined;
  const bonus = item?.bonus ? ` (${describeBonus(item.bonus)})` : '';
  return `+${def.coins} 🪙${item ? ` y ${item.icon} ${item.name}${bonus}` : ''}`;
}

/**
 * Acredita los pesitos del trofeo y agrega su accesorio exclusivo a la colección. Con NFT el
 * contrato ya creó el NFT del accesorio al reclamar; aquí solo se refleja en el juego.
 */
function grantReward(def: AchievementDef) {
  purse = { ...purse, coins: purse.coins + def.coins };
  savePurse(purse);
  gameScreen.setCoins(purse.coins);
  if (def.rewardItem && !purchases.includes(def.rewardItem)) {
    purchases = [...purchases, def.rewardItem];
    savePurchases(purchases);
    void loadInventory().then(() => { if (achievementsDialog.isOpen()) renderAchievements(); });
  }
}

const progressNow = (p: PetState, now: number): Progress => ({ ageMs: ageMs(p, now), items: purchases.length });

const achievementsDialog = createAchievementsDialog({ claim: (id) => claimAchievement(id) });

function renderAchievements() {
  if (!pet) return;
  const progress = progressNow(pet, Date.now());
  const asNft = itemsAsNft();
  const dead = pet.diedAt !== null;
  achievementsDialog.render({
    rows: ACHIEVEMENTS.map((def) => ({ def, state: achievementState(def, claimed, progress), reward: rewardLabel(def) })),
    asNft,
    summary: `${claimed.length} de ${ACHIEVEMENTS.length} trofeos · ${purchases.length} de ${SHOP_CATALOG.length} objetos`,
    canClaim: asNft && !dead && !signBusy && pendingSign === null,
    note: dead ? 'Tu mascota ya murió: sus trofeos quedan como están.'
      : asNft ? 'Cada trofeo se reclama con una firma y es un NFT ligado a esta mascota.'
      : 'Los trofeos se ganan solos jugando.',
  });
}

function openTrophies() {
  checkAchievements();
  achievementsDialog.open();
  renderAchievements();
}

/** Sin NFT los logros se ganan solos; con NFT solo se avisa y la persona decide reclamarlos. */
function checkAchievements() {
  if (!pet || pet.diedAt !== null) return;
  const fresh = availableAchievements(claimed, progressNow(pet, Date.now()));
  if (fresh.length === 0) return;
  if (!itemsAsNft()) {
    claimed = [...claimed, ...fresh.map((d) => d.id)];
    saveClaimed(claimed);
    for (const d of fresh) grantReward(d);
    gameScreen.showToast(`¡Ganaste un trofeo! ${fresh.map((d) => d.name).join(', ')}`);
    if (achievementsDialog.isOpen()) renderAchievements();
    return;
  }
  const news = fresh.filter((d) => !notified.has(d.id));
  if (news.length === 0) return;
  for (const d of news) notified.add(d.id);
  gameScreen.showToast(`Hay trofeo esperándote: ${news.map((d) => d.name).join(', ')}. Pásale a Trofeos.`);
}

/** Con NFT: firma `reclamarLogro` y solo si se confirma el trofeo queda en la colección. */
function claimAchievement(id: number) {
  withPet((p, now) => {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def || p.diedAt !== null || achievementState(def, claimed, progressNow(p, now)) !== 'available') return;
    signedAction(`Reclamar el trofeo «${def.name}»`, (m, tokenId, onStep) => m.claimAchievement(tokenId, def.id, onStep), () => {
      claimed = [...claimed, def.id];
      saveClaimed(claimed);
      grantReward(def);
      renderAchievements();
      gameScreen.say(`¡Trofeo «${def.name}» reclamado! Es un NFT de ${p.name}. ${rewardLabel(def)}`);
    }, renderAchievements);
  });
}

/* ------------------------------------------------- despensa y regalos (drops) */

/** Comida y regalos son NFT si hay mascota NFT y PolkaPetsItems v2. */
const foodAsNft = () => versions.items >= 2 && nft !== null && playMode() !== 'local';

const pantryCount = (): Record<string, number> => {
  const count: Record<string, number> = {};
  for (const i of pantry.items) count[i.foodId] = (count[i.foodId] ?? 0) + 1;
  return count;
};

/** Regalos según el contrato (con NFT v2); null mientras no se ha leído. */
let chainDrops: number | null = null;

function giftsReady(now: number): number {
  if (!pet || pet.diedAt !== null) return 0;
  if (foodAsNft() && chainDrops !== null) return chainDrops;
  return dropsAvailable(ageMs(pet, now), pantry.dropsTaken, DROP_INTERVAL_MS / (speed > 0 ? speed : 1));
}

function pantryView() {
  const now = Date.now();
  const interval = DROP_INTERVAL_MS / (speed > 0 ? speed : 1);
  const alive = pet !== null && pet.diedAt === null;
  const age = pet ? ageMs(pet, now) : 0;
  return {
    items: pantry.items,
    drops: giftsReady(now),
    nextDropMs: alive ? interval - (age % interval) : null,
    asNft: foodAsNft(),
    disabledReason: !alive ? 'Tu mascota ya no puede comer.' : signBusy || pendingSign ? 'Espera a que termine la firma en curso.' : null,
  };
}

const pantryDialog = createPantryDialog({
  use: (item) => void useFood(item),
  claimDrop: () => void claimDrop(),
});

async function openPantry() {
  pantryDialog.open(pantryView());
  if (nft) await ensureChainInfo();
  await syncPantry();
}

/** Con NFT la despensa verdadera está en la cadena: se relee (tokenIds incluidos). */
async function syncPantry() {
  if (!foodAsNft() || !nft) return;
  try {
    chainDrops = await (await getMinter()).dropsAvailable(BigInt(nft.tokenId));
    const chain = await (await getMinter()).pantry(BigInt(nft.tokenId));
    const items: PantryItem[] = chain.flatMap((c) => {
      const food = findFoodByArticle(c.articulo);
      return food ? [{ uid: `nft-${c.tokenId}`, foodId: food.id, tokenId: c.tokenId.toString() }] : [];
    });
    // Lo comprado sin NFT (por ejemplo, sin conexión) se conserva junto a lo que está en la cadena.
    pantry = { ...pantry, items: [...items, ...pantry.items.filter((i) => !i.tokenId)] };
    savePantry(pantry);
    pantryDialog.render(pantryView());
  } catch (error) {
    console.warn('[polkapets] despensa', error);
  }
}

async function useFood(item: PantryItem) {
  const food = findFood(item.foodId);
  if (!food) return;
  if (nft) await ensureChainInfo();
  withPet((p, now) => {
    if (p.diedAt !== null || isDead(p, now, config)) { gameScreen.say('Tu mascota ya no puede comer.'); return; }
    const apply = () => withPet((q, t) => {
      pantry = removeFromPantry(pantry, item.uid);
      savePantry(pantry);
      pantryDialog.render(pantryView());
      commit(eatSpecial(q, foodEffects(food), t, config), sayAs(q.name, 'special', t), { anim: 'eat', icon: food.icon });
    });
    if (foodAsNft() && item.tokenId) {
      pantryDialog.close();
      signedAction(`Darle ${food.name} a ${p.name}`, (m, _tokenId, onStep) => m.useFood(BigInt(item.tokenId!), onStep), apply);
    } else {
      apply();
    }
  });
}

async function claimDrop() {
  if (nft) await ensureChainInfo();
  withPet((p, now) => {
    if (giftsReady(now) === 0) { gameScreen.say(say('noGift', now)); return; }
    const receive = (food: SpecialFood | undefined, tokenId?: string) => {
      pantry = { ...pantry, dropsTaken: pantry.dropsTaken + 1 };
      if (chainDrops !== null) chainDrops = Math.max(0, chainDrops - 1);
      const uid = tokenId ? `nft-${tokenId}` : `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (food && !pantry.items.some((i) => i.uid === uid)) pantry = addToPantry(pantry, { uid, foodId: food.id, tokenId });
      savePantry(pantry);
      gameScreen.setGifts(giftsReady(Date.now()));
      pantryDialog.render(pantryView());
      gameScreen.showToast(food ? `¡Te tocó ${food.name}!${food.dropOnly ? ' Y esa no se vende.' : ''}` : 'Regalo abierto.');
    };
    if (foodAsNft()) {
      let result: { tokenId: bigint; articulo: number } | null = null;
      pantryDialog.close();
      signedAction(`Abrir un regalo de ${p.name}`, async (m, tokenId, onStep) => { result = await m.claimDrop(tokenId, onStep); },
        () => receive(result ? findFoodByArticle(result.articulo) : undefined, result ? String(result.tokenId) : undefined));
    } else {
      receive(pickDrop(Math.random()));
    }
  });
}

async function buyFood(food: SpecialFood) {
  if (shopBusy) return;
  if (!pet || pet.diedAt !== null) { shopDialog.failed('Tu mascota ya no puede comer.'); return; }
  if (purse.coins < food.price) { shopDialog.failed(`Te faltan ${food.price - purse.coins} 🪙.`); return; }
  shopBusy = true;
  shopDialog.buying(food);
  if (nft) await ensureChainInfo();
  const done = async (asNft: boolean) => {
    purse = { ...purse, coins: purse.coins - food.price };
    savePurse(purse);
    gameScreen.setCoins(purse.coins);
    // Con NFT la comida nueva se lee de la cadena (con su tokenId); sin NFT se guarda aquí.
    if (asNft) await syncPantry();
    else pantry = addToPantry(pantry, { uid: `local-${Date.now()}`, foodId: food.id });
    savePantry(pantry);
    shopDialog.boughtFood(food, { coins: purse.coins, pantry: pantryCount() });
  };
  try {
    const asNft = foodAsNft();
    if (asNft && pet) {
      await new Promise<void>((resolve, reject) => {
        if (signBusy || pendingSign) { reject(new Error('Espera a que termine la firma en curso.')); return; }
        signedAction(`Comprar ${food.name} para ${pet!.name}`, (m, tokenId, onStep) => m.buyItem(tokenId, food.articleId, onStep),
          resolve, () => reject(new Error('Cancelaste la compra: no se firmó nada y no se cobró.')));
      });
    }
    await done(asNft);
  } catch (error) {
    shopDialog.failed(error instanceof Error ? error.message : 'No se pudo completar la compra.');
  } finally {
    shopBusy = false;
  }
}

function withPet(fn: (p: PetState, now: number) => void) {
  if (pet) fn(pet, Date.now());
}

/** Guarda el estado nuevo de una acción y lanza su animación breve. */
function commit(next: PetState, message: string, reaction?: { anim: 'eat' | 'play'; icon: string }) {
  if (next === pet) { gameScreen.say(say('cantNow', Date.now())); render(); return; }
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

/** Lo que dice la mascota según su estado (src/game/voice.ts). Cambia de frase cada 20 s. */
const MOOD: Partial<Record<PetAnim, Moment>> = { dead: 'dead', sleep: 'sleeping', bath: 'bath', eat: 'eating', play: 'playing' };
const NEED_MOOD: Record<NeedKey, Moment> = { hunger: 'hungry', thirst: 'thirsty', energy: 'sleepy', happiness: 'bored', cleanliness: 'dirty' };

function render() {
  if (!pet || screen !== 'game') return;
  const now = Date.now();
  const stats = computeStats(pet, now, config);
  const stage = computeStage(pet, now, config);
  const dead = isDead(pet, now, config);
  const low = lowNeeds(stats, config);
  const asleep = isAsleep(pet, now, config);
  const anim = pickAnimation({ dead, sleeping: asleep, bathing, action, low, now });
  const mode: GameMode = dead ? 'dead' : asleep ? 'sleep' : bathing ? 'bath' : 'normal';
  const moment: Moment = MOOD[anim] ?? (low.length ? NEED_MOOD[low[0]] : 'happy');
  const mood = { icon: '', text: say(moment, Math.floor(now / 20_000) + pet.bornAt) };
  gameScreen.update({
    name: pet.name, stageLabel: STAGE_LABEL[stage], ageLabel: formatDuration(ageMs(pet, now)),
    // Mientras hay una firma pendiente no se puede pedir otro cuidado.
    stats, mode, bathProgress, mood, busy: (action !== null && now < action.until) || pendingSign !== null,
  });
  scene?.show({ petId: pet.petId, stage, anim, variant: pet.variant ?? colorVariant, style: drawStyle });
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
    gameScreen.say(sayAs(pet.name, 'starved', now));
    // En modo ranking pide guardar la partida en el leaderboard.
    openRecord(true);
  } else if (pet.sleeping && !isAsleep(pet, now, config)) {
    // Recuperó toda su energía: se despierta sola (también si la app estuvo cerrada).
    pet = wake(pet, now, config);
    savePet(pet);
    gameScreen.say(sayAs(pet.name, 'wokeAlone', now));
  }
  const stage = computeStage(pet, now, config);
  const grown = lastStage ? detectStageChange(lastStage, stage) : null;
  if (grown && pet.diedAt === null) gameScreen.showToast(`${sayAs(pet.name, 'grew', now)} Ya es ${STAGE_LABEL[grown].toLowerCase()}.`);
  lastStage = stage;
  checkAchievements();
  gameScreen.setGifts(giftsReady(now));
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
    if (!scene) {
      scene = createPetScene(gameScreen.gameHost, (progress) => { bathProgress = progress; render(); });
      void loadInventory();
    }
    if (pet) lastStage = computeStage(pet, Date.now(), config);
    render();
  }
}

if (params.get('admin') === '1') {
  startAdmin();
} else if (params.get('outside') === '1') {
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
  gameScreen.setCoins(purse.coins);
  gameScreen.setStyle(drawStyle);
  showScreen(pet ? 'game' : 'start');
  // Con NFT se averigua en segundo plano qué contratos hay (v1 o v2).
  if (nft) void ensureChainInfo();
  // Murió en una sesión anterior y nunca se preguntó: se pregunta ahora (solo con NFT).
  if (pet && pet.diedAt !== null && nft && !nft.asked) openRecord(true);
  window.addEventListener('storage', (event) => {
    if (event.key !== PET_STORAGE_KEY || !app.contains(startScreen.root)) return;
    pet = parsePetState(event.newValue);
    config = configForPet(pet, speed);
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

/* ---------------------------------------------- administración (?admin=1) */

function startAdmin() {
  let view: AdminView = {
    network: CHAIN_NAME, addresses: [], totalPets: null, season: null, seasonsOwner: null, itemsOwner: null, dropIntervalSec: null,
    pendingClose: [], account: null, wallets: [], inHost: false, busy: 'Leyendo los contratos…', message: null,
  };
  const screenAdmin = createAdminScreen({
    connect: (walletId) => void run('Conectando…', async (m) => {
      const account = await m.connect(walletId);
      view = { ...view, account: account.address };
    }),
    refresh: () => void load(),
    pause: (paused) => void run(paused ? 'Pausando…' : 'Reanudando…', (m) => m.setSeasonPaused(paused)),
    closeWeek: (week) => void run(`Cerrando la temporada ${week + 1}…`, (m) => m.closeSeason(week)),
    setDropInterval: (minutes) => void run('Cambiando el intervalo…', async (m) => {
      if (!(minutes >= 1)) throw new Error('Escribe al menos 1 minuto.');
      await m.setDropInterval(minutes * 60);
    }),
    exit: () => { location.search = ''; },
  });
  app.replaceChildren(screenAdmin.root);
  const sync = () => screenAdmin.sync(view);

  async function run(busy: string, fn: (m: NftMinter) => Promise<void>) {
    const m = await getMinter();
    view = { ...view, busy, message: null };
    sync();
    try {
      await fn(m);
      await load();
    } catch (error) {
      view = { ...view, busy: null, message: m.explain(error) };
      sync();
    }
  }

  async function load() {
    view = { ...view, busy: 'Leyendo los contratos…' };
    sync();
    const m = await getMinter();
    try {
      const [info, inHost] = await Promise.all([m.admin(), m.inHost()]);
      const wallets = inHost ? [] : await m.wallets();
      lastWallets = wallets;
      const registered = info.season ? (await m.seasonRows(info.season.semana)).length : 0;
      view = {
        ...view, busy: null, inHost, wallets: wallets.map((w) => ({ id: w.id, name: w.name })),
        addresses: [
          { label: 'PolkaPets', address: PETS_ADDRESS, version: `v${info.versions.pets}` },
          { label: 'Objetos', address: ITEMS_ADDR, version: info.versions.items ? `v${info.versions.items}` : undefined },
          { label: 'Temporadas', address: TEMPORADAS_ADDRESS },
          { label: 'Ranking v1', address: RANKING_ADDRESS },
        ],
        season: info.season ? {
          week: info.season.semana, open: info.season.abierta, paused: info.season.pausada, opensAt: info.season.abre, closesAt: info.season.cierra, registered,
        } : null,
        seasonsOwner: info.seasonsOwner, itemsOwner: info.itemsOwner,
        dropIntervalSec: info.dropInterval, pendingClose: info.pendingClose,
      };
    } catch (error) {
      console.warn('[polkapets] admin', error);
      const local = calendario(Date.now());
      view = { ...view, busy: null, message: `No se pudieron leer los contratos (${m.explain(error)}). Semana local: ${local.semana + 1}.` };
    }
    sync();
  }
  void load();
}
