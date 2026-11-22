import hre from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Despliega solo PolkaPetsPagos y actualiza `deployments/<red>-v2.json` (el resto no cambia).
 * Sirve para empezar con el registro de pagos limpio después de una prueba.
 * Uso: npm run deploy:pagos:testnet   y luego   npm run aplicar:testnet
 */
async function main() {
  const red = hre.network.name;
  const archivo = join(__dirname, "..", "deployments", `${red}-v2.json`);
  const datos = JSON.parse(readFileSync(archivo, "utf8"));
  const [deployer] = await hre.ethers.getSigners();
  const pagos = await (await hre.ethers.getContractFactory("PolkaPetsPagos")).deploy();
  await pagos.waitForDeployment();
  datos.pagos = await pagos.getAddress();
  writeFileSync(archivo, JSON.stringify(datos, null, 2));
  console.log(`PolkaPetsPagos ${datos.pagos} (administrador: ${deployer.address})`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
