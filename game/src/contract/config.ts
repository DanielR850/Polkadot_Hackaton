// Red y contrato. Tras desplegar tu propio PolkaPets, pon aquí la dirección que imprime
// `npm run contrato:deploy` (también queda en contrato/deployments/polkadotHubTestnet.json).

/**
 * Red local de pruebas: `pnpm dev:local` (vite --mode hardhat) usa un nodo Hardhat en 127.0.0.1:8545
 * con los contratos que despliegan `npm run node` y `npm run deploy:local` (+ `deploy:items:local`
 * con PETS_ADDRESS) desde contrato/. Las direcciones de abajo son las de un nodo recién creado
 * (cuentas y nonces de Hardhat). En cualquier otro modo la app usa Polkadot Hub TestNet.
 */
const LOCAL = (import.meta as { env?: Record<string, string | undefined> }).env?.MODE === "hardhat";

/** Dirección del contrato PolkaPets desplegado. */
export const PETS_ADDRESS: `0x${string}` = LOCAL
  ? "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  : "0x758425A3b756079B34FF97cB9C7A764fD44C008a";

/** ETH-RPC de Polkadot Hub TestNet (o del nodo local). */
export const ETH_RPC_URL = LOCAL ? "http://127.0.0.1:8545" : "https://eth-rpc-testnet.polkadot.io";

/** Chain id de Polkadot Hub TestNet (verificado con eth_chainId); 31337 en Hardhat. */
export const CHAIN_ID = LOCAL ? 31_337 : 420_420_417;

export const CHAIN_NAME = LOCAL ? "Hardhat local" : "Polkadot Hub TestNet";
export const EXPLORER_URL = "https://blockscout-testnet.polkadot.io";
export const NATIVE_SYMBOL = LOCAL ? "ETH" : "PAS";
export const NATIVE_DECIMALS = 18;

/** Faucet para conseguir PAS de prueba. */
export const FAUCET_URL = "https://faucet.polkadot.io/";

/** Dominio .dot de la app. El Host deriva de este nombre la cuenta del jugador. */
export const PRODUCT_DOMAIN = "polka-pets.dot";
/** Índice de la cuenta derivada del Product (igual que el taller). */
export const DERIVATION_INDEX = 0;

/** Timeouts (ms). */
export const READ_TIMEOUT_MS = 20_000;
export const TX_TIMEOUT_MS = 120_000;
/** El Host puede no responder a getProductContext(); entonces el id sale de la URL. */
export const PRODUCT_CONTEXT_TIMEOUT_MS = 3_000;
/** La persona aprueba en el teléfono: se le da tiempo. */
export const HOST_SIGN_TIMEOUT_MS = 300_000;
export const HOST_CONNECT_TIMEOUT_MS = 60_000;
export const HOST_ALLOWANCE_TIMEOUT_MS = 90_000;

/** Cada cuánto se vuelve a leer la mascota de la cadena (entre lecturas la UI simula el tiempo). */
export const RELECTURA_MS = 20_000;

/**
 * Contrato PolkaPetsRanking (contrato/contracts/PolkaPetsRanking.sol), donde se registran las
 * partidas al morir la mascota. null mientras no esté desplegado: el leaderboard muestra entonces
 * el ranking de PolkaPets y no se ofrece registrar. Pega aquí la dirección que te dé Remix.
 */
export const RANKING_ADDRESS: `0x${string}` | null = LOCAL ? null : "0xf675957A89bfF3e02BD8AeB302Ca2E8Ca6f2a5d2";

/**
 * Contrato PolkaPetsItems (contrato/contracts/PolkaPetsItems.sol): accesorios y muebles como NFT
 * ligados a cada mascota. null mientras no esté desplegado: las compras de la tienda siguen siendo
 * locales (sin NFT) y no se ofrece guardar el legado. Pega aquí la dirección que imprime
 * `npm run deploy:items:testnet` desde contrato/ (debe estar ligado a PETS_ADDRESS).
 */
export const ITEMS_ADDRESS: `0x${string}` | null = LOCAL
  ? "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  : "0x1beBe6e86473E58f321068413f6eafA410C5FF20";

/** Ranking: filas por página y máximo de mascotas que se leen. */
export const RANKING_PAGINA = 50;
export const RANKING_MAX_LEER = 1_000;
