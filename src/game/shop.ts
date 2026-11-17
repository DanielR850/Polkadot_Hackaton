// Tienda: catálogo con precios en pesitos 🪙 y la regla de compra. Lógica pura.
//
// Sin cartera la compra es local (se descuentan pesitos y el objeto queda en el dispositivo). Con un
// NFT de mascota, la compra firma `comprar` en PolkaPetsItems y el objeto queda ligado a esa
// mascota. Los objetos son de la mascota: al empezar otra, empieza sin ninguno.
import type { Equipped, InventoryItem } from './inventory.ts';

export interface ShopItem extends InventoryItem {
  /** Precio en pesitos. */
  price: number;
  /** Id del objeto en el catálogo del contrato PolkaPetsItems (debe coincidir con su constructor). */
  articleId: number;
  /** true = no se compra: solo se gana como recompensa de un trofeo. */
  exclusive?: boolean;
}

// Cada objeto apunta a su pixel art en public/assets/items/<tipo>/<archivo>.png. Para cambiar
// cómo se ve, reemplaza ese PNG (mismo nombre) o cambia la ruta aquí. Ver docs/ASSETS.md.
const acc = (file: string) => `items/accessories/${file}.png`;
const wall = (file: string) => `items/walls/${file}.png`;
const floor = (file: string) => `items/floors/${file}.png`;
const furn = (file: string) => `items/furniture/${file}.png`;
const dec = (file: string) => `items/decor/${file}.png`;

export const SHOP_CATALOG: readonly ShopItem[] = [
  // Accesorios: solo uno puesto a la vez.
  { id: 'shop:sombrero', articleId: 1, kind: 'accessory', name: 'Sombrero', icon: '🎩', image: acc('sombrero'), price: 40, bonus: { coins: 5 } },
  { id: 'shop:mono', articleId: 2, kind: 'accessory', name: 'Moño', icon: '🎀', image: acc('mono'), price: 25, bonus: { happiness: 10 } },
  { id: 'shop:lentes', articleId: 3, kind: 'accessory', name: 'Lentes', icon: '🕶️', image: acc('lentes'), price: 35, bonus: { coins: 8 } },
  { id: 'shop:flor', articleId: 4, kind: 'accessory', name: 'Flor', icon: '🌺', image: acc('flor'), price: 20, bonus: { happiness: 8 } },
  { id: 'shop:corona', articleId: 5, kind: 'accessory', name: 'Corona', icon: '👑', image: acc('corona'), price: 120, bonus: { coins: 15 } },
  { id: 'shop:charro', articleId: 25, kind: 'accessory', name: 'Sombrero de charro', icon: '👒', image: acc('charro'), price: 90, bonus: { coins: 12 } },
  { id: 'shop:fiesta', articleId: 26, kind: 'accessory', name: 'Gorro de fiesta', icon: '🥳', image: acc('fiesta'), price: 30, bonus: { happiness: 10 } },
  { id: 'shop:paliacate', articleId: 27, kind: 'accessory', name: 'Paliacate', icon: '🧣', image: acc('paliacate'), price: 25, bonus: { coins: 6 } },
  { id: 'shop:audifonos', articleId: 28, kind: 'accessory', name: 'Audífonos', icon: '🎧', image: acc('audifonos'), price: 55, bonus: { happiness: 12 } },
  { id: 'shop:gorro', articleId: 29, kind: 'accessory', name: 'Gorro de lana', icon: '🧶', image: acc('gorro'), price: 30, bonus: { happiness: 8 } },
  { id: 'shop:corona-flores', articleId: 30, kind: 'accessory', name: 'Corona de flores', icon: '💐', image: acc('corona-flores'), price: 45, bonus: { happiness: 14 } },
  { id: 'shop:gorra', articleId: 31, kind: 'accessory', name: 'Gorra', icon: '🧢', image: acc('gorra'), price: 35, bonus: { coins: 8 } },
  // Exclusivos: no se compran, se ganan con un trofeo (ver achievements.ts).
  { id: 'shop:medalla', articleId: 21, kind: 'accessory', name: 'Medalla', icon: '🏅', image: acc('medalla'), price: 0, exclusive: true, bonus: { coins: 10 } },
  { id: 'shop:estrella', articleId: 22, kind: 'accessory', name: 'Estrella', icon: '⭐', image: acc('estrella'), price: 0, exclusive: true, bonus: { happiness: 15 } },
  { id: 'shop:cinta', articleId: 23, kind: 'accessory', name: 'Cinta de campeón', icon: '🎗️', image: acc('cinta'), price: 0, exclusive: true, bonus: { coins: 20 } },
  { id: 'shop:amuleto', articleId: 24, kind: 'accessory', name: 'Amuleto', icon: '🧿', image: acc('amuleto'), price: 0, exclusive: true, bonus: { coins: 10, happiness: 10 } },
  // Pared
  { id: 'shop:pared-rosa', articleId: 6, kind: 'wall', name: 'Pared rosa mexicano', icon: '🟪', image: wall('rosa'), color: 0xf3a6c8, price: 30 },
  { id: 'shop:pared-turquesa', articleId: 7, kind: 'wall', name: 'Pared turquesa', icon: '🟦', image: wall('turquesa'), color: 0x8fd3d6, price: 30 },
  { id: 'shop:pared-amarilla', articleId: 8, kind: 'wall', name: 'Pared cempasúchil', icon: '🟨', image: wall('amarilla'), color: 0xf6c453, price: 30 },
  { id: 'shop:pared-ladrillo', articleId: 32, kind: 'wall', name: 'Ladrillo', icon: '🧱', image: wall('ladrillo'), color: 0xb5533c, price: 40 },
  { id: 'shop:pared-floral', articleId: 33, kind: 'wall', name: 'Papel tapiz floral', icon: '🌸', image: wall('floral'), color: 0xfff3d6, price: 40 },
  { id: 'shop:pared-madera', articleId: 34, kind: 'wall', name: 'Pared de madera', icon: '🪵', image: wall('madera'), color: 0xa8703f, price: 45 },
  { id: 'shop:pared-talavera', articleId: 35, kind: 'wall', name: 'Azulejo de talavera', icon: '🔷', image: wall('talavera'), color: 0xf7f3ea, price: 50 },
  { id: 'shop:pared-noche', articleId: 36, kind: 'wall', name: 'Noche estrellada', icon: '🌌', image: wall('noche'), color: 0x1f2a5a, price: 55 },
  // Piso
  { id: 'shop:piso-barro', articleId: 9, kind: 'floor', name: 'Piso de barro', icon: '🟧', image: floor('barro'), color: 0xc0643c, price: 35 },
  { id: 'shop:piso-pasto', articleId: 10, kind: 'floor', name: 'Pasto', icon: '🟩', image: floor('pasto'), color: 0x6fae4f, price: 35 },
  { id: 'shop:piso-piedra', articleId: 11, kind: 'floor', name: 'Piedra', icon: '⬜', image: floor('piedra'), color: 0x9aa0a8, price: 35 },
  { id: 'shop:piso-duela', articleId: 37, kind: 'floor', name: 'Duela clara', icon: '🟫', image: floor('duela'), color: 0xd9a86c, price: 40 },
  { id: 'shop:piso-ajedrez', articleId: 38, kind: 'floor', name: 'Ajedrez', icon: '♟️', image: floor('ajedrez'), color: 0xf4f1e8, price: 45 },
  { id: 'shop:piso-mosaico', articleId: 39, kind: 'floor', name: 'Mosaico', icon: '🔹', image: floor('mosaico'), color: 0xf7f3ea, price: 45 },
  { id: 'shop:piso-arena', articleId: 40, kind: 'floor', name: 'Arena', icon: '🏖️', image: floor('arena'), color: 0xe9cf94, price: 40 },
  // Muebles: uno por categoría.
  { id: 'shop:sillon', articleId: 12, kind: 'furniture', category: 'Asiento', name: 'Sillón', icon: '🛋️', image: furn('sillon'), price: 60 },
  { id: 'shop:silla', articleId: 13, kind: 'furniture', category: 'Asiento', name: 'Silla', icon: '🪑', image: furn('silla'), price: 40 },
  { id: 'shop:puff', articleId: 41, kind: 'furniture', category: 'Asiento', name: 'Puf', icon: '🟣', image: furn('puff'), price: 35 },
  { id: 'shop:planta', articleId: 14, kind: 'furniture', category: 'Planta', name: 'Planta', icon: '🪴', image: furn('planta'), price: 30 },
  { id: 'shop:cactus', articleId: 15, kind: 'furniture', category: 'Planta', name: 'Cactus', icon: '🌵', image: furn('cactus'), price: 25 },
  { id: 'shop:girasol', articleId: 47, kind: 'furniture', category: 'Planta', name: 'Girasol', icon: '🌻', image: furn('girasol'), price: 30 },
  { id: 'shop:lampara', articleId: 16, kind: 'furniture', category: 'Iluminación', name: 'Lámpara', icon: '🪔', image: furn('lampara'), price: 45 },
  { id: 'shop:lampara-pie', articleId: 46, kind: 'furniture', category: 'Iluminación', name: 'Lámpara de pie', icon: '💡', image: furn('lampara-pie'), price: 55 },
  { id: 'shop:cama', articleId: 17, kind: 'furniture', category: 'Cama', name: 'Camita', icon: '🛏️', image: furn('cama'), price: 80 },
  { id: 'shop:hamaca', articleId: 42, kind: 'furniture', category: 'Cama', name: 'Hamaca', icon: '🌈', image: furn('hamaca'), price: 70 },
  { id: 'shop:mesita', articleId: 43, kind: 'furniture', category: 'Mesa', name: 'Mesita', icon: '🍽️', image: furn('mesita'), price: 45 },
  { id: 'shop:librero', articleId: 44, kind: 'furniture', category: 'Almacenamiento', name: 'Librero', icon: '📚', image: furn('librero'), price: 65 },
  { id: 'shop:tele', articleId: 45, kind: 'furniture', category: 'Entretenimiento', name: 'Tele retro', icon: '📺', image: furn('tele'), price: 90 },
  // Adornos: uno por categoría.
  { id: 'shop:cuadro', articleId: 18, kind: 'decor', category: 'Colgante', name: 'Cuadro', icon: '🖼️', image: dec('cuadro'), price: 40 },
  { id: 'shop:poster', articleId: 48, kind: 'decor', category: 'Colgante', name: 'Póster Polkadot', icon: '🩷', image: dec('poster'), price: 35 },
  { id: 'shop:espejo', articleId: 49, kind: 'decor', category: 'Colgante', name: 'Espejo', icon: '🪞', image: dec('espejo'), price: 45 },
  { id: 'shop:reloj', articleId: 19, kind: 'decor', category: 'Repisa', name: 'Reloj', icon: '🕰️', image: dec('reloj'), price: 50 },
  { id: 'shop:florero', articleId: 50, kind: 'decor', category: 'Repisa', name: 'Florero', icon: '🏺', image: dec('florero'), price: 35 },
  { id: 'shop:calavera', articleId: 20, kind: 'decor', category: 'Ofrenda', name: 'Calaverita', icon: '💀', image: dec('calavera'), price: 45 },
  { id: 'shop:velas', articleId: 51, kind: 'decor', category: 'Ofrenda', name: 'Velas', icon: '🕯️', image: dec('velas'), price: 30 },
  { id: 'shop:foquitos', articleId: 52, kind: 'decor', category: 'Guirnalda', name: 'Foquitos', icon: '✨', image: dec('foquitos'), price: 40 },
];

/** Ids del catálogo del contrato de lo que está puesto (accesorio, pared, piso, muebles y adornos). */
export function equippedArticleIds(equipped: Equipped, catalog: readonly ShopItem[] = SHOP_CATALOG): number[] {
  const ids = [equipped.accessory, equipped.wall, equipped.floor, ...equipped.furniture, ...equipped.decor];
  return ids.flatMap((id) => {
    const item = catalog.find((i) => i.id === id);
    return item ? [item.articleId] : [];
  });
}
export type BuyCheck = { ok: true } | { ok: false; reason: string };

/** Se puede comprar si no lo tienes y te alcanzan los pesitos. */
export function canBuy(item: ShopItem, coins: number, ownedIds: readonly string[]): BuyCheck {
  if (ownedIds.includes(item.id)) return { ok: false, reason: 'Ya lo tienes.' };
  if (item.exclusive) return { ok: false, reason: 'No se compra: se gana con un trofeo.' };
  if (coins < item.price) return { ok: false, reason: `Te faltan ${item.price - coins} 🪙.` };
  return { ok: true };
}

/** Cómo se realiza la compra: local o con la firma de un mint NFT. */
export interface ShopBackend {
  /** Lanza un Error con mensaje en español si no se pudo comprar. */
  buy(item: ShopItem): Promise<void>;
}

/* ------------------------------------- compras locales (en el dispositivo) */

const KEY = 'tamagotchi-polkadot-purchases-v1';
let memory: string | null = null;

export function loadPurchases(): string[] {
  let raw = memory;
  try { raw = localStorage.getItem(KEY); } catch { /* sin localStorage */ }
  try {
    const d = raw ? JSON.parse(raw) : [];
    return Array.isArray(d) ? d.filter((x): x is string => typeof x === 'string' && SHOP_CATALOG.some((i) => i.id === x)) : [];
  } catch {
    return [];
  }
}

export function savePurchases(ids: readonly string[]): void {
  memory = JSON.stringify([...new Set(ids)]);
  try { localStorage.setItem(KEY, memory); } catch { /* se queda en memoria */ }
}

/** Nueva mascota: los objetos comprados pertenecen a la mascota anterior y no se heredan. */
export function clearPurchases(): void {
  savePurchases([]);
}
