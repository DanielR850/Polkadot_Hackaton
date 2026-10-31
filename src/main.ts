import './style.css';
import { createPetScene } from './game/petScene';
import { createPetState, care, tick, type Need } from './game/petState';

const STORAGE_KEY = 'tamagotchi-polkadot-pet-v1';
const app = document.querySelector<HTMLElement>('#app')!;
const saved = localStorage.getItem(STORAGE_KEY);
const state = createPetState(saved ? JSON.parse(saved) : undefined);
const scene = createPetScene(document.querySelector<HTMLElement>('#game')!);
const labels: Array<{ key: Need; label: string; icon: string; color: string }> = [
  { key: 'hunger', label: 'Hambre', icon: '🍓', color: '#ec8b68' },
  { key: 'energy', label: 'Energía', icon: '⚡', color: '#e9b84c' },
  { key: 'cleanliness', label: 'Limpieza', icon: '🫧', color: '#70b7c1' },
  { key: 'happiness', label: 'Ánimo', icon: '♡', color: '#d77a9b' },
];
const meters = document.querySelector<HTMLElement>('#meters')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function render() {
  meters.innerHTML = labels.map((item) => `
    <div class="meter-row"><div class="meter-label"><span>${item.icon}</span><b>${item.label}</b><strong>${Math.round(state[item.key])}%</strong></div>
    <div class="meter-track"><div class="meter-fill" style="width:${state[item.key]}%;background:${item.color}"></div></div></div>`).join('');
  document.querySelector('#day-label')!.textContent = `Día ${state.day}`;
  const mood = state.happiness < 30 ? ['☹', 'Un poquito triste…'] : state.energy < 25 ? ['☾', 'Necesito descansar'] : ['☺', '¡Qué bonito día!'];
  document.querySelector('#mood-emoji')!.textContent = mood[0];
  document.querySelector('#mood-text')!.textContent = mood[1];
}

app.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action as 'feed' | 'play' | 'clean' | 'sleep';
    const result = care(state, action);
    feedback.textContent = result;
    scene.react(action);
    save();
    render();
  });
});

window.setInterval(() => {
  tick(state);
  save();
  render();
}, 30_000);

render();
