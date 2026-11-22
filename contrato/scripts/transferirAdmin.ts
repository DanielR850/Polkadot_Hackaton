import hre from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pasa la administración de los contratos (pagos, objetos, temporadas y mascotas) a otra cuenta.
 * La cuenta nueva es la que ve el panel `?admin=1` al conectarse (en la Polkadot App es la cuenta del Product).
 *
 * Uso (PowerShell):  $env:NUEVO="0x…"; npm run transferir:testnet
 * Después de esto la cuenta del .env ya no puede administrar nada: no se puede deshacer sin la cuenta nueva.
 */
async function main() {
  const nuevo = process.env.NUEVO?.trim();
  if (!nuevo || !hre.ethers.isAddress(nuevo)) throw new Error("Pon la cuenta nueva en NUEVO (0x… de 40 caracteres).");
  const archivo = join(__dirname, "..", "deployments", `${hre.network.name}-v2.json`);
  const d = JSON.parse(readFileSync(archivo, "utf8"));
  const contratos: Array<[string, string]> = [["PolkaPetsPagos", d.pagos], ["PolkaPetsItems", d.items], ["PolkaPetsTemporadas", d.temporadas], ["PolkaPets", d.pets]];
  for (const [nombre, direccion] of contratos) {
    const c = await hre.ethers.getContractAt(nombre, direccion);
    await (await c.transferOwnership(nuevo)).wait();
    console.log(`${nombre}: administrador ahora ${await c.owner()}`);
  }
}

main().catch((e) => { console.error(String(e.shortMessage ?? e.message)); process.exitCode = 1; });
