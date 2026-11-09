import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

// Ids del catálogo (contrato/contracts/PolkaPetsItems.sol y src/game/shop.ts).
const SOMBRERO = 1;
const MONO = 2;
const CORONA = 5;
const PARED_ROSA = 6;
const PARED_TURQUESA = 7;
const PISO_BARRO = 9;
const SILLON = 12;
const SILLA = 13; // misma categoría que el sillón (asiento)
const PLANTA = 14;
const CACTUS = 15; // misma categoría que la planta
const LAMPARA = 16;
const CAMA = 17;
const CUADRO = 18;
const RELOJ = 19;
const CALAVERA = 20;

// Enum Tipo del contrato.
const TIPO = { Accesorio: 0, Pared: 1, Piso: 2, Mueble: 3, Adorno: 4 };

describe("PolkaPetsItems", () => {
  async function desplegar() {
    const [owner, otro] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    await pets.waitForDeployment();
    const items = await (await ethers.getContractFactory("PolkaPetsItems")).deploy(await pets.getAddress());
    await items.waitForDeployment();
    await pets.mint("Michi", 0); // mascota 1
    await pets.mint("Pelusa", 0); // mascota 2
    return { pets, items, owner, otro };
  }

  async function comprarVarios(items: Awaited<ReturnType<typeof desplegar>>["items"], mascota: number, ids: number[]) {
    for (const id of ids) await items.comprar(mascota, id);
  }

  describe("compra", () => {
    it("crea un NFT ligado a la mascota", async () => {
      const { items, owner } = await desplegar();
      await expect(items.comprar(1, SOMBRERO)).to.emit(items, "ArticuloComprado").withArgs(1n, 1n, SOMBRERO, owner.address);

      expect(await items.ownerOf(1)).to.equal(owner.address);
      expect(await items.mascotaDe(1)).to.equal(1n);
      expect(await items.articuloDe(1)).to.equal(SOMBRERO);
      expect(await items.compradosDe(1)).to.deep.equal([BigInt(SOMBRERO)]);
    });

    it("el catálogo clasifica cada objeto", async () => {
      const { items } = await desplegar();
      expect(await items.totalArticulos()).to.equal(24);
      expect((await items.articulo(SOMBRERO)).tipo).to.equal(TIPO.Accesorio);
      expect((await items.articulo(PARED_ROSA)).tipo).to.equal(TIPO.Pared);
      expect((await items.articulo(SILLON)).categoria).to.equal((await items.articulo(SILLA)).categoria);
      expect((await items.articulo(SILLON)).categoria).to.not.equal((await items.articulo(PLANTA)).categoria);
    });

    it("solo el dueño de la mascota compra para ella", async () => {
      const { items, otro } = await desplegar();
      await expect(items.connect(otro).comprar(1, SOMBRERO)).to.be.revertedWithCustomError(items, "NoEresDueno");
    });

    it("rechaza mascotas inexistentes, objetos inexistentes y compras repetidas", async () => {
      const { items } = await desplegar();
      await expect(items.comprar(99, SOMBRERO)).to.be.reverted;
      await expect(items.comprar(1, 0)).to.be.revertedWithCustomError(items, "ArticuloInvalido");
      await expect(items.comprar(1, 25)).to.be.revertedWithCustomError(items, "ArticuloInvalido");
      await items.comprar(1, SOMBRERO);
      await expect(items.comprar(1, SOMBRERO)).to.be.revertedWithCustomError(items, "YaComprado");
    });

    it("cada mascota compra por separado: la segunda no hereda nada de la primera", async () => {
      const { items } = await desplegar();
      await items.comprar(1, SOMBRERO);
      expect(await items.compradosDe(2)).to.deep.equal([]);
      await items.comprar(2, SOMBRERO); // el mismo objeto se puede comprar para otra mascota
      expect(await items.mascotaDe(2)).to.equal(2n);
      // y la mascota 2 no puede declarar como puesto algo que solo compró la 1
      await items.comprar(1, CORONA);
      await expect(items.sellarLegado(2, 1, [CORONA])).to.be.revertedWithCustomError(items, "NoComprado");
    });

    it("los objetos no se transfieren", async () => {
      const { items, owner, otro } = await desplegar();
      await items.comprar(1, SOMBRERO);
      await expect(items.transferFrom(owner.address, otro.address, 1)).to.be.revertedWithCustomError(items, "NoTransferible");
    });

    it("no se compra para una mascota que ya murió", async () => {
      const { items, pets } = await desplegar();
      await time.increase(7 * 24 * 3600);
      expect((await pets.verMascota(1)).viva).to.equal(false);
      await expect(items.comprar(1, SOMBRERO)).to.be.revertedWithCustomError(items, "MascotaMuerta");
    });
  });

  describe("legado", () => {
    it("guarda duración, comprados y puestos", async () => {
      const { items, owner } = await desplegar();
      await comprarVarios(items, 1, [SOMBRERO, MONO, PARED_ROSA, SILLON, PLANTA]);
      await time.increase(100);

      await expect(items.sellarLegado(1, 90, [SOMBRERO, PARED_ROSA, SILLON]))
        .to.emit(items, "LegadoSellado")
        .withArgs(1n, owner.address, 90n, 5n, 3n);

      const l = await items.verLegado(1);
      expect(l.sellado).to.equal(true);
      expect(l.duracion).to.equal(90n);
      expect([...l.comprados].map(Number)).to.deep.equal([SOMBRERO, MONO, PARED_ROSA, SILLON, PLANTA]);
      expect([...l.equipados].map(Number)).to.deep.equal([SOMBRERO, PARED_ROSA, SILLON]);
      // la otra mascota no tiene legado
      expect((await items.verLegado(2)).sellado).to.equal(false);
    });

    it("solo se sella una vez y solo lo hace el dueño", async () => {
      const { items, otro } = await desplegar();
      await time.increase(100);
      await expect(items.connect(otro).sellarLegado(1, 50, [])).to.be.revertedWithCustomError(items, "NoEresDueno");
      await items.sellarLegado(1, 50, []);
      await expect(items.sellarLegado(1, 50, [])).to.be.revertedWithCustomError(items, "LegadoYaSellado");
    });

    it("la duración debe ser positiva y no mayor al tiempo desde la adopción", async () => {
      const { items } = await desplegar();
      await expect(items.sellarLegado(1, 0, [])).to.be.revertedWithCustomError(items, "DuracionInvalida");
      await expect(items.sellarLegado(1, 1_000_000, [])).to.be.revertedWithCustomError(items, "DuracionInvalida");
    });

    it("tras sellar el legado ya no se compra para esa mascota", async () => {
      const { items } = await desplegar();
      await time.increase(100);
      await items.sellarLegado(1, 50, []);
      await expect(items.comprar(1, SOMBRERO)).to.be.revertedWithCustomError(items, "LegadoYaSellado");
      // otra mascota nueva sí puede comprar
      await expect(items.comprar(2, SOMBRERO)).to.not.be.reverted;
    });
  });

  describe("trofeos", () => {
    const PRIMEROS_PASOS = 1; // 10 min
    const ADOLESCENTE = 2; // 1 h
    const COLECCIONISTA = 7; // 3 objetos

    it("reclama un trofeo ligado a la mascota cuando pasó el tiempo", async () => {
      const { items, owner } = await desplegar();
      await time.increase(11 * 60);
      await expect(items.reclamarLogro(1, PRIMEROS_PASOS))
        .to.emit(items, "LogroReclamado")
        .withArgs(1n, 1n, PRIMEROS_PASOS, owner.address);

      expect(await items.ownerOf(1)).to.equal(owner.address);
      expect(await items.mascotaDe(1)).to.equal(1n);
      expect(await items.logroDe(1)).to.equal(PRIMEROS_PASOS);
      expect((await items.logrosDe(1)).map(Number)).to.deep.equal([PRIMEROS_PASOS]);
      expect(await items.totalLogros()).to.equal(9);
      // el trofeo es de la mascota 1: la 2 no lo tiene
      expect(await items.logrosDe(2)).to.deep.equal([]);
    });

    it("rechaza un logro que todavía no se alcanzó", async () => {
      const { items } = await desplegar();
      await expect(items.reclamarLogro(1, PRIMEROS_PASOS)).to.be.revertedWithCustomError(items, "LogroNoAlcanzado");
      await time.increase(11 * 60);
      await expect(items.reclamarLogro(1, ADOLESCENTE)).to.be.revertedWithCustomError(items, "LogroNoAlcanzado");
    });

    it("los logros de colección piden objetos comprados por esa mascota", async () => {
      const { items } = await desplegar();
      await comprarVarios(items, 1, [SOMBRERO, MONO]);
      await expect(items.reclamarLogro(1, COLECCIONISTA)).to.be.revertedWithCustomError(items, "LogroNoAlcanzado");
      await items.comprar(1, CORONA);
      await expect(items.reclamarLogro(1, COLECCIONISTA)).to.not.be.reverted;
      // los objetos de la mascota 1 no cuentan para la 2
      await expect(items.reclamarLogro(2, COLECCIONISTA)).to.be.revertedWithCustomError(items, "LogroNoAlcanzado");
    });

    it("no se reclama dos veces, ni uno inexistente, ni para una mascota ajena", async () => {
      const { items, otro } = await desplegar();
      await time.increase(11 * 60);
      await items.reclamarLogro(1, PRIMEROS_PASOS);
      await expect(items.reclamarLogro(1, PRIMEROS_PASOS)).to.be.revertedWithCustomError(items, "LogroYaReclamado");
      await expect(items.reclamarLogro(1, 0)).to.be.revertedWithCustomError(items, "LogroInvalido");
      await expect(items.reclamarLogro(1, 10)).to.be.revertedWithCustomError(items, "LogroInvalido");
      await expect(items.connect(otro).reclamarLogro(2, PRIMEROS_PASOS)).to.be.revertedWithCustomError(items, "NoEresDueno");
    });

    it("no se reclama con la mascota muerta ni después de sellar el legado", async () => {
      const { items, pets } = await desplegar();
      await time.increase(100);
      await items.sellarLegado(2, 50, []);
      await time.increase(11 * 60);
      await expect(items.reclamarLogro(2, PRIMEROS_PASOS)).to.be.revertedWithCustomError(items, "LegadoYaSellado");

      await time.increase(7 * 24 * 3600);
      expect((await pets.verMascota(1)).viva).to.equal(false);
      await expect(items.reclamarLogro(1, PRIMEROS_PASOS)).to.be.revertedWithCustomError(items, "MascotaMuerta");
    });

    it("algunos logros entregan un accesorio exclusivo, también ligado a la mascota", async () => {
      const { items, pets, owner } = await desplegar();
      const ADULTA = 3;
      const MEDALLA = 21;
      expect((await items.articulo(MEDALLA)).exclusivo).to.equal(true);
      expect((await items.logro(ADULTA)).recompensa).to.equal(MEDALLA);

      // Sin cuidados la mascota muere en el contrato: se cuida cada 30 min durante 4 h.
      for (let i = 0; i < 8; i += 1) {
        await time.increase(30 * 60);
        await pets.alimentar(1);
        await pets.jugar(1);
        await pets.dormir(1);
        await pets.banar(1);
      }
      await time.increase(60);
      await expect(items.reclamarLogro(1, ADULTA))
        .to.emit(items, "LogroReclamado")
        .and.to.emit(items, "ArticuloComprado")
        .withArgs(1n, 2n, MEDALLA, owner.address);

      // token 1 = trofeo, token 2 = medalla
      expect(await items.articuloDe(2)).to.equal(MEDALLA);
      expect(await items.mascotaDe(2)).to.equal(1n);
      expect(await items.tokenComprado(1, MEDALLA)).to.equal(2n);
      expect((await items.compradosDe(1)).map(Number)).to.deep.equal([MEDALLA]);
      // la mascota 2 no recibió nada
      expect(await items.tokenComprado(2, MEDALLA)).to.equal(0n);
      // y se puede poner (y cuenta para la regla de un solo accesorio)
      await items.comprar(1, SOMBRERO);
      await expect(items.validarEquipo(1, [MEDALLA])).to.not.be.reverted;
      await expect(items.validarEquipo(1, [MEDALLA, SOMBRERO])).to.be.revertedWithCustomError(items, "LugarRepetido");
    });

    it("los objetos exclusivos no se pueden comprar", async () => {
      const { items } = await desplegar();
      await expect(items.comprar(1, 21)).to.be.revertedWithCustomError(items, "SoloPorLogro").withArgs(21);
    });

    it("los trofeos no se transfieren y quedan en el legado", async () => {
      const { items, owner, otro } = await desplegar();
      await time.increase(11 * 60);
      await items.reclamarLogro(1, PRIMEROS_PASOS);
      await expect(items.transferFrom(owner.address, otro.address, 1)).to.be.revertedWithCustomError(items, "NoTransferible");

      await items.sellarLegado(1, 600, []);
      expect([...(await items.verLegado(1)).logros].map(Number)).to.deep.equal([PRIMEROS_PASOS]);
    });
  });

  describe("metadatos e imagen (tokenURI)", () => {
    /** Decodifica el data: URI de metadatos y el SVG de su imagen. */
    function leer(uri: string) {
      expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
      const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
      expect(json.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);
      const svg = Buffer.from(json.image.split(",")[1], "base64").toString("utf8");
      return { json, svg };
    }
    const atributo = (json: any, nombre: string) => json.attributes.find((a: any) => a.trait_type === nombre)?.value;

    it("un accesorio trae nombre, mascota, atributos e imagen con su emoji", async () => {
      const { items } = await desplegar();
      await items.comprar(1, SOMBRERO);
      const { json, svg } = leer(await items.tokenURI(1));

      expect(json.name).to.equal("Sombrero");
      expect(json.description).to.contain("Michi");
      expect(atributo(json, "Tipo")).to.equal("Accesorio");
      expect(atributo(json, "Mascota")).to.equal("Michi");
      expect(atributo(json, "Mascota #")).to.equal("1");
      expect(atributo(json, "Especie")).to.equal("Ajolote");
      expect(svg.startsWith("<svg")).to.equal(true);
      expect(svg).to.contain("🎩");
      expect(svg).to.contain("Mascota: Michi");
    });

    it("una pared se dibuja con su color y un mueble con su tipo", async () => {
      const { items } = await desplegar();
      await comprarVarios(items, 2, [PARED_ROSA, SILLON]);
      const pared = leer(await items.tokenURI(1));
      expect(atributo(pared.json, "Tipo")).to.equal("Pared");
      expect(pared.svg).to.contain('fill="#f3a6c8"');
      expect(atributo(pared.json, "Mascota")).to.equal("Pelusa");
      const mueble = leer(await items.tokenURI(2));
      expect(atributo(mueble.json, "Tipo")).to.equal("Mueble");
      expect(mueble.svg).to.contain("🛋️");
    });

    it("un trofeo y el accesorio que entrega tienen su propia imagen", async () => {
      const { items } = await desplegar();
      await time.increase(11 * 60);
      await items.reclamarLogro(1, 1); // Primeros pasos
      const trofeo = leer(await items.tokenURI(1));
      expect(trofeo.json.name).to.equal("Primeros pasos");
      expect(atributo(trofeo.json, "Tipo")).to.equal("Trofeo");
      expect(trofeo.svg).to.contain("🐣");
    });

    it("el nombre de la mascota no puede inyectar marcado en el SVG ni el JSON", async () => {
      const { items, pets } = await desplegar();
      await pets.mint('<script>"x"\\', 0); // mascota 3
      await items.comprar(3, SOMBRERO);
      const { json, svg } = leer(await items.tokenURI(1));
      expect(svg).to.not.contain("<script");
      expect(svg).to.not.contain('"x"');
      expect(atributo(json, "Mascota")).to.equal(" script  x  ");
    });

    it("un NFT que no existe no tiene tokenURI", async () => {
      const { items } = await desplegar();
      await expect(items.tokenURI(99)).to.be.reverted;
    });
  });

  describe("reglas de lo puesto", () => {
    it("rechaza dos accesorios al mismo tiempo", async () => {
      const { items } = await desplegar();
      await comprarVarios(items, 1, [SOMBRERO, CORONA]);
      await expect(items.validarEquipo(1, [SOMBRERO, CORONA]))
        .to.be.revertedWithCustomError(items, "LugarRepetido")
        .withArgs(TIPO.Accesorio);
      await time.increase(100);
      await expect(items.sellarLegado(1, 50, [SOMBRERO, CORONA])).to.be.revertedWithCustomError(items, "LugarRepetido");
    });

    it("rechaza dos paredes o dos pisos", async () => {
      const { items } = await desplegar();
      await comprarVarios(items, 1, [PARED_ROSA, PARED_TURQUESA]);
      await expect(items.validarEquipo(1, [PARED_ROSA, PARED_TURQUESA]))
        .to.be.revertedWithCustomError(items, "LugarRepetido")
        .withArgs(TIPO.Pared);
      await items.comprar(1, PISO_BARRO);
      await expect(items.validarEquipo(1, [PARED_ROSA, PISO_BARRO])).to.not.be.reverted;
    });

    it("rechaza dos muebles de la misma categoría", async () => {
      const { items } = await desplegar();
      await comprarVarios(items, 1, [SILLON, SILLA, PLANTA, CACTUS]);
      const asiento = (await items.articulo(SILLON)).categoria;
      await expect(items.validarEquipo(1, [SILLON, SILLA]))
        .to.be.revertedWithCustomError(items, "CategoriaRepetida")
        .withArgs(TIPO.Mueble, asiento);
      await expect(items.validarEquipo(1, [PLANTA, CACTUS])).to.be.revertedWithCustomError(items, "CategoriaRepetida");
      // categorías distintas sí
      await expect(items.validarEquipo(1, [SILLON, PLANTA])).to.not.be.reverted;
    });

    it("limita el total de muebles y de adornos", async () => {
      const { items } = await desplegar();
      await comprarVarios(items, 1, [SILLON, PLANTA, LAMPARA, CAMA, CUADRO, RELOJ, CALAVERA]);
      await expect(items.validarEquipo(1, [SILLON, PLANTA, LAMPARA])).to.not.be.reverted;
      await expect(items.validarEquipo(1, [SILLON, PLANTA, LAMPARA, CAMA]))
        .to.be.revertedWithCustomError(items, "SinLugar")
        .withArgs(TIPO.Mueble);
      await expect(items.validarEquipo(1, [CUADRO, RELOJ])).to.not.be.reverted;
      await expect(items.validarEquipo(1, [CUADRO, RELOJ, CALAVERA]))
        .to.be.revertedWithCustomError(items, "SinLugar")
        .withArgs(TIPO.Adorno);
    });

    it("rechaza el mismo objeto repetido y objetos no comprados", async () => {
      const { items } = await desplegar();
      await items.comprar(1, SOMBRERO);
      await expect(items.validarEquipo(1, [SOMBRERO, SOMBRERO])).to.be.revertedWithCustomError(items, "LugarRepetido");
      await expect(items.validarEquipo(1, [CORONA])).to.be.revertedWithCustomError(items, "NoComprado");
      await expect(items.validarEquipo(1, [99])).to.be.revertedWithCustomError(items, "NoComprado");
    });
  });
});
