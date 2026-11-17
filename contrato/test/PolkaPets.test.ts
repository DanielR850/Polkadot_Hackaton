import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

const AJOLOTE = 0;

// Con todo al máximo, sin cuidados (necesidades de 100 a 0: sed 4 h, hambre 5 h, felicidad 6 h,
// energía 7 h, limpieza 8 h):
//  - la vida (100 * 1080 = 108 000 segundos en cero) se agota a las 12 h (43 200 s):
//    a las 8 h ya suman 36 000 (3600 + 7200 + 10 800 + 14 400) y faltan 72 000 con las cinco
//    en 0 a la vez (5 por segundo): 14 400 s más.
const MUERTE_SIN_CUIDADOS = 43_200;

describe("PolkaPets", () => {
  async function desplegar() {
    const [owner, otro] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    await pets.waitForDeployment();
    return { pets, owner, otro };
  }

  async function adoptar(nombre = "Michi", especie = AJOLOTE) {
    const ctx = await desplegar();
    await ctx.pets.mint(nombre, especie);
    const nacimiento = (await ctx.pets.verMascota(1)).nacimiento;
    return { ...ctx, nacimiento };
  }

  it("adopta una mascota con nombre, especie y todo al máximo", async () => {
    const { pets, owner } = await desplegar();
    await expect(pets.mint("Michi", AJOLOTE))
      .to.emit(pets, "MascotaNacida")
      .withArgs(1n, owner.address, "Michi", AJOLOTE);

    const m = await pets.verMascota(1);
    expect(m.nombre).to.equal("Michi");
    expect(m.especie).to.equal(AJOLOTE);
    for (const v of [m.vida, m.hambre, m.sed, m.energia, m.felicidad, m.limpieza]) expect(v).to.equal(100);
    expect(m.viva).to.equal(true);
    expect(m.etapa).to.equal(0); // Bebé
    expect(await pets.ownerOf(1)).to.equal(owner.address);
  });

  it("rechaza nombres y especies inválidos", async () => {
    const { pets } = await desplegar();
    await expect(pets.mint("", AJOLOTE)).to.be.revertedWithCustomError(pets, "NombreInvalido");
    await expect(pets.mint("x".repeat(25), AJOLOTE)).to.be.revertedWithCustomError(pets, "NombreInvalido");
    await expect(pets.mint("Rex", 5)).to.be.revertedWithCustomError(pets, "EspecieInvalida");
  });

  it("adopta las cinco especies y conserva su id en la lectura", async () => {
    const { pets } = await desplegar();
    expect(await pets.NUM_ESPECIES()).to.equal(5);
    for (let id = 0; id < 5; id += 1) {
      await pets.mint(`Mascota ${id}`, id);
      expect((await pets.verMascota(id + 1)).especie).to.equal(id);
    }
  });

  it("cada necesidad baja a su ritmo", async () => {
    const { pets, nacimiento } = await adoptar();
    await time.increaseTo(nacimiento + 3600n);
    const m = await pets.verMascota(1);
    expect(m.hambre).to.equal(100 - 20); // 3600/180
    expect(m.sed).to.equal(100 - 25); // 3600/144
    expect(m.energia).to.equal(100 - 14); // 3600/252
    expect(m.felicidad).to.equal(100 - 16); // 3600/216
    expect(m.limpieza).to.equal(100 - 12); // 3600/288
    expect(m.vida).to.equal(100);
    expect(m.duracion).to.equal(3600);
  });

  it("alimentar sube hambre y sed", async () => {
    const { pets, nacimiento } = await adoptar();
    await time.setNextBlockTimestamp(nacimiento + 1800n); // hambre 90, sed 88
    await pets.alimentar(1);
    const m = await pets.verMascota(1);
    expect(m.hambre).to.equal(100); // 90 + 40, tope 100
    expect(m.sed).to.equal(100); // 88 + 40, tope 100
    expect(m.xp).to.equal(10);
  });

  it("jugar alegra pero cansa, da hambre y sed, y ensucia", async () => {
    const { pets } = await adoptar();
    await pets.jugar(1);
    const m = await pets.verMascota(1);
    expect(m.felicidad).to.equal(100);
    expect(m.energia).to.equal(85);
    expect(m.hambre).to.equal(90);
    expect(m.sed).to.equal(90);
    expect(m.limpieza).to.equal(85);
  });

  it("dormir recupera energía y bañar recupera limpieza", async () => {
    const { pets } = await adoptar();
    await pets.jugar(1); // energía 85, limpieza 85
    await pets.dormir(1);
    await pets.banar(1);
    const m = await pets.verMascota(1);
    expect(m.energia).to.equal(100);
    expect(m.limpieza).to.equal(100);
  });

  it("pierde vida mientras una necesidad está en 0 y muere en el segundo exacto", async () => {
    const { pets, nacimiento } = await adoptar();

    await time.increaseTo(nacimiento + 16_560n); // sed en 0 desde 14 400: 2160 s → -2 de vida
    let m = await pets.verMascota(1);
    expect(m.sed).to.equal(0);
    expect(m.vida).to.equal(98);
    expect(m.etapa).to.equal(3); // Enferma
    expect(m.viva).to.equal(true);

    await time.increaseTo(nacimiento + BigInt(MUERTE_SIN_CUIDADOS - 1));
    m = await pets.verMascota(1);
    expect(m.viva).to.equal(true);
    expect(m.vida).to.equal(1);

    await time.increaseTo(nacimiento + BigInt(MUERTE_SIN_CUIDADOS));
    m = await pets.verMascota(1);
    expect(m.viva).to.equal(false);
    expect(m.vida).to.equal(0);
    expect(m.etapa).to.equal(4); // Muerta
    expect(m.duracion).to.equal(MUERTE_SIN_CUIDADOS);

    // La duración queda fija aunque pase más tiempo.
    await time.increase(10_000);
    expect((await pets.verMascota(1)).duracion).to.equal(MUERTE_SIN_CUIDADOS);
    await expect(pets.alimentar(1)).to.be.revertedWithCustomError(pets, "EstaMuerta");
  });

  it("cuidar recupera vida si ninguna necesidad queda en 0", async () => {
    const { pets, nacimiento } = await adoptar();
    await time.setNextBlockTimestamp(nacimiento + 16_560n); // vida 98, sed 0
    await pets.alimentar(1); // sed 40, hambre 48 → ninguna en 0 → +5 vida (tope 100)
    const m = await pets.verMascota(1);
    expect(m.vida).to.equal(100);
    expect(m.etapa).to.equal(0);
  });

  it("sube de nivel al acumular XP", async () => {
    const { pets } = await adoptar();
    for (let i = 0; i < 10; i++) await pets.dormir(1);
    const m = await pets.verMascota(1);
    expect(m.nivel).to.equal(2);
    expect(m.xp).to.equal(0);
    expect(m.etapa).to.equal(1); // Joven
  });

  it("cambia el nombre solo el dueño", async () => {
    const { pets, otro } = await adoptar();
    await expect(pets.cambiarNombre(1, "Pelusa")).to.emit(pets, "NombreCambiado").withArgs(1n, "Pelusa");
    expect((await pets.verMascota(1)).nombre).to.equal("Pelusa");
    await expect(pets.connect(otro).cambiarNombre(1, "Robo")).to.be.revertedWithCustomError(pets, "NoEresDueno");
    await expect(pets.cambiarNombre(1, "")).to.be.revertedWithCustomError(pets, "NombreInvalido");
  });

  it("solo el dueño puede cuidar", async () => {
    const { pets, otro } = await adoptar();
    await expect(pets.connect(otro).alimentar(1)).to.be.revertedWithCustomError(pets, "NoEresDueno");
  });

  it("el ranking devuelve la duración de cada mascota", async () => {
    const { pets, owner, otro } = await desplegar();
    await pets.mint("Vieja", AJOLOTE);
    const nacimiento = (await pets.verMascota(1)).nacimiento;
    await time.setNextBlockTimestamp(nacimiento + 100n);
    await pets.connect(otro).mint("Nueva", AJOLOTE);
    await time.increaseTo(nacimiento + 50_000n); // las dos ya murieron (a las 12 h de nacer)

    expect(await pets.totalMascotas()).to.equal(2);
    const filas = await pets.ranking(0, 50);
    expect(filas.length).to.equal(2);
    expect(filas[0].nombre).to.equal("Vieja");
    expect(filas[0].dueno).to.equal(owner.address);
    expect(filas[0].viva).to.equal(false);
    expect(filas[0].duracion).to.equal(MUERTE_SIN_CUIDADOS);
    expect(filas[1].nombre).to.equal("Nueva");
    expect(filas[1].dueno).to.equal(otro.address);
    expect(filas[1].viva).to.equal(false);
    expect(filas[1].duracion).to.equal(MUERTE_SIN_CUIDADOS);

    expect((await pets.ranking(1, 50)).length).to.equal(1);
    expect((await pets.ranking(5, 50)).length).to.equal(0);
  });

  it("lista las mascotas de un dueño", async () => {
    const { pets, owner } = await desplegar();
    await pets.mint("A", AJOLOTE);
    await pets.mint("B", AJOLOTE);
    const ids = await pets.mascotasDe(owner.address);
    expect(ids.map((x) => Number(x))).to.deep.equal([1, 2]);
  });

  it("aísla dos dueños y actualiza permisos al transferir el NFT", async () => {
    const { pets, owner, otro } = await desplegar();
    await pets.mint("Luna", AJOLOTE);
    await pets.connect(otro).mint("Sol", 1);
    expect((await pets.mascotasDe(owner.address)).map(Number)).to.deep.equal([1]);
    expect((await pets.mascotasDe(otro.address)).map(Number)).to.deep.equal([2]);
    await expect(pets.connect(otro).jugar(1)).to.be.revertedWithCustomError(pets, "NoEresDueno");

    await pets.transferFrom(owner.address, otro.address, 1);
    expect(await pets.mascotasDe(owner.address)).to.deep.equal([]);
    expect((await pets.mascotasDe(otro.address)).map(Number).sort()).to.deep.equal([1, 2]);
    await expect(pets.jugar(1)).to.be.revertedWithCustomError(pets, "NoEresDueno");
    await expect(pets.connect(otro).jugar(1)).to.emit(pets, "Cuidada");
  });
});
