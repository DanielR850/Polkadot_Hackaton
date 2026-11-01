import type { Stats } from '../game/types.ts';
import { h } from './dom.ts';
import { BAR_INFO, barLevel } from './format.ts';

export type GameMode = 'normal' | 'sleep' | 'bath' | 'dead';

export interface GameView {
  name: string;
  stageLabel: string;
  ageLabel: string;
  stats: Stats;
  mode: GameMode;
  /** true mientras dura la animación de comer o jugar: una acción a la vez. */
  busy: boolean;
  bathProgress: number;
  mood: { icon: string; text: string };
}

export interface GameIntents {
  feed(): void;
  play(): void;
  sleep(): void;
  wake(): void;
  bath(): void;
  exitBath(): void;
  rename(): void;
  ranking(): void;
  restart(): void;
}

export interface GameScreenOptions {
  /** Nota al pie de los cuidados. Por defecto, la del juego local. */
  note?: { text: string; detail: string };
}

/** Pantalla de juego: habitación (canvas), barras y acciones. Solo muestra y devuelve intenciones. */
export function createGameScreen(intents: GameIntents, options: GameScreenOptions = {}) {
  const note = options.note ?? { text: 'Tu partida se guarda en este dispositivo.', detail: 'Cuidarla es gratis: no pide firmas.' };
  const noteText = h('span', {}, note.text);
  const noteDetail = h('small', {}, note.detail);
  const nameEl = h('h1', {});
  const stageEl = h('span', {});
  const ageEl = h('span', { class: 'age' });
  const gameHost = h('div', { id: 'game', 'aria-label': 'Mascota animada' });
  const moodIcon = h('span', {});
  const moodText = h('span', {});
  const feedback = h('p', { class: 'feedback', 'aria-live': 'polite' }, 'Tu mascota te está esperando.');
  const toast = h('div', { class: 'toast', role: 'status', hidden: true });
  const menuButton = h('button', { type: 'button', class: 'menu-button', 'aria-expanded': 'false', 'aria-controls': 'game-menu' }, '☰ Menú');
  const menuClose = h('button', { type: 'button', class: 'ghost' }, 'Continuar partida');
  const chooseAnother = h('button', { type: 'button', class: 'ghost' }, 'Elegir otra mascota');
  const menu = h('div', { id: 'game-menu', class: 'game-menu', hidden: true },
    h('strong', {}, 'MENÚ DE PARTIDA'),
    h('p', {}, 'Elegir otra mascota reemplaza esta partida guardada en tu dispositivo.'),
    menuClose, chooseAnother);
  const toggleMenu = (open: boolean) => {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', () => toggleMenu(menu.hidden));
  menuClose.addEventListener('click', () => toggleMenu(false));
  chooseAnother.addEventListener('click', () => { toggleMenu(false); intents.restart(); });

  const bars = BAR_INFO.map((info) => {
    const value = h('strong', {});
    const fill = h('div', { class: 'meter-fill' });
    const track = h('div', { class: 'meter-track', role: 'progressbar', 'aria-label': info.label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
    const row = h('div', { class: `meter-row${info.key === 'health' ? ' health' : ''}` },
      h('div', { class: 'meter-label' }, h('span', { 'aria-hidden': 'true' }, info.icon), h('b', {}, info.label), value), track);
    return { info, row, value, fill, track };
  });

  const action = (icon: string, label: string, onClick: () => void) => {
    const text = h('b', {}, label);
    const iconEl = h('span', { 'aria-hidden': 'true' }, icon);
    const button = h('button', { type: 'button' }, iconEl, text);
    button.addEventListener('click', onClick);
    return { button, text, iconEl };
  };
  const feedBtn = action('🍓', 'Alimentar', intents.feed);
  const playBtn = action('🎾', 'Jugar', intents.play);
  const sleepBtn = action('🌙', 'Dormir', () => (currentMode === 'sleep' ? intents.wake() : intents.sleep()));
  const bathBtn = action('🛁', 'Bañar', intents.bath);
  const renameBtn = action('✏️', 'Nombre', intents.rename);
  const rankingBtn = action('🏆', 'Ranking', intents.ranking);
  const actions = h('div', { class: 'actions' }, ...[feedBtn, playBtn, sleepBtn, bathBtn, renameBtn, rankingBtn].map((a) => a.button));

  const bathFill = h('div', { class: 'meter-fill bath-fill' });
  const bathTrack = h('div', { class: 'meter-track', role: 'progressbar', 'aria-label': 'Progreso del baño', 'aria-valuemin': 0, 'aria-valuemax': 100 }, bathFill);
  const exitBath = h('button', { type: 'button', class: 'primary' }, 'Salir del baño');
  exitBath.addEventListener('click', intents.exitBath);
  const bathPanel = h('div', { class: 'mode-panel', hidden: true },
    h('p', {}, 'Mueve la esponja sobre tu mascota para limpiarla.'), bathTrack, exitBath);

  const deathTime = h('p', { class: 'death-time' });
  const restart = h('button', { type: 'button', class: 'primary' }, 'Jugar de nuevo');
  restart.addEventListener('click', intents.restart);
  const deathPanel = h('div', { class: 'mode-panel death-panel', hidden: true },
    h('span', { class: 'death-icon', 'aria-hidden': 'true' }, '🕊️'), h('h2', {}, 'Tu mascota se fue'), deathTime, restart);

  const careControls = h('div', {}, h('div', { class: 'meters' }, ...bars.map((b) => b.row)), actions, bathPanel, feedback);

  const root = h('section', { class: 'screen game-screen', 'aria-label': 'Juego' },
    h('header', { class: 'topbar' },
      h('div', {}, h('span', { class: 'eyebrow' }, 'MI PEQUEÑO MUNDO'), nameEl),
      h('div', { class: 'topbar-tools' }, menuButton,
        h('div', { class: 'day-pill' }, h('span', { class: 'live-dot' }), stageEl, ageEl), menu)),
    h('main', { class: 'layout' },
      h('section', { class: 'pet-card', 'aria-label': 'Habitación de la mascota' },
        h('div', { class: 'room-label' }, h('span', {}, '⌂'), ' HABITACIÓN'), gameHost,
        h('div', { class: 'pet-caption' }, moodIcon, moodText), toast),
      h('aside', { class: 'care-card' },
        h('div', { class: 'card-heading' }, h('div', {}, h('span', { class: 'eyebrow' }, 'CUIDADOS'), h('h2', {}, '¿Qué hacemos?')), h('span', { class: 'sparkle' }, '✦')),
        careControls, deathPanel,
        h('div', { class: 'local-note' }, h('span', {}, '☁'),
          h('p', {}, noteText, h('br'), noteDetail)))));

  let currentMode: GameMode = 'normal';
  let toastTimer = 0;

  return {
    root,
    gameHost,
    update(view: GameView) {
      currentMode = view.mode;
      nameEl.textContent = view.name;
      stageEl.textContent = view.stageLabel;
      ageEl.textContent = view.ageLabel;
      moodIcon.textContent = view.mood.icon;
      moodText.textContent = view.mood.text;
      for (const bar of bars) {
        const value = Math.round(view.stats[bar.info.key]);
        bar.value.textContent = `${value}%`;
        bar.fill.style.width = `${value}%`;
        bar.fill.dataset.level = barLevel(value);
        bar.track.setAttribute('aria-valuenow', String(value));
      }
      const sleeping = view.mode === 'sleep';
      sleepBtn.text.textContent = sleeping ? 'Despertar' : 'Dormir';
      sleepBtn.iconEl.textContent = sleeping ? '☀️' : '🌙';
      for (const a of [feedBtn, playBtn, bathBtn]) a.button.disabled = view.mode !== 'normal' || view.busy;
      sleepBtn.button.disabled = view.mode === 'dead' || view.busy;
      renameBtn.button.disabled = view.mode === 'dead';
      actions.hidden = view.mode === 'bath';
      bathPanel.hidden = view.mode !== 'bath';
      const bath = Math.round(view.bathProgress);
      bathFill.style.width = `${bath}%`;
      bathTrack.setAttribute('aria-valuenow', String(bath));
      careControls.hidden = view.mode === 'dead';
      deathPanel.hidden = view.mode !== 'dead';
      deathTime.textContent = `${view.name} vivió ${view.ageLabel}. Etapa: ${view.stageLabel.toLowerCase()}.`;
    },
    say(text: string) { feedback.textContent = text; },
    setNote(text: string, detail: string) { noteText.textContent = text; noteDetail.textContent = detail; },
    showToast(text: string) {
      toast.textContent = text;
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3500);
    },
  };
}
