import { portraitUrl } from '../game/assets.ts';
import { PETS } from '../game/catalog.ts';
import { findVariant, recolorPixels, SPECIES_RAMPS, variantsOf, variantSwatch } from '../game/variants.ts';
import type { PetId } from '../game/types.ts';
import { h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export type PetSelection = { petId: PetId; variant: string | null };
const previews = new Map<string, string>();

/** Genera el retrato recoloreado con el mismo algoritmo que usa Phaser en la escena. */
async function recoloredPortrait(petId: PetId, slug: string, variantId: string): Promise<string | null> {
  const cacheKey = `${petId}:${variantId}`;
  const cached = previews.get(cacheKey);
  if (cached) return cached;
  const ramp = SPECIES_RAMPS[petId];
  const variant = findVariant(petId, variantId);
  if (!ramp || !variant) return null;
  const image = new Image();
  image.src = portraitUrl(slug);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(recolorPixels(pixels.data, canvas.width, canvas.height, ramp, variant));
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL('image/png');
  previews.set(cacheKey, url);
  return url;
}

/** Elegir especie y variante visual. El mint sigue recibiendo únicamente el ID de especie. */
export function createSelectScreen(
  onConfirm: (petId: PetId, variant: string | null) => void,
  onBack: () => void,
  onPreview: (petId: PetId | null) => void,
) {
  const greeting = h('p', { class: 'hint' });
  const confirm = h('button', { type: 'submit', class: 'primary', disabled: true }, 'Confirmar');
  const back = h('button', { type: 'button', class: 'ghost' }, '← Cambiar nombre');
  const portraits = new Map<PetId, HTMLImageElement>();
  const cards = PETS.map((pet) => {
    const swatch = h('span', { class: 'pet-swatch', style: `--pet:${hex(pet.color)};--pet-belly:${hex(pet.belly)};--pet-line:${hex(pet.outline)}`, 'aria-hidden': 'true' });
    const portrait = h('img', { class: 'pet-portrait', src: portraitUrl(pet.slug), alt: '', draggable: 'false' });
    portrait.addEventListener('error', () => portrait.replaceWith(swatch), { once: true });
    portraits.set(pet.id, portrait);
    return h('label', { class: 'pet-option' },
      h('input', { type: 'radio', name: 'pet', value: pet.id, class: 'sr-only' }),
      h('span', { class: 'pet-frame' }, portrait), h('b', {}, pet.label), h('small', {}, pet.description));
  });
  const colorRow = h('div', { class: 'choice-row', role: 'group', 'aria-label': 'Variante de color' });
  const options = h('div', { class: 'pet-options', hidden: true },
    h('p', { class: 'eyebrow' }, 'COLOR DE TU MASCOTA'), colorRow,
    h('small', { class: 'hint' }, 'El color es visual y también se guarda en tu partida. El NFT conserva la especie elegida.'));
  let petId: PetId | null = null;
  let variant: string | null = null;

  const choiceButton = (label: string, pressed: boolean, onClick: () => void, color?: number) => {
    const button = h('button', { type: 'button', class: 'choice', 'aria-pressed': String(pressed) },
      ...(color === undefined ? [] : [h('span', { class: 'choice-swatch', style: `background:${hex(color)}`, 'aria-hidden': 'true' })]), label);
    button.addEventListener('click', onClick);
    return button;
  };

  function drawOptions() {
    options.hidden = petId === null;
    if (petId === null) return;
    const species = PETS.find((pet) => pet.id === petId)!;
    colorRow.replaceChildren(
      choiceButton('Original', variant === null, () => { variant = null; drawOptions(); void showPortrait(); }, species.color),
      ...variantsOf(petId).map((choice) => choiceButton(choice.name, variant === choice.id,
        () => { variant = choice.id; drawOptions(); void showPortrait(); }, variantSwatch(choice))),
    );
  }

  async function showPortrait() {
    if (petId === null) return;
    const species = PETS.find((pet) => pet.id === petId);
    const portrait = species ? portraits.get(petId) : undefined;
    if (!species || !portrait) return;
    if (variant === null) { portrait.src = portraitUrl(species.slug); return; }
    const requested = variant;
    try {
      const url = await recoloredPortrait(petId, species.slug, requested);
      if (url && requested === variant && petId === species.id) portrait.src = url;
    } catch { /* conserva el retrato original si el navegador no puede procesarlo */ }
  }

  const form = h('form', { class: 'select-form' },
    h('div', { class: 'pet-grid', role: 'radiogroup', 'aria-label': 'Mascotas' }, ...cards), options,
    h('div', { class: 'row' }, back, confirm));
  const root = h('section', { class: 'screen select-screen', 'aria-label': 'Elegir mascota' },
    h('span', { class: 'eyebrow' }, 'PASO 2 DE 3'), h('h1', { class: 'title' }, 'Elige tu mascota'), greeting, form);

  form.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLInputElement) || event.target.name !== 'pet') return;
    const checked = form.querySelector<HTMLInputElement>('input[name="pet"]:checked');
    confirm.disabled = !checked;
    const next = checked ? (Number(checked.value) as PetId) : null;
    if (next !== petId) variant = null;
    petId = next;
    drawOptions();
    void showPortrait();
    onPreview(petId);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (petId !== null) onConfirm(petId, variant);
  });
  back.addEventListener('click', onBack);

  return {
    root,
    reset(name: string) {
      greeting.textContent = `¿Quién será ${name}?`;
      form.reset(); petId = null; variant = null; confirm.disabled = true;
      drawOptions(); void showPortrait(); onPreview(null);
    },
  };
}
