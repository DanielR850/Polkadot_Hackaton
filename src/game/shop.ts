// Tienda: catálogo con precios en pesitos y la regla de compra. Lógica pura.
//
// Las imágenes de objetos ya no forman parte del bundle: los iconos de la interfaz y la habitación
// se generan como pixel art con código. Los articleId se conservan porque también identifican los NFT.
import type { Equipped, InventoryItem } from './inventory.ts';

export interface ShopItem extends InventoryItem {
  price: number;
  /** Id estable del artículo en PolkaPetsItems. No cambiar sin migrar el contrato. */
  articleId: number;
  exclusive?: boolean;
}

export const SHOP_CATALOG: readonly ShopItem[] = [
  // Accesorios: solo uno puesto a la vez.
  { id: 'shop:sombrero', articleId: 1, kind: 'accessory', name: 'Sombrero', icon: '🎩', price: 40, bonus: { coins: 5 } },
  { id: 'shop:mono', articleId: 2, kind: 'accessory', name: 'Moño', icon: '🎀', price: 25, bonus: { happiness: 10 } },
  { id: 'shop:lentes', articleId: 3, kind: 'accessory', name: 'Lentes', icon: '🕶️', price: 35, bonus: { coins: 8 } },
  { id: 'shop:flor', articleId: 4, kind: 'accessory', name: 'Flor', icon: '🌺', price: 20, bonus: { happiness: 8 } },
  { id: 'shop:corona', articleId: 5, kind: 'accessory', name: 'Corona', icon: '👑', price: 120, bonus: { coins: 15 } },
  { id: 'shop:charro', articleId: 25, kind: 'accessory', name: 'Sombrero de charro', icon: '👒', price: 90, bonus: { coins: 12 } },
  { id: 'shop:fiesta', articleId: 26, kind: 'accessory', name: 'Gorro de fiesta', icon: '🥳', price: 30, bonus: { happiness: 10 } },
  { id: 'shop:paliacate', articleId: 27, kind: 'accessory', name: 'Paliacate', icon: '🧣', price: 25, bonus: { coins: 6 } },
  { id: 'shop:audifonos', articleId: 28, kind: 'accessory', name: 'Audífonos', icon: '🎧', price: 55, bonus: { happiness: 12 } },
  { id: 'shop:gorro', articleId: 29, kind: 'accessory', name: 'Gorro de lana', icon: '🧶', price: 30, bonus: { happiness: 8 } },
  { id: 'shop:corona-flores', articleId: 30, kind: 'accessory', name: 'Corona de flores', icon: '💐', price: 45, bonus: { happiness: 14 } },
  { id: 'shop:gorra', articleId: 31, kind: 'accessory', name: 'Gorra', icon: '🧢', price: 35, bonus: { coins: 8 } },
  // Exclusivos: no se compran, se ganan con un trofeo.
  { id: 'shop:medalla', articleId: 21, kind: 'accessory', name: 'Medalla', icon: '🏅', price: 0, exclusive: true, bonus: { coins: 10 } },
  { id: 'shop:estrella', articleId: 22, kind: 'accessory', name: 'Estrella', icon: '⭐', price: 0, exclusive: true, bonus: { happiness: 15 } },
  { id: 'shop:cinta', articleId: 23, kind: 'accessory', name: 'Cinta de campeón', icon: '🎗️', price: 0, exclusive: true, bonus: { coins: 20 } },
  { id: 'shop:amuleto', articleId: 24, kind: 'accessory', name: 'Amuleto', icon: '🧿', price: 0, exclusive: true, bonus: { coins: 10, happiness: 10 } },
  // Pared.
  { id: 'shop:pared-rosa', articleId: 6, kind: 'wall', name: 'Pared rosa mexicano', icon: '🟪', color: 0xf3a6c8, price: 30 },
  { id: 'shop:pared-turquesa', articleId: 7, kind: 'wall', name: 'Pared turquesa', icon: '🟦', color: 0x8fd3d6, price: 30 },
  { id: 'shop:pared-amarilla', articleId: 8, kind: 'wall', name: 'Pared cempasúchil', icon: '🟨', color: 0xf6c453, price: 30 },
  { id: 'shop:pared-ladrillo', articleId: 32, kind: 'wall', name: 'Ladrillo', icon: '🧱', color: 0xb5533c, price: 40 },
  { id: 'shop:pared-floral', articleId: 33, kind: 'wall', name: 'Papel tapiz floral', icon: '🌸', color: 0xfff3d6, price: 40 },
  { id: 'shop:pared-madera', articleId: 34, kind: 'wall', name: 'Pared de madera', icon: '🪵', color: 0xa8703f, price: 45 },
  { id: 'shop:pared-talavera', articleId: 35, kind: 'wall', name: 'Azulejo de talavera', icon: '🔷', color: 0xf7f3ea, price: 50 },
  { id: 'shop:pared-noche', articleId: 36, kind: 'wall', name: 'Noche estrellada', icon: '🌌', color: 0x1f2a5a, price: 55 },
  // Piso.
  { id: 'shop:piso-barro', articleId: 9, kind: 'floor', name: 'Piso de barro', icon: '🟧', color: 0xc0643c, price: 35 },
  { id: 'shop:piso-pasto', articleId: 10, kind: 'floor', name: 'Pasto', icon: '🟩', color: 0x6fae4f, price: 35 },
  { id: 'shop:piso-piedra', articleId: 11, kind: 'floor', name: 'Piedra', icon: '⬜', color: 0x9aa0a8, price: 35 },
  { id: 'shop:piso-duela', articleId: 37, kind: 'floor', name: 'Duela clara', icon: '🟫', color: 0xd9a86c, price: 40 },
  { id: 'shop:piso-ajedrez', articleId: 38, kind: 'floor', name: 'Ajedrez', icon: '♟️', color: 0xf4f1e8, price: 45 },
  { id: 'shop:piso-mosaico', articleId: 39, kind: 'floor', name: 'Mosaico', icon: '🔹', color: 0xf7f3ea, price: 45 },
  { id: 'shop:piso-arena', articleId: 40, kind: 'floor', name: 'Arena', icon: '🏖️', color: 0xe9cf94, price: 40 },
  // Muebles: uno por categoría.
  { id: 'shop:sillon', articleId: 12, kind: 'furniture', category: 'Asiento', name: 'Sillón', icon: '🛋️', price: 60 },
  { id: 'shop:silla', articleId: 13, kind: 'furniture', category: 'Asiento', name: 'Silla', icon: '🪑', price: 40 },
  { id: 'shop:puff', articleId: 41, kind: 'furniture', category: 'Asiento', name: 'Puf', icon: '🟣', price: 35 },
  { id: 'shop:planta', articleId: 14, kind: 'furniture', category: 'Planta', name: 'Planta', icon: '🪴', price: 30 },
  { id: 'shop:cactus', articleId: 15, kind: 'furniture', category: 'Planta', name: 'Cactus', icon: '🌵', price: 25 },
  { id: 'shop:girasol', articleId: 47, kind: 'furniture', category: 'Planta', name: 'Girasol', icon: '🌻', price: 30 },
  { id: 'shop:lampara', articleId: 16, kind: 'furniture', category: 'Iluminación', name: 'Lámpara', icon: '🪔', price: 45 },
  { id: 'shop:lampara-pie', articleId: 46, kind: 'furniture', category: 'Iluminación', name: 'Lámpara de pie', icon: '💡', price: 55 },
  { id: 'shop:cama', articleId: 17, kind: 'furniture', category: 'Cama', name: 'Camita', icon: '🛏️', price: 80 },
  { id: 'shop:hamaca', articleId: 42, kind: 'furniture', category: 'Cama', name: 'Hamaca', icon: '🌈', price: 70 },
  { id: 'shop:mesita', articleId: 43, kind: 'furniture', category: 'Mesa', name: 'Mesita', icon: '🍽️', price: 45 },
  { id: 'shop:librero', articleId: 44, kind: 'furniture', category: 'Almacenamiento', name: 'Librero', icon: '📚', price: 65 },
  { id: 'shop:tele', articleId: 45, kind: 'furniture', category: 'Entretenimiento', name: 'Tele retro', icon: '📺', price: 90 },
  // Adornos: uno por categoría.
  { id: 'shop:cuadro', articleId: 18, kind: 'decor', category: 'Colgante', name: 'Cuadro', icon: '🖼️', price: 40 },
  { id: 'shop:poster', articleId: 48, kind: 'decor', category: 'Colgante', name: 'Póster Polkadot', icon: '🩷', price: 35 },
  { id: 'shop:espejo', articleId: 49, kind: 'decor', category: 'Colgante', name: 'Espejo', icon: '🪞', price: 45 },
  { id: 'shop:reloj', articleId: 19, kind: 'decor', category: 'Repisa', name: 'Reloj', icon: '🕰️', price: 50 },
  { id: 'shop:florero', articleId: 50, kind: 'decor', category: 'Repisa', name: 'Florero', icon: '🏺', price: 35 },
  { id: 'shop:calavera', articleId: 20, kind: 'decor', category: 'Ofrenda', name: 'Calaverita', icon: '💀', price: 45 },
  { id: 'shop:velas', articleId: 51, kind: 'decor', category: 'Ofrenda', name: 'Velas', icon: '🕯️', price: 30 },
  { id: 'shop:foquitos', articleId: 52, kind: 'decor', category: 'Guirnalda', name: 'Foquitos', icon: '✨', price: 40 },
];

/** Ids del catálogo del contrato de lo que está puesto. */
export function equippedArticleIds(equipped: Equipped, catalog: readonly ShopItem[] = SHOP_CATALOG): number[] {
  const ids = [equipped.accessory, equipped.wall, equipped.floor, ...equipped.furniture, ...equipped.decor];
  return ids.flatMap((id) => {
    const item = catalog.find((i) => i.id === id);
    return item ? [item.articleId] : [];
  });
}
export type BuyCheck = { ok: true } | { ok: false; reason: string };

export function canBuy(item: ShopItem, coins: number, ownedIds: readonly string[]): BuyCheck {
  if (ownedIds.includes(item.id)) return { ok: false, reason: 'Ya lo tienes.' };
  if (item.exclusive) return { ok: false, reason: 'No se compra: se gana con un trofeo.' };
  if (coins < item.price) return { ok: false, reason: `Te faltan ${item.price - coins} 🪙.` };
  return { ok: true };
}

export interface ShopBackend {
  buy(item: ShopItem): Promise<void>;
}

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

export function clearPurchases(): void {
  savePurchases([]);
}
