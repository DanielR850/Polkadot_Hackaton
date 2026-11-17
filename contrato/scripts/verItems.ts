import hre from "hardhat";

/** Lee un PolkaPetsItems desplegado: ITEMS_ADDRESS=0x… npx hardhat run scripts/verItems.ts --network polkadotHubTestnet */
async function main() {
  const address = process.env.ITEMS_ADDRESS?.trim();
  if (!address) throw new Error("Falta ITEMS_ADDRESS.");
  const items = await hre.ethers.getContractAt("PolkaPetsItems", address);
  console.log(`pets: ${await items.pets()}`);
  console.log(`totalArticulos: ${await items.totalArticulos()} · totalLogros: ${await items.totalLogros()}`);
  for (const id of [1, 24, 25, 45, 52, 53]) {
    const a = await items.articulo(id);
    console.log(`articulo ${id}: existe=${a.existe} tipo=${a.tipo} categoria=${a.categoria} exclusivo=${a.exclusivo}`);
  }
  const l = await items.logro(8);
  console.log(`logro 8: existe=${l.existe} minObjetos=${l.minObjetos} recompensa=${l.recompensa}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
