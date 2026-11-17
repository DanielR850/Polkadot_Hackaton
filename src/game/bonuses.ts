// Bonos de los objetos puestos. Lógica pura: suma los porcentajes y los aplica a las recompensas.
//
// Los pesitos 🪙 y la felicidad de los minijuegos son del juego local, así que estos bonos los
// calcula el cliente; el contrato no los conoce. Un bono nunca cambia lo que se firma en la cadena.
import type { Bonus, Equipped, InventoryItem } from './inventory.ts';

export const NO_BONUS: Readonly<Required<Bonus>> = { coins: 0, happiness: 0 };

/** Suma los bonos de todo lo que está puesto (accesorio, pared, piso, muebles y adornos). */
export function totalBonus(equipped: Equipped, owned: readonly InventoryItem[]): Required<Bonus> {
  const ids = [equipped.accessory, equipped.wall, equipped.floor, ...equipped.furniture, ...equipped.decor];
  const total = { ...NO_BONUS };
  for (const id of ids) {
    const bonus = owned.find((i) => i.id === id)?.bonus;
    total.coins += bonus?.coins ?? 0;
    total.happiness += bonus?.happiness ?? 0;
  }
  return total;
}

/** `base` más `percent` %, redondeado. Sin base no hay bono. */
export function applyPercent(base: number, percent: number): number {
  if (base <= 0 || percent <= 0) return base;
  return Math.round((base * (100 + percent)) / 100);
}

/** Texto corto del bono: "+5% pesitos · +10% felicidad". Vacío si no tiene. */
export function describeBonus(bonus: Bonus | undefined): string {
  if (!bonus) return '';
  const parts: string[] = [];
  if (bonus.coins) parts.push(`+${bonus.coins}% pesitos`);
  if (bonus.happiness) parts.push(`+${bonus.happiness}% felicidad`);
  return parts.join(' · ');
}
