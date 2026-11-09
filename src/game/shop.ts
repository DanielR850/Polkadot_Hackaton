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

export const SHOP_CATALOG: readonly ShopItem[] = [
  // Accesorios: solo uno puesto a la vez.
  { id: 'shop:sombrero', articleId: 1, kind: 'accessory', name: 'Sombrero', icon: '🎩', price: 40, bonus: { coins: 5 } },
  { id: 'shop:mono', articleId: 2, kind: 'accessory', name: 'Moño', icon: '🎀', price: 25, bonus: { happiness: 10 } },
  { id: 'shop:lentes', articleId: 3, kind: 'accessory', name: 'Lentes', icon: '🕶️', price: 35, bonus: { coins: 8 } },
  { id: 'shop:flor', articleId: 4, kind: 'accessory', name: 'Flor', icon: '🌺', price: 20, bonus: { happiness: 8 } },
  { id: 'shop:corona', articleId: 5, kind: 'accessory', name: 'Corona', icon: '👑', price: 120, bonus: { coins: 15 } },
  // Exclusivos: no se compran, se ganan con un trofeo (ver achievements.ts).
  { id: 'shop:medalla', articleId: 21, kind: 'accessory', name: 'Medalla', icon: '🏅', price: 0, exclusive: true, bonus: { coins: 10 } },
  { id: 'shop:estrella', articleId: 22, kind: 'accessory', name: 'Estrella', icon: '⭐', price: 0, exclusive: true, bonus: { happiness: 15 } },
  { id: 'shop:cinta', articleId: 23, kind: 'accessory', name: 'Cinta de campeón', icon: '🎗️', price: 0, exclusive: true, bonus: { coins: 20 } },
  { id: 'shop:amuleto', articleId: 24, kind: 'accessory', name: 'Amuleto', icon: '🧿', price: 0, exclusive: true, bonus: { coins: 10, happiness: 10 } },
  // Pared
  { id: 'shop:pared-rosa', articleId: 6, kind: 'wall', name: 'Pared rosa mexicano', icon: '🟪', color: 0xf3a6c8, price: 30 },
  { id: 'shop:pared-turquesa', articleId: 7, kind: 'wall', name: 'Pared turquesa', icon: '🟦', color: 0x8fd3d6, price: 30 },
  { id: 'shop:pared-amarilla', articleId: 8, kind: 'wall', name: 'Pared cempasúchil', icon: '🟨', color: 0xf6c453, price: 30 },
  // Piso
  { id: 'shop:piso-barro', articleId: 9, kind: 'floor', name: 'Piso de barro', icon: '🟧', color: 0xc0643c, price: 35 },
  { id: 'shop:piso-pasto', articleId: 10, kind: 'floor', name: 'Pasto', icon: '🟩', color: 0x6fae4f, price: 35 },
  { id: 'shop:piso-piedra', articleId: 11, kind: 'floor', name: 'Piedra', icon: '⬜', color: 0x9aa0a8, price: 35 },
  // Muebles: uno por categoría.
  { id: 'shop:sillon', articleId: 12, kind: 'furniture', category: 'Asiento', name: 'Sillón', icon: '🛋️', price: 60 },
  { id: 'shop:silla', articleId: 13, kind: 'furniture', category: 'Asiento', name: 'Silla', icon: '🪑', price: 40 },
  { id: 'shop:planta', articleId: 14, kind: 'furniture', category: 'Planta', name: 'Planta', icon: '🪴', price: 30 },
  { id: 'shop:cactus', articleId: 15, kind: 'furniture', category: 'Planta', name: 'Cactus', icon: '🌵', price: 25 },
  { id: 'shop:lampara', articleId: 16, kind: 'furniture', category: 'Iluminación', name: 'Lámpara', icon: '🪔', price: 45 },
  { id: 'shop:cama', articleId: 17, kind: 'furniture', category: 'Cama', name: 'Camita', icon: '🛏️', price: 80 },
  // Adornos: uno por categoría.
  { id: 'shop:cuadro', articleId: 18, kind: 'decor', category: 'Colgante', name: 'Cuadro', icon: '🖼️', price: 40 },
  { id: 'shop:reloj', articleId: 19, kind: 'decor', category: 'Repisa', name: 'Reloj', icon: '🕰️', price: 50 },
  { id: 'shop:calavera', articleId: 20, kind: 'decor', category: 'Ofrenda', name: 'Calaverita', icon: '💀', price: 45 },
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
