export type Need = 'hunger' | 'energy' | 'cleanliness' | 'happiness';
export type CareAction = 'feed' | 'play' | 'clean' | 'sleep';
export interface PetState { hunger: number; energy: number; cleanliness: number; happiness: number; day: number; lastDay: number; }

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function createPetState(saved?: Partial<PetState>): PetState {
  const now = Date.now();
  return {
    hunger: clamp(saved?.hunger ?? 82), energy: clamp(saved?.energy ?? 78),
    cleanliness: clamp(saved?.cleanliness ?? 88), happiness: clamp(saved?.happiness ?? 84),
    day: Math.max(1, saved?.day ?? 1), lastDay: saved?.lastDay ?? now,
  };
}

export function care(state: PetState, action: CareAction): string {
  if (action === 'feed') { state.hunger = clamp(state.hunger + 22); state.happiness = clamp(state.happiness + 5); return '¡Qué rico! Tu criatura quedó feliz.'; }
  if (action === 'play') { state.happiness = clamp(state.happiness + 20); state.energy = clamp(state.energy - 12); state.cleanliness = clamp(state.cleanliness - 5); return '¡Se divirtió muchísimo jugando contigo!'; }
  if (action === 'clean') { state.cleanliness = clamp(state.cleanliness + 28); state.happiness = clamp(state.happiness + 4); return '¡Listo! Ahora está fresca y limpia.'; }
  state.energy = clamp(state.energy + 30); state.hunger = clamp(state.hunger - 4); return 'Shhh… está tomando una siesta reparadora.';
}

export function tick(state: PetState, now = Date.now()): void {
  const elapsed = Math.max(0, now - state.lastDay);
  const periods = Math.floor(elapsed / 86_400_000);
  if (periods > 0) { state.day += periods; state.lastDay += periods * 86_400_000; }
  state.hunger = clamp(state.hunger - 0.6);
  state.energy = clamp(state.energy - 0.25);
  state.cleanliness = clamp(state.cleanliness - 0.2);
  state.happiness = clamp(state.happiness - 0.25);
}
