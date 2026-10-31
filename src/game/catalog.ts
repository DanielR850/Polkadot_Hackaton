import type { CareItem, ItemKind, PetId, PetSpecies } from './types.ts';

// Primera versión: solo se puede adoptar el ajolote. Conservamos el id 0 en las partidas guardadas.
export const PETS: readonly PetSpecies[] = [
  { id: 0, slug: 'axolotl', label: 'Ajolote', description: 'Sonriente y acuático.', theme: 0xe4007c, color: 0xf5a3bf, outline: 0xc4506f, belly: 0xfbd2df },
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
