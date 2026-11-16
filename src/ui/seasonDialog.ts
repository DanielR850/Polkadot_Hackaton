// Ranking del modo Competencia por temporadas semanales: estado de la semana, top por dificultad y
// salón de campeones (podio guardado de cada semana cerrada). Solo muestra y devuelve intenciones.
import { findPet } from '../game/catalog.ts';
import { createDialog, h } from './dom.ts';
import { pixelIcon } from './pixelArt.ts';
import { formatDuration } from './format.ts';

export interface SeasonRow { id: string; name: string; petId: number; hours: number; aliveMs: number; mine: boolean }

export interface SeasonData {
  week: number;
  open: boolean;
  paused: boolean;
  opensAt: number;
  closesAt: number;
  /** Registros de la semana en curso. */
  rows: readonly SeasonRow[];
  /** Podio de las semanas cerradas, de la más reciente a la más vieja. */
  champions: ReadonlyArray<{ week: number; podium: readonly SeasonRow[] }>;
  /** Semanas que terminaron y nadie cerró: se puede guardar su podio. */
  pendingClose: readonly number[];
}

export interface SeasonSource {
  load(): Promise<SeasonData>;
  /** Cierra una temporada terminada (una firma): guarda su podio y borra lo demás. */
  close?(week: number): Promise<void>;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const DIFFICULTY_TABS: ReadonlyArray<{ hours: number; label: string }> = [
  { hours: 1, label: '1 h' },
  { hours: 7, label: '7 h' },
  { hours: 12, label: '12 h' },
];

export function createSeasonDialog(source: SeasonSource) {
  const { dialog, body } = createDialog('Competencia', 'ranking-dialog season-dialog');
  const banner = h('div', { class: 'mint-card season-banner' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const list = h('ol', { class: 'ranking-list' });
  const hall = h('section', { class: 'season-hall' });
  body.append(banner, tabs, status, list, hall);

  let data: SeasonData | null = null;
  let hours = 7;
  let request = 0;
  let timer = 0;

  const tabButtons = DIFFICULTY_TABS.map((t) => {
    const b = h('button', { type: 'button', role: 'tab', title: `Dificultad de ${t.label}` }, t.label);
    b.addEventListener('click', () => { hours = t.hours; drawList(); });
    tabs.append(b);
    return { hours: t.hours, b };
  });

  const row = (r: SeasonRow, index: number) =>
    h('li', { class: r.mine ? 'mine' : '', 'aria-current': r.mine ? 'true' : undefined },
      h('span', { class: 'rank' }, MEDAL[index] ?? `${index + 1}`),
      h('b', {}, r.name, r.mine ? h('small', {}, ' (tú)') : null),
      h('span', { class: 'species' }, findPet(r.petId)?.label ?? ''),
      h('span', { class: 'time' }, formatDuration(r.aliveMs)));

  function drawBanner() {
    if (!data) return;
    const now = Date.now();
    const state = data.paused ? '⏸️ En pausa' : data.open ? '🟢 Abierta' : '🔴 Cerrada';
    const when = data.paused ? 'El administrador pausó los registros.'
      : data.open ? `Cierra en ${formatDuration(Math.max(0, data.closesAt - now))} (viernes 23:59, hora de México).`
      : `La próxima abre en ${formatDuration(Math.max(0, data.opensAt + 7 * 86_400_000 - now))} (lunes 00:00).`;
    banner.replaceChildren(
      pixelIcon('📅', 'inv-icon'),
      h('span', {}, h('b', {}, `Temporada ${data.week + 1} · ${state}`), h('small', {}, when),
        h('small', {}, 'Adopta en modo Competencia esta semana; cuando muera, registra su tiempo. Cada lunes el ranking vuelve a cero.')));
  }

  function drawList() {
    for (const t of tabButtons) t.b.setAttribute('aria-selected', String(t.hours === hours));
    if (!data) return;
    const rows = data.rows.filter((r) => r.hours === hours).sort((a, b) => b.aliveMs - a.aliveMs).slice(0, 10);
    status.textContent = rows.length ? '' : 'Todavía nadie se ha registrado en esta dificultad esta semana.';
    list.replaceChildren(...rows.map(row));
  }

  function drawHall() {
    if (!data) return;
    const pending = data.pendingClose.map((week) => {
      const b = h('button', { type: 'button', class: 'ghost' }, `Guardar podio de la temporada ${week + 1}`);
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await source.close?.(week); await load(); } catch (e) { status.textContent = e instanceof Error ? e.message : 'No se pudo cerrar.'; b.disabled = false; }
      });
      return b;
    });
    hall.replaceChildren(
      h('h3', { class: 'eyebrow' }, 'SALÓN DE CAMPEONES'),
      ...(source.close ? pending : []),
      ...(data.champions.length === 0 ? [h('p', { class: 'hint' }, 'Aún no hay temporadas cerradas.')] : data.champions.map((c) =>
        h('div', { class: 'season-week' }, h('b', {}, `Temporada ${c.week + 1}`),
          ...DIFFICULTY_TABS.map((t) => {
            const top = c.podium.filter((r) => r.hours === t.hours);
            if (top.length === 0) return null;
            return h('div', { class: 'season-podium' }, h('small', {}, t.label),
              h('ol', { class: 'ranking-list' }, ...top.map(row)));
          })))));
  }

  async function load() {
    const id = ++request;
    status.textContent = 'Cargando…';
    list.replaceChildren();
    try {
      const d = await source.load();
      if (id !== request) return;
      data = d;
      drawBanner();
      drawList();
      drawHall();
    } catch {
      if (id === request) status.textContent = 'No se pudo cargar la competencia. Intenta de nuevo.';
    }
  }

  dialog.addEventListener('close', () => { window.clearInterval(timer); timer = 0; });

  return {
    open(preferredHours?: number) {
      if (preferredHours) hours = preferredHours;
      dialog.showModal();
      void load();
      window.clearInterval(timer);
      timer = window.setInterval(drawBanner, 1000);
    },
  };
}
