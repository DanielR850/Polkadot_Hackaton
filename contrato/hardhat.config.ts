import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Clave privada de despliegue. Vive solo en contrato/.env (ignorado por git).
const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "").trim();
const cuentas = PRIVATE_KEY ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`] : [];

/**
 * Config de Hardhat para Polkadot Hub TestNet.
 *
 * Polkadot Hub ejecuta bytecode EVM estándar (REVM), así que se compila con solc
 * normal y se despliega con las herramientas de Ethereum de siempre.
 *
 * RPC:      https://eth-rpc-testnet.polkadot.io
 * Chain ID: 420420417
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin 5.x usa la instrucción mcopy (Cancun). REVM en Polkadot Hub la soporta.
      evmVersion: "cancun",
    },
  },

  networks: {
    // EVM local de Hardhat para los tests.
    hardhat: {},

    polkadotHubTestnet: {
      url: "https://eth-rpc-testnet.polkadot.io",
      chainId: 420420417,
      accounts: cuentas,
    },
  },
};

export default config;
