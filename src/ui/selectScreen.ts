import { portraitUrl } from '../game/assets.ts';
import { PETS } from '../game/catalog.ts';
import type { PetId } from '../game/types.ts';
import { h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Elegir 1 de 5 mascotas. Radios nativos: funcionan con toque, mouse y flechas del teclado. */
/** `onPreview` avisa qué mascota está marcada para mostrar su tema de color antes de confirmar. */
export function createSelectScreen(onConfirm: (petId: PetId) => void, onBack: () => void, onPreview: (petId: PetId | null) => void) {
  const greeting = h('p', { class: 'hint' });
  const confirm = h('button', { type: 'submit', class: 'primary', disabled: true }, 'Confirmar');
  const back = h('button', { type: 'button', class: 'ghost' }, '← Cambiar nombre');
  const cards = PETS.map((pet) => {
    const swatch = h('span', { class: 'pet-swatch', style: `--pet:${hex(pet.color)};--pet-belly:${hex(pet.belly)};--pet-line:${hex(pet.outline)}`, 'aria-hidden': 'true' });
    // Retrato pixel del equipo de assets; si todavía no existe se queda el marcador de color.
    const portrait = h('img', { class: 'pet-portrait', src: portraitUrl(pet.slug), alt: '', draggable: 'false' });
    portrait.addEventListener('error', () => portrait.replaceWith(swatch), { once: true });
    return h('label', { class: 'pet-option' },
      h('input', { type: 'radio', name: 'pet', value: pet.id, class: 'sr-only' }),
      h('span', { class: 'pet-frame' }, portrait),
      h('b', {}, pet.label),
      h('small', {}, pet.description));
  });
  const form = h('form', { class: 'select-form' },
    h('div', { class: 'pet-grid', role: 'radiogroup', 'aria-label': 'Mascotas' }, ...cards),
    h('div', { class: 'row' }, back, confirm));
  const root = h('section', { class: 'screen select-screen', 'aria-label': 'Elegir mascota' },
    h('span', { class: 'eyebrow' }, 'PASO 2 DE 2'), h('h1', { class: 'title' }, 'Elige tu mascota'), greeting, form);

  form.addEventListener('change', () => {
    const checked = form.querySelector<HTMLInputElement>('input:checked');
    confirm.disabled = !checked;
    onPreview(checked ? (Number(checked.value) as PetId) : null);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = form.querySelector<HTMLInputElement>('input:checked');
    if (checked) onConfirm(Number(checked.value) as PetId);
  });
  back.addEventListener('click', onBack);

  return {
    root,
    reset(name: string) {
      greeting.textContent = `¿Quién será ${name}?`;
      form.reset();
      confirm.disabled = true;
      onPreview(null);
    },
  };
}
