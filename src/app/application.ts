// Controlador: interpreta las intenciones de la interfaz, aplica las reglas del juego y actualiza
// la escena y las pantallas. Flujo: nombre → mascota → adoptar NFT (paso opcional) → habitación.
// Modo local: cuidados gratis. Con NFT (pasivo o ranking): cada cuidado se simula, se firma y solo
// se aplica cuando la transacción se confirma.
import { pickAnimation, type PetAnim } from '../game/animations.ts';
import { findItem } from '../game/catalog.ts';
import { DEFAULT_CONFIG, withSpeed } from '../game/config.ts';
import { createPetScene, type PetSceneHandle } from '../game/petScene.ts';
import { findPet } from '../game/catalog.ts';
import {
  ageMs, bathe, computeStage, computeStats, createPet, detectStageChange, feed, isAsleep, isDead, lowNeeds,
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
/** Modo elegido en el paso 3 (con cartera). Por defecto, ranking si el leaderboard existe. */
let draftMode: NftMode = RANKING_ADDRESS ? 'ranking' : 'passive';

/** Modo de la partida: sin cartera es 'local'; con NFT, el que se eligió al adoptar. */
type PlayMode = 'local' | NftMode;
const playMode = (): PlayMode => (nft ? nft.mode ?? 'ranking' : 'local');

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
  resetBelongings();
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
  setMode: (mode) => { if (!mintBusy && (mode === 'passive' || RANKING_ADDRESS)) { draftMode = mode; syncConnected(); } },
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
  mintScreen.sync({
    step: 'connected', via: mintAccount.via, address: mintAccount.address, inHost: mintAccount.inHost,
    mode: draftMode, rankingAvailable: RANKING_ADDRESS !== null,
  });
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
    minted = { tokenId: tokenId.toString(), address: account.address, mode: draftMode };
    mintScreen.sync({ step: 'done', tokenId: minted.tokenId, url: minter.nftUrl(tokenId) });
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
  if (mode === 'ranking') gameScreen.setNote(`🏆 Modo ranking · NFT #${nft!.tokenId}`, 'Cada cuidado se firma. Al morir, guarda cuánto vivió en el leaderboard.');
  else if (mode === 'passive') gameScreen.setNote(`🌿 Modo pasivo · NFT #${nft!.tokenId}`, 'Cada cuidado se firma. No participa en el leaderboard.');
  else gameScreen.setNote('Modo local, sin cartera.', 'Tu partida se guarda en este dispositivo. Cuidarla es gratis.');
  gameScreen.setRankingVisible(mode === 'ranking');
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
  gameScreen.say('Ahora no puede hacer eso.');
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

function applyInventory() {
  saveEquipped(equipped);
  scene?.setDecor(toDecor(equipped, owned));
  scene?.setAccessory(accessoryIcon(equipped, owned));
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
  owned = [];
  equipped = { ...NOTHING_EQUIPPED };
  applyInventory();
}

const inventoryIntents = {
  select(kind: 'accessory' | 'wall' | 'floor', id: string | null) {
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
const accessoriesDialog = createAccessoriesDialog(inventoryIntents);
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
    gameScreen.say(`¡${item.name} ya está en tu ${item.kind === 'accessory' ? 'mascota' : 'habitación'}!`);
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
  play: () => withPet((p, now) => {
    if (pendingSign) { gameScreen.say('Espera a que termine la firma en curso.'); return; }
    miniGameDialog.choose(purse.best, blockedReason(p, now));
  }),
  accessories: () => void openInventory(accessoriesDialog),
  space: () => void openInventory(spaceDialog),
  shop: () => shopDialog.open({ coins: purse.coins, owned: purchases }),
  trophies: () => openTrophies(),
  sleep: () => withPet((p, now) => {
    if (computeStats(p, now, config).energy >= 99.5) { gameScreen.say('No tiene sueño: su energía está al máximo.'); return; }
    if (!possible(sleep(p, now, config), p)) return;
    careWithSignature(`Mandar a dormir a ${p.name}`, 'dormir', () => withPet((q, t) =>
      commit(sleep(q, t, config), 'Shhh… está durmiendo. Se despertará al recuperar toda su energía.')));
  }),
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
    // Sin frotar no hay baño: no se pide firma.
    if (progress === 0) { gameScreen.say('Salió del baño sin enjabonarse.'); render(); return; }
    if (!possible(bathe(p, progress, now, config), p)) { render(); return; }
    const message = progress < 50 ? 'Le faltó un poco de jabón.' : '¡Quedó reluciente!';
    careWithSignature(`Bañar a ${p.name}`, 'banar', () => withPet((q, t) => commit(bathe(q, progress, t, config), message)));
  }),
  rename: () => { if (pet && !signBusy && !pendingSign) renameDialog.open(pet.name); },
  ranking: () => rankingDialog.open(),
  record: () => openRecord(false),
  legacy: () => saveLegacy(),
  restart: () => {
    if (recordBusy || signBusy) return;
    // El legado se arma con lo que tiene puesto en este dispositivo: al empezar de nuevo se pierde.
    if (itemsAsNft() && nft && !nft.legacy && pet?.diedAt != null && purchases.length > 0
      && !window.confirm(`Aún no guardaste el legado de ${pet.name} (sus accesorios y muebles). Si empiezas de nuevo no podrás guardarlo. ¿Continuar?`)) return;
    if (signDialog.isOpen()) { pendingSign = null; signDialog.close(); }
    if (miniGameDialog.isOpen()) { endMiniGame(); miniGameDialog.close(); }
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
  if (!item || !possible(feed(p, itemId, now, config), p)) return;
  careWithSignature(`Darle ${item.label.toLowerCase()} a ${p.name}`, 'alimentar', () => withPet((q, t) =>
    commit(feed(q, itemId, t, config), `¡Qué rico! Le diste ${item.label.toLowerCase()}.`, { anim: 'eat', icon: item.icon })));
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
  const enabled = RANKING_ADDRESS !== null && playMode() === 'ranking';
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
    gameScreen.showToast(`🏆 ¡Trofeo: ${fresh.map((d) => d.name).join(', ')}!`);
    if (achievementsDialog.isOpen()) renderAchievements();
    return;
  }
  const news = fresh.filter((d) => !notified.has(d.id));
  if (news.length === 0) return;
  for (const d of news) notified.add(d.id);
  gameScreen.showToast(`⭐ Trofeo disponible: ${news.map((d) => d.name).join(', ')}. Reclámalo en 🏆 Trofeos.`);
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
  const asleep = isAsleep(pet, now, config);
  const anim = pickAnimation({ dead, sleeping: asleep, bathing, action, low, now });
  const mode: GameMode = dead ? 'dead' : asleep ? 'sleep' : bathing ? 'bath' : 'normal';
  const mood = MOOD[anim] ?? (low.length ? { icon: '☹', text: NEED_MOOD[low[0]] } : { icon: '☺', text: '¡Qué bonito día!' });
  gameScreen.update({
    name: pet.name, stageLabel: STAGE_LABEL[stage], ageLabel: formatDuration(ageMs(pet, now)),
    // Mientras hay una firma pendiente no se puede pedir otro cuidado.
    stats, mode, bathProgress, mood, busy: (action !== null && now < action.until) || pendingSign !== null,
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
    // En modo ranking pide guardar la partida en el leaderboard.
    openRecord(true);
  } else if (pet.sleeping && !isAsleep(pet, now, config)) {
    // Recuperó toda su energía: se despierta sola (también si la app estuvo cerrada).
    pet = wake(pet, now, config);
    savePet(pet);
    gameScreen.say(`¡${pet.name} recuperó toda su energía y se despertó!`);
  }
  const stage = computeStage(pet, now, config);
  const grown = lastStage ? detectStageChange(lastStage, stage) : null;
  if (grown && pet.diedAt === null) gameScreen.showToast(`¡${pet.name} creció a ${STAGE_LABEL[grown].toLowerCase()}!`);
  lastStage = stage;
  checkAchievements();
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
  gameScreen.setCoins(purse.coins);
  showScreen(pet ? 'game' : 'start');
  // Murió en una sesión anterior y nunca se preguntó: se pregunta ahora (solo con NFT).
  if (pet && pet.diedAt !== null && nft && !nft.asked) openRecord(true);
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
