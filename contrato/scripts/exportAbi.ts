import hre from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Exporta la ABI compilada de PolkaPets al frontend:
 *   game/src/contract/polkapets.abi.json
 *
 * El wrapper tipado del juego (polkapets.ts) carga ese JSON. Regenera con `npm run abi`
 * cada vez que cambie el contrato.
 */
async function main() {
  await hre.run("compile");

  const artifact = await hre.artifacts.readArtifact("PolkaPets");
  const destino = join(__dirname, "..", "..", "game", "src", "contract", "polkapets.abi.json");

  if (!existsSync(dirname(destino))) mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(artifact.abi, null, 2));

  console.log(`ABI exportada a ${destino} (${artifact.abi.length} entradas).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
