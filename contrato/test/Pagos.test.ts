import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;
const TX = ethers.id("pago de prueba");

describe("PolkaPetsPagos: billeteras y pagos trackeables", () => {
  async function desplegar() {
    const [admin, ana, beto, extra] = await ethers.getSigners();
    const pagos = await (await ethers.getContractFactory("PolkaPetsPagos")).deploy();
    return { pagos, admin, ana, beto, extra };
  }

  it("cada jugador registra y cambia su wallet de cobro", async () => {
    const { pagos, ana, extra } = await desplegar();
    expect(await pagos.billeteraDe(ana.address)).to.equal(ethers.ZeroAddress);
    await expect(pagos.connect(ana).setBilletera(extra.address)).to.emit(pagos, "BilleteraRegistrada").withArgs(ana.address, extra.address);
    expect(await pagos.billeteraDe(ana.address)).to.equal(extra.address);
    await pagos.connect(ana).setBilletera(ethers.ZeroAddress);
    expect(await pagos.billeteraDe(ana.address)).to.equal(ethers.ZeroAddress);
  });

  it("solo el administrador registra pagos, y solo a la wallet que la persona registró", async () => {
    const { pagos, ana, beto, extra } = await desplegar();
    await expect(pagos.connect(ana).registrarPago(1, 1, ana.address, 20, TX)).to.be.revertedWithCustomError(pagos, "OwnableUnauthorizedAccount");
    await expect(pagos.registrarPago(1, 1, ana.address, 20, TX)).to.be.revertedWithCustomError(pagos, "SinBilletera").withArgs(ana.address);
    await pagos.connect(ana).setBilletera(extra.address);
    await expect(pagos.registrarPago(1, 1, ana.address, 20, TX))
      .to.emit(pagos, "PagoRegistrado").withArgs(1, 1, ana.address, extra.address, 20, TX);
    const p = await pagos.pagoDe(1, 1);
    expect(p.cuenta).to.equal(ana.address);
    expect(p.billetera).to.equal(extra.address);
    expect(p.monto).to.equal(20n);
    expect(p.txHash).to.equal(TX);
    expect(Number(p.pagadoEn)).to.be.greaterThan(0);
    // Cambiar la wallet después no reescribe un pago ya hecho.
    await pagos.connect(ana).setBilletera(beto.address);
    expect((await pagos.pagoDe(1, 1)).billetera).to.equal(extra.address);
  });

  it("valida lugar, monto y hash, y no deja pagar dos veces el mismo lugar", async () => {
    const { pagos, ana, extra } = await desplegar();
    await pagos.connect(ana).setBilletera(extra.address);
    await expect(pagos.registrarPago(1, 0, ana.address, 20, TX)).to.be.revertedWithCustomError(pagos, "LugarInvalido");
    await expect(pagos.registrarPago(1, 4, ana.address, 20, TX)).to.be.revertedWithCustomError(pagos, "LugarInvalido");
    await expect(pagos.registrarPago(1, 1, ana.address, 0, TX)).to.be.revertedWithCustomError(pagos, "MontoInvalido");
    await expect(pagos.registrarPago(1, 1, ana.address, 20, ethers.ZeroHash)).to.be.revertedWithCustomError(pagos, "TxInvalido");
    await pagos.registrarPago(1, 1, ana.address, 20, TX);
    await expect(pagos.registrarPago(1, 1, ana.address, 20, TX)).to.be.revertedWithCustomError(pagos, "PagoYaRegistrado");
    await pagos.registrarPago(2, 1, ana.address, 20, ethers.id("otro")); // otra semana, mismo lugar: bien
  });

  it("se puede consultar por semana, por cuenta y por índice", async () => {
    const { pagos, ana, beto, extra } = await desplegar();
    await pagos.connect(ana).setBilletera(extra.address);
    await pagos.connect(beto).setBilletera(beto.address);
    await pagos.registrarPago(3, 1, ana.address, 20, ethers.id("a"));
    await pagos.registrarPago(3, 2, beto.address, 10, ethers.id("b"));
    await pagos.registrarPago(4, 1, ana.address, 20, ethers.id("c"));
    expect(await pagos.totalPagos()).to.equal(3n);
    const semana = await pagos.pagosDeSemana(3);
    expect(semana.length).to.equal(3);
    expect(semana[0].cuenta).to.equal(ana.address);
    expect(semana[1].cuenta).to.equal(beto.address);
    expect(semana[2].pagadoEn).to.equal(0n); // el 3.º aún no se paga
    expect((await pagos.pagosDe(ana.address)).length).to.equal(2);
    expect((await pagos.pagosDe(beto.address)).length).to.equal(1);
    expect((await pagos.pago(2)).semana).to.equal(4n);
    await expect(pagos.pago(9)).to.be.revertedWithCustomError(pagos, "NoExistePago");
    expect(await pagos.billeterasDe([ana.address, beto.address])).to.deep.equal([extra.address, beto.address]);
  });
});
