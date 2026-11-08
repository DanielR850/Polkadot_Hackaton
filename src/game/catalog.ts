import type { CareItem, ItemKind, PetId, PetSpecies } from './types.ts';

// Los ids son estables para conservar las partidas guardadas y el ranking local.
export const PETS: readonly PetSpecies[] = [
  { id: 0, slug: 'axolotl', label: 'Ajolote', description: 'Sonriente y acuático.', theme: 0xe4007c, color: 0xf5a3bf, outline: 0xc4506f, belly: 0xfbd2df },
  { id: 1, slug: 'wolf', label: 'Lobo', description: 'Curioso y juguetón.', theme: 0x6575ad, color: 0x9396a8, outline: 0x4f526d, belly: 0xece6e0 },
  { id: 2, slug: 'bear', label: 'Oso grizzly', description: 'Dulce y aventurero.', theme: 0xa96b40, color: 0x9c6245, outline: 0x593a36, belly: 0xecc99c },
  { id: 3, slug: 'opossum', label: 'Tlacuache', description: 'Travieso y nocturno.', theme: 0x9b7590, color: 0x82777c, outline: 0x48435b, belly: 0xf0dfd1 },
  { id: 4, slug: 'manatee', label: 'Manatí', description: 'Tranquilo y amigable.', theme: 0x5b9baa, color: 0x819fb3, outline: 0x435c78, belly: 0xc8d9e2 },
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
