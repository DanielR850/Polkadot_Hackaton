// Ventanas de inventario: "Accesorios" y "Mi espacio" (pared, piso, muebles, adornos).
// Solo muestran lo que la persona ya tiene; los objetos llegarán como NFT (src/game/inventory.ts).
import { describeBonus } from '../game/bonuses.ts';
import { placeBlocker, SLOTS, SPACE_SECTIONS, type Equipped, type InventoryItem, type InventoryKind } from '../game/inventory.ts';
import { HAT_PALETTES } from '../game/wearables.ts';
import { createDialog, h } from './dom.ts';
import { pixelIcon } from './pixelArt.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface InventoryIntents {
  /** Elegir uno (accesorio, pared o piso). id null = ninguno / el original. */
  select(kind: 'accessory' | 'outfit' | 'wall' | 'floor', id: string | null): void;
  /** Poner o quitar un mueble o adorno. */
  toggle(kind: 'furniture' | 'decor', id: string): void;
  /** Color de la prenda de pixel art puesta (sombrero). */
  palette?(id: string): void;
}

/** Tarjeta de un objeto. */
function itemCard(item: InventoryItem | null, active: boolean, label: string, onClick: () => void, disabled = false, hint = '') {
  const swatch = item?.color !== undefined
    ? h('span', { class: 'inv-swatch', style: `background:${hex(item.color)}`, 'aria-hidden': 'true' })
    : pixelIcon(item?.icon ?? '✖', 'inv-icon');
  const b = h('button', { type: 'button', class: 'item-option inv-item', 'aria-pressed': String(active) }, swatch, h('b', {}, label), ...(item?.category ? [h('small', {}, item.category)] : []),
    ...(item?.bonus ? [h('small', { class: 'item-bonus' }, describeBonus(item.bonus))] : []));
  b.disabled = disabled;
  if (hint) b.title = hint;
  b.addEventListener('click', onClick);
  return b;
}

function empty(text: string) {
  return h('div', { class: 'inv-empty' },
    h('span', { 'aria-hidden': 'true' }, '📦'),
    h('p', {}, text),
    h('small', {}, 'Los consigues en la Tienda con los pesitos de los minijuegos.'));
}

export function createAccessoriesDialog(intents: InventoryIntents) {
  const { dialog, body } = createDialog('Accesorios', 'inventory-dialog');
  const status = h('p', { class: 'hint' });
  const grid = h('div', { class: 'item-grid inv-grid' });
  const colors = h('div', { class: 'pet-options', hidden: true });
  body.append(status, grid, colors);

  return {
    open() { if (!dialog.open) dialog.showModal(); },
    /** Muestra los colores de la prenda puesta si es de pixel art (`current` = paleta elegida). */
    colors(wearable: boolean, current: string) {
      colors.hidden = !wearable;
      if (!wearable) return;
      colors.replaceChildren(h('p', { class: 'eyebrow' }, 'COLOR DE LA ROPA'), h('div', { class: 'choice-row' }, ...HAT_PALETTES.map((p) => {
        const b = h('button', { type: 'button', class: 'choice', 'aria-pressed': String(p.id === current) },
          h('span', { class: 'choice-swatch', style: `background:${hex(p.body[2])};box-shadow:inset 0 -6px 0 ${hex(p.band[1])}`, 'aria-hidden': 'true' }), p.name);
        b.addEventListener('click', () => intents.palette?.(p.id));
        return b;
      })));
    },
    loading() { status.textContent = 'Cargando tu inventario…'; grid.replaceChildren(); },
    failed() { status.textContent = 'No se pudo cargar tu inventario. Intenta de nuevo.'; grid.replaceChildren(); },
    render(owned: readonly InventoryItem[], equipped: Equipped) {
      const head = owned.filter((i) => i.kind === 'accessory');
      const body = owned.filter((i) => i.kind === 'outfit');
      if (head.length === 0 && body.length === 0) {
        status.textContent = '';
        grid.replaceChildren(empty('Aún no tienes accesorios ni ropa.'));
        return;
      }
      status.textContent = 'Puedes llevar un accesorio en la cabeza y una prenda en el cuerpo al mismo tiempo.';
      const section = (title: string) => h('p', { class: 'eyebrow inv-section' }, title);
      grid.replaceChildren(
        section('CABEZA Y CARA'),
        itemCard(null, equipped.accessory === null, 'Nada', () => intents.select('accessory', null)),
        ...head.map((i) => itemCard(i, equipped.accessory === i.id, i.name, () => intents.select('accessory', i.id))),
        ...(body.length ? [
          section('ROPA'),
          itemCard(null, equipped.outfit === null, 'Nada', () => intents.select('outfit', null)),
          ...body.map((i) => itemCard(i, equipped.outfit === i.id, i.name, () => intents.select('outfit', i.id))),
        ] : []));
    },
  };
}

export function createSpaceDialog(intents: InventoryIntents) {
  const { dialog, body } = createDialog('Mi espacio', 'inventory-dialog');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const status = h('p', { class: 'hint' });
  const grid = h('div', { class: 'item-grid inv-grid' });
  body.append(tabs, status, grid);

  let section: Exclude<InventoryKind, 'accessory' | 'outfit'> = 'wall';
  let owned: readonly InventoryItem[] = [];
  let equipped: Equipped | null = null;

  const tabButtons = SPACE_SECTIONS.map((s) => {
    const b = h('button', { type: 'button', role: 'tab' }, s.label);
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
    status.textContent = `Toca para colocar o quitar. Lugares: ${placed.length} de ${max}. Solo uno por categoría.`;
    grid.replaceChildren(...items.map((i) => {
      const on = placed.includes(i.id);
      const blocker = on ? null : placeBlocker(equipped!, kind, i, owned);
      return itemCard(i, on, i.name, () => intents.toggle(kind, i.id), blocker !== null, blocker ?? '');
    }));
  }

  return {
    open() { if (!dialog.open) dialog.showModal(); draw(); },
    loading() { status.textContent = 'Cargando tu inventario…'; grid.replaceChildren(); },
    failed() { status.textContent = 'No se pudo cargar tu inventario. Intenta de nuevo.'; grid.replaceChildren(); },
    render(items: readonly InventoryItem[], current: Equipped) { owned = items; equipped = current; draw(); },
  };
}
