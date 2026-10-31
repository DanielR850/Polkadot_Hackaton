// Descubre las wallets del navegador con EIP-6963 (MetaMask, Talisman, SubWallet, Nova…).
// Cada wallet anuncia su proveedor EIP-1193; si ninguna lo hace, se usa window.ethereum.

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface WalletInfo {
  /** Identificador estable de la wallet (rdns de EIP-6963, o "injected"). */
  id: string;
  nombre: string;
  /** data: URI del icono, o null. */
  icono: string | null;
  provider: Eip1193Provider;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

/** Enlaces para quien no tiene ninguna wallet. */
export const WALLETS_SUGERIDAS = [
  { nombre: "MetaMask", url: "https://metamask.io/download/" },
  { nombre: "Talisman", url: "https://talisman.xyz/" },
  { nombre: "SubWallet", url: "https://www.subwallet.app/" },
] as const;

/**
 * Pide a las wallets que se anuncien y espera `esperaMs`. Las wallets responden
 * casi al instante; la espera solo cubre las que inyectan su script tarde.
 */
export function descubrirWallets(esperaMs = 400): Promise<WalletInfo[]> {
  return new Promise((resolve) => {
    const encontradas = new Map<string, WalletInfo>();

    const alAnunciar = (ev: Event) => {
      const d = (ev as CustomEvent<Eip6963Detail>).detail;
      if (!d?.provider || !d.info) return;
      const id = d.info.rdns || d.info.uuid;
      encontradas.set(id, { id, nombre: d.info.name, icono: d.info.icon || null, provider: d.provider });
    };

    window.addEventListener("eip6963:announceProvider", alAnunciar);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", alAnunciar);
      const lista = [...encontradas.values()];
      if (lista.length === 0) {
        const inyectada = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
        if (inyectada) lista.push({ id: "injected", nombre: "Wallet del navegador", icono: null, provider: inyectada });
      }
      resolve(lista);
    }, esperaMs);
  });
}
