// Vista de un objeto en las ventanas de tienda e inventario: su pixel art de public/assets/,
// o el emoji si la imagen no existe o no carga.
import { assetUrl } from '../game/assets.ts';
import type { InventoryItem } from '../game/inventory.ts';
import { pixelIcon } from './pixelArt.ts';
import { h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function itemArt(item: InventoryItem | null): HTMLElement {
  if (!item) return h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, '✖');
  if (item.kind === 'wall' || item.kind === 'floor') {
    // Pared y piso: muestra del azulejo repetido, sobre su color base.
    const tile = item.image ? `url("${assetUrl(item.image)}") 0 0 / 20px 20px repeat, ` : '';
    return h('span', { class: 'inv-swatch', style: `background:${tile}${hex(item.color ?? 0xcccccc)}`, 'aria-hidden': 'true' });
  }
  // El arte de objetos se genera con la misma paleta pixel que los sprites. Conservamos la imagen
  // del azulejo porque paredes y pisos necesitan repetirse en la habitación.
  if (!item.image) return pixelIcon(item.icon, 'inv-icon');
  return pixelIcon(item.icon, 'inv-icon');
}
