import hre from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/** Lee los contratos desplegados en TestNet y comprueba lo esencial (solo lecturas, sin firmar). */
async function main() {
  const d = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "polkadotHubTestnet-v2.json"), "utf8"));
  const { ethers } = hre;
  const pets = await ethers.getContractAt("PolkaPets", d.pets);
  const items = await ethers.getContractAt("PolkaPetsItems", d.items);
  const temp = await ethers.getContractAt("PolkaPetsTemporadas", d.temporadas);
  console.log("PolkaPets version", await pets.version(), "· especies", await pets.NUM_ESPECIES(), "· operador Items", await pets.operador(d.items));
  console.log("Items version", await items.version(), "· objetos", await items.totalArticulos(), "· logros", await items.totalLogros());
  const tamal = await items.articulo(53), poncho = await items.articulo(60), charro = await items.articulo(25);
  console.log("articulo 25 (charro) tipo", tamal && Number(charro.tipo), "· 53 (tamal) tipo", Number(tamal.tipo), "valor", Number(tamal.valor), "· 60 (poncho) tipo", Number(poncho.tipo));
  console.log("Temporadas version", await temp.version());
  const pagos = await ethers.getContractAt("PolkaPetsPagos", d.pagos);
  console.log("Pagos version", await pagos.version(), "· pagos registrados", (await pagos.totalPagos()).toString(), "· administrador", await pagos.owner());
  console.log("Items: CUPO_MAX", await items.CUPO_MAX(), "· precio charro", await items.precio(25), "· precio tamal", await items.precio(53));
  console.log("PolkaPets: sueño completo en", await pets.SEG_SUENO_COMPLETO(), "s");
  console.log("PolkaPets en Items:", (await items.pets()) === d.pets ? "ligado" : "NO LIGADO");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
