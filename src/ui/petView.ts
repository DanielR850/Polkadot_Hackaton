import type { CareAction, Need, PetState } from '../domain/pet/petState';

const labels: Array<{ key: Need; label: string; icon: string; color: string }> = [
  { key: 'hunger', label: 'Hambre', icon: '🍓', color: '#ec8b68' },
  { key: 'energy', label: 'Energía', icon: '⚡', color: '#e9b84c' },
  { key: 'cleanliness', label: 'Limpieza', icon: '🫧', color: '#70b7c1' },
  { key: 'happiness', label: 'Ánimo', icon: '♡', color: '#d77a9b' },
];
const actions = new Set<CareAction>(['feed', 'play', 'clean', 'sleep']);

export interface PetView {
  render(state: PetState, message?: string): void;
  destroy(): void;
}

export function mountPetView(root: HTMLElement, onAction: (action: CareAction) => void | Promise<void>): PetView {
  const meters = requireElement<HTMLElement>(root, '#meters');
  const feedback = requireElement<HTMLElement>(root, '#feedback');
  const dayLabel = requireElement<HTMLElement>(root, '#day-label');
  const moodEmoji = requireElement<HTMLElement>(root, '#mood-emoji');
  const moodText = requireElement<HTMLElement>(root, '#mood-text');
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action]'));
  const listeners = new Map<HTMLButtonElement, () => void>();

  for (const button of buttons) {
    const listener = () => {
      const action = button.dataset.action;
      if (action && actions.has(action as CareAction)) void onAction(action as CareAction);
    };
    listeners.set(button, listener);
    button.addEventListener('click', listener);
  }

  return {
    render(state, message) {
      meters.innerHTML = labels.map((item) => `
        <div class="meter-row"><div class="meter-label"><span>${item.icon}</span><b>${item.label}</b><strong>${Math.round(state[item.key])}%</strong></div>
        <div class="meter-track"><div class="meter-fill" style="width:${state[item.key]}%;background:${item.color}"></div></div></div>`).join('');
      dayLabel.textContent = `Día ${state.day}`;

      const mood = state.happiness < 30
        ? ['☹', 'Un poquito triste…']
        : state.energy < 25 ? ['☾', 'Necesito descansar'] : ['☺', '¡Qué bonito día!'];
      moodEmoji.textContent = mood[0];
      moodText.textContent = mood[1];
      if (message) feedback.textContent = message;
    },
    destroy() {
      for (const [button, listener] of listeners) button.removeEventListener('click', listener);
    },
  };
}

function requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Falta el elemento de interfaz ${selector}.`);
  return element;
}
