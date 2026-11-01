import { createDialog, h } from './dom.ts';

const ROUND_MS = 12_000;
const TARGETS = [5, 1, 9, 3, 7] as const;

/** Minijuego local de 12 segundos. Cerrar el diálogo cancela sin gastar energía. */
export function createBallGame(onFinish: (catches: number) => void) {
  const { dialog, body, close } = createDialog('Atrapa la pelota', 'ball-dialog');
  const instruction = h('p', { class: 'hint' }, 'Atrapa 5 pelotas antes de que acabe el tiempo. Cada acierto da felicidad; jugar gasta energía y sed.');
  const progress = h('p', { class: 'ball-progress', role: 'status', 'aria-live': 'polite' });
  const field = h('div', { class: 'ball-field', 'aria-label': 'Campo de juego' });
  const ball = h('button', { type: 'button', class: 'ball-target', 'aria-label': 'Atrapar pelota' }, '🎾');
  const cancel = h('button', { type: 'button', class: 'ghost' }, 'Salir sin jugar');
  cancel.addEventListener('click', close);
  field.append(ball);
  body.append(instruction, progress, field, h('div', { class: 'row' }, cancel));

  let catches = 0;
  let deadline = 0;
  let timer = 0;

  function showTarget() {
    const position = TARGETS[catches];
    ball.style.gridColumn = String(((position - 1) % 3) + 1);
    ball.style.gridRow = String(Math.floor((position - 1) / 3) + 1);
    progress.textContent = `${catches}/5 pelotas · ${Math.ceil(Math.max(0, deadline - performance.now()) / 1000)} s`;
  }

  function finish() {
    window.clearInterval(timer);
    close();
    onFinish(catches);
  }

  ball.addEventListener('click', () => {
    if (!dialog.open) return;
    if (performance.now() >= deadline) { finish(); return; }
    catches += 1;
    if (catches === TARGETS.length) { finish(); return; }
    showTarget();
  });
  dialog.addEventListener('close', () => window.clearInterval(timer));

  return {
    open() {
      catches = 0;
      deadline = performance.now() + ROUND_MS;
      showTarget();
      dialog.showModal();
      ball.focus();
      timer = window.setInterval(() => {
        if (performance.now() >= deadline) finish();
        else showTarget();
      }, 200);
    },
  };
}
