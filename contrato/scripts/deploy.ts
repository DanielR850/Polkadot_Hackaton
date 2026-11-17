import hre from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Despliega PolkaPets y deja la dirección en dos sitios para que el frontend la use:
 *  - imprime en consola (para copiarla al game/src/contract/config.ts)
 *  - escribe contrato/deployments/<red>.json
 */
async function main() {
  const red = hre.network.name;
  console.log(`Desplegando PolkaPets en la red: ${red}`);

  const PolkaPets = await hre.ethers.getContractFactory("PolkaPets");
  const contrato = await PolkaPets.deploy();
  await contrato.waitForDeployment();

  const address = await contrato.getAddress();
  console.log(`\n✅ PolkaPets desplegado en: ${address}`);
  console.log(`\nCopia esta dirección en game/src/contract/config.ts (PETS_ADDRESS).`);

  const salida = join(__dirname, "..", "deployments", `${red}.json`);
  if (!existsSync(dirname(salida))) mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(
    salida,
    JSON.stringify({ address, red, fecha: new Date().toISOString() }, null, 2),
  );
  console.log(`Guardado en ${salida}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
