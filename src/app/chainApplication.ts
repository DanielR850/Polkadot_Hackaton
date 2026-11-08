// Modo NFT con la misma interfaz retro del juego local: habitación Phaser, barras, botones,
// menú de comida, baño con esponja, ranking y cambio de nombre. Cada cuidado es una transacción
// que firma la persona (Polkadot App dentro del Host, o MetaMask en un navegador normal).
// El estado y las firmas viven en el hub de game/src/hub; aquí solo se compone y se traduce.
import { formatEther } from 'viem';
import { FAUCET_URL, NATIVE_SYMBOL } from '../../game/src/contract/config.ts';
import { Etapa, etapaPorNivel, nombreValido, NOMBRE_MAX_BYTES, type Accion, type Mascota } from '../../game/src/contract/polkapets.ts';
import { WALLETS_SUGERIDAS } from '../../game/src/contract/wallets.ts';
import { ordenarRanking } from '../../game/src/engine/ranking.ts';
import { diagnosticar } from '../../game/src/engine/salud.ts';
import { mascotaAhora } from '../../game/src/engine/tiempo.ts';
import type { Firmante } from '../../game/src/contract/pets.ts';
import { createHub, leerRanking, type HubState } from '../../game/src/hub/hub.ts';
import { acortarDireccion } from '../../game/src/lib/format.ts';
import type { PetAnim } from '../game/animations.ts';
import { findItem, findPet } from '../game/catalog.ts';
import { createPetScene, type PetSceneHandle } from '../game/petScene.ts';
import { detectStageChange, validateName, type NameResult } from '../game/petState.ts';
import type { RankingSource } from '../game/ranking.ts';
import type { Stage } from '../game/types.ts';
import { createChainBar, createChainNameScreen, createChainSpeciesScreen, createConnectScreen } from '../ui/chainScreens.ts';
import { createFeedMenu } from '../ui/feedMenu.ts';
import { formatDuration, STAGE_LABEL } from '../ui/format.ts';
import { createGameScreen, type GameMode } from '../ui/gameScreen.ts';
import { createRankingDialog } from '../ui/rankingDialog.ts';
import { createRenameDialog } from '../ui/renameDialog.ts';
import { applyTheme, buildTheme, DEFAULT_THEME_COLOR } from '../ui/theme.ts';

const ACTION_MS = 1400;
const LOW = 30;

/** Nombre válido para la interfaz local y para el contrato (máximo 24 bytes UTF-8). */
function validateChainName(raw: string): NameResult {
  const result = validateName(raw);
  if (result.ok && !nombreValido(result.value)) return { ok: false, error: `Muy largo: máximo ${NOMBRE_MAX_BYTES} bytes (ñ y acentos cuentan doble).` };
  return result;
}

function growthStage(m: Mascota): Stage {
  const growth = m.etapa === Etapa.Enferma || m.etapa === Etapa.Muerta ? etapaPorNivel(m.nivel) : m.etapa;
  return growth === Etapa.Adulta ? 'adult' : growth === Etapa.Joven ? 'teen' : 'baby';
}

export interface ChainAppOptions {
  /** "← Juego local": vuelve a la pantalla de inicio sin borrar el NFT. */
  onExit(): void;
  /** La mascota murió o se eligió otra: vuelve al flujo nombre → mascota → adoptar. */
  onNewGame(): void;
  /** Cuenta ya conectada en el paso de adopción: entra sin volver a conectar. */
  firmante?: Firmante;
  /** NFT que se sigue en esta partida. */
  tokenId?: bigint;
  /** Animal elegido para un NFT (el contrato puede guardarlo como especie 0, el comodín). */
  speciesOf?(tokenId: bigint): number | undefined;
}

export function startChainApp(app: HTMLElement, options: ChainAppOptions): void {
  const hub = createHub();
  const petIdOf = (m: Pick<Mascota, 'tokenId' | 'especie'>) => options.speciesOf?.(m.tokenId) ?? m.especie;
  let theme = buildTheme(findPet(0)?.theme ?? DEFAULT_THEME_COLOR);
  let themePetId = -1;
  /** Tema del animal de la mascota, como en el juego local. */
  const useTheme = (petId: number) => {
    if (petId === themePetId) return;
    themePetId = petId;
    theme = buildTheme(findPet(petId)?.theme ?? DEFAULT_THEME_COLOR);
    applyTheme(theme);
    scene?.setRoomColors(theme.room);
  };
  let scene: PetSceneHandle | null = null;
  useTheme(options.speciesOf && options.tokenId !== undefined ? options.speciesOf(options.tokenId) ?? 0 : 0);
  let bathing = false;
  let bathProgress = 0;
  let action: { anim: 'eat' | 'play' | 'sleep'; until: number } | null = null;
  let lastStage: Stage | null = null;
  let lastToken: bigint | null = null;

  /* ------------------------------------------------------------ piezas */

  const chainBar = createChainBar(() => { hub.salir(); options.onExit(); }, () => hub.limpiarMensajes(), FAUCET_URL);

  const connect = createConnectScreen({
    host: () => void hub.conectarHost(),
    wallet: (id) => {
      const wallet = hub.getState().wallets.find((w) => w.id === id);
      if (wallet) void hub.conectar(wallet);
    },
    retry: () => void hub.buscarWallets(),
    back: () => { hub.salir(); options.onExit(); },
  });
  const nameScreen = createChainNameScreen((name) => { hub.elegirNombre(name); }, () => hub.volver(), validateChainName);
  const species = createChainSpeciesScreen((petId) => void hub.adoptar(petId), () => hub.volver());

  /** Lanza la animación breve de un cuidado que ya entró en la cadena. */
  const react = (anim: 'eat' | 'play' | 'sleep', icon: string) => {
    action = { anim, until: Date.now() + ACTION_MS };
    scene?.react(icon, anim === 'eat' ? 'eat' : 'play');
    window.setTimeout(render, ACTION_MS + 20);
    render();
  };

  /** Envía un cuidado; si se firmó y entró, anima y muestra el mensaje. */
  const care = async (accion: Accion, ok: () => void) => {
    if (await hub.cuidar(accion)) ok();
    else render();
  };

  const game = createGameScreen({
    feed: () => feedMenu.open(),
    play: () => void care('jugar', () => { react('play', '🎾'); game.say('¡Se divirtió muchísimo jugando contigo!'); }),
    sleep: () => void care('dormir', () => { react('sleep', '🌙'); game.say('Durmió una siesta y recuperó energía.'); }),
    wake: () => {},
    bath: () => {
      bathing = true;
      bathProgress = 0;
      scene?.resetBath();
      game.say('¡Hora del baño! Al salir firmas el baño.');
      render();
    },
    exitBath: () => {
      const progress = bathProgress;
      bathing = false;
      bathProgress = 0;
      scene?.resetBath();
      if (progress === 0) { game.say('Salió del baño sin enjabonarse.'); render(); return; }
      void care('banar', () => game.say(progress < 50 ? 'Le faltó un poco de jabón, pero quedó más limpio.' : '¡Quedó reluciente!'));
    },
    rename: () => { const m = hub.getState().mascota; if (m) renameDialog.open(m.nombre); },
    ranking: () => rankingDialog.open(),
    restart: () => { hub.salir(); options.onNewGame(); },
  }, { note: { text: 'Tu mascota es un NFT en Polkadot Hub.', detail: 'Cada cuidado es una transacción que tú firmas.' } });

  const feedMenu = createFeedMenu((itemId) => {
    const item = findItem(itemId);
    void care('alimentar', () => {
      react('eat', item?.icon ?? '🍓');
      game.say(`¡Qué rico! Le diste ${item?.label.toLowerCase() ?? 'de comer'}.`);
    });
  });

  const renameDialog = createRenameDialog((name) => void hub.renombrar(name), validateChainName);

  const ranking: RankingSource = {
    async getTop() {
      const rows = ordenarRanking(await leerRanking(), hub.getState().cuenta, 10);
      return rows.map((row) => ({
        id: String(row.tokenId),
        petName: row.viva ? row.nombre : `${row.nombre} 🕊️`,
        petId: petIdOf(row),
        aliveMs: row.duracion * 1000,
        isMine: row.mia,
      }));
    },
  };
  const rankingDialog = createRankingDialog(ranking, undefined, 'Las 10 mascotas que más tiempo han vivido, leídas del contrato.');

  const screens = { conectar: connect.root, nombre: nameScreen.root, especie: species.root, juego: game.root } as const;
  app.replaceChildren(chainBar.bar, chainBar.banner, ...Object.values(screens));

  /* ------------------------------------------------------------ pintar */

  function renderGame(s: HubState) {
    if (!s.mascota) return;
    scene ??= createPetScene(game.gameHost, (progress) => { bathProgress = progress; render(); });
    const m = mascotaAhora(s.mascota, (performance.now() - s.leidaEn) / 1000);
    const now = Date.now();
    if (action && now >= action.until) action = null;
    if (!m.viva) bathing = false;

    useTheme(petIdOf(m));
    scene.setRoomColors(theme.room);
    const stage = growthStage(m);
    if (lastToken !== m.tokenId) { lastToken = m.tokenId; lastStage = stage; }
    const grown = lastStage ? detectStageChange(lastStage, stage) : null;
    if (grown && m.viva) game.showToast(`¡${m.nombre} creció a ${STAGE_LABEL[grown].toLowerCase()}!`);
    lastStage = stage;

    const diag = diagnosticar(m);
    const low = [m.hambre, m.sed, m.energia, m.felicidad, m.limpieza].some((v) => v < LOW);
    const anim: PetAnim = !m.viva ? 'dead' : bathing ? 'bath' : action ? action.anim : low || m.etapa === Etapa.Enferma ? 'sad' : 'idle';
    const mode: GameMode = !m.viva ? 'dead' : bathing ? 'bath' : 'normal';
    const mood = !m.viva ? { icon: '🕊️', text: 'Descansa en paz.' }
      : bathing ? { icon: '🫧', text: '¡Burbujas por todas partes!' }
      : action?.anim === 'eat' ? { icon: '😋', text: '¡Ñam, ñam!' }
      : action?.anim === 'play' ? { icon: '😄', text: '¡Otra vez, otra vez!' }
      : action?.anim === 'sleep' ? { icon: '☾', text: 'Zzz… está soñando.' }
      : diag.urgencia === 'bien' ? { icon: '☺', text: '¡Qué bonito día!' } : { icon: '☹', text: diag.mensaje };

    game.update({
      name: m.nombre,
      stageLabel: `${STAGE_LABEL[stage]} · Nv ${m.nivel}`,
      ageLabel: formatDuration(m.duracion * 1000),
      stats: { health: m.vida, hunger: m.hambre, thirst: m.sed, energy: m.energia, happiness: m.felicidad, cleanliness: m.limpieza },
      mode,
      bathProgress,
      mood,
      busy: s.ocupado !== null || action !== null,
    });
    scene.show({ petId: petIdOf(m), stage, anim });
  }

  function render(s: HubState = hub.getState()) {
    // La pantalla de inicio del modo NFT no se usa: se entra directo a vincular la cuenta
    // (salvo que el paso de adopción ya trajo la cuenta conectada).
    if (s.pantalla === 'inicio') { if (!entering) hub.empezar(); return; }
    // Sin mascota que seguir (o se pidió otra): el nombre y el animal se eligen en el flujo normal.
    if (s.pantalla === 'nombre' || s.pantalla === 'especie') { options.onNewGame(); return; }
    for (const [name, root] of Object.entries(screens)) root.hidden = name !== s.pantalla;

    const evm = s.firmante?.tipo === 'evm';
    chainBar.sync({
      account: s.cuenta ? `${s.firmante?.nombre ?? 'Wallet'} · ${acortarDireccion(s.cuenta)}` : null,
      balance: evm && s.saldo !== null ? `${Number(formatEther(s.saldo)).toFixed(2)} ${NATIVE_SYMBOL}` : null,
      showFaucet: evm && s.saldo !== null && s.saldo < 10n ** 16n,
      busy: s.ocupado,
      error: s.error,
      notice: s.aviso,
      signHint: s.firmante?.tipo === 'host' || s.enHost ? 'Aprueba la firma en tu teléfono.' : 'Revisa tu wallet si te pide firmar.',
    });

    const busy = s.ocupado !== null;
    connect.sync({
      inHost: s.enHost,
      searching: s.buscandoWallets,
      wallets: s.wallets.map((w) => ({ id: w.id, name: w.nombre, icon: w.icono })),
      suggested: WALLETS_SUGERIDAS.map((w) => ({ name: w.nombre, url: w.url })),
      busy,
    });
    species.sync(s.nombreNuevo, busy, s.numEspecies);
    if (s.pantalla === 'juego') renderGame(s);
  }

  hub.seguir(options.tokenId);
  let entering = options.firmante !== undefined;
  let lastScreen: HubState['pantalla'] | null = null;
  hub.subscribe((s) => {
    if (s.pantalla === 'nombre' && lastScreen !== 'nombre') nameScreen.focus(s.nombreNuevo);
    if (s.pantalla === 'juego' && lastScreen !== 'juego') { bathing = false; action = null; game.say(`${s.mascota?.nombre ?? 'Tu mascota'} te está esperando.`); }
    lastScreen = s.pantalla;
    render(s);
  });
  window.setInterval(() => { if (hub.getState().pantalla === 'juego') render(); }, 1000);
  if (options.firmante) void hub.entrarCon(options.firmante, options.tokenId).finally(() => { entering = false; });
}
