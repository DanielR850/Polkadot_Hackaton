// Ventana de la tienda: pestañas por tipo, precio, confirmación y resultado de la compra.
// Solo muestra y devuelve intenciones; la compra la hace el controlador (src/game/shop.ts).
import { SPACE_SECTIONS, type InventoryKind } from '../game/inventory.ts';
import { describeBonus } from '../game/bonuses.ts';
import { canBuy, type ShopItem } from '../game/shop.ts';
import { createDialog, h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface ShopIntents {
  buy(item: ShopItem): void;
  /** Ponerse o colocar lo recién comprado. */
  use(item: ShopItem): void;
}

const SECTIONS: ReadonlyArray<{ kind: InventoryKind; label: string; icon: string }> = [
  { kind: 'accessory', label: 'Accesorios', icon: '🎩' },
  ...SPACE_SECTIONS,
];

export function createShopDialog(items: readonly ShopItem[], intents: ShopIntents) {
  const { dialog, body } = createDialog('Tienda', 'inventory-dialog shop-dialog');
  const wallet = h('p', { class: 'shop-wallet' });
  const tabs = h('div', { class: 'tabs shop-tabs', role: 'tablist' });
  const grid = h('div', { class: 'item-grid inv-grid' });
  const panel = h('div', { class: 'shop-panel', hidden: true });
  body.append(wallet, tabs, grid, panel);

  let section: InventoryKind = 'accessory';
  let coins = 0;
  let owned: readonly string[] = [];
  let busy = false;

  const tabButtons = SECTIONS.map((s) => {
    const b = h('button', { type: 'button', role: 'tab' }, `${s.icon} ${s.label}`);
    b.addEventListener('click', () => { if (busy) return; section = s.kind; panel.hidden = true; draw(); });
    tabs.append(b);
    return { kind: s.kind, b };
  });

  const button = (label: string, cls: string, onClick: () => void) => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', onClick);
    return b;
  };
  const preview = (item: ShopItem) => item.color !== undefined
    ? h('span', { class: 'inv-swatch', style: `background:${hex(item.color)}`, 'aria-hidden': 'true' })
    : h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, item.icon);

  function draw() {
    wallet.textContent = `Tienes 🪙 ${coins}. Gana más jugando a los minijuegos.`;
    for (const t of tabButtons) t.b.setAttribute('aria-selected', String(t.kind === section));
    grid.replaceChildren(...items.filter((i) => i.kind === section && !i.exclusive).map((item) => {
      const mine = owned.includes(item.id);
      const card = h('button', { type: 'button', class: 'item-option inv-item shop-item', 'aria-pressed': String(mine) },
        preview(item), h('b', {}, item.name), ...(item.category ? [h('small', {}, item.category)] : []),
        ...(item.bonus ? [h('small', { class: 'item-bonus' }, describeBonus(item.bonus))] : []),
        h('small', { class: mine ? 'shop-owned' : 'shop-price' }, mine ? '✓ Lo tienes' : `🪙 ${item.price}`));
      card.disabled = busy;
      card.addEventListener('click', () => confirm(item));
      return card;
    }));
  }

  /** Paso de confirmación: muestra el objeto, el precio y si alcanza. */
  function confirm(item: ShopItem) {
    const check = canBuy(item, coins, owned);
    panel.hidden = false;
    panel.replaceChildren(
      h('div', { class: 'mint-card shop-confirm' }, preview(item),
        h('span', {}, h('b', {}, item.name), h('small', {}, check.ok ? `Cuesta 🪙 ${item.price}. Te quedarán 🪙 ${coins - item.price}.` : check.reason))),
      h('div', { class: 'row chain-row' },
        button('Cancelar', 'ghost', () => { panel.hidden = true; }),
        ...(owned.includes(item.id) ? [button('Usar', 'primary', () => intents.use(item))]
          : [Object.assign(button(`Comprar por 🪙 ${item.price}`, 'primary', () => intents.buy(item)), { disabled: !check.ok })])));
  }

  return {
    open(state: { coins: number; owned: readonly string[] }) {
      coins = state.coins;
      owned = state.owned;
      busy = false;
      panel.hidden = true;
      draw();
      if (!dialog.open) dialog.showModal();
    },
    buying(item: ShopItem) {
      busy = true;
      draw();
      panel.replaceChildren(h('p', { class: 'hint' }, `Comprando ${item.name}…`));
    },
    /** Compra terminada: se actualizan monedas e inventario y se ofrece usarlo. */
    bought(item: ShopItem, state: { coins: number; owned: readonly string[] }) {
      coins = state.coins;
      owned = state.owned;
      busy = false;
      draw();
      const where = item.kind === 'accessory' ? 'Accesorios' : 'Mi espacio';
      panel.hidden = false;
      panel.replaceChildren(
        h('div', { class: 'mint-card shop-confirm' }, preview(item),
          h('span', {}, h('b', {}, `¡Compraste ${item.name}!`), h('small', {}, `Lo encuentras en ${where}.`))),
        h('div', { class: 'row chain-row' },
          button('Seguir comprando', 'ghost', () => { panel.hidden = true; }),
          button(item.kind === 'accessory' ? 'Ponérselo' : 'Colocarlo', 'primary', () => intents.use(item))));
    },
    failed(message: string) {
      busy = false;
      draw();
      panel.hidden = false;
      panel.replaceChildren(h('div', { class: 'mint-error', role: 'alert' }, h('span', { 'aria-hidden': 'true' }, '⚠️'), h('p', {}, message)));
    },
    close() { if (dialog.open) dialog.close(); },
  };
}
