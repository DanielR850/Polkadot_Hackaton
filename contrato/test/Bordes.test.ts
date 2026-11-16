import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;
const DIA = 86_400;

// Casos límite y de abuso de los tres contratos v2.
describe("Casos límite v2", () => {
  async function todo() {
    const [owner, ana, beto] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    const items = await (await ethers.getContractFactory("PolkaPetsItems")).deploy(await pets.getAddress());
    await pets.setOperador(await items.getAddress(), true);
    const inicio = BigInt(await time.latest()) + 100n;
    const temporadas = await (await ethers.getContractFactory("PolkaPetsTemporadas")).deploy(await pets.getAddress(), inicio);
    await time.increaseTo(inicio + 10n);
    return { pets, items, temporadas, owner, ana, beto, inicio };
  }

  it("rechaza un modo inexistente", async () => {
    const { pets } = await todo();
    await expect(pets.mint("X", 0, 7, 2)).to.be.reverted;
  });

  it("la vida curada nunca pasa de 100", async () => {
    const { pets, items } = await todo();
    await pets.mint("X", 0, 12, 1);
    await items.comprar(1, 29); // chocolate +30 vida
    await items.usar(1);
    expect((await pets.verMascota(1)).vida).to.equal(100);
  });

  it("una pacífica cura con operador aunque lleve días sin cuidados", async () => {
    const { pets, items } = await todo();
    await pets.mint("Paz", 0, 1, 0);
    await items.comprar(1, 31 - 6); // tamal (25)
    await time.increase(10 * DIA);
    expect((await pets.verMascota(1)).vida).to.equal(1);
    await items.usar(1);
    expect((await pets.verMascota(1)).vida).to.equal(21);
  });

  it("sin mascota viva no hay drops ni compras de comida", async () => {
    const { pets, items } = await todo();
    await pets.mint("X", 0, 1, 1);
    await time.increase(3 * 3600);
    expect(await items.dropsDisponibles(1)).to.equal(0);
    await expect(items.reclamarDrop(1)).to.be.revertedWithCustomError(items, "MascotaMuerta");
    await expect(items.comprar(1, 25)).to.be.revertedWithCustomError(items, "MascotaMuerta");
  });

  it("la comida no cuenta para los logros de colección", async () => {
    const { pets, items } = await todo();
    await pets.mint("X", 0, 12, 1);
    for (let i = 0; i < 4; i++) await items.comprar(1, 27);
    await expect(items.reclamarLogro(1, 7)).to.be.revertedWithCustomError(items, "LogroNoAlcanzado");
  });

  it("no se puede usar la comida de otra mascota", async () => {
    const { pets, items, ana } = await todo();
    await pets.mint("Mia", 0, 12, 1);
    await pets.connect(ana).mint("Suya", 0, 12, 1);
    await items.comprar(1, 25);
    await expect(items.connect(ana).usar(1)).to.be.revertedWithCustomError(items, "NoEresDueno");
  });

  it("cerrar una semana vacía guarda un podio vacío", async () => {
    const { temporadas, inicio } = await todo();
    await time.increaseTo(inicio + 5n * BigInt(DIA));
    await expect(temporadas.cerrarTemporada(0)).to.emit(temporadas, "TemporadaCerrada").withArgs(0n, 0n, 0n);
    expect((await temporadas.podio(0)).length).to.equal(0);
  });

  it("no se cierra una semana futura", async () => {
    const { temporadas } = await todo();
    await expect(temporadas.cerrarTemporada(5)).to.be.revertedWithCustomError(temporadas, "TemporadaEnCurso");
  });

  it("en empate gana quien se registró primero", async () => {
    const { pets, temporadas, ana, beto, inicio } = await todo();
    await pets.connect(ana).mint("A", 0, 1, 1); // 1
    await pets.connect(beto).mint("B", 0, 1, 1); // 2 (un segundo después: misma duración sin cuidados)
    await time.increase(2 * 3600);
    await temporadas.connect(beto).registrar(2);
    await temporadas.connect(ana).registrar(1);
    await time.increaseTo(inicio + 5n * BigInt(DIA));
    await temporadas.cerrarTemporada(0);
    const podio = await temporadas.podio(0);
    expect(podio[0].duracion).to.equal(podio[1].duracion);
    expect(podio[0].tokenId).to.equal(2n); // se registró primero
  });

  it("los registros se leen por páginas", async () => {
    const { pets, temporadas, ana } = await todo();
    for (let i = 0; i < 5; i++) await pets.connect(ana).mint(`P${i}`, 0, 1, 1);
    await time.increase(2 * 3600);
    for (let i = 1; i <= 5; i++) await temporadas.connect(ana).registrar(i);
    expect((await temporadas.registros(0, 0, 2)).length).to.equal(2);
    expect((await temporadas.registros(0, 4, 10)).length).to.equal(1);
    expect((await temporadas.registros(0, 9, 10)).length).to.equal(0);
  });

  it("un NFT transferido se registra con su nuevo dueño", async () => {
    const { pets, temporadas, ana, beto } = await todo();
    await pets.connect(ana).mint("A", 0, 1, 1);
    await pets.connect(ana).transferFrom(ana.address, beto.address, 1);
    await time.increase(2 * 3600);
    await expect(temporadas.connect(ana).registrar(1)).to.be.revertedWithCustomError(temporadas, "NoEresDueno");
    await temporadas.connect(beto).registrar(1);
  });

  it("cambiar el calendario mueve la ventana de la temporada", async () => {
    const { temporadas } = await todo();
    const ahora = BigInt(await time.latest());
    await temporadas.setCalendario(ahora - 6n * BigInt(DIA), 7); // abierta toda la semana
    expect((await temporadas.semanaActual()).abierta).to.equal(true);
    await temporadas.setCalendario(ahora - 6n * BigInt(DIA), 1); // solo el lunes
    expect((await temporadas.semanaActual()).abierta).to.equal(false);
  });
});
