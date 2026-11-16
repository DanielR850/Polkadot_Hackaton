import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

const AJOLOTE = 0;
const PACIFICO = 0;
const COMPETENCIA = 1;

// Versión 2: los ritmos se escalan por la dificultad (horas). Con 1 h, sin cuidados:
// sed llega a 0 a los 2400 s (100 × 24), hambre a los 3200 s (100 × 32). La vida (100 × 16 = 1600
// "segundos en cero") se agota así: de 2400 a 3200 suma 800 (solo sed en 0); faltan 800 con dos en
// 0 (2 por segundo): 400 s más → muere exactamente a los 3600 s. Con 7 h y 12 h todo se multiplica.
const HORA = 3600;

describe("PolkaPets", () => {
  async function desplegar() {
    const [owner, otro, operador] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    await pets.waitForDeployment();
    return { pets, owner, otro, operador };
  }

  async function adoptar(horas = 1, modo = COMPETENCIA, nombre = "Michi", especie = AJOLOTE) {
    const ctx = await desplegar();
    await ctx.pets.mint(nombre, especie, horas, modo);
    const nacimiento = (await ctx.pets.verMascota(1)).nacimiento;
    return { ...ctx, nacimiento };
  }

  it("adopta con nombre, especie, dificultad, modo y todo al máximo", async () => {
    const { pets, owner } = await desplegar();
    await expect(pets.mint("Michi", AJOLOTE, 7, COMPETENCIA))
      .to.emit(pets, "MascotaNacida")
      .withArgs(1n, owner.address, "Michi", AJOLOTE);
    const m = await pets.verMascota(1);
    expect(m.nombre).to.equal("Michi");
    expect(m.horas).to.equal(7);
    expect(m.modo).to.equal(COMPETENCIA);
    for (const v of [m.vida, m.hambre, m.sed, m.energia, m.felicidad, m.limpieza]) expect(v).to.equal(100);
    expect(m.viva).to.equal(true);
    expect(await pets.version()).to.equal(2);
  });

  it("rechaza nombres, especies y dificultades inválidos", async () => {
    const { pets } = await desplegar();
    await expect(pets.mint("", AJOLOTE, 7, 0)).to.be.revertedWithCustomError(pets, "NombreInvalido");
    await expect(pets.mint("x".repeat(25), AJOLOTE, 7, 0)).to.be.revertedWithCustomError(pets, "NombreInvalido");
    await expect(pets.mint("Rex", 5, 7, 0)).to.be.revertedWithCustomError(pets, "EspecieInvalida");
    for (const h of [0, 2, 6, 8, 13, 24]) {
      await expect(pets.mint("Rex", 0, h, 0)).to.be.revertedWithCustomError(pets, "DificultadInvalida");
    }
  });

  it("adopta las cinco especies y conserva su id en la lectura", async () => {
    const { pets } = await desplegar();
    for (let id = 0; id < 5; id += 1) {
      await pets.mint(`Mascota ${id}`, id, 12, PACIFICO);
      expect((await pets.verMascota(id + 1)).especie).to.equal(id);
    }
  });

  it("cada necesidad baja a su ritmo según la dificultad", async () => {
    const { pets, nacimiento } = await adoptar(1);
    await time.increaseTo(nacimiento + 1600n);
    let m = await pets.verMascota(1);
    expect(m.hambre).to.equal(100 - 50); // 1600 / 32
    expect(m.sed).to.equal(100 - 66); // 1600 / 24
    expect(m.energia).to.equal(100 - 25); // 1600 / 64
    expect(m.felicidad).to.equal(100 - 33); // 1600 / 48
    expect(m.limpieza).to.equal(100 - 20); // 1600 / 80
    expect(m.duracion).to.equal(1600);

    const siete = await adoptar(7);
    await time.increaseTo(siete.nacimiento + 7n * 1600n);
    m = await siete.pets.verMascota(1);
    expect(m.hambre).to.equal(50); // mismo punto, siete veces más tarde
    expect(m.sed).to.equal(34);
  });

  for (const horas of [1, 7, 12]) {
    it(`en competencia sin cuidados muere exactamente a las ${horas} h`, async () => {
      const { pets, nacimiento } = await adoptar(horas);
      const muerte = BigInt(horas * HORA);
      await time.increaseTo(nacimiento + muerte - 1n);
      let m = await pets.verMascota(1);
      expect(m.viva).to.equal(true);
      expect(m.vida).to.be.greaterThan(0);
      await time.increaseTo(nacimiento + muerte);
      m = await pets.verMascota(1);
      expect(m.viva).to.equal(false);
      expect(m.etapa).to.equal(4); // Muerta
      expect(m.duracion).to.equal(muerte);
      await time.increase(10_000);
      expect((await pets.verMascota(1)).duracion).to.equal(muerte); // queda fija
      await expect(pets.alimentar(1)).to.be.revertedWithCustomError(pets, "EstaMuerta");
    });
  }

  it("en modo pacífico no muere: se enferma con vida 1 y se recupera al cuidarla", async () => {
    const { pets, nacimiento } = await adoptar(1, PACIFICO);
    await time.increaseTo(nacimiento + 10n * BigInt(HORA));
    let m = await pets.verMascota(1);
    expect(m.viva).to.equal(true);
    expect(m.vida).to.equal(1);
    expect(m.etapa).to.equal(3); // Enferma
    expect(m.muerte).to.equal(0);
    await pets.alimentar(1);
    await pets.dormir(1);
    await pets.jugar(1);
    await pets.banar(1);
    m = await pets.verMascota(1);
    expect(m.viva).to.equal(true);
    expect(m.vida).to.be.greaterThan(1);
  });

  it("alimentar sube hambre y sed; jugar alegra pero cansa", async () => {
    const { pets, nacimiento } = await adoptar(1);
    await time.setNextBlockTimestamp(nacimiento + 320n); // hambre 90, sed 87
    await pets.alimentar(1);
    let m = await pets.verMascota(1);
    expect(m.hambre).to.equal(100);
    expect(m.sed).to.equal(100);
    expect(m.xp).to.equal(10);
    await pets.jugar(1);
    m = await pets.verMascota(1);
    expect(m.felicidad).to.equal(100);
    expect(m.energia).to.be.lessThan(90);
  });

  it("cuidar recupera vida si ninguna necesidad queda en 0", async () => {
    const { pets, nacimiento } = await adoptar(1);
    await time.setNextBlockTimestamp(nacimiento + 2600n); // sed en 0 desde 2400: 200 s → -12 de vida
    await pets.alimentar(1);
    const m = await pets.verMascota(1);
    expect(m.vida).to.equal(100 - 12 + 5);
  });

  it("sube de nivel al acumular XP", async () => {
    const { pets } = await adoptar(12);
    for (let i = 0; i < 10; i++) await pets.dormir(1);
    const m = await pets.verMascota(1);
    expect(m.nivel).to.equal(2);
    expect(m.etapa).to.equal(1); // Joven
  });

  it("solo un operador autorizado por el dueño del contrato puede curar", async () => {
    const { pets, otro, operador, nacimiento } = await adoptar(1);
    await expect(pets.connect(operador).curar(1, 10, 10)).to.be.revertedWithCustomError(pets, "NoEresOperador");
    await expect(pets.connect(otro).setOperador(operador.address, true)).to.be.revertedWithCustomError(pets, "OwnableUnauthorizedAccount");
    await pets.setOperador(operador.address, true);
    await time.setNextBlockTimestamp(nacimiento + 2600n); // vida 88, sed 0
    await expect(pets.connect(operador).curar(1, 10, 30)).to.emit(pets, "Curada");
    const m = await pets.verMascota(1);
    expect(m.vida).to.equal(98);
    expect(m.sed).to.equal(30);
    await time.increase(10 * HORA);
    await expect(pets.connect(operador).curar(1, 10, 0)).to.be.revertedWithCustomError(pets, "EstaMuerta");
  });

  it("cambia el nombre y cuida solo el dueño", async () => {
    const { pets, otro } = await adoptar(7);
    await expect(pets.cambiarNombre(1, "Pelusa")).to.emit(pets, "NombreCambiado").withArgs(1n, "Pelusa");
    await expect(pets.connect(otro).cambiarNombre(1, "Robo")).to.be.revertedWithCustomError(pets, "NoEresDueno");
    await expect(pets.connect(otro).alimentar(1)).to.be.revertedWithCustomError(pets, "NoEresDueno");
  });

  it("el ranking devuelve la duración de cada mascota", async () => {
    const { pets, owner, otro } = await desplegar();
    await pets.mint("Vieja", AJOLOTE, 1, COMPETENCIA);
    const nacimiento = (await pets.verMascota(1)).nacimiento;
    await time.setNextBlockTimestamp(nacimiento + 100n);
    await pets.connect(otro).mint("Paz", AJOLOTE, 1, PACIFICO);
    await time.increaseTo(nacimiento + 5n * BigInt(HORA));
    const filas = await pets.ranking(0, 50);
    expect(filas.length).to.equal(2);
    expect(filas[0].dueno).to.equal(owner.address);
    expect(filas[0].viva).to.equal(false);
    expect(filas[0].duracion).to.equal(HORA);
    expect(filas[1].viva).to.equal(true); // pacífica: sigue viva
    expect((await pets.ranking(5, 50)).length).to.equal(0);
  });

  it("aísla dos dueños y actualiza permisos al transferir el NFT", async () => {
    const { pets, owner, otro } = await desplegar();
    await pets.mint("Luna", AJOLOTE, 12, 0);
    await pets.connect(otro).mint("Sol", 1, 12, 0);
    expect((await pets.mascotasDe(owner.address)).map(Number)).to.deep.equal([1]);
    await pets.transferFrom(owner.address, otro.address, 1);
    await expect(pets.jugar(1)).to.be.revertedWithCustomError(pets, "NoEresDueno");
    await expect(pets.connect(otro).jugar(1)).to.emit(pets, "Cuidada");
  });
});
