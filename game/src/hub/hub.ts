/*
 * Hub: estado de la partida y única pieza que habla con la red y la wallet.
 * La UI se suscribe, pinta según `pantalla` y llama a las acciones.
 *
 * Flujo: inicio → conectar → nombre → especie → juego (+ modales de nombre y ranking).
 * Si la cuenta ya tiene una mascota viva, "conectar" lleva directo al juego.
 *
 * Dos formas de firmar (contract/pets.ts, `Firmante`):
 *  - dentro de Polkadot Desktop o la Polkadot App: el Host (contract/host.ts);
 *  - en un navegador normal: una wallet EVM (MetaMask, Talisman…).
 *
 * Invariantes:
 *  - una operación con la wallet a la vez (`ocupado`);
 *  - cada escritura se simula antes de pedir la firma (contract/pets.ts);
 *  - después de cada escritura se relee la mascota de la cadena.
 */
import type { Address } from "viem";
import { RELECTURA_MS } from "../contract/config";
import { conectarHost, dentroDelHost, type SesionHost } from "../contract/host";
import * as red from "../contract/pets";
import { nombreValido, type Accion, type Mascota } from "../contract/polkapets";
import { descubrirWallets, type WalletInfo } from "../contract/wallets";
import { mensajeError } from "../lib/txErrors";

export type Pantalla = "inicio" | "conectar" | "nombre" | "especie" | "juego";

export interface HubState {
  pantalla: Pantalla;
  /** null mientras se comprueba; true dentro de Polkadot Desktop o la Polkadot App. */
  enHost: boolean | null;
  wallets: WalletInfo[];
  buscandoWallets: boolean;
  firmante: red.Firmante | null;
  cuenta: Address | null;
  saldo: bigint | null;
  numEspecies: number;
  /** Nombre elegido en la pantalla "nombre", mientras se elige la especie. */
  nombreNuevo: string;
  mascota: Mascota | null;
  /** performance.now() del momento en que se leyó `mascota` (la UI simula desde ahí). */
  leidaEn: number;
  /** Texto de la operación en curso, o null. */
  ocupado: string | null;
  error: string | null;
  aviso: string | null;
}

export interface Hub {
  getState(): HubState;
  subscribe(fn: (s: HubState) => void): () => void;
  empezar(): void;
  buscarWallets(): Promise<void>;
  conectar(wallet: WalletInfo): Promise<void>;
  conectarHost(): Promise<void>;
  elegirNombre(nombre: string): boolean;
  adoptar(especie: number): Promise<void>;
  cuidar(accion: Accion): Promise<boolean>;
  renombrar(nombre: string): Promise<boolean>;
  nuevaPartida(): void;
  volver(): void;
  salir(): void;
  limpiarMensajes(): void;
}

const TEXTO_ACCION: Record<Accion, string> = {
  alimentar: "Dando de comer y beber…",
  jugar: "Jugando…",
  dormir: "Durmiendo…",
  banar: "Bañando…",
};

export function createHub(): Hub {
  let state: HubState = {
    pantalla: "inicio",
    enHost: null,
    wallets: [],
    buscandoWallets: false,
    firmante: null,
    cuenta: null,
    saldo: null,
    numEspecies: 1,
    nombreNuevo: "",
    mascota: null,
    leidaEn: 0,
    ocupado: null,
    error: null,
    aviso: null,
  };
  const listeners = new Set<(s: HubState) => void>();
  let relectura: ReturnType<typeof setInterval> | null = null;
  let desuscribirWallet: (() => void) | null = null;
  /** La sesión del Host se reutiliza: volver a conectar no vuelve a pedir permisos. */
  let sesionHost: SesionHost | null = null;

  const set = (patch: Partial<HubState>) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn(state);
  };

  /** Ejecuta una operación con la wallet, mostrando `texto` y capturando el error. */
  async function operar(texto: string, fn: () => Promise<void>): Promise<boolean> {
    if (state.ocupado) return false;
    set({ ocupado: texto, error: null, aviso: null });
    try {
      await fn();
      set({ ocupado: null });
      return true;
    } catch (e) {
      console.warn("[polkapets]", e);
      set({ ocupado: null, error: mensajeError(e) });
      return false;
    }
  }

  async function releer(): Promise<void> {
    const m = state.mascota;
    if (!m) return;
    const actual = await red.verMascota(m.tokenId);
    // Si mientras tanto se cambió de mascota, se descarta la lectura.
    if (state.mascota?.tokenId === m.tokenId) set({ mascota: actual, leidaEn: performance.now() });
  }

  async function actualizarSaldo(): Promise<void> {
    // Dentro del Host el gas es PGAS y lo da el permiso de gas: el saldo de PAS no aplica.
    if (!state.cuenta || state.firmante?.tipo !== "evm") return;
    try {
      set({ saldo: await red.saldo(state.cuenta) });
    } catch {
      /* el saldo es informativo */
    }
  }

  function arrancarRelectura(): void {
    pararRelectura();
    relectura = setInterval(() => {
      if (state.pantalla === "juego" && !state.ocupado && state.mascota?.viva) {
        releer().catch((e) => console.warn("[polkapets] relectura", e));
      }
    }, RELECTURA_MS);
  }

  function pararRelectura(): void {
    if (relectura) clearInterval(relectura);
    relectura = null;
  }

  function mostrarMascota(m: Mascota): void {
    set({ mascota: m, leidaEn: performance.now(), pantalla: "juego" });
    arrancarRelectura();
  }

  /** Con la cuenta lista: busca su mascota viva o pasa a elegir nombre. */
  async function entrar(firmante: red.Firmante): Promise<void> {
    // El contrato EVM desplegado solo admite el ajolote; una versión nueva puede admitir cinco.
    const numEspecies = await red.numEspecies();
    set({ firmante, cuenta: firmante.cuenta, numEspecies });
    void actualizarSaldo();
    const mascotas = await red.cargarMascotas(firmante.cuenta);
    const viva = mascotas.find((m) => m.viva);
    if (viva) {
      mostrarMascota(viva);
      set({ aviso: `¡Hola de nuevo! ${viva.nombre} te estaba esperando.` });
    } else {
      set({ pantalla: "nombre", nombreNuevo: "" });
    }
  }

  /** Si la wallet cambia de cuenta o se desconecta, la partida vuelve al inicio. */
  function vigilarWallet(w: WalletInfo): void {
    desuscribirWallet?.();
    const alCambiar = (...args: unknown[]) => {
      const cuentas = args[0] as string[] | undefined;
      if (!cuentas?.length || cuentas[0].toLowerCase() !== state.cuenta?.toLowerCase()) {
        hub.salir();
        set({ aviso: "Cambiaste de cuenta en la wallet. Vuelve a conectar." });
      }
    };
    w.provider.on?.("accountsChanged", alCambiar);
    desuscribirWallet = () => w.provider.removeListener?.("accountsChanged", alCambiar);
  }

  const hub: Hub = {
    getState: () => state,

    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },

    empezar() {
      set({ pantalla: "conectar", error: null, aviso: null });
      void hub.buscarWallets();
    },

    async buscarWallets() {
      set({ buscandoWallets: true });
      const enHost = await dentroDelHost();
      // Dentro del Host no hay extensiones de navegador: la cuenta la da el Host.
      const wallets = enHost ? [] : await descubrirWallets();
      set({ enHost, wallets, buscandoWallets: false });
    },

    async conectar(wallet) {
      await operar(`Conectando con ${wallet.nombre}…`, async () => {
        const cuenta = await red.conectar(wallet.provider);
        vigilarWallet(wallet);
        await entrar(red.firmanteEvm(wallet.nombre, wallet.provider, cuenta));
      });
    },

    async conectarHost() {
      await operar("Conectando con la Polkadot App… Acepta los permisos en tu teléfono.", async () => {
        sesionHost ??= await conectarHost();
        await entrar(red.firmanteHost(sesionHost));
      });
    },

    elegirNombre(nombre) {
      if (!nombreValido(nombre)) {
        set({ error: "El nombre debe tener entre 1 y 24 caracteres." });
        return false;
      }
      set({ nombreNuevo: nombre.trim(), pantalla: "especie", error: null });
      return true;
    },

    async adoptar(especie) {
      const { firmante, nombreNuevo } = state;
      if (!firmante) return hub.salir();
      if (!Number.isInteger(especie) || especie < 0 || especie >= state.numEspecies) {
        set({ error: "Este contrato aún no admite esa especie como NFT." });
        return;
      }
      await operar(`Adoptando a ${nombreNuevo}…`, async () => {
        const id = await red.adoptar(firmante, nombreNuevo, especie);
        mostrarMascota(await red.verMascota(id));
        set({ aviso: `¡${nombreNuevo} llegó a casa! Cuídala para que dure mucho.` });
        void actualizarSaldo();
      });
    },

    async cuidar(accion) {
      const { firmante, mascota } = state;
      if (!firmante || !mascota) return false;
      return operar(TEXTO_ACCION[accion], async () => {
        await red.cuidar(firmante, accion, mascota.tokenId);
        await releer();
        void actualizarSaldo();
      });
    },

    async renombrar(nombre) {
      const { firmante, mascota } = state;
      if (!firmante || !mascota) return false;
      if (!nombreValido(nombre)) {
        set({ error: "El nombre debe tener entre 1 y 24 caracteres." });
        return false;
      }
      return operar("Cambiando el nombre…", async () => {
        await red.cambiarNombre(firmante, mascota.tokenId, nombre);
        await releer();
        set({ aviso: `Ahora se llama ${nombre.trim()}.` });
        void actualizarSaldo();
      });
    },

    nuevaPartida() {
      pararRelectura();
      set({ pantalla: "nombre", mascota: null, nombreNuevo: "", error: null, aviso: null });
    },

    volver() {
      if (state.ocupado) return;
      const atras: Partial<Record<Pantalla, Pantalla>> = { conectar: "inicio", nombre: "conectar", especie: "nombre" };
      const destino = atras[state.pantalla];
      if (destino) set({ pantalla: destino, error: null });
    },

    salir() {
      pararRelectura();
      desuscribirWallet?.();
      desuscribirWallet = null;
      set({
        pantalla: "inicio",
        firmante: null,
        cuenta: null,
        saldo: null,
        numEspecies: 1,
        mascota: null,
        nombreNuevo: "",
        ocupado: null,
        error: null,
        aviso: null,
      });
    },

    limpiarMensajes() {
      if (state.error || state.aviso) set({ error: null, aviso: null });
    },
  };

  return hub;
}

/** Ranking, separado del hub porque se puede abrir sin cuenta. */
export { leerRanking } from "../contract/pets";
