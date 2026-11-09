import hre from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** PolkaPets ya desplegado en Polkadot Hub TestNet (game/src/contract/config.ts → PETS_ADDRESS). */
const PETS_TESTNET = "0x758425A3b756079B34FF97cB9C7A764fD44C008a";

/**
 * Despliega PolkaPetsItems ligado a un PolkaPets existente.
 *  - Dirección de PolkaPets: variable de entorno PETS_ADDRESS o, si no, la de TestNet.
 *  - Imprime la dirección para pegarla en game/src/contract/config.ts (ITEMS_ADDRESS).
 */
async function main() {
  const red = hre.network.name;
  const pets = process.env.PETS_ADDRESS?.trim() || PETS_TESTNET;
  console.log(`Desplegando PolkaPetsItems en la red: ${red} (PolkaPets: ${pets})`);

  // Evita ligarlo a una dirección de otra red (por ejemplo, un PETS_ADDRESS local olvidado).
  if ((await hre.ethers.provider.getCode(pets)) === "0x") {
    throw new Error(`No hay ningún contrato en ${pets} en la red ${red}. Revisa PETS_ADDRESS.`);
  }

  const Items = await hre.ethers.getContractFactory("PolkaPetsItems");
  const contrato = await Items.deploy(pets);
  await contrato.waitForDeployment();

  const address = await contrato.getAddress();
  console.log(`\n✅ PolkaPetsItems desplegado en: ${address}`);
  console.log(`\nCopia esta dirección en game/src/contract/config.ts (ITEMS_ADDRESS).`);

  const salida = join(__dirname, "..", "deployments", `${red}-items.json`);
  if (!existsSync(dirname(salida))) mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, JSON.stringify({ address, pets, red, fecha: new Date().toISOString() }, null, 2));
  console.log(`Guardado en ${salida}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
