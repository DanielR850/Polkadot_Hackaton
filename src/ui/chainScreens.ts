// Pantallas del modo NFT con el mismo estilo retro del juego local. Solo muestran datos y
// devuelven intenciones; las firmas y la red las maneja el hub de game/src/hub.
import { portraitUrl } from '../game/assets.ts';
import { PETS } from '../game/catalog.ts';
import { NAME_MAX_LENGTH, type NameResult } from '../game/petState.ts';
import { h } from './dom.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/* ------------------------------------------------- barra de cuenta y avisos */

export interface ChainBarView {
  account: string | null;
  balance: string | null;
  showFaucet: boolean;
  busy: string | null;
  error: string | null;
  notice: string | null;
  /** Texto que acompaña a una operación en curso (dónde aprobar la firma). */
  signHint: string;
}

export function createChainBar(onExit: () => void, onDismiss: () => void, faucetUrl: string) {
  const account = h('span', { class: 'chain-account' });
  const faucet = h('a', { class: 'ghost chain-faucet', href: faucetUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Conseguir PAS');
  const exit = h('button', { type: 'button', class: 'ghost' }, '← Juego local');
  exit.addEventListener('click', onExit);
  const bar = h('header', { class: 'chain-bar' },
    h('div', { class: 'chain-brand' }, h('span', { class: 'live-dot' }), h('span', { class: 'eyebrow' }, 'NFT EN POLKADOT')),
    h('div', { class: 'chain-bar-right' }, faucet, account, exit));

  const text = h('span', {});
  const close = h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Cerrar aviso' }, '✕');
  close.addEventListener('click', onDismiss);
  const banner = h('div', { class: 'chain-banner', role: 'status', 'aria-live': 'polite', hidden: true }, text, close);

  return {
    bar,
    banner,
    sync(v: ChainBarView) {
      account.hidden = v.account === null;
      account.textContent = v.account ? `${v.account}${v.balance ? ` · ${v.balance}` : ''}` : '';
      faucet.hidden = !v.showFaucet;
      exit.disabled = v.busy !== null;
      const kind = v.busy ? 'busy' : v.error ? 'error' : v.notice ? 'notice' : null;
      banner.hidden = kind === null;
      if (!kind) return;
      banner.dataset.kind = kind;
      close.hidden = kind === 'busy';
      text.textContent = kind === 'busy' ? `⏳ ${v.busy} ${v.signHint}` : kind === 'error' ? `⚠️ ${v.error}` : v.notice!;
    },
  };
}

/* ------------------------------------------------------------- conectar */

export interface WalletOption { id: string; name: string; icon: string | null }

export interface ConnectView {
  /** null mientras se comprueba si la app está dentro de la Polkadot App. */
  inHost: boolean | null;
  searching: boolean;
  wallets: readonly WalletOption[];
  suggested: ReadonlyArray<{ name: string; url: string }>;
  busy: boolean;
}

export function createConnectScreen(intents: { host(): void; wallet(id: string): void; retry(): void; back(): void }) {
  const help = h('p', { class: 'hint' });
  const list = h('div', { class: 'chain-options' });
  const back = h('button', { type: 'button', class: 'ghost' }, '← Volver');
  back.addEventListener('click', intents.back);
  const root = h('section', { class: 'screen start-screen', 'aria-label': 'Vincular cuenta' },
    h('span', { class: 'eyebrow' }, 'PASO 1 DE 3'), h('h1', { class: 'title' }, 'Vincula tu cuenta'), help, list,
    h('div', { class: 'row chain-row' }, back));

  let lastKey = '';
  return {
    root,
    sync(v: ConnectView) {
      const key = `${v.inHost}|${v.searching}|${v.wallets.map((w) => w.id).join(',')}|${v.busy}`;
      if (key === lastKey) return;
      lastKey = key;
      back.disabled = v.busy;

      if (v.searching || v.inHost === null) {
        help.textContent = 'Buscando tu cuenta…';
        list.replaceChildren();
        return;
      }
      if (v.inHost) {
        help.textContent = 'Tu cuenta es la de la Polkadot App. Acepta en tu teléfono los permisos de cuenta, transacciones y gas.';
        const button = h('button', { type: 'button', class: 'primary big' }, 'CONECTAR');
        button.disabled = v.busy;
        button.addEventListener('click', intents.host);
        list.replaceChildren(button);
        return;
      }
      help.textContent = 'Elige tu wallet: MetaMask o una wallet de Polkadot compatible con EVM (Talisman, SubWallet, Nova).';
      if (v.wallets.length === 0) {
        const retry = h('button', { type: 'button', class: 'ghost' }, 'Buscar de nuevo');
        retry.addEventListener('click', intents.retry);
        list.replaceChildren(
          h('p', { class: 'hint error' }, 'No encontramos ninguna wallet en este navegador. Instala una y recarga:'),
          h('div', { class: 'chain-links' }, ...v.suggested.map((w) => h('a', { class: 'ghost', href: w.url, target: '_blank', rel: 'noopener noreferrer' }, w.name))),
          retry);
        return;
      }
      list.replaceChildren(...v.wallets.map((w) => {
        const button = h('button', { type: 'button', class: 'chain-entry chain-wallet' });
        // Solo iconos embebidos (data:image/...), nunca URLs externas.
        if (w.icon?.startsWith('data:image/')) button.append(h('img', { src: w.icon, alt: '', width: 28, height: 28 }));
        button.append(h('span', {}, w.name));
        button.disabled = v.busy;
        button.addEventListener('click', () => intents.wallet(w.id));
        return button;
      }));
    },
  };
}

/* --------------------------------------------------------------- nombre */

export function createChainNameScreen(onNext: (name: string) => void, onBack: () => void, validate: (raw: string) => NameResult) {
  const input = h('input', {
    id: 'nft-pet-name', class: 'name-input', type: 'text', maxlength: NAME_MAX_LENGTH, autocomplete: 'off',
    placeholder: 'Nombre de tu mascota', 'aria-describedby': 'nft-name-hint',
  });
  const hint = h('p', { id: 'nft-name-hint', class: 'hint' });
  const next = h('button', { type: 'submit', class: 'primary big', disabled: true }, 'SIGUIENTE');
  const back = h('button', { type: 'button', class: 'ghost' }, '← Volver');
  back.addEventListener('click', onBack);
  const form = h('form', { class: 'start-form' },
    h('label', { for: 'nft-pet-name', class: 'eyebrow' }, 'TU MASCOTA NFT SE LLAMA'), input, hint, next);
  const root = h('section', { class: 'screen start-screen', 'aria-label': 'Nombre de la mascota' },
    h('span', { class: 'eyebrow' }, 'PASO 2 DE 3'), h('h1', { class: 'title' }, '¿Cómo se va a llamar?'), form,
    h('div', { class: 'row chain-row' }, back));

  const refresh = () => {
    const result = validate(input.value);
    next.disabled = !result.ok;
    hint.textContent = result.ok || input.value === '' ? 'Podrás cambiarlo después con el botón Nombre.' : result.error;
    hint.classList.toggle('error', !result.ok && input.value !== '');
  };
  input.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validate(input.value);
    if (result.ok) onNext(result.value);
  });

  return {
    root,
    focus(value: string) { input.value = value; refresh(); setTimeout(() => input.focus(), 0); },
  };
}

/* ------------------------------------------------------- elige a (especie) */

export function createChainSpeciesScreen(onAdopt: (petId: number) => void, onBack: () => void) {
  const title = h('h1', { class: 'title' });
  const adopt = h('button', { type: 'submit', class: 'primary' }, '🥚 Adoptar (NFT)');
  const back = h('button', { type: 'button', class: 'ghost' }, '← Volver');
  back.addEventListener('click', onBack);
  const cards = PETS.map((pet, index) => {
    const swatch = h('span', { class: 'pet-swatch', style: `--pet:${hex(pet.color)};--pet-belly:${hex(pet.belly)};--pet-line:${hex(pet.outline)}`, 'aria-hidden': 'true' });
    const portrait = h('img', { class: 'pet-portrait', src: portraitUrl(pet.slug), alt: '', draggable: 'false' });
    portrait.addEventListener('error', () => portrait.replaceWith(swatch), { once: true });
    return h('label', { class: 'pet-option' },
      h('input', { type: 'radio', name: 'nft-pet', value: pet.id, class: 'sr-only', checked: index === 0 }),
      h('span', { class: 'pet-frame' }, portrait),
      h('b', {}, pet.label),
      h('small', {}, 'Tu compañero acuático.'));
  });
  const form = h('form', { class: 'select-form' },
    h('div', { class: 'pet-grid chain-pet-grid', role: 'radiogroup', 'aria-label': 'Mascotas' }, ...cards),
    h('div', { class: 'row' }, back, adopt));
  const root = h('section', { class: 'screen select-screen', 'aria-label': 'Elegir mascota' },
    h('span', { class: 'eyebrow' }, 'PASO 3 DE 3'), title,
    h('p', { class: 'hint' }, 'Al adoptar firmas una transacción que crea tu mascota como NFT en tu cuenta.'), form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = form.querySelector<HTMLInputElement>('input:checked');
    if (checked) onAdopt(Number(checked.value));
  });

  return {
    root,
    sync(name: string, busy: boolean) {
      title.textContent = `Elige a ${name || 'tu mascota'}`;
      adopt.disabled = busy;
      back.disabled = busy;
      for (const input of form.querySelectorAll('input')) input.disabled = busy;
    },
  };
}
