// Vista de un objeto en las ventanas de tienda e inventario: pixel art generado en runtime.
import type { InventoryItem } from '../game/inventory.ts';
import { pixelIcon } from './pixelArt.ts';
import { h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function itemArt(item: InventoryItem | null): HTMLElement {
  if (!item) return h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, '✖');
  if (item.kind === 'wall' || item.kind === 'floor') {
    return h('span', { class: 'inv-swatch', style: `background:${hex(item.color ?? 0xcccccc)}`, 'aria-hidden': 'true' });
  }
  return pixelIcon(item.icon, 'inv-icon');
}
