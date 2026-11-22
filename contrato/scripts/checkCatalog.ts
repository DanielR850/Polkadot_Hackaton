import hre from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Compara el catálogo de PolkaPetsItems con SHOP_CATALOG de src/game/shop.ts (en la red local). */
async function main() {
  const { ethers } = hre;
  const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
  const items = await (await ethers.getContractFactory("PolkaPetsItems")).deploy(await pets.getAddress());
  const src = readFileSync(join(__dirname, "..", "..", "src", "game", "shop.ts"), "utf8");
  const TIPO: Record<string, number> = { accessory: 0, wall: 1, floor: 2, furniture: 3, decor: 4, outfit: 6 };
  const CAT: Record<string, Record<string, number>> = {
    furniture: { Asiento: 1, Planta: 2, "Iluminación": 3, Cama: 4, Mesa: 5, Almacenamiento: 6, Entretenimiento: 7 },
    decor: { Colgante: 1, Repisa: 2, Ofrenda: 3, Guirnalda: 4 },
  };
  let errores = 0, total = 0;
  for (const line of src.split("\n")) {
    const id = line.match(/articleId: (\d+)/)?.[1];
    if (!id) continue;
    total++;
    const kind = line.match(/kind: '(\w+)'/)![1];
    const category = line.match(/category: '([^']+)'/)?.[1];
    const exclusive = line.includes("exclusive: true");
    const a = await items.articulo(Number(id));
    const want = { existe: true, tipo: TIPO[kind], categoria: category ? CAT[kind][category] : 0, exclusivo: exclusive };
    const got = { existe: a.existe, tipo: Number(a.tipo), categoria: Number(a.categoria), exclusivo: a.exclusivo };
    if (JSON.stringify(want) !== JSON.stringify(got)) { errores++; console.log(`id ${id}: esperado ${JSON.stringify(want)}, contrato ${JSON.stringify(got)}`); }
  }
  // Precios: el contrato los trae empacados; deben coincidir con la tienda y la despensa.
  const fuentes = [src, readFileSync(join(__dirname, "..", "..", "src", "game", "pantry.ts"), "utf8")];
  let preciosRevisados = 0;
  for (const texto of fuentes) {
    for (const line of texto.split("\n")) {
      const id = line.match(/articleId: (\d+)/)?.[1];
      const price = line.match(/price: (\d+)/)?.[1];
      if (!id || !price) continue;
      preciosRevisados++;
      const onChain = Number(await items.precio(Number(id)));
      if (onChain !== Number(price)) { errores++; console.log(`precio del objeto ${id}: tienda ${price}, contrato ${onChain}`); }
    }
  }
  console.log(`${preciosRevisados} precios revisados`);
  console.log(`${total} objetos revisados, ${errores} diferencias. totalArticulos = ${await items.totalArticulos()}`);
  if (errores) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
