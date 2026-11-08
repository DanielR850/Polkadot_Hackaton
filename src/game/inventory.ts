// Inventario de accesorios y decoración. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Los objetos los tendrá la persona como NFT (los implementa el equipo después). Este módulo solo
// define qué es un objeto, de dónde se leen (`InventorySource`) y qué tiene puesto. Para conectar
// los NFT basta con crear otra fuente que devuelva `InventoryItem[]` leídos del contrato.

/** Dónde se usa un objeto: en la mascota o en una sección de la habitación. */
export type InventoryKind = 'accessory' | 'wall' | 'floor' | 'furniture' | 'decor';

export interface InventoryItem {
  /** Identificador estable (por ejemplo `nft:<contrato>:<tokenId>`). */
  id: string;
  kind: InventoryKind;
  name: string;
  /** Emoji que lo representa por ahora (accesorios, muebles y adornos). */
  icon: string;
  /** Color de la pared o del piso (0xRRGGBB). */
  color?: number;
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

/** Quita lo que ya no está en el inventario y respeta los lugares disponibles. */
export function sanitize(equipped: Equipped, owned: readonly InventoryItem[]): Equipped {
  const has = (id: string | null, kind: InventoryKind) => (id && owned.some((i) => i.id === id && i.kind === kind) ? id : null);
  const many = (ids: string[], kind: InventoryKind, max: number) =>
    [...new Set(ids)].filter((id) => has(id, kind)).slice(0, max);
  return {
    accessory: has(equipped.accessory, 'accessory'),
    wall: has(equipped.wall, 'wall'),
    floor: has(equipped.floor, 'floor'),
    furniture: many(equipped.furniture, 'furniture', SLOTS.furniture),
    decor: many(equipped.decor, 'decor', SLOTS.decor),
  };
}

/** Pone o quita un mueble o adorno. Devuelve null si ya no hay lugar libre. */
export function toggle(equipped: Equipped, kind: 'furniture' | 'decor', id: string): Equipped | null {
  const list = equipped[kind];
  if (list.includes(id)) return { ...equipped, [kind]: list.filter((x) => x !== id) };
  if (list.length >= SLOTS[kind]) return null;
  return { ...equipped, [kind]: [...list, id] };
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
  { id: 'demo:sillon', kind: 'furniture', name: 'Sillón', icon: '🛋️' },
  { id: 'demo:planta', kind: 'furniture', name: 'Planta', icon: '🪴' },
  { id: 'demo:lampara', kind: 'furniture', name: 'Lámpara', icon: '🪔' },
  { id: 'demo:cuadro', kind: 'decor', name: 'Cuadro', icon: '🖼️' },
  { id: 'demo:reloj', kind: 'decor', name: 'Reloj', icon: '🕰️' },
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
