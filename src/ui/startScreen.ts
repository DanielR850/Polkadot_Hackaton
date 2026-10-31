import { NAME_MAX_LENGTH, validateName } from '../game/petState.ts';
import { h } from './dom.ts';

/** Pantalla inicial: nombre grande y botón JUGAR. Devuelve la intención `onPlay(nombre)`. */
export function createStartScreen(onPlay: (name: string) => void, onChain: () => void) {
  const input = h('input', {
    id: 'pet-name', class: 'name-input', type: 'text', maxlength: NAME_MAX_LENGTH, autocomplete: 'off',
    placeholder: 'Nombre de tu mascota', 'aria-describedby': 'name-hint',
  });
  const hint = h('p', { id: 'name-hint', class: 'hint' }, `De 1 a ${NAME_MAX_LENGTH} caracteres.`);
  const play = h('button', { type: 'submit', class: 'primary big', disabled: true }, 'JUGAR');
  const chain = h('button', { type: 'button', class: 'chain-entry' }, 'JUGAR CON NFT EN POLKADOT');
  chain.addEventListener('click', onChain);
  const form = h('form', { class: 'start-form' },
    h('label', { for: 'pet-name', class: 'eyebrow' }, 'TU TAMAGOTCHI SE LLAMA'), input, hint, play);
  const root = h('section', { class: 'screen start-screen', 'aria-label': 'Inicio' },
    h('img', { class: 'app-logo', src: 'app-logo.jpeg', alt: 'Logo de la aplicación' }),
    h('span', { class: 'eyebrow' }, 'MI PEQUEÑO MUNDO'),
    h('h1', { class: 'title' }, 'Tamagotchi Polkadot'),
    form,
    h('p', { class: 'chain-hint' }, 'O adopta una mascota NFT con tu wallet:'),
    chain);

  const refresh = () => {
    const result = validateName(input.value);
    play.disabled = !result.ok;
    hint.textContent = result.ok || input.value === '' ? `De 1 a ${NAME_MAX_LENGTH} caracteres.` : result.error;
    hint.classList.toggle('error', !result.ok && input.value !== '');
  };
  input.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateName(input.value);
    if (result.ok) onPlay(result.value);
  });

  return {
    root,
    reset(name = '') { input.value = name; refresh(); },
    focus() { input.focus(); },
    say(message: string) { hint.textContent = message; hint.classList.add('error'); },
  };
}
