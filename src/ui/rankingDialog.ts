import { findPet } from '../game/catalog.ts';
import type { RankingSource } from '../game/ranking.ts';
import { createDialog, h } from './dom.ts';
import { formatDuration } from './format.ts';

/** Ranking por tiempo vivido. Muestra carga, vacío y error; la fila propia va resaltada. */
/**
 * `onConnect`: si se pasa, muestra la invitación a vincular una cuenta (juego local).
 * `subtitle`: texto de arriba; el modo NFT pone el suyo porque sus datos vienen del contrato.
 */
export function createRankingDialog(source: RankingSource, onConnect?: () => void, subtitle = 'Estos son récords de ejemplo del juego local.') {
  const { dialog, body } = createDialog('Ranking', 'ranking-dialog');
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const list = h('ol', { class: 'ranking-list' });
  body.append(h('p', { class: 'hint' }, subtitle));
  if (onConnect) {
    const connect = h('button', { class: 'primary', type: 'button' }, 'Vincular cuenta para registrar mi récord');
    connect.addEventListener('click', () => { dialog.close(); onConnect(); });
    body.append(h('p', { class: 'hint', 'aria-live': 'polite' }, 'Vincula tu cuenta para registrar tu récord NFT en la cadena.'), connect);
  }
  body.append(status, list);
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
