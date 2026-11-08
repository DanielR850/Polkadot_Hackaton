// Ventana de minijuegos: elegir juego → jugar → resultado. Solo muestra y devuelve intenciones;
// la partida la dibuja src/game/minigames/scenes.ts y las recompensas las aplica el controlador.
import { MINI_GAMES, type MiniGameId, type MiniGameResult } from '../game/minigames/rules.ts';
import { createDialog, h } from './dom.ts';

export interface MiniGameIntents {
  /** Empieza la partida dentro de `host`. */
  start(game: MiniGameId, host: HTMLElement): void;
  /** Cobra el resultado (en modos con NFT, primero se firma). */
  claim(result: MiniGameResult): void;
  /** Cierra la ventana; si había una partida, se descarta sin recompensa. */
  close(): void;
}

export interface MiniGameReward { happiness: number; coins: number; record: boolean }

export function createMiniGameDialog(intents: MiniGameIntents) {
  const { dialog, body } = createDialog('Minijuegos', 'minigame-dialog');
  const closeButton = dialog.querySelector<HTMLButtonElement>('.dialog-close');
  const content = h('div', { class: 'minigame-body' });
  body.append(content);
  // Cerrar (✕, Esc o clic fuera) siempre pasa por el controlador para limpiar la partida.
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); intents.close(); });
  closeButton?.addEventListener('click', (event) => { event.stopImmediatePropagation(); intents.close(); }, { capture: true });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { event.stopImmediatePropagation(); intents.close(); } }, { capture: true });

  const button = (label: string, cls: string, onClick: () => void) => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', onClick);
    return b;
  };

  return {
    isOpen: () => dialog.open,
    close() { content.replaceChildren(); if (dialog.open) dialog.close(); },

    /** Paso 1: elegir juego. `blocked`: motivo por el que ahora no puede jugar. */
    choose(best: Record<MiniGameId, number>, blocked: string | null) {
      if (!dialog.open) dialog.showModal();
      content.replaceChildren(
        h('p', { class: 'hint' }, blocked ?? 'Jugar la pone feliz y te da pesitos 🪙, pero la cansa un poco.'),
        h('div', { class: 'minigame-options' }, ...MINI_GAMES.map((g) => {
          const b = h('button', { type: 'button', class: 'mint-card mode-option' },
            h('span', { class: 'mode-icon', 'aria-hidden': 'true' }, g.icon),
            h('span', {}, h('b', {}, g.name), h('small', {}, g.description), h('small', { class: 'minigame-best' }, `Récord: ${best[g.id]}`)));
          b.disabled = blocked !== null;
          b.addEventListener('click', () => this.play(g.id));
          return b;
        })));
    },

    /** Paso 2: la partida, dentro de la ventana. */
    play(game: MiniGameId) {
      const host = h('div', { class: 'minigame-stage', 'aria-label': 'Minijuego' });
      const tip = game === 'catch' ? 'Mueve a tu mascota con el dedo, el mouse o las flechas ← →.' : 'Mueve tu paleta con el dedo, el mouse o las flechas ← →.';
      content.replaceChildren(host, h('p', { class: 'hint' }, tip));
      intents.start(game, host);
    },

    /** Paso 3: resultado. `signs`: en modos con NFT, cobrar pide una firma. */
    result(result: MiniGameResult, reward: MiniGameReward, signs: boolean) {
      const name = MINI_GAMES.find((g) => g.id === result.game)?.name ?? '';
      content.replaceChildren(
        h('p', { class: 'record-title' }, reward.record ? `🏆 ¡Nuevo récord en ${name}!` : `${name}: ¡buen juego!`),
        h('div', { class: 'mint-card minigame-result' },
          h('span', {}, h('small', {}, 'Puntos'), h('b', {}, String(result.score))),
          h('span', {}, h('small', {}, 'Pesitos'), h('b', {}, `+${reward.coins} 🪙`)),
          h('span', {}, h('small', {}, 'Felicidad'), h('b', {}, `+${reward.happiness}`))),
        h('p', { class: 'hint' }, signs
          ? 'Para cobrar, firma el juego en la blockchain. Si no firmas, no se aplica nada.'
          : 'Jugar también la cansa un poco.'),
        h('div', { class: 'row chain-row' },
          button('Salir sin cobrar', 'ghost', intents.close),
          button(signs ? '✍️ FIRMAR Y COBRAR' : '🪙 COBRAR', 'primary', () => intents.claim(result))));
    },
  };
}
