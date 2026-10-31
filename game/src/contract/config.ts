// Red y contrato. Tras desplegar tu propio PolkaPets, pon aquí la dirección que imprime
// `npm run contrato:deploy` (también queda en contrato/deployments/polkadotHubTestnet.json).

/** Dirección del contrato PolkaPets desplegado. */
export const PETS_ADDRESS = "0x08Ff3f07Bca56D0ebdD4346c815B320CDCBC3aec" as const;

/** ETH-RPC de Polkadot Hub TestNet. */
export const ETH_RPC_URL = "https://eth-rpc-testnet.polkadot.io";

/** Chain id de Polkadot Hub TestNet (verificado con eth_chainId). */
export const CHAIN_ID = 420_420_417;

export const CHAIN_NAME = "Polkadot Hub TestNet";
export const EXPLORER_URL = "https://blockscout-testnet.polkadot.io";
export const NATIVE_SYMBOL = "PAS";
export const NATIVE_DECIMALS = 18;

/** Faucet para conseguir PAS de prueba. */
export const FAUCET_URL = "https://faucet.polkadot.io/";

/** Timeouts (ms). */
export const READ_TIMEOUT_MS = 20_000;
export const TX_TIMEOUT_MS = 120_000;

/** Cada cuánto se vuelve a leer la mascota de la cadena (entre lecturas la UI simula el tiempo). */
export const RELECTURA_MS = 20_000;

/** Ranking: filas por página y máximo de mascotas que se leen. */
export const RANKING_PAGINA = 50;
export const RANKING_MAX_LEER = 1_000;
