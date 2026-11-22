// Botón flotante de música: abre un panel con silenciar y el volumen. Solo devuelve intenciones.
import { h } from './dom.ts';

export interface SoundState { volume: number; muted: boolean }

const icon = (s: SoundState) => (s.muted || s.volume === 0 ? '🔇' : s.volume < 0.5 ? '🔉' : '🔊');

export function createSoundControl(initial: SoundState, onChange: (s: SoundState) => void) {
  let state = { ...initial };
  const toggle = h('button', { type: 'button', class: 'sound-toggle', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': 'Música' });
  const mute = h('button', { type: 'button', class: 'ghost sound-mute' });
  const down = h('button', { type: 'button', class: 'ghost sound-step', 'aria-label': 'Bajar volumen' }, '−');
  const up = h('button', { type: 'button', class: 'ghost sound-step', 'aria-label': 'Subir volumen' }, '+');
  const slider = h('input', { type: 'range', min: 0, max: 100, step: 5, class: 'sound-slider', 'aria-label': 'Volumen de la música' });
  const level = h('span', { class: 'sound-level' });
  const panel = h('div', { class: 'sound-panel', role: 'group', 'aria-label': 'Música', hidden: true },
    h('span', { class: 'eyebrow' }, 'MÚSICA'), mute, h('div', { class: 'sound-row' }, down, slider, up), level);
  const root = h('div', { class: 'sound-control' }, panel, toggle);

  const render = () => {
    toggle.textContent = icon(state);
    mute.textContent = state.muted ? '🔈 Activar sonido' : '🔇 Silenciar';
    mute.setAttribute('aria-pressed', String(state.muted));
    slider.value = String(Math.round(state.volume * 100));
    level.textContent = state.muted ? 'Silenciada' : `${Math.round(state.volume * 100)} %`;
  };
  const set = (patch: Partial<SoundState>) => {
    state = { ...state, ...patch };
    render();
    onChange(state);
  };
  /** Cambiar el volumen también quita el silencio. */
  const setVolume = (v: number) => set({ volume: Math.max(0, Math.min(1, Math.round(v * 20) / 20)), muted: false });

  const open = (value: boolean) => {
    panel.hidden = !value;
    toggle.setAttribute('aria-expanded', String(value));
  };
  toggle.addEventListener('click', () => open(panel.hidden));
  mute.addEventListener('click', () => set({ muted: !state.muted }));
  down.addEventListener('click', () => setVolume(state.volume - 0.1));
  up.addEventListener('click', () => setVolume(state.volume + 0.1));
  slider.addEventListener('input', () => setVolume(Number(slider.value) / 100));
  document.addEventListener('pointerdown', (event) => { if (!root.contains(event.target as Node)) open(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') open(false); });

  render();
  return { root };
}
