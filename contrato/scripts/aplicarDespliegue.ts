import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Pega en src/contract/config.ts las direcciones del último despliegue v2 en TestNet
 * (contrato/deployments/polkadotHubTestnet-v2.json, que escribe `npm run deploy:v2:testnet`).
 * No lee llaves ni hace llamadas a la red: solo copia tres direcciones públicas.
 *
 * Uso:  npm run aplicar:testnet            (edita config.ts)
 *       PROBAR=1 npm run aplicar:testnet      (muestra el resultado sin escribir)
 */
const ARCHIVO = process.env.DESPLIEGUE ?? join(__dirname, "..", "deployments", "polkadotHubTestnet-v2.json");
const CONFIG = join(__dirname, "..", "..", "src", "contract", "config.ts");
const DIRECCION = /^0x[0-9a-fA-F]{40}$/;

function main() {
  const probar = process.env.PROBAR === "1";
  if (!existsSync(ARCHIVO)) throw new Error(`No existe ${ARCHIVO}. Corre primero: npm run deploy:v2:testnet`);
  const d = JSON.parse(readFileSync(ARCHIVO, "utf8")) as { pets: string; items: string; temporadas: string };
  for (const [k, v] of Object.entries({ pets: d.pets, items: d.items, temporadas: d.temporadas })) {
    if (!DIRECCION.test(v)) throw new Error(`Dirección inválida para ${k}: ${v}`);
  }

  let s = readFileSync(CONFIG, "utf8");
  const cambios: [string, RegExp, string][] = [
    ["PETS_ADDRESS", /(export const PETS_ADDRESS[^=]*=\s*LOCAL\s*\?\s*"0x[0-9a-fA-F]+"\s*:\s*)"0x[0-9a-fA-F]+"/, `$1"${d.pets}"`],
    ["ITEMS_ADDRESS", /(export const ITEMS_ADDRESS[^=]*=\s*LOCAL\s*\?\s*"0x[0-9a-fA-F]+"\s*:\s*)(?:"0x[0-9a-fA-F]+"|null)/, `$1"${d.items}"`],
    ["TEMPORADAS_ADDRESS", /(export const TEMPORADAS_ADDRESS[^=]*=\s*LOCAL\s*\?\s*"0x[0-9a-fA-F]+"\s*:\s*)(?:"0x[0-9a-fA-F]+"|null)/, `$1"${d.temporadas}"`],
  ];
  for (const [nombre, patron, reemplazo] of cambios) {
    if (!patron.test(s)) throw new Error(`No encontré ${nombre} en config.ts; edítalo a mano.`);
    s = s.replace(patron, reemplazo);
    console.log(`${nombre} -> ${nombre === "PETS_ADDRESS" ? d.pets : nombre === "ITEMS_ADDRESS" ? d.items : d.temporadas}`);
  }
  if (probar) return console.log("(modo --probar: no se escribió nada)");
  writeFileSync(CONFIG, s);
  console.log("config.ts actualizado. Ahora: pnpm build y publicar con pad (docs/PUBLICACION.md).");
}
main();
