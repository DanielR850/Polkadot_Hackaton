import hre from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Prueba de humo contra el contrato desplegado (deployments/<red>.json): adopta una
 * mascota, la cuida con cada acción, le cambia el nombre y lee el ranking.
 *
 *   npm run probar
 */
async function main() {
  const red = hre.network.name;
  const { address } = JSON.parse(readFileSync(join(__dirname, "..", "deployments", `${red}.json`), "utf8")) as {
    address: string;
  };

  const [signer] = await hre.ethers.getSigners();
  const pets = await hre.ethers.getContractAt("PolkaPets", address, signer);
  const yo = await signer.getAddress();
  console.log(`Contrato: ${address}\nCuenta:   ${yo}\n`);

  const nombre = `Prueba-${Date.now() % 100000}`;
  console.log(`1) mint("${nombre}", 2 /* dragón */)`);
  const tx = await pets.mint(nombre, 2);
  const recibo = await tx.wait();
  console.log(`   tx ${tx.hash} en bloque ${recibo?.blockNumber}`);
  const ids = await pets.mascotasDe(yo);
  const id = ids[ids.length - 1];

  const mostrar = async (titulo: string) => {
    const m = await pets.verMascota(id);
    console.log(
      `${titulo.padEnd(22)} ${m.nombre} · vida ${m.vida} · hambre ${m.hambre} · sed ${m.sed} · energía ${m.energia}` +
        ` · felicidad ${m.felicidad} · limpieza ${m.limpieza} · xp ${m.xp} · ${m.duracion}s`,
    );
  };
  await mostrar(`2) NFT #${id}`);

  for (const accion of ["jugar", "alimentar", "dormir", "banar"] as const) {
    await (await pets[accion](id)).wait();
    await mostrar(`   ${accion}`);
  }

  await (await pets.cambiarNombre(id, `${nombre}-B`)).wait();
  await mostrar("   cambiarNombre");

  const total = await pets.totalMascotas();
  const filas = await pets.ranking(0, 50);
  console.log(`\nRanking: ${total} mascota(s)`);
  for (const f of filas) console.log(`   #${f.tokenId} ${f.nombre} · ${f.duracion}s · viva ${f.viva}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
