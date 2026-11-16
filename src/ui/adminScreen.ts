// Pantalla de administración (`?admin=1`): estado de los contratos, temporada de Competencia,
// drops y acciones del dueño de los contratos. Solo muestra y devuelve intenciones.
import { h } from './dom.ts';
import { formatDuration } from './format.ts';

export interface AdminView {
  network: string;
  addresses: ReadonlyArray<{ label: string; address: string | null; version?: string }>;
  totalPets: number | null;
  season: { week: number; open: boolean; paused: boolean; opensAt: number; closesAt: number; registered: number } | null;
  seasonsOwner: string | null;
  itemsOwner: string | null;
  dropIntervalSec: number | null;
  pendingClose: readonly number[];
  account: string | null;
  wallets: ReadonlyArray<{ id: string; name: string }>;
  inHost: boolean;
  busy: string | null;
  message: string | null;
}

export interface AdminIntents {
  connect(walletId: string | null): void;
  refresh(): void;
  pause(paused: boolean): void;
  closeWeek(week: number): void;
  setDropInterval(minutes: number): void;
  exit(): void;
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const same = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function createAdminScreen(intents: AdminIntents) {
  const body = h('div', { class: 'admin-body' });
  /** Minutos que la persona está escribiendo: un refresco del panel no debe borrarlos. */
  let draftMinutes: string | null = null;
  const root = h('section', { class: 'screen select-screen admin-screen', 'aria-label': 'Administración' },
    h('span', { class: 'eyebrow' }, 'POLKAPETS · ADMIN'), h('h1', { class: 'title' }, 'Panel de administración'), body);

  const btn = (label: string, cls: string, onClick: () => void, disabled = false) => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  };

  function sync(v: AdminView) {
    const busy = v.busy !== null;
    const ownsSeasons = same(v.account, v.seasonsOwner);
    const ownsItems = same(v.account, v.itemsOwner);
    const minutes = h('input', { type: 'number', min: 1, step: 1, value: draftMinutes ?? (v.dropIntervalSec ? Math.round(v.dropIntervalSec / 60) : 30), 'aria-label': 'Minutos por drop' });
    minutes.addEventListener('input', () => { draftMinutes = minutes.value; });
    const now = Date.now();
    body.replaceChildren(
      ...(v.message ? [h('div', { class: 'mint-error', role: 'alert' }, h('span', { 'aria-hidden': 'true' }, 'ℹ️'), h('p', {}, v.message))] : []),
      ...(busy ? [h('p', { class: 'hint', role: 'status' }, v.busy)] : []),

      h('div', { class: 'mint-card admin-card' },
        h('b', {}, 'Cuenta'),
        v.account
          ? h('p', {}, `Conectada: ${short(v.account)}`, ownsSeasons || ownsItems ? ' · administradora ✓' : ' · no es la administradora (solo lectura)')
          : h('div', { class: 'chain-options' },
            ...(v.inHost ? [btn('Conectar con la Polkadot App', 'primary', () => intents.connect(null), busy)] : []),
            ...v.wallets.map((w) => btn(`Conectar ${w.name}`, 'ghost', () => intents.connect(w.id), busy)),
            ...(!v.inHost && v.wallets.length === 0 ? [h('p', { class: 'hint' }, 'No hay wallet en este navegador. Puedes ver los datos sin conectar.')] : []))),

      h('div', { class: 'mint-card admin-card' },
        h('b', {}, `Contratos · ${v.network}`),
        h('ul', { class: 'admin-list' }, ...v.addresses.map((a) => h('li', {}, h('span', {}, a.label),
          h('code', {}, a.address ? short(a.address) : 'no desplegado'), a.version ? h('small', {}, a.version) : null))),
        h('p', { class: 'hint' }, v.totalPets === null ? '' : `Mascotas adoptadas en total: ${v.totalPets}`)),

      h('div', { class: 'mint-card admin-card' },
        h('b', {}, 'Competencia semanal'),
        v.season
          ? h('div', {},
            h('p', {}, `Temporada ${v.season.week + 1} · ${v.season.paused ? 'en pausa' : v.season.open ? 'abierta' : 'cerrada'} · ${v.season.registered} registros`),
            h('p', { class: 'hint' }, v.season.paused ? 'Los registros están detenidos hasta que los reanudes.'
              : v.season.open ? `Cierra en ${formatDuration(v.season.closesAt - now)}.`
              : `Abre en ${formatDuration(Math.max(0, v.season.opensAt + 7 * 86_400_000 - now))}.`),
            h('div', { class: 'row' },
              btn(v.season.paused ? 'Reanudar registros' : 'Pausar registros', 'ghost', () => intents.pause(!v.season!.paused), busy || !ownsSeasons),
              ...v.pendingClose.map((w) => btn(`Cerrar temporada ${w + 1} y guardar podio`, 'primary', () => intents.closeWeek(w), busy || !v.account))),
            !ownsSeasons ? h('p', { class: 'hint' }, 'Pausar solo lo puede hacer la cuenta que desplegó el contrato. Cerrar una temporada terminada lo puede hacer cualquiera.') : null)
          : h('p', { class: 'hint' }, 'El contrato de temporadas (v2) todavía no está desplegado en esta red.')),

      h('div', { class: 'mint-card admin-card' },
        h('b', {}, 'Drops'),
        v.dropIntervalSec === null
          ? h('p', { class: 'hint' }, 'El contrato de objetos v2 todavía no está desplegado en esta red. En el juego local cae un regalo cada 30 min.')
          : h('div', {},
            h('p', {}, `Un regalo cada ${formatDuration(v.dropIntervalSec * 1000)} de vida.`),
            h('div', { class: 'row' }, minutes,
              btn('Cambiar', 'ghost', () => { const value = Number(minutes.value); draftMinutes = null; intents.setDropInterval(value); }, busy || !ownsItems)))),

      h('div', { class: 'row' }, btn('Actualizar', 'ghost', intents.refresh, busy), btn('Volver al juego', 'primary', intents.exit)));
  }

  return { root, sync };
}
