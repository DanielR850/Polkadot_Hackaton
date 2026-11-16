// "Mis animales": la mascota de ahora y las anteriores, con su retrato en el color que tuvieron.
// Solo muestra; el historial lo arma el controlador (src/game/history.ts).
import { portraitUrl } from '../game/assets.ts';
import { findPet } from '../game/catalog.ts';
import { summarize, type PetRecord } from '../game/history.ts';
import { findVariant } from '../game/variants.ts';
import { createDialog, h } from './dom.ts';
import { formatDuration } from './format.ts';
import { recoloredPortrait } from './selectScreen.ts';

export interface CollectionView {
  /** La mascota actual (viva o muerta), si hay partida. */
  current: PetRecord | null;
  history: readonly PetRecord[];
}

function card(r: PetRecord, now: boolean): HTMLElement {
  const pet = findPet(r.petId);
  const img = h('img', { class: 'pet-portrait', src: portraitUrl(pet?.slug ?? 'axolotl'), alt: '', draggable: 'false' });
  if (r.variant && pet) void recoloredPortrait(r.petId, pet.slug, r.variant).then((url) => { if (url) img.src = url; }).catch(() => {});
  const color = findVariant(r.petId, r.variant)?.name ?? 'Original';
  const mode = r.peaceful ? 'Pacífico' : 'Competencia';
  const status = r.diedAt !== null ? `Vivió ${formatDuration(r.aliveMs)}` : now ? `Lleva ${formatDuration(r.aliveMs)}` : `La cuidaste ${formatDuration(r.aliveMs)}`;
  return h('article', { class: `pet-record${now ? ' now' : ''}${r.diedAt !== null ? ' gone' : ''}` },
    h('span', { class: 'pet-frame' }, img),
    h('div', {},
      h('b', {}, r.name, now ? h('small', { class: 'record-now' }, ' ahora') : null),
      h('small', {}, `${pet?.label ?? ''} · ${color}`),
      h('small', {}, `${mode}${r.lifeHours ? ` · ${r.lifeHours} h` : ''}${r.tokenId ? ` · NFT #${r.tokenId}` : ''}`),
      h('small', { class: 'record-time' }, r.diedAt !== null ? `${status} · descansa en paz` : status)));
}

export function createCollectionDialog() {
  const { dialog, body } = createDialog('Mis animales', 'inventory-dialog collection-dialog');
  return {
    open(v: CollectionView) {
      const all = v.current ? [v.current, ...v.history] : [...v.history];
      const sum = summarize(all);
      body.replaceChildren(
        h('p', { class: 'hint' }, sum.total === 0
          ? 'Todavía no has cuidado a ningún animal. ¡Adopta al primero!'
          : `Has cuidado ${sum.total} ${sum.total === 1 ? 'animal' : 'animales'}.${sum.best ? ` El que más aguantó: ${sum.best.name} (${formatDuration(sum.best.aliveMs)}).` : ''}`),
        h('div', { class: 'record-list' },
          ...(v.current ? [card(v.current, true)] : []),
          ...v.history.map((r) => card(r, false))));
      if (!dialog.open) dialog.showModal();
    },
  };
}
