import hre from "hardhat";

/**
 * Muestra el estado de los contratos v2 en una red (por defecto, el nodo local): mascotas,
 * temporada, despensa y drops. Útil para revisar lo que hizo el juego en las pruebas de interfaz.
 * Uso: npx hardhat run scripts/inspeccionar.ts --network localhost
 */
async function main() {
  const d = await import(`../deployments/${hre.network.name}-v2.json`);
  const pets = await hre.ethers.getContractAt("PolkaPets", d.pets);
  const items = await hre.ethers.getContractAt("PolkaPetsItems", d.items);
  const temporadas = await hre.ethers.getContractAt("PolkaPetsTemporadas", d.temporadas);
  const total = Number(await pets.totalMascotas());
  console.log(`Mascotas: ${total}`);
  for (let id = 1; id <= total; id++) {
    const m = await pets.verMascota(id);
    const [tokens, articulos] = await items.despensaDe(id);
    console.log(`#${id} ${m.nombre} especie=${m.especie} horas=${m.horas} modo=${m.modo === 0n ? "pacífico" : "competencia"} viva=${m.viva} vida=${m.vida} hambre=${m.hambre} sed=${m.sed} xp=${m.xp} duracion=${m.duracion}s`);
    console.log(`   comprados=${(await items.compradosDe(id)).join(",") || "-"} despensa=${articulos.join(",") || "-"} (${tokens.length}) drops=${await items.dropsDisponibles(id)}`);
  }
  const s = await temporadas.semanaActual();
  console.log(`Temporada semana=${s.semana} abierta=${s.abierta} registros=${await temporadas.total(s.semana)} cerradas=${(await temporadas.semanasCerradas()).join(",") || "-"}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
