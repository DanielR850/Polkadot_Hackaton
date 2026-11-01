// Paso 3: adoptar la mascota elegida como NFT antes de entrar a la habitación.
// Estados: buscando → conectar (Host / wallets / sin wallet) → conectando → cuenta lista →
// adoptando (pasos de la firma) → adopción completada. Los errores salen en un aviso con
// "Reintentar". Solo muestra y devuelve intenciones; la firma la hace src/polkadot/nftMint.ts.
import { portraitUrl } from '../game/assets.ts';
import { findPet } from '../game/catalog.ts';
import { h } from './dom.ts';

export interface MintWalletView { id: string; name: string; icon: string | null }
export type MintStepView = 'simulando' | 'firma' | 'confirmando' | 'leyendo';

export type MintView =
  | { step: 'searching' }
  | { step: 'choose'; inHost: boolean; wallets: readonly MintWalletView[]; suggested: ReadonlyArray<{ name: string; url: string }> }
  | { step: 'connecting'; inHost: boolean; via: string }
  | { step: 'connected'; via: string; address: string; inHost: boolean }
  | { step: 'minting'; inHost: boolean; progress: MintStepView }
  | { step: 'done'; tokenId: string; url: string };

export interface MintIntents {
  /** walletId null = conectar con la Polkadot App (Host). */
  connect(walletId: string | null): void;
  retry(): void;
  mint(): void;
  skip(): void;
  back(): void;
  enter(): void;
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const STEPS: ReadonlyArray<{ key: MintStepView; label: string }> = [
  { key: 'simulando', label: 'Revisando que el contrato acepte la adopción' },
  { key: 'firma', label: 'Esperando tu firma' },
  { key: 'confirmando', label: 'Confirmando en la blockchain' },
  { key: 'leyendo', label: 'Buscando tu NFT' },
];

export function createMintScreen(intents: MintIntents) {
  const eyebrow = h('span', { class: 'eyebrow' }, 'PASO 3 DE 3');
  const title = h('h1', { class: 'title' });
  const portrait = h('span', { class: 'pet-frame mint-frame' });
  const egg = h('span', { class: 'mint-egg', 'aria-hidden': 'true' }, '🥚');
  const stage = h('div', { class: 'mint-stage' }, portrait, egg);
  const help = h('p', { class: 'hint' });
  const body = h('div', { class: 'mint-body' });
  const errorText = h('p', {});
  const errorRetry = h('button', { type: 'button', class: 'ghost' }, 'Reintentar');
  const error = h('div', { class: 'mint-error', role: 'alert', hidden: true }, h('span', { 'aria-hidden': 'true' }, '⚠️'), errorText, errorRetry);
  const back = h('button', { type: 'button', class: 'ghost' }, '← Cambiar mascota');
  const skip = h('button', { type: 'button', class: 'ghost' }, 'Jugar sin NFT');
  const footer = h('div', { class: 'row chain-row' }, back, skip);
  back.addEventListener('click', intents.back);
  skip.addEventListener('click', intents.skip);
  const root = h('section', { class: 'screen select-screen mint-screen', 'aria-label': 'Adoptar como NFT' },
    eyebrow, title, stage, help, body, error, footer);

  let name = '';
  let retry: () => void = intents.retry;
  errorRetry.addEventListener('click', () => retry());
  let timer = 0;
  let startedAt = 0;

  const primary = (label: string, onClick: () => void) => {
    const b = h('button', { type: 'button', class: 'primary big' }, label);
    b.addEventListener('click', onClick);
    return b;
  };
  const loader = (text: string) => h('div', { class: 'mint-loader', role: 'status' },
    h('span', { class: 'mint-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', {}, text));
  const stopTimer = () => { window.clearInterval(timer); timer = 0; };

  function stepper(current: MintStepView, inHost: boolean) {
    const index = STEPS.findIndex((s) => s.key === current);
    const elapsed = h('small', { class: 'mint-elapsed' });
    const tickElapsed = () => { elapsed.textContent = `${Math.floor((Date.now() - startedAt) / 1000)} s`; };
    tickElapsed();
    stopTimer();
    timer = window.setInterval(tickElapsed, 1000);
    const where = inHost ? 'en tu teléfono' : 'en tu wallet';
    return h('div', {},
      h('ol', { class: 'mint-steps' }, ...STEPS.map((s, i) => h('li', { 'data-state': i < index ? 'done' : i === index ? 'now' : 'next' },
        h('span', { class: 'mint-step-dot', 'aria-hidden': 'true' }, i < index ? '✓' : `${i + 1}`),
        h('span', {}, s.key === 'firma' ? `Esperando tu firma ${where}` : s.label)))),
      h('p', { class: 'hint' }, current === 'firma'
        ? `Abre la solicitud ${where} y apruébala. Puede tardar un par de minutos.`
        : 'No cierres la app mientras se confirma.', ' ', elapsed));
  }

  return {
    root,
    /** Pone el nombre y el retrato de la mascota elegida. */
    reset(petName: string, petId: number) {
      name = petName;
      const pet = findPet(petId);
      portrait.replaceChildren(h('img', { class: 'pet-portrait', src: portraitUrl(pet?.slug ?? 'axolotl'), alt: pet?.label ?? '', draggable: 'false' }));
      error.hidden = true;
    },
    /** Aviso de error con botón; `onRetry` decide qué se reintenta (por defecto, buscar la cuenta). */
    showError(message: string | null, onRetry: () => void = intents.retry) {
      error.hidden = !message;
      errorText.textContent = message ?? '';
      retry = onRetry;
    },
    sync(v: MintView) {
      if (v.step !== 'minting') stopTimer();
      const working = v.step === 'searching' || v.step === 'connecting' || v.step === 'minting';
      root.dataset.step = v.step;
      back.disabled = working;
      skip.disabled = v.step === 'connecting' || v.step === 'minting';
      footer.hidden = v.step === 'done';
      eyebrow.textContent = v.step === 'done' ? '¡ADOPCIÓN COMPLETADA!' : 'PASO 3 DE 3';
      title.textContent = v.step === 'done' ? `¡${name} es tuya!` : `Adopta a ${name}`;
      stage.dataset.egg = v.step === 'minting' ? 'wobble' : v.step === 'done' ? 'hatched' : 'idle';
      if (v.step === 'minting' || v.step === 'connecting') error.hidden = true;

      if (v.step === 'searching') {
        help.textContent = '';
        body.replaceChildren(loader('Buscando tu cuenta…'));
      } else if (v.step === 'choose' && v.inHost) {
        help.textContent = 'Tu mascota será un NFT de tu cuenta de la Polkadot App. Su estado vive en la blockchain: cada cuidado es una firma.';
        body.replaceChildren(
          h('div', { class: 'mint-card' },
            h('b', {}, 'Tu teléfono te pedirá:'),
            h('ul', { class: 'mint-perms' },
              h('li', {}, h('span', { 'aria-hidden': 'true' }, '👤'), 'Compartir tu cuenta con PolkaPets'),
              h('li', {}, h('span', { 'aria-hidden': 'true' }, '✍️'), 'Enviar transacciones (adoptar y cada cuidado)'),
              h('li', {}, h('span', { 'aria-hidden': 'true' }, '⛽'), 'Permiso de gas (PGAS) para pagar la comisión'))),
          primary('CONECTAR', () => intents.connect(null)));
      } else if (v.step === 'choose' && v.wallets.length > 0) {
        help.textContent = 'Tu mascota será un NFT de tu wallet. Su estado vive en la blockchain: cada cuidado es una firma.';
        body.replaceChildren(h('p', { class: 'eyebrow' }, 'ELIGE TU WALLET'), h('div', { class: 'chain-options' }, ...v.wallets.map((w) => {
          const b = h('button', { type: 'button', class: 'chain-entry chain-wallet' });
          // Solo iconos embebidos (data:image/...), nunca URLs externas.
          if (w.icon?.startsWith('data:image/')) b.append(h('img', { src: w.icon, alt: '', width: 28, height: 28 }));
          else b.append(h('span', { 'aria-hidden': 'true' }, '👛'));
          b.append(h('span', {}, w.name));
          b.addEventListener('click', () => intents.connect(w.id));
          return b;
        })));
      } else if (v.step === 'choose') {
        help.textContent = 'Para adoptar como NFT necesitas una wallet. También puedes jugar sin NFT.';
        const again = h('button', { type: 'button', class: 'primary' }, 'Ya la instalé, buscar de nuevo');
        again.addEventListener('click', intents.retry);
        body.replaceChildren(h('div', { class: 'mint-card' },
          h('b', {}, 'No encontramos ninguna wallet en este navegador'),
          h('ol', { class: 'mint-howto' },
            h('li', {}, 'Instala una de estas extensiones:'),
            h('li', {}, 'Crea una cuenta y agrega la red Polkadot Hub TestNet.'),
            h('li', {}, 'Recarga esta página o toca el botón de abajo.')),
          h('div', { class: 'chain-links' }, ...v.suggested.map((w) => h('a', { class: 'ghost', href: w.url, target: '_blank', rel: 'noopener noreferrer' }, w.name)))),
          again);
      } else if (v.step === 'connecting') {
        help.textContent = '';
        body.replaceChildren(loader(v.inHost ? 'Acepta los permisos en tu teléfono…' : `Conectando con ${v.via}… Revisa tu wallet.`));
      } else if (v.step === 'connected') {
        help.textContent = '';
        body.replaceChildren(
          h('div', { class: 'mint-card mint-account' },
            h('span', { class: 'live-dot' }),
            h('div', {}, h('small', {}, 'Cuenta conectada'), h('b', {}, `${v.via} · ${short(v.address)}`))),
          primary('🥚 ADOPTAR NFT', intents.mint),
          h('p', { class: 'hint' }, `Firmas la adopción ${v.inHost ? 'en tu teléfono' : 'en tu wallet'}. Después, cada cuidado también se firma y queda en la blockchain.`));
      } else if (v.step === 'minting') {
        if (startedAt === 0 || v.progress === 'simulando') startedAt = Date.now();
        help.textContent = '';
        body.replaceChildren(stepper(v.progress, v.inHost));
      } else {
        startedAt = 0;
        help.textContent = 'Tu mascota ya vive en la blockchain. Sin cuidados aguanta unas 12 horas.';
        const link = h('a', { class: 'ghost', href: v.url, target: '_blank', rel: 'noopener noreferrer' }, 'Ver en Blockscout ↗');
        body.replaceChildren(
          h('div', { class: 'mint-card mint-nft' }, h('small', {}, 'TU NFT'), h('b', { class: 'mint-token' }, `#${v.tokenId}`), h('small', {}, 'PolkaPets · Polkadot Hub TestNet')),
          primary('ENTRAR A LA HABITACIÓN', intents.enter),
          link);
      }
    },
  };
}
