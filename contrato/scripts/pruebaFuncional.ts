import hre from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/** Prueba real en TestNet con la cuenta de pruebas: adoptar con color, comprar ropa y comida. */
async function main() {
  const d = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "polkadotHubTestnet-v2.json"), "utf8"));
  const { ethers } = hre;
  const [yo] = await ethers.getSigners();
  const pets = await ethers.getContractAt("PolkaPets", d.pets);
  const items = await ethers.getContractAt("PolkaPetsItems", d.items);
  const m5 = pets.getFunction("mint(string,uint8,uint8,uint8,uint8)");
  await (await m5("Prueba", 3, 7, 0, 2)).wait();
  const ids = await pets.mascotasDe(yo.address);
  const id = ids[ids.length - 1];
  const m = await pets.verMascota(id);
  console.log("adoptada", id.toString(), m.nombre, "especie", Number(m.especie), "color", Number(await pets.varianteDe(id)));
  await (await items.comprar(id, 25)).wait();
  await (await items.comprar(id, 60)).wait();
  await (await items.comprar(id, 53)).wait();
  console.log("comprados: charro (25), poncho (60), tamal (53)");
  const des = await items.despensaDe(id);
  console.log("despensa", des.length, "comida(s)");
}
main().catch((e) => { console.error(String(e.shortMessage ?? e.message).slice(0, 300)); process.exitCode = 1; });
