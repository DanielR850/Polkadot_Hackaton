import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

// Colección de comida, utilidad y drops de PolkaPetsItems v2.
const SOMBRERO = 1;
const TAMAL = 53; // Vida +20
const PAN = 54; // Saciedad +25
const MOLE = 58; // solo drop
const UTIL = { Ninguna: 0, Pesitos: 1, Felicidad: 2, Vida: 3, Saciedad: 4 };

describe("PolkaPetsItems: comida, utilidad y drops", () => {
  async function desplegar(horas = 1, modo = 1) {
    const [owner, otro] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    const items = await (await ethers.getContractFactory("PolkaPetsItems")).deploy(await pets.getAddress());
    await pets.setOperador(await items.getAddress(), true);
    await pets.mint("Michi", 0, horas, modo);
    const nacimiento = (await pets.verMascota(1)).nacimiento;
    return { pets, items, owner, otro, nacimiento };
  }

  it("cada objeto declara su utilidad en la cadena y en el tokenURI", async () => {
    const { items } = await desplegar();
    const s = await items.articulo(SOMBRERO);
    expect(s.utilidad).to.equal(UTIL.Pesitos);
    expect(s.valor).to.equal(5);
    for (const id of [...Array.from({ length: 61 }, (_, i) => i + 1)]) expect((await items.articulo(id)).utilidad).to.not.equal(UTIL.Ninguna);
    await items.comprar(1, SOMBRERO);
    const json = JSON.parse(Buffer.from((await items.tokenURI(1)).split(",")[1], "base64").toString("utf8"));
    expect(json.attributes.find((a: { trait_type: string }) => a.trait_type === "Utilidad").value).to.equal("+5% pesitos");
  });

  it("la comida se compra varias veces, va a la despensa y no cuenta para la colección", async () => {
    const { items } = await desplegar();
    await items.comprar(1, TAMAL);
    await items.comprar(1, TAMAL);
    await items.comprar(1, PAN);
    const [tokens, articulos] = await items.despensaDe(1);
    expect(tokens.length).to.equal(3);
    expect(articulos.map(Number)).to.deep.equal([TAMAL, TAMAL, PAN]);
    expect(await items.compradosDe(1)).to.deep.equal([]);
    await expect(items.comprar(1, MOLE)).to.be.revertedWithCustomError(items, "SoloPorLogro");
  });

  it("usar una comida la quema y cura a la mascota en PolkaPets", async () => {
    const { pets, items, nacimiento } = await desplegar(1);
    await items.comprar(1, TAMAL); // token 1
    await items.comprar(1, PAN); // token 2
    await time.setNextBlockTimestamp(nacimiento + 2600n); // vida 88, sed 0
    await expect(items.usar(1)).to.emit(items, "ComidaUsada").withArgs(1n, 1n, TAMAL, UTIL.Vida, 20);
    expect((await pets.verMascota(1)).vida).to.equal(100); // 88 + 20, tope 100
    await expect(items.ownerOf(1)).to.be.revertedWithCustomError(items, "ERC721NonexistentToken");
    await items.usar(2);
    expect((await pets.verMascota(1)).sed).to.be.greaterThanOrEqual(25);
    const [tokens] = await items.despensaDe(1);
    expect(tokens.length).to.equal(0);
    await expect(items.usar(2)).to.be.reverted; // ya no existe
  });

  it("solo el dueño usa su comida, no se usa con la mascota muerta y la comida no se pone", async () => {
    const { items, otro } = await desplegar(1);
    await items.comprar(1, TAMAL);
    await expect(items.connect(otro).usar(1)).to.be.revertedWithCustomError(items, "NoEresDueno");
    await expect(items.validarEquipo(1, [TAMAL])).to.be.reverted;
    await time.increase(2 * 3600);
    await expect(items.usar(1)).to.be.revertedWithCustomError(items, "MascotaMuerta");
  });

  it("la comida NFT no se transfiere", async () => {
    const { items, owner, otro } = await desplegar();
    await items.comprar(1, TAMAL);
    await expect(items.transferFrom(owner.address, otro.address, 1)).to.be.revertedWithCustomError(items, "NoTransferible");
  });

  it("gana un drop por cada intervalo de vida y lo reclama como comida NFT", async () => {
    const { items, nacimiento } = await desplegar(12, 0);
    expect(await items.dropsDisponibles(1)).to.equal(0);
    await expect(items.reclamarDrop(1)).to.be.revertedWithCustomError(items, "SinDrops");
    await time.increaseTo(nacimiento + 65n * 60n);
    expect(await items.dropsDisponibles(1)).to.equal(2);
    await expect(items.reclamarDrop(1)).to.emit(items, "DropReclamado");
    await items.reclamarDrop(1);
    expect(await items.dropsDisponibles(1)).to.equal(0);
    const [tokens, articulos] = await items.despensaDe(1);
    expect(tokens.length).to.equal(2);
    for (const a of articulos) expect(Number(a)).to.be.within(53, 59);
  });

  it("solo el dueño del contrato cambia el intervalo de drops", async () => {
    const { items, otro, nacimiento } = await desplegar(12, 0);
    await expect(items.connect(otro).setIntervaloDrop(600)).to.be.revertedWithCustomError(items, "OwnableUnauthorizedAccount");
    await expect(items.setIntervaloDrop(10)).to.be.revertedWithCustomError(items, "DuracionInvalida");
    await items.setIntervaloDrop(600);
    await time.increaseTo(nacimiento + 1800n);
    expect(await items.dropsDisponibles(1)).to.equal(3);
  });

  it("ropa mexicana: una prenda del cuerpo junto a un accesorio, pero no dos prendas", async () => {
    const { items } = await desplegar(12, 0);
    for (const id of [25, 60, 61]) await items.comprar(1, id); // charro, poncho, rebozo
    await items.validarEquipo(1, [25, 60]); // sombrero charro + poncho: válido
    await expect(items.validarEquipo(1, [60, 61])).to.be.revertedWithCustomError(items, "LugarRepetido");
    await time.increase(200);
    await items.sellarLegado(1, 100, [25, 61]);
    const json = JSON.parse(Buffer.from((await items.tokenURI(2)).split(",")[1], "base64").toString("utf8"));
    expect(json.name).to.equal("Poncho");
    expect(json.attributes.find((a: { trait_type: string }) => a.trait_type === "Tipo").value).to.equal("Ropa");
  });
});
