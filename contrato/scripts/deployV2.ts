import hre from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Despliega la versión 2 completa y la deja conectada:
 *  1. PolkaPets (dificultad 1/7/12 h y modos Pacífico/Competencia),
 *  2. PolkaPetsItems ligado a ese PolkaPets (colecciones, utilidad, comida y drops),
 *  3. PolkaPetsTemporadas (Competencia semanal: lunes a viernes, hora de México),
 *  4. autoriza a PolkaPetsItems como operador de PolkaPets (para que la comida cure).
 *
 * Uso:  npm run deploy:v2:local   (nodo de `npm run node`)
 *       npm run deploy:v2:testnet (necesita PRIVATE_KEY en contrato/.env y PAS de prueba)
 * Copia las direcciones que imprime en src/contract/config.ts.
 */

/** Lunes 1970-01-05 00:00 en México (UTC-6) = 06:00 UTC. México no usa horario de verano desde 2022. */
const LUNES_MEXICO = 367_200;
const SEMANA = 604_800;

async function main() {
  const red = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Red: ${red} · cuenta: ${deployer.address}`);

  const ahora = Math.floor(Date.now() / 1000);
  const inicio = process.env.INICIO_TEMPORADA
    ? Number(process.env.INICIO_TEMPORADA)
    : LUNES_MEXICO + Math.floor((ahora - LUNES_MEXICO) / SEMANA) * SEMANA;

  const pets = await (await hre.ethers.getContractFactory("PolkaPets")).deploy();
  await pets.waitForDeployment();
  const petsAddress = await pets.getAddress();
  console.log(`PolkaPets            ${petsAddress}`);

  const items = await (await hre.ethers.getContractFactory("PolkaPetsItems")).deploy(petsAddress);
  await items.waitForDeployment();
  const itemsAddress = await items.getAddress();
  console.log(`PolkaPetsItems       ${itemsAddress}`);

  const temporadas = await (await hre.ethers.getContractFactory("PolkaPetsTemporadas")).deploy(petsAddress, inicio);
  await temporadas.waitForDeployment();
  const temporadasAddress = await temporadas.getAddress();
  console.log(`PolkaPetsTemporadas  ${temporadasAddress} (semana 0: ${new Date(inicio * 1000).toISOString()})`);

  await (await pets.setOperador(itemsAddress, true)).wait();
  console.log("PolkaPetsItems autorizado como operador de PolkaPets.");

  console.log(`\nPega en src/contract/config.ts:
  PETS_ADDRESS       = "${petsAddress}"
  ITEMS_ADDRESS      = "${itemsAddress}"
  TEMPORADAS_ADDRESS = "${temporadasAddress}"`);

  const salida = join(__dirname, "..", "deployments", `${red}-v2.json`);
  if (!existsSync(dirname(salida))) mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, JSON.stringify({
    red, fecha: new Date().toISOString(), deployer: deployer.address, inicioTemporada: inicio,
    pets: petsAddress, items: itemsAddress, temporadas: temporadasAddress,
  }, null, 2));
  console.log(`Guardado en ${salida}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
