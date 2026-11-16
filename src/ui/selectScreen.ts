import { portraitUrl } from '../game/assets.ts';
import { PETS } from '../game/catalog.ts';
import { DEFAULT_LIFE_HOURS, DIFFICULTIES } from '../game/config.ts';
import type { LifeHours, PetId } from '../game/types.ts';
import { findVariant, recolorPixels, SPECIES_RAMPS, variantsOf, variantSwatch } from '../game/variants.ts';
import { h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface PetChoice { variant: string | null; lifeHours: LifeHours }

/** Retratos recoloreados ya calculados (por especie y variante). */
const previews = new Map<string, string>();

/** Recolorea el retrato con la variante (mismo algoritmo que el juego) y devuelve una URL. */
export async function recoloredPortrait(petId: PetId, slug: string, variantId: string): Promise<string | null> {
  const key = `${petId}:${variantId}`;
  const cached = previews.get(key);
  if (cached) return cached;
  const ramp = SPECIES_RAMPS[petId];
  const variant = findVariant(petId, variantId);
  if (!ramp || !variant) return null;
  const img = new Image();
  img.src = portraitUrl(slug);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(recolorPixels(pixels.data, canvas.width, canvas.height, ramp, variant));
  ctx.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL('image/png');
  previews.set(key, url);
  return url;
}

/**
 * Elegir 1 de 5 mascotas, su color y la dificultad. Radios nativos: funcionan con toque, mouse y
 * flechas del teclado. `onPreview` avisa qué mascota está marcada para mostrar su tema de color.
 */
export function createSelectScreen(onConfirm: (petId: PetId, choice: PetChoice) => void, onBack: () => void, onPreview: (petId: PetId | null) => void) {
  const greeting = h('p', { class: 'hint' });
  const confirm = h('button', { type: 'submit', class: 'primary', disabled: true }, 'Confirmar');
  const back = h('button', { type: 'button', class: 'ghost' }, '← Cambiar nombre');
  const portraits = new Map<PetId, HTMLImageElement>();
  const cards = PETS.map((pet) => {
    const swatch = h('span', { class: 'pet-swatch', style: `--pet:${hex(pet.color)};--pet-belly:${hex(pet.belly)};--pet-line:${hex(pet.outline)}`, 'aria-hidden': 'true' });
    // Retrato pixel del equipo de assets; si todavía no existe se queda el marcador de color.
    const portrait = h('img', { class: 'pet-portrait', src: portraitUrl(pet.slug), alt: '', draggable: 'false' });
    portrait.addEventListener('error', () => portrait.replaceWith(swatch), { once: true });
    portraits.set(pet.id, portrait);
    return h('label', { class: 'pet-option' },
      h('input', { type: 'radio', name: 'pet', value: pet.id, class: 'sr-only' }),
      h('span', { class: 'pet-frame' }, portrait),
      h('b', {}, pet.label),
      h('small', {}, pet.description));
  });

  let petId: PetId | null = null;
  let variant: string | null = null;
  let lifeHours: LifeHours = DEFAULT_LIFE_HOURS;
  const colorRow = h('div', { class: 'choice-row', role: 'group', 'aria-label': 'Color' });
  const lifeRow = h('div', { class: 'choice-row', role: 'group', 'aria-label': 'Dificultad' });
  const lifeHint = h('small', { class: 'hint' });
  const options = h('div', { class: 'pet-options', hidden: true },
    h('p', { class: 'eyebrow' }, 'COLOR'), colorRow,
    h('p', { class: 'eyebrow' }, 'DIFICULTAD'), lifeRow, lifeHint);

  const choiceButton = (label: string, pressed: boolean, onClick: () => void, swatchColor?: number) => {
    const b = h('button', { type: 'button', class: 'choice', 'aria-pressed': String(pressed) },
      ...(swatchColor !== undefined ? [h('span', { class: 'choice-swatch', style: `background:${hex(swatchColor)}`, 'aria-hidden': 'true' })] : []),
      label);
    b.addEventListener('click', onClick);
    return b;
  };

  function drawOptions() {
    options.hidden = petId === null;
    if (petId === null) return;
    const pet = PETS.find((p) => p.id === petId)!;
    colorRow.replaceChildren(
      choiceButton('Original', variant === null, () => { variant = null; drawOptions(); void showPortrait(); }, pet.color),
      ...variantsOf(petId).map((v) => choiceButton(v.name, variant === v.id, () => { variant = v.id; drawOptions(); void showPortrait(); }, variantSwatch(v))));
    lifeRow.replaceChildren(...DIFFICULTIES.map((d) => choiceButton(`${d.label} · ${d.hours} h`, lifeHours === d.hours, () => { lifeHours = d.hours; drawOptions(); })));
    lifeHint.textContent = DIFFICULTIES.find((d) => d.hours === lifeHours)?.detail ?? '';
  }

  /** Muestra el retrato con el color elegido (los demás vuelven al original). */
  async function showPortrait() {
    for (const pet of PETS) {
      const img = portraits.get(pet.id);
      if (img && pet.id !== petId && !img.src.endsWith(portraitUrl(pet.slug))) img.src = portraitUrl(pet.slug);
    }
    if (petId === null) return;
    const pet = PETS.find((p) => p.id === petId)!;
    const img = portraits.get(petId);
    if (!img) return;
    if (variant === null) { img.src = portraitUrl(pet.slug); return; }
    const wanted = variant;
    const forPet = petId;
    try {
      const url = await recoloredPortrait(forPet, pet.slug, wanted);
      if (url && variant === wanted && petId === forPet) img.src = url;
    } catch { /* si falla, se queda el retrato original */ }
  }

  const form = h('form', { class: 'select-form' },
    h('div', { class: 'pet-grid', role: 'radiogroup', 'aria-label': 'Mascotas' }, ...cards),
    options,
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
    if (petId !== null) onConfirm(petId, { variant, lifeHours });
  });
  back.addEventListener('click', onBack);

  return {
    root,
    reset(name: string) {
      greeting.textContent = `¿Quién será ${name}?`;
      form.reset();
      petId = null;
      variant = null;
      lifeHours = DEFAULT_LIFE_HOURS;
      confirm.disabled = true;
      drawOptions();
      void showPortrait();
      onPreview(null);
    },
  };
}
