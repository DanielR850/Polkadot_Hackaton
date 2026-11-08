// Ventanas de inventario: "Accesorios" y "Mi espacio" (pared, piso, muebles, adornos).
// Solo muestran lo que la persona ya tiene; los objetos llegarán como NFT (src/game/inventory.ts).
import { SLOTS, SPACE_SECTIONS, type Equipped, type InventoryItem, type InventoryKind } from '../game/inventory.ts';
import { createDialog, h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface InventoryIntents {
  /** Elegir uno (accesorio, pared o piso). id null = ninguno / el original. */
  select(kind: 'accessory' | 'wall' | 'floor', id: string | null): void;
  /** Poner o quitar un mueble o adorno. */
  toggle(kind: 'furniture' | 'decor', id: string): void;
}

/** Tarjeta de un objeto. */
function itemCard(item: InventoryItem | null, active: boolean, label: string, onClick: () => void, disabled = false) {
  const swatch = item?.color !== undefined
    ? h('span', { class: 'inv-swatch', style: `background:${hex(item.color)}`, 'aria-hidden': 'true' })
    : h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, item?.icon ?? '✖');
  const b = h('button', { type: 'button', class: 'item-option inv-item', 'aria-pressed': String(active) }, swatch, h('b', {}, label));
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

function empty(text: string) {
  return h('div', { class: 'inv-empty' },
    h('span', { 'aria-hidden': 'true' }, '📦'),
    h('p', {}, text),
    h('small', {}, 'Consíguelos en la 🛒 Tienda con los pesitos de los minijuegos.'));
}

export function createAccessoriesDialog(intents: InventoryIntents) {
  const { dialog, body } = createDialog('Accesorios', 'inventory-dialog');
  const status = h('p', { class: 'hint' });
  const grid = h('div', { class: 'item-grid inv-grid' });
  body.append(status, grid);

  return {
    open() { if (!dialog.open) dialog.showModal(); },
    loading() { status.textContent = 'Cargando tu inventario…'; grid.replaceChildren(); },
    failed() { status.textContent = 'No se pudo cargar tu inventario. Intenta de nuevo.'; grid.replaceChildren(); },
    render(owned: readonly InventoryItem[], equipped: Equipped) {
      const items = owned.filter((i) => i.kind === 'accessory');
      if (items.length === 0) {
        status.textContent = '';
        grid.replaceChildren(empty('Aún no tienes accesorios.'));
        return;
      }
      status.textContent = 'Toca un accesorio para ponérselo a tu mascota.';
      grid.replaceChildren(
        itemCard(null, equipped.accessory === null, 'Ninguno', () => intents.select('accessory', null)),
        ...items.map((i) => itemCard(i, equipped.accessory === i.id, i.name, () => intents.select('accessory', i.id))));
    },
  };
}

export function createSpaceDialog(intents: InventoryIntents) {
  const { dialog, body } = createDialog('Mi espacio', 'inventory-dialog');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const status = h('p', { class: 'hint' });
  const grid = h('div', { class: 'item-grid inv-grid' });
  body.append(tabs, status, grid);

  let section: Exclude<InventoryKind, 'accessory'> = 'wall';
  let owned: readonly InventoryItem[] = [];
  let equipped: Equipped | null = null;

  const tabButtons = SPACE_SECTIONS.map((s) => {
    const b = h('button', { type: 'button', role: 'tab' }, `${s.icon} ${s.label}`);
    b.addEventListener('click', () => { section = s.kind; draw(); });
    tabs.append(b);
    return { kind: s.kind, b };
  });

  function draw() {
    for (const t of tabButtons) t.b.setAttribute('aria-selected', String(t.kind === section));
    if (!equipped) return;
    const items = owned.filter((i) => i.kind === section);
    const label = SPACE_SECTIONS.find((s) => s.kind === section)!.label.toLowerCase();
    if (items.length === 0) {
      status.textContent = '';
      grid.replaceChildren(empty(`Aún no tienes objetos de ${label}.`));
      return;
    }
    if (section === 'wall' || section === 'floor') {
      const current = equipped[section];
      const kind = section;
      status.textContent = `Elige ${kind === 'wall' ? 'la pared' : 'el piso'} de tu habitación.`;
      grid.replaceChildren(
        itemCard(null, current === null, 'Original', () => intents.select(kind, null)),
        ...items.map((i) => itemCard(i, current === i.id, i.name, () => intents.select(kind, i.id))));
      return;
    }
    const kind = section;
    const placed = equipped[kind];
    const max = SLOTS[kind];
    status.textContent = `Toca para colocar o quitar. Lugares: ${placed.length} de ${max}.`;
    grid.replaceChildren(...items.map((i) => {
      const on = placed.includes(i.id);
      return itemCard(i, on, i.name, () => intents.toggle(kind, i.id), !on && placed.length >= max);
    }));
  }

  return {
    open() { if (!dialog.open) dialog.showModal(); draw(); },
    loading() { status.textContent = 'Cargando tu inventario…'; grid.replaceChildren(); },
    failed() { status.textContent = 'No se pudo cargar tu inventario. Intenta de nuevo.'; grid.replaceChildren(); },
    render(items: readonly InventoryItem[], current: Equipped) { owned = items; equipped = current; draw(); },
  };
}
