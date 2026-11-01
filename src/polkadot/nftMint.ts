// Adaptador del mint del NFT para el juego local. Es la única firma del juego: adoptar.
// Los cuidados siguen siendo locales y gratis. Reutiliza el cliente de game/src/contract:
// dentro de Polkadot Desktop o la Polkadot App firma el Host; en un navegador, una wallet EVM.
import { EXPLORER_URL, PETS_ADDRESS } from '../../game/src/contract/config.ts';
import { conectarHost, dentroDelHost } from '../../game/src/contract/host.ts';
import { adoptar, conectar, firmanteEvm, firmanteHost, numEspecies, type Firmante, type PasoTx } from '../../game/src/contract/pets.ts';
import { descubrirWallets, WALLETS_SUGERIDAS, type WalletInfo } from '../../game/src/contract/wallets.ts';
import { mensajeError } from '../../game/src/lib/txErrors.ts';

export type MintStep = PasoTx;

export interface MintWallet { id: string; name: string; icon: string | null }

export interface MintAccount {
  /** Dónde se firma: "Polkadot App" o el nombre de la wallet. */
  via: string;
  address: string;
  inHost: boolean;
  /** Especies que acepta el contrato desplegado (ids 0..n-1). */
  species: number;
}

export interface NftMinter {
  /** true dentro de Polkadot Desktop o la Polkadot App. */
  inHost(): Promise<boolean>;
  wallets(): Promise<MintWallet[]>;
  suggested: ReadonlyArray<{ name: string; url: string }>;
  /** walletId null = conectar con el Host. */
  connect(walletId: string | null): Promise<MintAccount>;
  /** Firma `mint(nombre, especie)` y devuelve el tokenId. Si el contrato no admite la especie, usa la 0. */
  mint(name: string, petId: number, onStep?: (step: MintStep) => void): Promise<bigint>;
  /** Página del NFT en Blockscout. */
  nftUrl(tokenId: bigint | string): string;
  /** Texto corto en español para cualquier error de wallet, red o contrato. */
  explain(error: unknown): string;
}

export function createNftMinter(): NftMinter {
  let found: WalletInfo[] = [];
  let signer: Firmante | null = null;
  let species = 1;

  return {
    inHost: () => dentroDelHost(),

    async wallets() {
      found = await descubrirWallets();
      return found.map((w) => ({ id: w.id, name: w.nombre, icon: w.icono }));
    },

    suggested: WALLETS_SUGERIDAS.map((w) => ({ name: w.nombre, url: w.url })),

    async connect(walletId) {
      if (walletId === null) {
        signer = firmanteHost(await conectarHost());
      } else {
        const wallet = found.find((w) => w.id === walletId);
        if (!wallet) throw new Error('Esa wallet ya no está disponible. Busca de nuevo.');
        signer = firmanteEvm(wallet.nombre, wallet.provider, await conectar(wallet.provider));
      }
      species = await numEspecies();
      return { via: signer.nombre, address: signer.cuenta, inHost: signer.tipo === 'host', species };
    },

    async mint(name, petId, onStep) {
      if (!signer) throw new Error('Conecta tu cuenta primero.');
      // Comodín: el contrato desplegado solo admite la especie 0 (NUM_ESPECIES = 1). Si la especie
      // elegida no cabe, el NFT se registra como especie 0 y el juego sigue mostrando el animal
      // elegido (vive en la partida local). Con un contrato de 5 especies se usa la especie real.
      return adoptar(signer, name, petId < species ? petId : 0, onStep);
    },

    nftUrl: (tokenId) => `${EXPLORER_URL}/token/${PETS_ADDRESS}/instance/${tokenId}`,

    explain: (error) => mensajeError(error),
  };
}
