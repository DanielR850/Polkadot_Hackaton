import type { CareItem, ItemKind, PetId, PetSpecies } from './types.ts';

// Las 5 mascotas del equipo. `slug` es el prefijo de sus archivos en `public/assets/characters/`
// (por ejemplo `axolotl-portrait.png`). `id` (0–4) no debe cambiar porque es el que se guarda.
// Los colores son del marcador temporal que se dibuja mientras no hay sprites.
export const PETS: readonly PetSpecies[] = [
  { id: 0, slug: 'axolotl', label: 'Ajolote', description: 'Sonriente y acuático.', color: 0xf5a3bf, outline: 0xc4506f, belly: 0xfbd2df },
  { id: 1, slug: 'wolf', label: 'Lobo', description: 'Leal y aventurero.', color: 0x9aa1aa, outline: 0x4f555e, belly: 0xe1e4e8 },
  { id: 2, slug: 'grizzly', label: 'Oso grizzly', description: 'Grande y comelón.', color: 0xa65c2e, outline: 0x5e3216, belly: 0xcf9461 },
  { id: 3, slug: 'opossum', label: 'Tlacuache', description: 'Astuto y nocturno.', color: 0x6a5b52, outline: 0x342b26, belly: 0xf0dcc4 },
  { id: 4, slug: 'manatee', label: 'Manatí', description: 'Tranquilo y dormilón.', color: 0x7f96a5, outline: 0x4a5d69, belly: 0xa9bdc9 },
];

export const ITEMS: readonly CareItem[] = [
  { id: 'apple', kind: 'food', label: 'Manzana', icon: '🍎', effects: { hunger: 20 } },
  { id: 'strawberry', kind: 'food', label: 'Fresas', icon: '🍓', effects: { hunger: 15, happiness: 5 } },
  { id: 'rice', kind: 'food', label: 'Arroz', icon: '🍚', effects: { hunger: 35, energy: 5 } },
  { id: 'cake', kind: 'food', label: 'Pastel', icon: '🍰', effects: { hunger: 15, happiness: 15, cleanliness: -5 } },
  { id: 'water', kind: 'drink', label: 'Agua', icon: '💧', effects: { thirst: 30 } },
  { id: 'milk', kind: 'drink', label: 'Leche', icon: '🥛', effects: { thirst: 20, hunger: 5 } },
  { id: 'juice', kind: 'drink', label: 'Jugo', icon: '🧃', effects: { thirst: 20, happiness: 8 } },
  { id: 'tea', kind: 'drink', label: 'Té tibio', icon: '🍵', effects: { thirst: 15, energy: 10 } },
];

export function findPet(id: number): PetSpecies | undefined {
  return PETS.find((pet) => pet.id === id);
}

export function isPetId(id: unknown): id is PetId {
  return typeof id === 'number' && PETS.some((pet) => pet.id === id);
}

export function findItem(id: string): CareItem | undefined {
  return ITEMS.find((item) => item.id === id);
}

export function itemsOfKind(kind: ItemKind): CareItem[] {
  return ITEMS.filter((item) => item.kind === kind);
}
