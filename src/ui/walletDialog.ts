// Mi billetera: la wallet a la que quieres recibir tus premios y los pagos ya hechos, como en el
// Pac-Man. La wallet se guarda en la cadena (una firma) y cada premio pagado queda con el hash de su
// transacción para que cualquiera lo revise. Solo muestra y devuelve intenciones.
import { createDialog, h } from './dom.ts';

export interface PaymentRow {
  week: number;
  place: number;
  amount: number;
  /** Cuenta del jugador que cobró. */
  account: string;
  /** Wallet a la que se envió. */
  wallet: string;
  txHash: string;
  url: string;
  paidAt: number;
  mine: boolean;
}

export interface WalletData {
  /** Pagos activados en esta red (hay contrato de pagos). */
  enabled: boolean;
  /** Hay cuenta conectada (se juega con NFT). */
  connected: boolean;
  account: string | null;
  /** La wallet de cobro guardada en la cadena, si hay. */
  wallet: string | null;
  mine: readonly PaymentRow[];
  latest: readonly PaymentRow[];
}

export interface WalletSource {
  load(): Promise<WalletData>;
  /** Guarda la wallet de cobro en la cadena (pide firma). */
  save(address: string): Promise<void>;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const dateOf = (seconds: number) => new Date(seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export function createWalletDialog(source: WalletSource) {
  const { dialog, body } = createDialog('Mi billetera', 'wallet-dialog');
  const info = h('p', { class: 'hint' }, 'Aquí dices a qué wallet te mandamos los premios de la Competencia. Se guarda en la blockchain.');
  const account = h('p', { class: 'wallet-account' });
  const current = h('p', { class: 'wallet-current', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', class: 'name-input small', placeholder: '0x… (tu wallet de cobro)', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Wallet de cobro' });
  const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
  const save = h('button', { type: 'submit', class: 'primary' }, 'Guardar en la cadena');
  const form = h('form', {}, input, hint, h('div', { class: 'row' }, save));
  const mineTitle = h('b', {}, 'Mis premios');
  const mineList = h('ul', { class: 'payment-list' });
  const latestTitle = h('b', {}, 'Últimos pagos (públicos)');
  const latestList = h('ul', { class: 'payment-list' });
  const status = h('p', { class: 'hint', role: 'status' });
  body.append(info, account, current, form, status, mineTitle, mineList, latestTitle, latestList);

  let data: WalletData | null = null;
  let busy = false;
  let request = 0;

  const row = (p: PaymentRow) => {
    const link = h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', title: p.txHash }, `tx ${short(p.txHash)}`);
    return h('li', { class: p.mine ? 'mine' : '' },
      h('span', { class: 'rank' }, MEDAL[p.place - 1] ?? `${p.place}`),
      h('b', {}, `$${p.amount}`),
      h('span', {}, `Semana ${p.week + 1}`),
      h('small', {}, `a ${short(p.wallet)} · ${dateOf(p.paidAt)}`),
      link);
  };

  const validate = () => {
    const value = input.value.trim();
    const ok = ADDRESS.test(value);
    const same = !!data?.wallet && data.wallet.toLowerCase() === value.toLowerCase();
    save.disabled = busy || !ok || same;
    hint.textContent = value === '' ? 'Pega la dirección que empieza con 0x.' : !ok ? 'Debe empezar con 0x y tener 40 caracteres después.' : same ? 'Ya es la que tienes guardada.' : 'Se guarda con una firma.';
    hint.classList.toggle('error', value !== '' && !ok);
  };

  function draw() {
    const d = data;
    if (!d) return;
    const usable = d.enabled && d.connected;
    form.hidden = !usable;
    account.textContent = d.account ? `Tu cuenta en el juego: ${short(d.account)}` : '';
    account.hidden = !d.account;
    current.textContent = !d.enabled ? 'Los pagos todavía no están activados en esta red.'
      : !d.connected ? 'Para guardar tu wallet juega con cartera: los premios son de las cuentas con NFT.'
      : d.wallet ? `Wallet de cobro guardada: ${d.wallet}` : 'Todavía no guardas una wallet de cobro: sin ella no se te puede pagar un premio.';
    current.classList.toggle('error', usable && !d.wallet);
    mineTitle.hidden = mineList.hidden = !d.connected;
    mineList.replaceChildren(...(d.mine.length ? d.mine.map(row) : [h('li', { class: 'hint' }, 'Todavía no has recibido premios.')]));
    latestTitle.hidden = latestList.hidden = !d.enabled;
    latestList.replaceChildren(...(d.latest.length ? d.latest.map(row) : [h('li', { class: 'hint' }, 'Aún no se registra ningún pago.')]));
    validate();
  }

  async function load() {
    const mine = ++request;
    status.textContent = 'Leyendo la cadena…';
    try {
      const next = await source.load();
      if (mine !== request) return;
      data = next;
      status.textContent = '';
      if (next.wallet && input.value.trim() === '') input.value = next.wallet;
      draw();
    } catch (error) {
      if (mine !== request) return;
      status.textContent = 'No se pudo leer la cadena. Revisa tu conexión y vuelve a abrir.';
      console.warn('[polkapets] billetera', error);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (busy || !ADDRESS.test(value)) return;
    busy = true;
    validate();
    status.textContent = 'Firma la transacción…';
    try {
      await source.save(value);
      status.textContent = '✓ Wallet guardada en la cadena.';
      await load();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No se pudo guardar la wallet.';
    } finally {
      busy = false;
      validate();
    }
  });
  input.addEventListener('input', validate);
  dialog.addEventListener('close', () => { request++; });

  return {
    open() { data = null; status.textContent = ''; dialog.showModal(); void load(); },
    close() { dialog.close(); },
    isOpen: () => dialog.open,
  };
}
