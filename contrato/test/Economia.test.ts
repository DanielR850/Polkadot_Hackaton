import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

describe("Economía: pesitos en la cadena", () => {
  async function desplegar() {
    const [owner, otro] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    const items = await (await ethers.getContractFactory("PolkaPetsItems")).deploy(await pets.getAddress());
    await pets.setOperador(await items.getAddress(), true);
    await pets.mint("Michi", 0, 12, 0); // 12 h, Pacífico
    return { pets, items, owner, otro };
  }

  it("empieza en 0: sin pesitos no se compra nada", async () => {
    const { items } = await desplegar();
    expect(await items.pesitos(1)).to.equal(0n);
    await expect(items.comprar(1, 1)).to.be.revertedWithCustomError(items, "PesitosInsuficientes").withArgs(40, 0);
  });

  it("los precios vienen de la cadena y coinciden con la tienda", async () => {
    const { items } = await desplegar();
    expect(await items.precio(1)).to.equal(40n); // sombrero
    expect(await items.precio(25)).to.equal(90n); // sombrero de charro
    expect(await items.precio(53)).to.equal(30n); // tamal
    expect(await items.precio(21)).to.equal(0n); // medalla: exclusiva
    expect(await items.precio(58)).to.equal(0n); // mole: solo drop
  });

  it("cobrar suma al saldo y el cupo limita cuánto se puede cobrar de golpe", async () => {
    const { items } = await desplegar();
    expect(await items.cupoDisponible(1)).to.equal(60n);
    await expect(items.cobrarPesitos(1, 25)).to.emit(items, "PesitosCobrados").withArgs(1n, 25n, 25n);
    // Pide mil: recibe solo lo que queda en el cupo (35).
    await items.cobrarPesitos(1, 1000);
    expect(await items.pesitos(1)).to.equal(60n);
    expect(await items.cupoDisponible(1)).to.equal(0n);
    await expect(items.cobrarPesitos(1, 1)).to.be.revertedWithCustomError(items, "SinCupo");
  });

  it("el cupo se rellena con el tiempo: 10 pesitos por minuto", async () => {
    const { items } = await desplegar();
    await items.cobrarPesitos(1, 60);
    await time.increase(60);
    expect(Number(await items.cupoDisponible(1))).to.be.within(9, 11);
    await time.increase(3600);
    expect(await items.cupoDisponible(1)).to.equal(60n); // nunca pasa del máximo
  });

  it("no hay forma de ponerse dinero: en una hora se cobra, como mucho, lo que deja el cupo", async () => {
    const { items } = await desplegar();
    for (let minuto = 0; minuto < 60; minuto++) {
      await items.cobrarPesitos(1, 65535).catch(() => undefined);
      await time.increase(60);
    }
    // 60 al inicio + 10 por minuto durante 59 minutos, con margen por los segundos de cada bloque.
    expect(Number(await items.pesitos(1))).to.be.lessThanOrEqual(60 + 10 * 60 + 5);
  });

  it("solo el dueño cobra, no se cobra 0 y una mascota muerta no cobra", async () => {
    const { pets, items, otro } = await desplegar();
    await expect(items.connect(otro).cobrarPesitos(1, 10)).to.be.revertedWithCustomError(items, "NoEresDueno");
    await expect(items.cobrarPesitos(1, 0)).to.be.revertedWithCustomError(items, "CantidadInvalida");
    await pets.mint("Mortal", 0, 1, 1); // 1 h, Competencia
    await time.increase(4 * 3600);
    await expect(items.cobrarPesitos(2, 10)).to.be.revertedWithCustomError(items, "MascotaMuerta");
  });

  it("comprar cobra el precio, y lo exclusivo no se compra con pesitos", async () => {
    const { items } = await desplegar();
    await items.cobrarPesitos(1, 60);
    await expect(items.comprar(1, 1)).to.emit(items, "ArticuloComprado"); // sombrero: 40
    expect(await items.pesitos(1)).to.equal(20n);
    await expect(items.comprar(1, 25)).to.be.revertedWithCustomError(items, "PesitosInsuficientes").withArgs(90, 20); // charro
    await expect(items.comprar(1, 21)).to.be.revertedWithCustomError(items, "SoloPorLogro");
    await expect(items.comprar(1, 58)).to.be.revertedWithCustomError(items, "SoloPorLogro"); // mole: solo drop
  });

  it("los trofeos dan pesitos ya validados por la cadena, una sola vez por mascota", async () => {
    const { items } = await desplegar();
    await expect(items.reclamarLogro(1, 1)).to.be.revertedWithCustomError(items, "LogroNoAlcanzado"); // aún no pasan 10 min
    expect(await items.pesitos(1)).to.equal(0n);
    await time.increase(11 * 60);
    await expect(items.reclamarLogro(1, 1)).to.emit(items, "PesitosCobrados").withArgs(1n, 10n, 10n);
    expect(await items.pesitos(1)).to.equal(10n);
    await expect(items.reclamarLogro(1, 1)).to.be.revertedWithCustomError(items, "LogroYaReclamado");
    expect(await items.pesitos(1)).to.equal(10n);
    await time.increase(3600); // ya pasó 1 hora: trofeo 2 = 20 pesitos
    await items.reclamarLogro(1, 2);
    expect(await items.pesitos(1)).to.equal(30n);
  });

  it("la comida también cuesta y cada mascota tiene su saldo", async () => {
    const { pets, items } = await desplegar();
    await pets.mint("Pelusa", 0, 12, 0);
    await items.cobrarPesitos(1, 60);
    await items.comprar(1, 53); // tamal: 30
    await items.comprar(1, 53);
    expect(await items.pesitos(1)).to.equal(0n);
    expect(await items.pesitos(2)).to.equal(0n);
    await expect(items.comprar(2, 53)).to.be.revertedWithCustomError(items, "PesitosInsuficientes");
  });
});
