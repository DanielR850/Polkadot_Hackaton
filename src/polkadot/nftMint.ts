// Adaptador del mint del NFT para el juego local. Es la única firma del juego: adoptar.
// Los cuidados siguen siendo locales y gratis. Reutiliza el cliente de src/contract:
// dentro de Polkadot Desktop o la Polkadot App firma el Host; en un navegador, una wallet EVM.
import { EXPLORER_URL, PETS_ADDRESS } from '../contract/config.ts';
import { conectarHost, dentroDelHost } from '../contract/host.ts';
import { adoptar, cambiarNombre, conectar, cuidar, firmanteEvm, firmanteHost, numEspecies, versionPets, type Firmante, type PasoTx } from '../contract/pets.ts';
import { descubrirWallets, WALLETS_SUGERIDAS, type WalletInfo } from '../contract/wallets.ts';
import { mensajeError } from '../lib/txErrors.ts';
import {
  cambiarIntervaloDrop, comprarArticulo, errorItems, itemsActivo, leerAdminItems, leerDespensa, leerDropsDisponibles, reclamarDropMascota,
  reclamarLogroMascota, sellarLegadoMascota, usarComida, versionItems,
} from '../contract/items.ts';
import {
  cerrarTemporada, errorTemporadas, leerAdminTemporadas, leerCampeones, leerRegistros, leerTemporada, pausarTemporadas, registrarEnTemporada,
  semanasSinCerrar, temporadasActivas, yaRegistradaTemporada, type RegistroTemporada, type Temporada,
} from '../contract/temporadas.ts';
import { errorRanking, leerLeaderboard, rankingActivo, registrarPartida, yaRegistrada, type FilaLeaderboard, type Partida } from '../contract/ranking.ts';

export type { FilaLeaderboard, Partida, RegistroTemporada, Temporada };

/** Qué versión de cada contrato está desplegada (para mostrar u ocultar lo nuevo). */
export interface ChainVersions { pets: number; items: number; seasons: boolean }

/** Datos de la pantalla de administración. */
export interface AdminInfo {
  versions: ChainVersions;
  season: Temporada | null;
  seasonsOwner: string | null;
  seasonStart: number | null;
  openDays: number | null;
  itemsOwner: string | null;
  dropInterval: number | null;
  pendingClose: number[];
}

export type MintStep = PasoTx;
/** Funciones de cuidado del contrato PolkaPets. */
export type CareAction = 'alimentar' | 'jugar' | 'dormir' | 'banar';

export interface MintWallet { id: string; name: string; icon: string | null }

export interface MintAccount {
  /** Dónde se firma: "Polkadot App" o el nombre de la wallet. */
  via: string;
  address: string;
  inHost: boolean;
  /** Especies que acepta el contrato desplegado (ids 0..n-1). */
  species: number;
}

export interface NftMinter {
  /** true dentro de Polkadot Desktop o la Polkadot App. */
  inHost(): Promise<boolean>;
  wallets(): Promise<MintWallet[]>;
  suggested: ReadonlyArray<{ name: string; url: string }>;
  /** walletId null = conectar con el Host. */
  connect(walletId: string | null): Promise<MintAccount>;
  /**
   * Firma la adopción y devuelve el tokenId. Si el contrato no admite la especie, usa la 0.
   * Con PolkaPets v2 también firma la dificultad (horas) y el modo (Pacífico o Competencia).
   */
  mint(name: string, petId: number, onStep?: (step: MintStep) => void, options?: { lifeHours: 1 | 7 | 12; peaceful: boolean; variantIndex?: number }): Promise<bigint>;
  versions(): Promise<ChainVersions>;
  /** Temporada de Competencia en curso (v2), o null si no hay contrato de temporadas. */
  season(): Promise<Temporada | null>;
  seasonRows(week: number): Promise<RegistroTemporada[]>;
  champions(): Promise<Array<{ semana: number; podio: RegistroTemporada[] }>>;
  isSeasonRecorded(tokenId: bigint): Promise<boolean>;
  /** Firma el registro en la temporada (la duración la calcula la cadena). */
  recordSeason(tokenId: bigint, onStep?: (step: MintStep) => void): Promise<void>;
  closeSeason(week: number, onStep?: (step: MintStep) => void): Promise<void>;
  /** Comida NFT sin usar de la mascota. */
  pantry(tokenId: bigint): Promise<Array<{ tokenId: bigint; articulo: number }>>;
  useFood(foodTokenId: bigint, onStep?: (step: MintStep) => void): Promise<void>;
  dropsAvailable(tokenId: bigint): Promise<number>;
  claimDrop(tokenId: bigint, onStep?: (step: MintStep) => void): Promise<{ tokenId: bigint; articulo: number } | null>;
  admin(): Promise<AdminInfo>;
  setSeasonPaused(paused: boolean, onStep?: (step: MintStep) => void): Promise<void>;
  setDropInterval(seconds: number, onStep?: (step: MintStep) => void): Promise<void>;
  /** Página del NFT en Blockscout. */
  nftUrl(tokenId: bigint | string): string;
  /** Cuenta conectada, o null. */
  account(): MintAccount | null;
  /** true si hay contrato de ranking: al morir se puede registrar la partida. */
  rankingEnabled(): boolean;
  isRecorded(tokenId: bigint): Promise<boolean>;
  /** Firma el registro de la partida en el leaderboard. */
  record(partida: Partida, onStep?: (step: MintStep) => void): Promise<void>;
  leaderboard(): Promise<FilaLeaderboard[]>;
  /**
   * Firma un cuidado del NFT. Primero lo simula: si el contrato lo rechazaría, lanza el error sin
   * abrir la wallet (no se paga nada). Resuelve solo cuando la transacción se confirmó con éxito.
   */
  care(tokenId: bigint, action: CareAction, onStep?: (step: MintStep) => void): Promise<void>;
  /** Igual que care, para cambiar el nombre del NFT. */
  rename(tokenId: bigint, name: string, onStep?: (step: MintStep) => void): Promise<void>;
  /** true si hay contrato de objetos: las compras de la tienda son NFT ligados a la mascota. */
  itemsEnabled(): boolean;
  /** Firma la compra de un objeto (id del catálogo del contrato) para la mascota 	okenId. */
  buyItem(tokenId: bigint, articleId: number, onStep?: (step: MintStep) => void): Promise<void>;
  /** Firma el reclamo de un trofeo (id de logro del contrato) para la mascota `tokenId`. */
  claimAchievement(tokenId: bigint, achievementId: number, onStep?: (step: MintStep) => void): Promise<void>;
  /** Firma el legado de la mascota muerta: cuánto vivió y qué tenía puesto (el contrato valida las reglas). */
  saveLegacy(tokenId: bigint, durationSec: number, equipped: readonly number[], onStep?: (step: MintStep) => void): Promise<void>;
  /** Texto corto en español para cualquier error de wallet, red o contrato. */
  explain(error: unknown): string;
}

export function createNftMinter(): NftMinter {
  let found: WalletInfo[] = [];
  let signer: Firmante | null = null;
  let species = 1;
  let current: MintAccount | null = null;

  return {
    inHost: () => dentroDelHost(),

    async wallets() {
      found = await descubrirWallets();
      return found.map((w) => ({ id: w.id, name: w.nombre, icon: w.icono }));
    },

    suggested: WALLETS_SUGERIDAS.map((w) => ({ name: w.nombre, url: w.url })),

    async connect(walletId) {
      if (walletId === null) {
        signer = firmanteHost(await conectarHost());
      } else {
        const wallet = found.find((w) => w.id === walletId);
        if (!wallet) throw new Error('Esa wallet ya no está disponible. Busca de nuevo.');
        signer = firmanteEvm(wallet.nombre, wallet.provider, await conectar(wallet.provider));
      }
      species = await numEspecies();
      current = { via: signer.nombre, address: signer.cuenta, inHost: signer.tipo === 'host', species };
      return current;
    },

    account: () => current,
    rankingEnabled: () => rankingActivo(),
    isRecorded: (tokenId) => yaRegistrada(tokenId),
    async record(partida, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await registrarPartida(signer, partida, onStep);
    },
    leaderboard: () => leerLeaderboard(),
    async care(tokenId, action, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await cuidar(signer, action, tokenId, onStep);
    },
    itemsEnabled: () => itemsActivo(),
    async buyItem(tokenId, articleId, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await comprarArticulo(signer, tokenId, articleId, onStep);
    },
    async claimAchievement(tokenId, achievementId, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await reclamarLogroMascota(signer, tokenId, achievementId, onStep);
    },
    async saveLegacy(tokenId, durationSec, equipped, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await sellarLegadoMascota(signer, tokenId, durationSec, equipped, onStep);
    },
    async rename(tokenId, name, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await cambiarNombre(signer, tokenId, name, onStep);
    },

    async mint(name, petId, onStep, options) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      if (options) {
        return adoptar(signer, name, petId < species ? petId : 0, onStep, { horas: options.lifeHours, modo: options.peaceful ? 0 : 1, variante: options.variantIndex });
      }
      // Comodín: el contrato desplegado solo admite la especie 0 (NUM_ESPECIES = 1). Si la especie
      // elegida no cabe, el NFT se registra como especie 0 y el juego sigue mostrando el animal
      // elegido (vive en la partida local). Con un contrato de 5 especies se usa la especie real.
      return adoptar(signer, name, petId < species ? petId : 0, onStep);
    },

    nftUrl: (tokenId) => `${EXPLORER_URL}/token/${PETS_ADDRESS}/instance/${tokenId}`,

    async versions() {
      const [pets, items] = await Promise.all([versionPets(), versionItems()]);
      return { pets, items, seasons: temporadasActivas() };
    },
    season: () => leerTemporada(),
    seasonRows: (week) => leerRegistros(week),
    champions: () => leerCampeones(),
    isSeasonRecorded: (tokenId) => yaRegistradaTemporada(tokenId),
    async recordSeason(tokenId, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await registrarEnTemporada(signer, tokenId, onStep);
    },
    async closeSeason(week, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await cerrarTemporada(signer, week, onStep);
    },
    pantry: (tokenId) => leerDespensa(tokenId),
    async useFood(foodTokenId, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await usarComida(signer, foodTokenId, onStep);
    },
    dropsAvailable: (tokenId) => leerDropsDisponibles(tokenId),
    async claimDrop(tokenId, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      return reclamarDropMascota(signer, tokenId, onStep);
    },
    async admin() {
      const versions = await this.versions();
      const [season, temporadas, items] = await Promise.all([leerTemporada(), leerAdminTemporadas(), leerAdminItems()]);
      const pendingClose = season ? await semanasSinCerrar(season.semana, season.abierta) : [];
      return {
        versions, season, pendingClose,
        seasonsOwner: temporadas?.owner ?? null, seasonStart: temporadas?.inicio ?? null, openDays: temporadas?.diasAbierta ?? null,
        itemsOwner: items?.owner ?? null, dropInterval: items?.intervaloDrop ?? null,
      };
    },
    async setSeasonPaused(paused, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await pausarTemporadas(signer, paused, onStep);
    },
    async setDropInterval(seconds, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      await cambiarIntervaloDrop(signer, seconds, onStep);
    },
    explain: (error) => errorTemporadas(error) ?? errorItems(error) ?? errorRanking(error) ?? mensajeError(error),
  };
}
