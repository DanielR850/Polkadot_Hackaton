import hre from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Prueba real en TestNet con la cuenta de pruebas del .env: adopta con color, duerme y despierta
 * (la cadena guarda las horas), cobra pesitos con su cupo, compra con esos pesitos, guarda una wallet
 * de cobro y anota un pago con su hash. Cada paso se comprueba leyendo la cadena.
 */
async function main() {
  const d = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "polkadotHubTestnet-v2.json"), "utf8"));
  const { ethers } = hre;
  const [yo] = await ethers.getSigners();
  const pets = await ethers.getContractAt("PolkaPets", d.pets);
  const items = await ethers.getContractAt("PolkaPetsItems", d.items);
  const pagos = await ethers.getContractAt("PolkaPetsPagos", d.pagos);
  const ok = (cond: boolean, texto: string) => { console.log(`${cond ? "✓" : "✗"} ${texto}`); if (!cond) process.exitCode = 1; };
  const rechaza = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };

  const m5 = pets.getFunction("mint(string,uint8,uint8,uint8,uint8)");
  await (await m5("Prueba", 3, 7, 0, 2)).wait();
  const ids = await pets.mascotasDe(yo.address);
  const id = ids[ids.length - 1];
  const m = await pets.verMascota(id);
  ok(Number(m.especie) === 3 && Number(await pets.varianteDe(id)) === 2, `adoptada #${id} (tlacuache, color 2)`);

  // Sueño: la cadena guarda cuándo se durmió y cuándo despertó.
  await (await pets.dormir(id)).wait();
  const desde = Number(await pets.durmiendoDesde(id));
  ok(desde > 0, "dormir guarda la hora en la cadena");
  ok(await rechaza(() => pets.dormir.staticCall(id)), "no se puede dormir dos veces");
  await new Promise((r) => setTimeout(r, 15000));
  ok(Number((await pets.verMascota(id)).durmiendoDesde) === desde, "la lectura dice que sigue durmiendo");
  await (await pets.despertar(id)).wait();
  ok(Number(await pets.durmiendoDesde(id)) === 0, "despertar queda registrado (durmiendoDesde = 0)");

  // Pesitos con cupo.
  const antes = Number(await items.pesitos(id));
  await (await items.cobrarPesitos(id, 65535)).wait();
  const saldo = Number(await items.pesitos(id));
  ok(saldo - antes <= 60 && saldo > antes, `cobrar pidiendo 65535 solo da lo que permite el cupo (+${saldo - antes})`);

  // Compras con pesitos.
  const barato = saldo >= 30 ? 53 : 26;
  const precio = Number(await items.precio(barato));
  await (await items.comprar(id, barato)).wait();
  ok(Number(await items.pesitos(id)) === saldo - precio, `comprar el objeto ${barato} cobra ${precio} pesitos`);
  ok(await rechaza(() => items.comprar.staticCall(id, 25)), "sin pesitos suficientes no se compra el sombrero de charro (90)");
  ok(await rechaza(() => items.comprar.staticCall(id, 21)), "un objeto exclusivo no se compra con pesitos");

  // Billetera y pagos.
  await (await pagos.setBilletera(yo.address)).wait();
  ok((await pagos.billeteraDe(yo.address)).toLowerCase() === yo.address.toLowerCase(), "la wallet de cobro queda guardada");
  const hash = ethers.id(`prueba-${Date.now()}`);
  const semana = 9000 + Number(await pagos.totalPagos()); // semana de prueba que no choca con las reales
  await (await pagos.registrarPago(semana, 1, yo.address, 1, hash)).wait();
  const pago = await pagos.pagoDe(semana, 1);
  ok(pago.txHash === hash && pago.cuenta.toLowerCase() === yo.address.toLowerCase(), "el pago queda registrado con su hash");
}

main().catch((e) => { console.error(String(e.shortMessage ?? e.message).slice(0, 300)); process.exitCode = 1; });
