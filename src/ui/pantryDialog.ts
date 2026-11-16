// Despensa: comida especial guardada (NFT o local) y regalos (drops) por tiempo de vida.
// Solo muestra y devuelve intenciones; usar y reclamar los hace el controlador.
import { describeFood, findFood, type PantryItem } from '../game/pantry.ts';
import { createDialog, h } from './dom.ts';
import { pixelIcon } from './pixelArt.ts';
import { formatDuration } from './format.ts';

export interface PantryIntents {
  use(item: PantryItem): void;
  claimDrop(): void;
}

export interface PantryView {
  items: readonly PantryItem[];
  /** Regalos listos para reclamar. */
  drops: number;
  /** Tiempo hasta el siguiente regalo, en ms; null si no aplica (mascota muerta). */
  nextDropMs: number | null;
  /** true si la comida es NFT: usarla y reclamar son firmas. */
  asNft: boolean;
  /** Mientras hay una firma o la mascota no puede comer. */
  disabledReason: string | null;
}

export function createPantryDialog(intents: PantryIntents) {
  const { dialog, body } = createDialog('🧺 Despensa', 'inventory-dialog pantry-dialog');
  const gifts = h('div', { class: 'mint-card pantry-gifts' });
  const status = h('p', { class: 'hint' });
  const grid = h('div', { class: 'item-grid inv-grid' });
  body.append(gifts, status, grid);

  function render(v: PantryView) {
    const claim = h('button', { type: 'button', class: 'primary' }, v.drops > 1 ? `Abrir regalo (${v.drops})` : 'Abrir regalo');
    claim.disabled = v.drops === 0 || v.disabledReason !== null;
    claim.addEventListener('click', intents.claimDrop);
    gifts.replaceChildren(
      pixelIcon('🎁', 'inv-icon'),
      h('span', {},
        h('b', {}, v.drops > 0 ? `¡Tienes ${v.drops} ${v.drops === 1 ? 'regalo' : 'regalos'}!` : 'Regalos por cuidarla'),
        h('small', {}, v.nextDropMs === null ? 'Tu mascota ya no recibe regalos.'
          : v.drops > 0 ? `Cada regalo es una comida especial${v.asNft ? ' NFT' : ''}, a veces una que no se vende.`
          : `El siguiente llega en ${formatDuration(v.nextDropMs)} de vida.`)),
      claim);
    status.textContent = v.disabledReason ?? (v.items.length
      ? `Toca una comida para dársela.${v.asNft ? ' Usarla quema su NFT y la cura en la blockchain (una firma).' : ''}`
      : 'Tu despensa está vacía. Compra comida especial en la 🛒 Tienda o abre regalos.');
    grid.replaceChildren(...v.items.map((item) => {
      const food = findFood(item.foodId);
      if (!food) return h('span');
      const b = h('button', { type: 'button', class: 'item-option inv-item' },
        pixelIcon(food.icon, 'inv-icon'), h('b', {}, food.name),
        h('small', { class: 'item-bonus' }, describeFood(food)),
        ...(item.tokenId ? [h('small', {}, `NFT #${item.tokenId}`)] : []));
      b.disabled = v.disabledReason !== null;
      b.addEventListener('click', () => intents.use(item));
      return b;
    }));
  }

  return {
    open(v: PantryView) { render(v); if (!dialog.open) dialog.showModal(); },
    render(v: PantryView) { if (dialog.open) render(v); },
    isOpen: () => dialog.open,
    close() { if (dialog.open) dialog.close(); },
  };
}
