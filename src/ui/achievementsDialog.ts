// Ventana de trofeos: la colección de logros de la mascota. Solo muestra y devuelve intenciones;
// reclamar (y firmar, si hay NFT) lo hace el controlador.
import type { AchievementDef, AchievementState } from '../game/achievements.ts';
import { createDialog, h } from './dom.ts';

export interface AchievementRow {
  def: AchievementDef;
  state: AchievementState;
  /** Qué da al reclamarlo: pesitos y, a veces, un accesorio. */
  reward: string;
}

export interface AchievementsView {
  rows: readonly AchievementRow[];
  /** Resumen de la colección: "3 de 9 trofeos · 5 objetos". */
  summary: string;
  /** Si reclamar pide firma: false cuando no se puede firmar ahora (murió, o hay otra firma). */
  canClaim: boolean;
  /** Explica por qué no se puede reclamar, si aplica. */
  note: string;
  /** Con NFT, el botón dice "Reclamar NFT"; sin él, los logros se ganan solos. */
  asNft: boolean;
}

export interface AchievementsIntents {
  claim(id: number): void;
}

const STATE_ICON: Record<AchievementState, string> = { locked: '🔒', available: '⭐', claimed: '✅' };

export function createAchievementsDialog(intents: AchievementsIntents) {
  const { dialog, body } = createDialog('Trofeos', 'inventory-dialog');
  const summary = h('p', { class: 'shop-wallet' });
  const note = h('p', { class: 'hint' });
  const list = h('ul', { class: 'ranking-list achievement-list' });
  body.append(summary, note, list);

  return {
    open() { if (!dialog.open) dialog.showModal(); },
    close() { if (dialog.open) dialog.close(); },
    isOpen: () => dialog.open,
    render(view: AchievementsView) {
      summary.textContent = view.summary;
      note.textContent = view.note;
      list.replaceChildren(...view.rows.map(({ def, state, reward }) => {
        const item = h('li', { class: `achievement achievement-${state}` },
          h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, state === 'locked' ? '🔒' : def.icon),
          h('span', {}, h('b', {}, def.name), h('small', {}, def.description), h('small', { class: 'item-bonus' }, `Premio: ${reward}`)),
          h('span', { class: 'achievement-state', role: 'img', 'aria-label': state === 'locked' ? 'Bloqueado' : state === 'claimed' ? 'Conseguido' : 'Disponible' },
            STATE_ICON[state]));
        if (state === 'available' && view.asNft) {
          const claim = h('button', { type: 'button', class: 'primary' }, 'Reclamar NFT');
          claim.disabled = !view.canClaim;
          claim.addEventListener('click', () => intents.claim(def.id));
          item.append(claim);
        }
        return item;
      }));
    },
  };
}
