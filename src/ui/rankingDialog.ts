import { findPet } from '../game/catalog.ts';
import type { RankingSource } from '../game/ranking.ts';
import { createDialog, h } from './dom.ts';
import { formatDuration } from './format.ts';

/** Ranking por tiempo vivido. Muestra carga, vacío y error; la fila propia va resaltada. */
export function createRankingDialog(source: RankingSource, subtitle = 'Mascotas que más tiempo han vivido. Datos de ejemplo.') {
  const { dialog, body } = createDialog('Ranking', 'ranking-dialog');
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const list = h('ol', { class: 'ranking-list' });
  body.append(h('p', { class: 'hint' }, subtitle), status, list);
  let request = 0;

  async function load() {
    const id = ++request;
    status.textContent = 'Cargando…';
    list.replaceChildren();
    try {
      const entries = await source.getTop();
      if (id !== request) return;
      status.textContent = entries.length ? '' : 'Todavía no hay mascotas en el ranking.';
      list.replaceChildren(...entries.map((entry, index) =>
        h('li', { class: entry.isMine ? 'mine' : '', 'aria-current': entry.isMine ? 'true' : undefined },
          h('span', { class: 'rank' }, `${index + 1}`),
          h('b', {}, entry.petName, entry.isMine ? h('small', {}, ' (tú)') : null),
          h('span', { class: 'species' }, findPet(entry.petId)?.label ?? ''),
          h('span', { class: 'time' }, formatDuration(entry.aliveMs)))));
    } catch {
      if (id === request) status.textContent = 'No se pudo cargar el ranking. Intenta de nuevo.';
    }
  }

  return {
    open() { dialog.showModal(); void load(); },
  };
}
