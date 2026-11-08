// Tienda: catálogo con precios en pesitos 🪙 y la regla de compra. Lógica pura.
//
// Hoy la compra es local (se descuentan pesitos y el objeto queda en el dispositivo). Cuando los
// objetos sean NFT, el equipo solo reemplaza `ShopBackend.buy` por un mint del contrato: la
// interfaz y el inventario no cambian.
import type { InventoryItem } from './inventory.ts';

export interface ShopItem extends InventoryItem {
  /** Precio en pesitos. */
  price: number;
}

export const SHOP_CATALOG: readonly ShopItem[] = [
  // Accesorios
  { id: 'shop:sombrero', kind: 'accessory', name: 'Sombrero', icon: '🎩', price: 40 },
  { id: 'shop:mono', kind: 'accessory', name: 'Moño', icon: '🎀', price: 25 },
  { id: 'shop:lentes', kind: 'accessory', name: 'Lentes', icon: '🕶️', price: 35 },
  { id: 'shop:flor', kind: 'accessory', name: 'Flor', icon: '🌺', price: 20 },
  { id: 'shop:corona', kind: 'accessory', name: 'Corona', icon: '👑', price: 120 },
  // Pared
  { id: 'shop:pared-rosa', kind: 'wall', name: 'Pared rosa mexicano', icon: '🟪', color: 0xf3a6c8, price: 30 },
  { id: 'shop:pared-turquesa', kind: 'wall', name: 'Pared turquesa', icon: '🟦', color: 0x8fd3d6, price: 30 },
  { id: 'shop:pared-amarilla', kind: 'wall', name: 'Pared cempasúchil', icon: '🟨', color: 0xf6c453, price: 30 },
  // Piso
  { id: 'shop:piso-barro', kind: 'floor', name: 'Piso de barro', icon: '🟧', color: 0xc0643c, price: 35 },
  { id: 'shop:piso-pasto', kind: 'floor', name: 'Pasto', icon: '🟩', color: 0x6fae4f, price: 35 },
  { id: 'shop:piso-piedra', kind: 'floor', name: 'Piedra', icon: '⬜', color: 0x9aa0a8, price: 35 },
  // Muebles
  { id: 'shop:sillon', kind: 'furniture', name: 'Sillón', icon: '🛋️', price: 60 },
  { id: 'shop:planta', kind: 'furniture', name: 'Planta', icon: '🪴', price: 30 },
  { id: 'shop:lampara', kind: 'furniture', name: 'Lámpara', icon: '🪔', price: 45 },
  { id: 'shop:cama', kind: 'furniture', name: 'Camita', icon: '🛏️', price: 80 },
  // Adornos
  { id: 'shop:cuadro', kind: 'decor', name: 'Cuadro', icon: '🖼️', price: 40 },
  { id: 'shop:reloj', kind: 'decor', name: 'Reloj', icon: '🕰️', price: 50 },
  { id: 'shop:calavera', kind: 'decor', name: 'Calaverita', icon: '💀', price: 45 },
];

export type BuyCheck = { ok: true } | { ok: false; reason: string };

/** Se puede comprar si no lo tienes y te alcanzan los pesitos. */
export function canBuy(item: ShopItem, coins: number, ownedIds: readonly string[]): BuyCheck {
  if (ownedIds.includes(item.id)) return { ok: false, reason: 'Ya lo tienes.' };
  if (coins < item.price) return { ok: false, reason: `Te faltan ${item.price - coins} 🪙.` };
  return { ok: true };
}

/** Cómo se realiza la compra. Hoy local; después, un mint NFT. */
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
