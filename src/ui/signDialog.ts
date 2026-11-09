// Ventana de firma para cada cuidado del NFT (alimentar, jugar, dormir, bañar y cambiar nombre).
// Estados: buscando cuenta → elegir cuenta → conectando → cuenta equivocada → firmando (pasos) →
// error con "Reintentar". Solo muestra y devuelve intenciones; la firma la hace src/polkadot/nftMint.ts.
import { createDialog, h } from './dom.ts';
import type { MintWalletView } from './mintScreen.ts';

export type SignStep = 'simulando' | 'firma' | 'confirmando';

export type SignView =
  | { step: 'searching' }
  | { step: 'choose'; inHost: boolean; wallets: readonly MintWalletView[]; suggested: ReadonlyArray<{ name: string; url: string }> }
  | { step: 'connecting'; inHost: boolean }
  | { step: 'wrongAccount'; connected: string; expected: string }
  | { step: 'signing'; inHost: boolean; progress: SignStep };

export interface SignIntents {
  connect(walletId: string | null): void;
  retry(): void;
  cancel(): void;
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const STEPS: ReadonlyArray<{ key: SignStep; label: string }> = [
  { key: 'simulando', label: 'Probando la transacción (sin costo)' },
  { key: 'firma', label: 'Esperando tu firma' },
  { key: 'confirmando', label: 'Confirmando en la blockchain' },
];

export function createSignDialog(intents: SignIntents) {
  const { dialog, body, close } = createDialog('Firmar cuidado', 'record-dialog sign-dialog');
  const closeButton = dialog.querySelector<HTMLButtonElement>('.dialog-close');
  const title = h('p', { class: 'record-title' });
  const help = h('p', { class: 'hint' });
  const content = h('div', { class: 'mint-body' });
  const errorText = h('p', {});
  const errorRetry = h('button', { type: 'button', class: 'ghost' }, 'Reintentar');
  const error = h('div', { class: 'mint-error', role: 'alert', hidden: true }, h('span', { 'aria-hidden': 'true' }, '⚠️'), errorText, errorRetry);
  body.append(title, help, content, error);

  let busy = false;
  let retry: () => void = intents.retry;
  errorRetry.addEventListener('click', () => retry());
  // Con la firma en curso no se puede cerrar: la transacción ya se envió o está por enviarse.
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (!busy) intents.cancel(); });
  closeButton?.addEventListener('click', (event) => { event.stopImmediatePropagation(); if (!busy) intents.cancel(); }, { capture: true });

  const button = (label: string, cls: string, onClick: () => void) => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', onClick);
    return b;
  };
  const row = (...children: HTMLElement[]) => h('div', { class: 'row chain-row' }, ...children);
  const loader = (text: string) => h('div', { class: 'mint-loader', role: 'status' },
    h('span', { class: 'mint-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', {}, text));

  return {
    /** `label`: qué se firma, por ejemplo "Darle de comer a Lobito". */
    open(label: string) {
      title.textContent = label;
      error.hidden = true;
      if (!dialog.open) dialog.showModal();
    },
    close() { busy = false; close(); },
    isOpen: () => dialog.open,
    showError(message: string | null, onRetry: () => void = intents.retry) {
      busy = false;
      if (closeButton) closeButton.hidden = false;
      error.hidden = !message;
      errorText.textContent = message ?? '';
      retry = onRetry;
      if (message) content.replaceChildren(row(button('Cancelar', 'ghost', intents.cancel)));
    },
    sync(v: SignView) {
      busy = v.step === 'connecting' || v.step === 'signing';
      if (closeButton) closeButton.hidden = busy;
      if (busy) error.hidden = true;

      if (v.step === 'searching') {
        help.textContent = 'Para firmar este cuidado conecta la cuenta con la que adoptaste a tu mascota.';
        content.replaceChildren(loader('Buscando tu cuenta…'));
      } else if (v.step === 'choose' && v.inHost) {
        help.textContent = 'Para firmar este cuidado conecta tu cuenta de la Polkadot App.';
        content.replaceChildren(button('CONECTAR', 'primary big', () => intents.connect(null)), row(button('Cancelar', 'ghost', intents.cancel)));
      } else if (v.step === 'choose' && v.wallets.length > 0) {
        help.textContent = 'Elige la wallet con la que adoptaste a tu mascota.';
        content.replaceChildren(h('div', { class: 'chain-options' }, ...v.wallets.map((w) => {
          const b = h('button', { type: 'button', class: 'chain-entry chain-wallet' });
          // Solo iconos embebidos (data:image/...), nunca URLs externas.
          if (w.icon?.startsWith('data:image/')) b.append(h('img', { src: w.icon, alt: '', width: 28, height: 28 }));
          else b.append(h('span', { 'aria-hidden': 'true' }, '👛'));
          b.append(h('span', {}, w.name));
          b.addEventListener('click', () => intents.connect(w.id));
          return b;
        })), row(button('Cancelar', 'ghost', intents.cancel)));
      } else if (v.step === 'choose') {
        help.textContent = 'No encontramos ninguna wallet. Instala o activa la wallet con la que adoptaste a tu mascota.';
        content.replaceChildren(
          h('div', { class: 'chain-links' }, ...v.suggested.map((w) => h('a', { class: 'ghost', href: w.url, target: '_blank', rel: 'noopener noreferrer' }, w.name))),
          row(button('Cancelar', 'ghost', intents.cancel), button('Buscar de nuevo', 'primary', intents.retry)));
      } else if (v.step === 'connecting') {
        help.textContent = '';
        content.replaceChildren(loader(v.inHost ? 'Acepta los permisos en tu teléfono…' : 'Revisa tu wallet…'));
      } else if (v.step === 'wrongAccount') {
        help.textContent = `Conectaste ${short(v.connected)}, pero tu mascota es de ${short(v.expected)}. Cambia de cuenta en tu wallet y vuelve a intentar: el contrato solo acepta al dueño del NFT.`;
        content.replaceChildren(row(button('Cancelar', 'ghost', intents.cancel), button('Volver a conectar', 'primary', intents.retry)));
      } else {
        const index = STEPS.findIndex((s) => s.key === v.progress);
        const where = v.inHost ? 'en tu teléfono' : 'en tu wallet';
        help.textContent = v.progress === 'simulando'
          ? 'Primero se prueba la transacción: si el contrato la rechazaría, no se te cobra nada.'
          : v.progress === 'firma' ? `La prueba salió bien. Aprueba la solicitud ${where}.` : 'No cierres la app mientras se confirma.';
        content.replaceChildren(h('ol', { class: 'mint-steps' }, ...STEPS.map((s, i) => h('li', { 'data-state': i < index ? 'done' : i === index ? 'now' : 'next' },
          h('span', { class: 'mint-step-dot', 'aria-hidden': 'true' }, i < index ? '✓' : `${i + 1}`),
          h('span', {}, s.key === 'firma' ? `Esperando tu firma ${where}` : s.label)))));
      }
    },
  };
}
