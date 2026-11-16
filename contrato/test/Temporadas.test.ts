import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

const DIA = 86_400;
const SEMANA = 7 * DIA;
const PACIFICO = 0;
const COMPETENCIA = 1;

describe("PolkaPetsTemporadas", () => {
  /** Calendario cuya semana 0 empieza en unos segundos (relativo al reloj de Hardhat). */
  async function desplegar() {
    const [owner, ana, beto, caro] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    const ahora = BigInt(await time.latest());
    const inicio = ahora + 1000n; // "lunes" 00:00 de la semana 0
    const temporadas = await (await ethers.getContractFactory("PolkaPetsTemporadas")).deploy(await pets.getAddress(), inicio);
    await time.increaseTo(inicio + 10n); // lunes
    return { pets, temporadas, inicio, owner, ana, beto, caro };
  }

  it("abre de lunes a viernes y cierra sábado y domingo", async () => {
    const { temporadas, inicio } = await desplegar();
    let s = await temporadas.semanaActual();
    expect(s.semana).to.equal(0);
    expect(s.abierta).to.equal(true);
    expect(s.cierra - s.abre).to.equal(5n * BigInt(DIA));
    await time.increaseTo(inicio + 5n * BigInt(DIA) - 1n); // viernes 23:59:59
    expect((await temporadas.semanaActual()).abierta).to.equal(true);
    await time.increaseTo(inicio + 5n * BigInt(DIA)); // sábado 00:00
    expect((await temporadas.semanaActual()).abierta).to.equal(false);
    await time.increaseTo(inicio + BigInt(SEMANA)); // lunes siguiente
    s = await temporadas.semanaActual();
    expect(s.semana).to.equal(1);
    expect(s.abierta).to.equal(true);
  });

  it("registra con la duración calculada por la cadena y valida todo", async () => {
    const { pets, temporadas, ana, beto } = await desplegar();
    await pets.connect(ana).mint("Axo", 0, 1, COMPETENCIA); // 1
    await pets.connect(ana).mint("Paz", 0, 1, PACIFICO); // 2
    await expect(temporadas.connect(ana).registrar(1)).to.be.revertedWithCustomError(temporadas, "SigueViva");
    await time.increase(3600);
    await expect(temporadas.connect(beto).registrar(1)).to.be.revertedWithCustomError(temporadas, "NoEresDueno");
    await expect(temporadas.connect(ana).registrar(2)).to.be.revertedWithCustomError(temporadas, "NoEsCompetencia");
    await expect(temporadas.connect(ana).registrar(1)).to.emit(temporadas, "Registrada").withArgs(0n, 1n, ana.address, 1, 3600n);
    await expect(temporadas.connect(ana).registrar(1)).to.be.revertedWithCustomError(temporadas, "YaRegistrada");
    const filas = await temporadas.registros(0, 0, 10);
    expect(filas.length).to.equal(1);
    expect(filas[0].nombre).to.equal("Axo");
    expect(filas[0].duracion).to.equal(3600);
  });

  it("no acepta mascotas de otra temporada ni registros en fin de semana o en pausa", async () => {
    const { pets, temporadas, inicio, ana, owner } = await desplegar();
    await pets.connect(ana).mint("Vieja", 0, 1, COMPETENCIA); // nace la semana 0
    await time.increaseTo(inicio + 5n * BigInt(DIA) + 10n); // sábado
    await expect(temporadas.connect(ana).registrar(1)).to.be.revertedWithCustomError(temporadas, "TemporadaCerradaAhora");
    await time.increaseTo(inicio + BigInt(SEMANA) + 10n); // lunes de la semana 1
    await expect(temporadas.connect(ana).registrar(1)).to.be.revertedWithCustomError(temporadas, "DeOtraTemporada");
    await pets.connect(ana).mint("Nueva", 0, 1, COMPETENCIA);
    await time.increase(3600);
    await temporadas.connect(owner).setPausada(true);
    await expect(temporadas.connect(ana).registrar(2)).to.be.revertedWithCustomError(temporadas, "EnPausa");
    await temporadas.connect(owner).setPausada(false);
    await temporadas.connect(ana).registrar(2);
  });

  it("al cerrar guarda el podio por dificultad y borra lo demás; el lunes empieza vacío", async () => {
    const { pets, temporadas, inicio, ana, beto, caro } = await desplegar();
    // Cuatro mascotas de 1 h y una de 7 h con distintas duraciones (cuidados distintos).
    const jugadores = [ana, beto, caro, ana];
    for (let i = 0; i < 4; i++) await pets.connect(jugadores[i]).mint(`P${i}`, 0, 1, COMPETENCIA);
    await pets.connect(beto).mint("Larga", 0, 7, COMPETENCIA); // 5
    await pets.connect(beto).alimentar(2); // vive un poco más
    await time.increase(600);
    await pets.connect(caro).alimentar(3);
    await time.increase(600);
    await pets.connect(caro).alimentar(3); // la que más vive
    await time.increase(7 * 3600 + 600);
    for (let i = 0; i < 4; i++) await temporadas.connect(jugadores[i]).registrar(i + 1);
    await temporadas.connect(beto).registrar(5);
    expect(await temporadas.total(0)).to.equal(5);

    await expect(temporadas.cerrarTemporada(0)).to.be.revertedWithCustomError(temporadas, "TemporadaEnCurso");
    await time.increaseTo(inicio + 5n * BigInt(DIA));
    await expect(temporadas.cerrarTemporada(0)).to.emit(temporadas, "TemporadaCerrada").withArgs(0n, 5n, 4n);
    await expect(temporadas.cerrarTemporada(0)).to.be.revertedWithCustomError(temporadas, "YaCerrada");

    const podio = await temporadas.podio(0);
    expect(podio.length).to.equal(4); // top 3 de 1 h + la única de 7 h
    expect(podio[0].tokenId).to.equal(3); // campeona de 1 h
    expect(podio[0].duracion).to.be.greaterThan(podio[1].duracion);
    expect(podio[1].duracion).to.be.greaterThanOrEqual(podio[2].duracion);
    expect(podio[3].horas).to.equal(7);
    expect(await temporadas.total(0)).to.equal(0); // historial borrado
    expect((await temporadas.semanasCerradas()).map(Number)).to.deep.equal([0]);

    await time.increaseTo(inicio + BigInt(SEMANA));
    expect((await temporadas.semanaActual()).semana).to.equal(1);
    expect(await temporadas.total(1)).to.equal(0);
  });

  it("solo el dueño cambia el calendario o pausa", async () => {
    const { temporadas, ana } = await desplegar();
    await expect(temporadas.connect(ana).setPausada(true)).to.be.revertedWithCustomError(temporadas, "OwnableUnauthorizedAccount");
    await expect(temporadas.connect(ana).setCalendario(0, 5)).to.be.revertedWithCustomError(temporadas, "OwnableUnauthorizedAccount");
    await expect(temporadas.setCalendario(0, 0)).to.be.revertedWithCustomError(temporadas, "CalendarioInvalido");
    await expect(temporadas.setCalendario(0, 8)).to.be.revertedWithCustomError(temporadas, "CalendarioInvalido");
  });
});
