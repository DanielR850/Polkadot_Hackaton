// Diálogo para registrar la partida en el leaderboard cuando la mascota muere.
// Estados: preguntar → (sin NFT | no disponible) → buscando → elegir cuenta → conectando →
// cuenta equivocada → firmando (pasos) → registrada | ya registrada. Los errores salen en un aviso
// con "Reintentar". Solo muestra y devuelve intenciones; la firma la hace src/polkadot/nftMint.ts.
import { portraitUrl } from '../game/assets.ts';
import { findPet } from '../game/catalog.ts';
import { createDialog, h } from './dom.ts';
import type { MintWalletView } from './mintScreen.ts';

export type RecordStep = 'simulando' | 'firma' | 'confirmando';

export interface RecordSummary { name: string; petId: number; duration: string; tokenId: string }

export type RecordView =
  | { step: 'ask' }
  | { step: 'noNft' }
  | { step: 'unavailable' }
  | { step: 'searching' }
  | { step: 'choose'; inHost: boolean; wallets: readonly MintWalletView[]; suggested: ReadonlyArray<{ name: string; url: string }> }
  | { step: 'connecting'; inHost: boolean }
  | { step: 'wrongAccount'; connected: string; expected: string }
  | { step: 'signing'; inHost: boolean; progress: RecordStep }
  | { step: 'done' }
  | { step: 'already' };

export interface RecordIntents {
  accept(): void;
  decline(): void;
  connect(walletId: string | null): void;
  retry(): void;
  ranking(): void;
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const STEPS: ReadonlyArray<{ key: RecordStep; label: string }> = [
  { key: 'simulando', label: 'Revisando que el contrato acepte el registro' },
  { key: 'firma', label: 'Esperando tu firma' },
  { key: 'confirmando', label: 'Guardando en la blockchain' },
];

export function createRecordDialog(intents: RecordIntents) {
  const { dialog, body, close } = createDialog('Registrar partida', 'record-dialog');
  const closeButton = dialog.querySelector<HTMLButtonElement>('.dialog-close');
  const portrait = h('span', { class: 'pet-frame mint-frame record-frame' });
  const summary = h('div', { class: 'mint-card record-summary' });
  const title = h('p', { class: 'record-title' });
  const help = h('p', { class: 'hint' });
  const content = h('div', { class: 'mint-body' });
  const errorText = h('p', {});
  const errorRetry = h('button', { type: 'button', class: 'ghost' }, 'Reintentar');
  const error = h('div', { class: 'mint-error', role: 'alert', hidden: true }, h('span', { 'aria-hidden': 'true' }, '⚠️'), errorText, errorRetry);
  body.append(h('div', { class: 'record-head' }, portrait, summary), title, help, content, error);

  let retry: () => void = intents.retry;
  errorRetry.addEventListener('click', () => retry());
  let busy = false;
  // Mientras se conecta o se firma no se puede cerrar: la firma ya está en curso.
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });

  const button = (label: string, cls: string, onClick: () => void) => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', onClick);
    return b;
  };
  const row = (...children: HTMLElement[]) => h('div', { class: 'row chain-row' }, ...children);
  const loader = (text: string) => h('div', { class: 'mint-loader', role: 'status' },
    h('span', { class: 'mint-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', {}, text));

  return {
    /** Abre el diálogo con los datos de la partida. */
    open(s: RecordSummary) {
      const pet = findPet(s.petId);
      portrait.replaceChildren(h('img', { class: 'pet-portrait', src: portraitUrl(pet?.slug ?? 'axolotl'), alt: '', draggable: 'false' }));
      summary.replaceChildren(
        h('small', {}, `${pet?.label ?? 'Mascota'} · NFT #${s.tokenId || '—'}`),
        h('b', {}, s.name),
        h('small', {}, 'Vivió'), h('b', { class: 'record-time' }, s.duration));
      error.hidden = true;
      if (!dialog.open) dialog.showModal();
    },
    close() { busy = false; close(); },
    isOpen: () => dialog.open,
    showError(message: string | null, onRetry: () => void = intents.retry) {
      error.hidden = !message;
      errorText.textContent = message ?? '';
      retry = onRetry;
    },
    sync(v: RecordView) {
      busy = v.step === 'connecting' || v.step === 'signing';
      if (closeButton) closeButton.hidden = busy;
      if (busy) error.hidden = true;
      dialog.dataset.step = v.step;

      if (v.step === 'ask') {
        title.textContent = '¿Quieres registrar tu partida?';
        help.textContent = 'Se guarda en el leaderboard de la blockchain para que todos vean cuánto vivió. Pide una firma y se registra una sola vez.';
        content.replaceChildren(row(button('No, gracias', 'ghost', intents.decline), button('🏆 SÍ, REGISTRAR', 'primary', intents.accept)));
      } else if (v.step === 'noNft') {
        title.textContent = 'Esta partida no se puede registrar';
        help.textContent = 'Solo las mascotas adoptadas como NFT entran al leaderboard. La próxima vez, adopta tu mascota como NFT en el paso 3.';
        content.replaceChildren(row(button('Ver leaderboard', 'ghost', intents.ranking), button('Entendido', 'primary', intents.decline)));
      } else if (v.step === 'unavailable') {
        title.textContent = 'El leaderboard todavía no está activo';
        help.textContent = 'El contrato del leaderboard aún no está desplegado. Tu partida no se pudo registrar esta vez.';
        content.replaceChildren(row(button('Cerrar', 'primary', intents.decline)));
      } else if (v.step === 'searching') {
        title.textContent = 'Conecta tu cuenta';
        help.textContent = '';
        content.replaceChildren(loader('Buscando tu cuenta…'));
      } else if (v.step === 'choose' && v.inHost) {
        title.textContent = 'Conecta tu cuenta';
        help.textContent = 'Usa la misma cuenta de la Polkadot App con la que adoptaste a tu mascota.';
        content.replaceChildren(button('CONECTAR', 'primary big', () => intents.connect(null)), row(button('Cancelar', 'ghost', intents.decline)));
      } else if (v.step === 'choose' && v.wallets.length > 0) {
        title.textContent = 'Conecta tu cuenta';
        help.textContent = 'Elige la wallet con la que adoptaste a tu mascota.';
        content.replaceChildren(h('div', { class: 'chain-options' }, ...v.wallets.map((w) => {
          const b = h('button', { type: 'button', class: 'chain-entry chain-wallet' });
          // Solo iconos embebidos (data:image/...), nunca URLs externas.
          if (w.icon?.startsWith('data:image/')) b.append(h('img', { src: w.icon, alt: '', width: 28, height: 28 }));
          else b.append(h('span', { 'aria-hidden': 'true' }, '👛'));
          b.append(h('span', {}, w.name));
          b.addEventListener('click', () => intents.connect(w.id));
          return b;
        })), row(button('Cancelar', 'ghost', intents.decline)));
      } else if (v.step === 'choose') {
        title.textContent = 'No encontramos ninguna wallet';
        help.textContent = 'Para registrar necesitas la wallet con la que adoptaste a tu mascota. Instálala o actívala y vuelve a buscar.';
        content.replaceChildren(
          h('div', { class: 'chain-links' }, ...v.suggested.map((w) => h('a', { class: 'ghost', href: w.url, target: '_blank', rel: 'noopener noreferrer' }, w.name))),
          row(button('Cancelar', 'ghost', intents.decline), button('Buscar de nuevo', 'primary', intents.retry)));
      } else if (v.step === 'connecting') {
        title.textContent = 'Conectando…';
        help.textContent = '';
        content.replaceChildren(loader(v.inHost ? 'Acepta los permisos en tu teléfono…' : 'Revisa tu wallet…'));
      } else if (v.step === 'wrongAccount') {
        title.textContent = 'Esa no es la cuenta de tu mascota';
        help.textContent = `Conectaste ${short(v.connected)}, pero tu mascota la adoptó ${short(v.expected)}. Cambia de cuenta en tu wallet y vuelve a conectar: el contrato solo acepta al dueño del NFT.`;
        content.replaceChildren(row(button('Cancelar', 'ghost', intents.decline), button('Volver a conectar', 'primary', intents.retry)));
      } else if (v.step === 'signing') {
        title.textContent = 'Registrando tu partida…';
        const index = STEPS.findIndex((s) => s.key === v.progress);
        const where = v.inHost ? 'en tu teléfono' : 'en tu wallet';
        help.textContent = v.progress === 'firma' ? `Abre la solicitud ${where} y apruébala.` : 'No cierres la app mientras se guarda.';
        content.replaceChildren(h('ol', { class: 'mint-steps' }, ...STEPS.map((s, i) => h('li', { 'data-state': i < index ? 'done' : i === index ? 'now' : 'next' },
          h('span', { class: 'mint-step-dot', 'aria-hidden': 'true' }, i < index ? '✓' : `${i + 1}`),
          h('span', {}, s.key === 'firma' ? `Esperando tu firma ${where}` : s.label)))));
      } else if (v.step === 'done') {
        title.textContent = '🏆 ¡Partida registrada!';
        help.textContent = 'Tu mascota ya aparece en el leaderboard de la blockchain.';
        content.replaceChildren(row(button('Cerrar', 'ghost', intents.decline), button('VER LEADERBOARD', 'primary', intents.ranking)));
      } else {
        title.textContent = 'Esta partida ya estaba registrada';
        help.textContent = 'Cada NFT se registra una sola vez. Puedes verla en el leaderboard.';
        content.replaceChildren(row(button('Cerrar', 'ghost', intents.decline), button('VER LEADERBOARD', 'primary', intents.ranking)));
      }
    },
  };
}
