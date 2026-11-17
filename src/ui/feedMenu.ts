import { itemsOfKind } from '../game/catalog.ts';
import type { ItemKind } from '../game/types.ts';
import { createDialog, h } from './dom.ts';

const EFFECT_LABEL: Record<string, string> = { hunger: 'hambre', thirst: 'sed', energy: 'energía', happiness: 'felicidad', cleanliness: 'limpieza' };

/** Menú de alimentar con pestañas Comidas y Bebidas. Se elige un elemento a la vez y se da con "Dar". */
export function createFeedMenu(onGive: (itemId: string) => void) {
  const { dialog, body, close } = createDialog('¿Qué le damos?', 'feed-dialog');
  const give = h('button', { type: 'submit', class: 'primary', disabled: true }, 'Dar');
  const panels = new Map<ItemKind, HTMLElement>();
  const tabs = new Map<ItemKind, HTMLButtonElement>();
  const tabList = h('div', { class: 'tabs', role: 'tablist' });

  for (const [kind, label] of [['food', 'Comidas'], ['drink', 'Bebidas']] as const) {
    const tab = h('button', { type: 'button', role: 'tab', id: `tab-${kind}`, 'aria-controls': `panel-${kind}` }, label);
    const panel = h('div', { class: 'item-grid', role: 'tabpanel', id: `panel-${kind}`, 'aria-labelledby': `tab-${kind}` },
      ...itemsOfKind(kind).map((item) => {
        const effects = Object.entries(item.effects)
          .map(([key, value]) => `${value! > 0 ? '+' : ''}${value} ${EFFECT_LABEL[key]}`).join(' · ');
        return h('label', { class: 'item-option' },
          h('input', { type: 'radio', name: 'item', value: item.id, class: 'sr-only' }),
          h('span', { class: 'item-icon', 'aria-hidden': 'true' }, item.icon), h('b', {}, item.label), h('small', {}, effects));
      }));
    tab.addEventListener('click', () => select(kind));
    tabList.append(tab);
    tabs.set(kind, tab);
    panels.set(kind, panel);
  }

  const form = h('form', {}, tabList, ...panels.values(), h('div', { class: 'row' }, give));
  body.append(form);

  function select(kind: ItemKind) {
    for (const [k, tab] of tabs) tab.setAttribute('aria-selected', String(k === kind));
    for (const [k, panel] of panels) panel.hidden = k !== kind;
    form.reset();
    give.disabled = true;
  }

  form.addEventListener('change', () => { give.disabled = !form.querySelector('input:checked'); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = form.querySelector<HTMLInputElement>('input:checked');
    if (!checked) return;
    close();
    onGive(checked.value);
  });

  return {
    open() { select('food'); dialog.showModal(); },
  };
}
