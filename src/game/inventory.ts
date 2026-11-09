// Inventario de accesorios y decoración. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Los objetos los tendrá la persona como NFT (los implementa el equipo después). Este módulo solo
// define qué es un objeto, de dónde se leen (`InventorySource`) y qué tiene puesto. Para conectar
// los NFT basta con crear otra fuente que devuelva `InventoryItem[]` leídos del contrato.

/** Dónde se usa un objeto: en la mascota o en una sección de la habitación. */
export type InventoryKind = 'accessory' | 'wall' | 'floor' | 'furniture' | 'decor';

/** Bonos en porcentaje que da un objeto puesto: más pesitos o más felicidad al jugar. */
export interface Bonus {
  /** % extra de pesitos ganados en los minijuegos. */
  coins?: number;
  /** % extra de felicidad que dan los minijuegos. */
  happiness?: number;
}

export interface InventoryItem {
  /** Identificador estable (por ejemplo `nft:<contrato>:<tokenId>`). */
  id: string;
  kind: InventoryKind;
  name: string;
  /** Emoji que lo representa por ahora (accesorios, muebles y adornos). */
  icon: string;
  /** Color de la pared o del piso (0xRRGGBB). */
  color?: number;
  /**
   * Categoría de un mueble o adorno ("Asiento", "Planta"…). Solo puede haber uno puesto por
   * categoría; el contrato PolkaPetsItems aplica la misma regla.
   */
  category?: string;
  /** Bono que da mientras está puesto. */
  bonus?: Bonus;
}

/** De dónde salen los objetos de la persona. */
export interface InventorySource {
  list(): Promise<InventoryItem[]>;
}

/** Lo que tiene puesto. Pared y piso: uno o el original (null). Muebles y adornos: varios. */
export interface Equipped {
  accessory: string | null;
  wall: string | null;
  floor: string | null;
  furniture: string[];
  decor: string[];
}

/** Lugares disponibles en la habitación. */
export const SLOTS = { furniture: 3, decor: 2 } as const;

/** Secciones de "Mi espacio", en el orden en que se muestran. */
export const SPACE_SECTIONS: ReadonlyArray<{ kind: Exclude<InventoryKind, 'accessory'>; label: string; icon: string }> = [
  { kind: 'wall', label: 'Pared', icon: '🧱' },
  { kind: 'floor', label: 'Piso', icon: '🟫' },
  { kind: 'furniture', label: 'Muebles', icon: '🪑' },
  { kind: 'decor', label: 'Adornos', icon: '🖼️' },
];

/** Lo que la escena necesita para dibujar la habitación decorada. */
export interface RoomDecor {
  wall: number | null;
  floor: number | null;
  furniture: string[];
  decor: string[];
}

export const NOTHING_EQUIPPED: Equipped = { accessory: null, wall: null, floor: null, furniture: [], decor: [] };

/**
 * Quita lo que ya no está en el inventario y respeta las reglas de lo puesto: un accesorio, una
 * pared, un piso, un mueble o adorno por categoría y los lugares disponibles.
 */
export function sanitize(equipped: Equipped, owned: readonly InventoryItem[]): Equipped {
  const find = (id: string | null, kind: InventoryKind) => (id ? owned.find((i) => i.id === id && i.kind === kind) : undefined);
  const has = (id: string | null, kind: InventoryKind) => (find(id, kind) ? id : null);
  const many = (ids: string[], kind: 'furniture' | 'decor') => {
    const kept: string[] = [];
    const categories = new Set<string>();
    for (const id of new Set(ids)) {
      const item = find(id, kind);
      if (!item || kept.length >= SLOTS[kind]) continue;
      if (item.category) {
        if (categories.has(item.category)) continue;
        categories.add(item.category);
      }
      kept.push(id);
    }
    return kept;
  };
  return {
    accessory: has(equipped.accessory, 'accessory'),
    wall: has(equipped.wall, 'wall'),
    floor: has(equipped.floor, 'floor'),
    furniture: many(equipped.furniture, 'furniture'),
    decor: many(equipped.decor, 'decor'),
  };
}

export type EquipResult = { ok: true; equipped: Equipped } | { ok: false; reason: string };

/** Por qué no se puede poner este mueble o adorno ahora; null si se puede. */
export function placeBlocker(
  equipped: Equipped, kind: 'furniture' | 'decor', item: InventoryItem, owned: readonly InventoryItem[],
): string | null {
  const placed = equipped[kind];
  if (placed.includes(item.id)) return null;
  if (item.category) {
    const same = placed.map((id) => owned.find((i) => i.id === id)).find((i) => i?.category === item.category);
    if (same) return `Ya tienes puesto «${same.name}» de la categoría ${item.category}. Quítalo primero.`;
  }
  if (placed.length >= SLOTS[kind]) return 'Ya no hay lugar libre. Quita algo primero.';
  return null;
}

/** Pone o quita un mueble o adorno. Rechaza dos de la misma categoría o si no hay lugar libre. */
export function toggle(
  equipped: Equipped, kind: 'furniture' | 'decor', id: string, owned: readonly InventoryItem[],
): EquipResult {
  const list = equipped[kind];
  if (list.includes(id)) return { ok: true, equipped: { ...equipped, [kind]: list.filter((x) => x !== id) } };
  const item = owned.find((i) => i.id === id && i.kind === kind);
  if (!item) return { ok: false, reason: 'Ese objeto no está en tu inventario.' };
  const reason = placeBlocker(equipped, kind, item, owned);
  return reason ? { ok: false, reason } : { ok: true, equipped: { ...equipped, [kind]: [...list, id] } };
}

/** true si lo puesto cumple todas las reglas con lo que se tiene (lo mismo que valida el contrato). */
export function isValidEquipment(equipped: Equipped, owned: readonly InventoryItem[]): boolean {
  return JSON.stringify(sanitize(equipped, owned)) === JSON.stringify(equipped);
}

export function toDecor(equipped: Equipped, owned: readonly InventoryItem[]): RoomDecor {
  const byId = (id: string | null) => owned.find((i) => i.id === id);
  return {
    wall: byId(equipped.wall)?.color ?? null,
    floor: byId(equipped.floor)?.color ?? null,
    furniture: equipped.furniture.map((id) => byId(id)?.icon ?? '').filter(Boolean),
    decor: equipped.decor.map((id) => byId(id)?.icon ?? '').filter(Boolean),
  };
}

export function accessoryIcon(equipped: Equipped, owned: readonly InventoryItem[]): string | null {
  return owned.find((i) => i.id === equipped.accessory)?.icon ?? null;
}

/* ----------------------------------------------------------- fuentes */

/** Objetos de muestra para probar la interfaz (`?demo=1` en la URL). No son NFT. */
export const DEMO_ITEMS: readonly InventoryItem[] = [
  { id: 'demo:sombrero', kind: 'accessory', name: 'Sombrero', icon: '🎩' },
  { id: 'demo:corona', kind: 'accessory', name: 'Corona', icon: '👑' },
  { id: 'demo:moño', kind: 'accessory', name: 'Moño', icon: '🎀' },
  { id: 'demo:pared-rosa', kind: 'wall', name: 'Pared rosa', icon: '🟪', color: 0xf3a6c8 },
  { id: 'demo:pared-azul', kind: 'wall', name: 'Pared turquesa', icon: '🟦', color: 0x8fd3d6 },
  { id: 'demo:piso-barro', kind: 'floor', name: 'Piso de barro', icon: '🟧', color: 0xc0643c },
  { id: 'demo:piso-pasto', kind: 'floor', name: 'Pasto', icon: '🟩', color: 0x6fae4f },
  { id: 'demo:sillon', kind: 'furniture', name: 'Sillón', icon: '🛋️', category: 'Asiento' },
  { id: 'demo:planta', kind: 'furniture', name: 'Planta', icon: '🪴', category: 'Planta' },
  { id: 'demo:lampara', kind: 'furniture', name: 'Lámpara', icon: '🪔', category: 'Iluminación' },
  { id: 'demo:cuadro', kind: 'decor', name: 'Cuadro', icon: '🖼️', category: 'Colgante' },
  { id: 'demo:reloj', kind: 'decor', name: 'Reloj', icon: '🕰️', category: 'Repisa' },
];

/**
 * Fuente actual: lo comprado en la tienda (`purchased`) y, con `demo`, los objetos de muestra.
 * Reemplazar por la fuente de NFT cuando exista el contrato.
 */
export function createLocalInventory(demo: boolean, purchased: () => readonly InventoryItem[]): InventorySource {
  return { list: async () => [...purchased(), ...(demo ? DEMO_ITEMS : [])] };
}

/* ------------------------------------------------- lo que tiene puesto */

const KEY = 'tamagotchi-polkadot-equipped-v1';
let memory: string | null = null;

export function loadEquipped(): Equipped {
  let raw = memory;
  try { raw = localStorage.getItem(KEY); } catch { /* sin localStorage */ }
  try {
    const d = raw ? (JSON.parse(raw) as Partial<Equipped>) : null;
    const id = (v: unknown) => (typeof v === 'string' ? v : null);
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return d ? { accessory: id(d.accessory), wall: id(d.wall), floor: id(d.floor), furniture: ids(d.furniture), decor: ids(d.decor) } : { ...NOTHING_EQUIPPED };
  } catch {
    return { ...NOTHING_EQUIPPED };
  }
}

export function saveEquipped(equipped: Equipped): void {
  memory = JSON.stringify(equipped);
  try { localStorage.setItem(KEY, memory); } catch { /* se queda en memoria */ }
}

/** Nueva mascota: empieza sin nada puesto (los objetos pertenecen a la mascota que los compró). */
export function clearEquipped(): void {
  saveEquipped({ ...NOTHING_EQUIPPED });
}
