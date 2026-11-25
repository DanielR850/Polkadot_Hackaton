import hre from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Prueba de MUERTE en la cadena real (TestNet), sin trucos de tiempo.
 *
 *  1.ª vez:  adopta una mascota en Competencia con dificultad de 1 h y anota cuándo debe morir.
 *  Después:  vuelve a correr el script y lee la cadena: si ya pasó 1 h sin cuidados, tiene que estar
 *            muerta (viva = false), con la hora de muerte y la duración guardadas por el contrato.
 *
 * Uso: npm run muerte:testnet   (corre una vez para empezar y otra vez, una hora después, para comprobar)
 */
async function main() {
  const d = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "polkadotHubTestnet-v2.json"), "utf8"));
  const { ethers } = hre;
  const [yo] = await ethers.getSigners();
  const pets = await ethers.getContractAt("PolkaPets", d.pets);
  const archivo = join(__dirname, "..", "deployments", "muerte-testnet.json");

  if (!existsSync(archivo)) {
    await (await pets.mint("Mortal", 0, 1, 1)).wait(); // 1 h, Competencia
    const ids = await pets.mascotasDe(yo.address);
    const id = ids[ids.length - 1];
    const m = await pets.verMascota(id);
    const nace = Number(m.nacimiento);
    writeFileSync(archivo, JSON.stringify({ id: id.toString(), nace, debeMorirDespuesDe: nace + 3600 }, null, 2));
    console.log(`Mascota #${id} adoptada en Competencia (1 h). Viva: ${m.viva}. Debe morir hacia ${new Date((nace + 3600) * 1000).toLocaleString("es-MX")}.`);
    console.log("Vuelve a correr este comando pasada 1 hora sin cuidarla para comprobar que murió.");
    return;
  }

  const e = JSON.parse(readFileSync(archivo, "utf8"));
  const m = await pets.verMascota(BigInt(e.id));
  const bloque = await ethers.provider.getBlock("latest");
  const ahora = Number(bloque!.timestamp);
  const falta = e.debeMorirDespuesDe - ahora;
  console.log(`Mascota #${e.id}: viva = ${m.viva}, vida = ${m.vida}, hambre = ${m.hambre}, sed = ${m.sed}, etapa = ${m.etapa}`);
  if (m.viva) {
    console.log(falta > 0 ? `Todavía no: faltan ${Math.ceil(falta / 60)} min para que cumpla 1 h sin cuidados.` : "✗ Ya pasó 1 h y sigue viva: revisar.");
    process.exitCode = falta > 0 ? 0 : 1;
  } else {
    console.log(`✓ Murió en la cadena. Hora de muerte: ${new Date(Number(m.muerte) * 1000).toLocaleString("es-MX")} · duración guardada: ${Number(m.duracion)} s.`);
    try { await pets.alimentar.staticCall(BigInt(e.id)); console.log("✗ pero aún acepta cuidados"); process.exitCode = 1; } catch { console.log("✓ el contrato ya no acepta cuidados para ella."); }
  }
}

main().catch((err) => { console.error(String(err.shortMessage ?? err.message).slice(0, 300)); process.exitCode = 1; });
