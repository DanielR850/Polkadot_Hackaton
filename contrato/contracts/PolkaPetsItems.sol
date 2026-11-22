// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/** Lo que este contrato lee de PolkaPets v2 (mismo orden de campos que PolkaPets.MascotaView). */
interface IPolkaPetsLectura {
    enum Etapa { Bebe, Joven, Adulta, Enferma, Muerta }
    enum Modo { Pacifico, Competencia }
    struct MascotaView {
        uint256 tokenId;
        string nombre;
        uint8 especie;
        uint64 nacimiento;
        uint64 ultimaInteraccion;
        uint8 vida;
        uint8 hambre;
        uint8 sed;
        uint8 energia;
        uint8 felicidad;
        uint8 limpieza;
        uint16 nivel;
        uint32 xp;
        bool viva;
        Etapa etapa;
        uint64 duracion;
        uint64 muerte;
        uint8 horas;
        Modo modo;
    }

    function ownerOf(uint256 tokenId) external view returns (address);
    function verMascota(uint256 tokenId) external view returns (MascotaView memory);
    function curar(uint256 tokenId, uint8 vida, uint8 necesidades) external;
}

/**
 * @title PolkaPetsItems
 * @notice Accesorios, muebles y trofeos del Tamagotchi como NFT (ERC-721). Cada objeto se compra, y cada
 *         trofeo se reclama, para UNA mascota (su tokenId en PolkaPets) y queda vinculado a ella para siempre:
 *          - otra mascota, aunque sea del mismo dueño, no puede usarlo ni tiene acceso a él;
 *          - el objeto no se puede transferir (queda ligado a la mascota que lo compró);
 *          - los trofeos (logros) también son NFT ligados a la mascota que los ganó: el contrato
 *            comprueba el tiempo desde su adopción y cuántos objetos compró (`reclamarLogro`);
 *          - cuando la mascota muere, `sellarLegado` guarda cuánto vivió y qué objetos tenía
 *            comprados y puestos, y qué trofeos ganó. Después ya no se puede comprar para esa mascota.
 *
 * @dev    Qué está puesto cambia seguido, así que no es una transacción por cambio: el juego lo
 *         guarda en el dispositivo y lo declara una sola vez, al sellar el legado. Ahí el contrato
 *         valida las reglas de "puesto":
 *          - como máximo UN accesorio, UNA pared y UN piso;
 *          - como máximo UN mueble por categoría (y MAX_MUEBLES en total);
 *          - como máximo UN adorno por categoría (y MAX_ADORNOS en total);
 *          - solo objetos que esa mascota compró.
 *         El precio en pesitos 🪙 es una moneda local del juego: el contrato no la conoce.
 *
 *         Versión 2 — colecciones y utilidad:
 *          - Ropa (accesorios), Hogar (paredes, pisos, muebles y adornos), Comida y Trofeos.
 *          - Cada objeto tiene una utilidad declarada en la cadena (`utilidad`, `valor`) y visible en
 *            su `tokenURI`: % de pesitos o % de felicidad mientras está puesto (los aplica el juego),
 *            o Vida / Saciedad al usar una comida (la aplica este contrato curando en PolkaPets).
 *          - La comida es consumible: se compra varias veces y `usar` la quema y cura a la mascota.
 *          - Drops: cada `intervaloDrop` de vida activa la mascota puede reclamar una comida NFT
 *            (incluidas comidas que no se venden).
 */
contract PolkaPetsItems is ERC721, Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Tipos
    // ─────────────────────────────────────────────────────────────────────────

    enum Tipo {
        Accesorio, // 0
        Pared, // 1
        Piso, // 2
        Mueble, // 3
        Adorno, // 4
        Comida, // 5: consumible
        Ropa // 6: ropa del cuerpo (poncho, paliacate, rebozo); una a la vez, junto a un accesorio
    }

    /** Para qué sirve un objeto. Los porcentajes los aplica el juego; Vida y Saciedad, este contrato. */
    enum Utilidad {
        Ninguna, // 0
        Pesitos, // 1: +valor % de pesitos en los minijuegos mientras está puesto
        Felicidad, // 2: +valor % de felicidad en los minijuegos mientras está puesto
        Vida, // 3: al usarla, +valor de vida en la cadena
        Saciedad // 4: al usarla, +valor a las cinco necesidades en la cadena
    }

    /** Un objeto del catálogo. `categoria` distingue muebles y adornos que ocupan el mismo lugar. */
    struct Articulo {
        bool existe;
        Tipo tipo;
        uint8 categoria;
        bool exclusivo; // true = no se compra: solo se gana como recompensa de un logro o un drop
        Utilidad utilidad;
        uint16 valor;
    }

    /** Un logro del catálogo: se gana con tiempo vivido y/o objetos comprados. */
    struct Logro {
        bool existe;
        uint32 minSegundos; // tiempo mínimo desde la adopción
        uint16 minObjetos; // objetos mínimos comprados para esa mascota
        uint16 recompensa; // objeto exclusivo que se entrega junto al trofeo (0 = ninguno)
    }

    /** Cómo se ve un objeto o un trofeo en el `tokenURI`: nombre, emoji y color (paredes y pisos). */
    struct Visual {
        string nombre;
        string icono;
        uint24 color; // 0 = sin color: se dibuja el emoji
    }

    /** Resumen de una mascota que murió. */
    struct Legado {
        bool sellado;
        uint64 duracion; // segundos que vivió
        uint64 selladoEn; // timestamp en que se guardó
        uint16[] comprados; // ids del catálogo que compró
        uint16[] equipados; // ids del catálogo que tenía puestos
        uint16[] logros; // ids de los logros que ganó
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Parámetros
    // ─────────────────────────────────────────────────────────────────────────

    uint8 public constant MAX_MUEBLES = 3;
    uint8 public constant MAX_ADORNOS = 2;
    /** Cada cuánto tiempo de vida la mascota gana un drop (lo puede cambiar el dueño). */
    uint64 public intervaloDrop = 30 minutes;
    // ─────────────────────────────────────────────────────────────────────────
    // Estado
    // ─────────────────────────────────────────────────────────────────────────

    IPolkaPetsLectura public immutable pets;

    uint256 private _siguienteId = 1;
    /** @notice Cuántos objetos tiene el catálogo. */
    function totalArticulos() external pure returns (uint16) {
        return TOTAL_ARTICULOS;
    }
    /**
     * Catálogo de objetos 1 a 61, empacado en el código (no en el almacenamiento) para que el
     * despliegue quepa en el límite de gas de Polkadot Hub. 6 bytes por objeto: tipo, categoría,
     * exclusivo, utilidad y valor (2 bytes). Debe coincidir con src/game/shop.ts y src/game/pantry.ts.
     */
    bytes private constant CATALOGO = hex"00000001000500000002000a00000001000800000002000800000001000f01000002000301000002000301000002000302000001000302000001000302000001000303010002000503010001000303020002000403020001000403030001000503040002000804010002000304020001000504030002000500000101000a00000102000f00000101001400000101000f00000001000c00000002000a00000001000600000002000c00000002000800000002000e00000001000801000002000301000002000301000002000301000002000301000002000302000001000302000001000302000001000302000001000303010002000403040002000703050001000403060001000603070002000903030001000503020002000404010002000304010001000404020002000304030002000404040001000405000003001405000004001905000004000f05000004001405000003001e05000103003205000104003c06000002000a060000020008";
    uint16 private constant TOTAL_ARTICULOS = 61;

    /** NFT de objeto → id del catálogo y mascota a la que pertenece. */
    mapping(uint256 => uint16) public articuloDe;
    mapping(uint256 => uint256) public mascotaDe;

    /** mascota → objeto → tokenId del NFT (0 = no lo ha comprado). */
    mapping(uint256 => mapping(uint16 => uint256)) public tokenComprado;
    mapping(uint256 => uint16[]) private _comprados;
    mapping(uint256 => Legado) private _legados;

    /** Logros: catálogo y trofeos ganados por cada mascota. */
    uint16 public totalLogros;
    mapping(uint16 => Logro) private _catalogoLogros;
    /** NFT de trofeo → id del logro (0 si el NFT es un objeto). */
    mapping(uint256 => uint16) public logroDe;
    /** mascota → logro → tokenId del NFT (0 = no lo ha ganado). */
    mapping(uint256 => mapping(uint16 => uint256)) public tokenLogro;
    mapping(uint256 => uint16[]) private _logrosGanados;

    /** Comida sin usar de cada mascota (tokenIds). */
    mapping(uint256 => uint256[]) private _despensa;
    /** Drops ya reclamados por cada mascota. */
    mapping(uint256 => uint32) public dropsTomados;
    /** Comidas que pueden salir en un drop. */
    uint16[] private _poolDrop;
    // ─────────────────────────────────────────────────────────────────────────
    // Eventos y errores
    // ─────────────────────────────────────────────────────────────────────────

    event ArticuloComprado(uint256 indexed mascotaId, uint256 indexed tokenId, uint16 articuloId, address indexed dueno);
    event LogroReclamado(uint256 indexed mascotaId, uint256 indexed tokenId, uint16 logroId, address indexed dueno);
    event ComidaUsada(uint256 indexed mascotaId, uint256 indexed tokenId, uint16 articuloId, Utilidad utilidad, uint16 valor);
    event DropReclamado(uint256 indexed mascotaId, uint256 indexed tokenId, uint16 articuloId);
    event LegadoSellado(uint256 indexed mascotaId, address indexed dueno, uint64 duracion, uint256 comprados, uint256 equipados);

    error NoEresDueno(uint256 mascotaId);
    error MascotaMuerta(uint256 mascotaId);
    error LegadoYaSellado(uint256 mascotaId);
    error ArticuloInvalido(uint16 articuloId);
    /** El objeto es exclusivo: solo se consigue reclamando su logro. */
    error SoloPorLogro(uint16 articuloId);
    error YaComprado(uint256 mascotaId, uint16 articuloId);
    error NoComprado(uint256 mascotaId, uint16 articuloId);
    /** Dos objetos del mismo lugar: dos accesorios, dos paredes, dos pisos… */
    error LugarRepetido(Tipo tipo);
    /** Dos muebles (o adornos) de la misma categoría. */
    error CategoriaRepetida(Tipo tipo, uint8 categoria);
    error SinLugar(Tipo tipo);
    error LogroInvalido(uint16 logroId);
    error LogroYaReclamado(uint256 mascotaId, uint16 logroId);
    error LogroNoAlcanzado(uint16 logroId);
    error DuracionInvalida();
    error NoTransferible();
    error NoEsComida(uint256 tokenId);
    error SinDrops(uint256 mascotaId);
    error NoSePonen(uint16 articuloId);
    constructor(address polkaPets) ERC721("PolkaPets Items", "PPETI") Ownable(msg.sender) {
        pets = IPolkaPetsLectura(polkaPets);

        // Debe coincidir con SHOP_CATALOG de src/game/shop.ts. Nombre, emoji y color de cada uno
        // están en `_visualArticulo`: no se guardan aquí para que el despliegue sea barato.

        // Utilidad de cada objeto (debe coincidir con `bonus` de SHOP_CATALOG en src/game/shop.ts).
        // Ropa mexicana: sombrero charro (accesorio) y prendas del cuerpo.
        // Objetos 25-52 de Ana (ya desplegados en TestNet con estos ids, tipos y categorías).
        // Ropa del cuerpo (v2): una prenda a la vez, junto a un accesorio.
        // Exclusivos: solo se ganan con un logro (`recompensa`).
        // Colección de comida (consumible). Debe coincidir con FOOD_CATALOG de src/game/shop.ts.
        _poolDrop = [53, 54, 55, 56, 57, 58, 59];
        // Debe coincidir con ACHIEVEMENTS de src/game/achievements.ts (id, segundos, objetos, recompensa).
        _logro(1, 10 minutes, 0, 0); // Primeros pasos
        _logro(2, 1 hours, 0, 0); // Adolescente
        _logro(3, 4 hours, 0, 21); // Adulta
        _logro(4, 8 hours, 0, 0); // Resistente
        _logro(5, 1 days, 0, 22); // Un día completo
        _logro(6, 7 days, 0, 23); // Una semana
        _logro(7, 0, 3, 0); // Coleccionista
        _logro(8, 0, 8, 24); // Gran colección
        _logro(9, 0, 15, 0); // Casa llena
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Acciones (transacciones)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Compra un objeto para una mascota tuya. Crea un NFT ligado a esa mascota.
     *         Cada objeto se compra una sola vez por mascota.
     */
    function comprar(uint256 mascotaId, uint16 articuloId) external returns (uint256 tokenId) {
        IPolkaPetsLectura.MascotaView memory m = _mascotaDelSender(mascotaId);
        if (!m.viva) revert MascotaMuerta(mascotaId);
        if (_legados[mascotaId].sellado) revert LegadoYaSellado(mascotaId);
        Articulo memory a = _articulo(articuloId);
        if (!a.existe) revert ArticuloInvalido(articuloId);
        if (a.exclusivo) revert SoloPorLogro(articuloId);
        if (a.tipo == Tipo.Comida) return _entregarComida(mascotaId, articuloId, msg.sender);
        if (tokenComprado[mascotaId][articuloId] != 0) revert YaComprado(mascotaId, articuloId);
        tokenId = _entregar(mascotaId, articuloId, msg.sender);
    }

    /**
     * @notice Usa una comida de la despensa: la quema y cura a su mascota en PolkaPets
     *         (Vida: +valor de vida; Saciedad: +valor a las cinco necesidades).
     */
    function usar(uint256 tokenId) external {
        uint256 mascotaId = mascotaDe[tokenId];
        IPolkaPetsLectura.MascotaView memory m = _mascotaDelSender(mascotaId);
        if (!m.viva) revert MascotaMuerta(mascotaId);
        Articulo memory a = _articulo(articuloDe[tokenId]);
        if (a.tipo != Tipo.Comida || logroDe[tokenId] != 0 || _ownerOf(tokenId) == address(0)) revert NoEsComida(tokenId);
        _quitarDeDespensa(mascotaId, tokenId);
        _burn(tokenId);
        uint8 v = a.valor > 100 ? 100 : uint8(a.valor);
        if (a.utilidad == Utilidad.Vida) pets.curar(mascotaId, v, 0);
        else if (a.utilidad == Utilidad.Saciedad) pets.curar(mascotaId, 0, v);
        emit ComidaUsada(mascotaId, tokenId, articuloDe[tokenId], a.utilidad, a.valor);
    }

    /**
     * @notice Reclama un drop: por cada `intervaloDrop` que la mascota lleva viva gana una comida NFT
     *         al azar del pool (incluye comidas que no se venden). El azar es suficiente para un juego,
     *         no para premios con valor monetario.
     */
    function reclamarDrop(uint256 mascotaId) external returns (uint256 tokenId) {
        IPolkaPetsLectura.MascotaView memory m = _mascotaDelSender(mascotaId);
        if (!m.viva) revert MascotaMuerta(mascotaId);
        if (dropsDisponibles(mascotaId) == 0) revert SinDrops(mascotaId);
        uint32 n = dropsTomados[mascotaId]++;
        uint256 azar = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), mascotaId, n, msg.sender)));
        uint16 articuloId = _poolDrop[azar % _poolDrop.length];
        tokenId = _entregarComida(mascotaId, articuloId, msg.sender);
        emit DropReclamado(mascotaId, tokenId, articuloId);
    }

    /** @notice Cambia cada cuánto tiempo de vida se gana un drop. Solo el dueño. */
    function setIntervaloDrop(uint64 segundos) external onlyOwner {
        if (segundos < 60) revert DuracionInvalida();
        intervaloDrop = segundos;
    }

    /**
     * @notice Reclama un trofeo para una mascota tuya y viva. El contrato comprueba por su cuenta el
     *         tiempo desde la adopción y los objetos que esa mascota compró. Crea un NFT ligado a ella y,
     *         si el logro tiene recompensa, el NFT del objeto exclusivo. Los pesitos 🪙 de la recompensa
     *         son locales: los acredita el juego.
     */
    function reclamarLogro(uint256 mascotaId, uint16 logroId) external returns (uint256 tokenId) {
        IPolkaPetsLectura.MascotaView memory m = _mascotaDelSender(mascotaId);
        if (!m.viva) revert MascotaMuerta(mascotaId);
        if (_legados[mascotaId].sellado) revert LegadoYaSellado(mascotaId);
        Logro memory l = _catalogoLogros[logroId];
        if (!l.existe) revert LogroInvalido(logroId);
        if (tokenLogro[mascotaId][logroId] != 0) revert LogroYaReclamado(mascotaId, logroId);
        if (block.timestamp - m.nacimiento < l.minSegundos || _comprados[mascotaId].length < l.minObjetos) {
            revert LogroNoAlcanzado(logroId);
        }

        tokenId = _siguienteId++;
        logroDe[tokenId] = logroId;
        mascotaDe[tokenId] = mascotaId;
        tokenLogro[mascotaId][logroId] = tokenId;
        _logrosGanados[mascotaId].push(logroId);

        _safeMint(msg.sender, tokenId);
        emit LogroReclamado(mascotaId, tokenId, logroId, msg.sender);

        // Recompensa: un objeto exclusivo, también ligado a la mascota (si no lo tenía ya).
        if (l.recompensa != 0 && tokenComprado[mascotaId][l.recompensa] == 0) {
            _entregar(mascotaId, l.recompensa, msg.sender);
        }
    }

    /**
     * @notice Guarda lo que vivió la mascota y los objetos que tenía comprados y puestos.
     *         Se hace una sola vez por mascota. `duracion` viene del juego (los cuidados son
     *         locales), igual que en el ranking: no puede ser mayor al tiempo desde su adopción.
     * @param equipados ids del catálogo que tenía puestos; se validan contra las reglas de arriba.
     */
    function sellarLegado(uint256 mascotaId, uint64 duracion, uint16[] calldata equipados) external {
        IPolkaPetsLectura.MascotaView memory m = _mascotaDelSender(mascotaId);
        Legado storage l = _legados[mascotaId];
        if (l.sellado) revert LegadoYaSellado(mascotaId);
        if (duracion == 0 || duracion > block.timestamp - m.nacimiento) revert DuracionInvalida();

        _validarEquipo(mascotaId, equipados);

        l.sellado = true;
        l.duracion = duracion;
        l.selladoEn = uint64(block.timestamp);
        l.comprados = _comprados[mascotaId];
        l.equipados = equipados;
        l.logros = _logrosGanados[mascotaId];
        emit LegadoSellado(mascotaId, msg.sender, duracion, l.comprados.length, equipados.length);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lectura (view, gratis)
    // ─────────────────────────────────────────────────────────────────────────

    function version() external pure returns (uint8) {
        return 2;
    }

    /** @notice Drops que la mascota puede reclamar ahora. */
    function dropsDisponibles(uint256 mascotaId) public view returns (uint256) {
        IPolkaPetsLectura.MascotaView memory m = pets.verMascota(mascotaId);
        if (!m.viva) return 0;
        uint256 ganados = (block.timestamp - m.nacimiento) / intervaloDrop;
        uint256 tomados = dropsTomados[mascotaId];
        return ganados > tomados ? ganados - tomados : 0;
    }

    /** @notice Comida sin usar de una mascota: tokenIds y su id de catálogo. */
    function despensaDe(uint256 mascotaId) external view returns (uint256[] memory tokens, uint16[] memory articulos) {
        tokens = _despensa[mascotaId];
        articulos = new uint16[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) articulos[i] = articuloDe[tokens[i]];
    }

    /** @notice Datos de un objeto del catálogo. */
    function articulo(uint16 articuloId) external pure returns (Articulo memory) {
        return _articulo(articuloId);
    }

    /** @notice Objetos (ids del catálogo) que ha comprado una mascota. */
    function compradosDe(uint256 mascotaId) external view returns (uint16[] memory) {
        return _comprados[mascotaId];
    }

    /** @notice Datos de un logro del catálogo. */
    function logro(uint16 logroId) external view returns (Logro memory) {
        return _catalogoLogros[logroId];
    }

    /** @notice Trofeos (ids de logro) que ha ganado una mascota. */
    function logrosDe(uint256 mascotaId) external view returns (uint16[] memory) {
        return _logrosGanados[mascotaId];
    }

    /** @notice Legado de una mascota; `sellado` es false si todavía no se guardó. */
    function verLegado(uint256 mascotaId) external view returns (Legado memory) {
        return _legados[mascotaId];
    }

    /** @notice Comprueba, sin escribir, si una selección de objetos puestos sería válida. */
    function validarEquipo(uint256 mascotaId, uint16[] calldata equipados) external view {
        _validarEquipo(mascotaId, equipados);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internos
    // ─────────────────────────────────────────────────────────────────────────

    /** Crea el NFT de un objeto para una mascota y lo agrega a su colección. */
    function _entregar(uint256 mascotaId, uint16 articuloId, address a) private returns (uint256 tokenId) {
        tokenId = _siguienteId++;
        articuloDe[tokenId] = articuloId;
        mascotaDe[tokenId] = mascotaId;
        tokenComprado[mascotaId][articuloId] = tokenId;
        _comprados[mascotaId].push(articuloId);

        _safeMint(a, tokenId);
        emit ArticuloComprado(mascotaId, tokenId, articuloId, a);
    }

    /** Comida: entra a la despensa de la mascota. Se puede tener varias del mismo tipo. */
    function _entregarComida(uint256 mascotaId, uint16 articuloId, address a) private returns (uint256 tokenId) {
        tokenId = _siguienteId++;
        articuloDe[tokenId] = articuloId;
        mascotaDe[tokenId] = mascotaId;
        _despensa[mascotaId].push(tokenId);
        _safeMint(a, tokenId);
        emit ArticuloComprado(mascotaId, tokenId, articuloId, a);
    }

    function _quitarDeDespensa(uint256 mascotaId, uint256 tokenId) private {
        uint256[] storage d = _despensa[mascotaId];
        for (uint256 i = 0; i < d.length; i++) {
            if (d[i] == tokenId) {
                d[i] = d[d.length - 1];
                d.pop();
                return;
            }
        }
        revert NoEsComida(tokenId);
    }

    function _logro(uint16 id, uint32 minSegundos, uint16 minObjetos, uint16 recompensa) private {
        _catalogoLogros[id] = Logro(true, minSegundos, minObjetos, recompensa);
        totalLogros += 1;
    }

    /** Lee un objeto del catálogo empacado; id 0 o fuera de rango = no existe. */
    function _articulo(uint16 id) private pure returns (Articulo memory a) {
        if (id == 0 || id > TOTAL_ARTICULOS) return a;
        uint256 o = (uint256(id) - 1) * 6;
        a.existe = true;
        a.tipo = Tipo(uint8(CATALOGO[o]));
        a.categoria = uint8(CATALOGO[o + 1]);
        a.exclusivo = CATALOGO[o + 2] != 0;
        a.utilidad = Utilidad(uint8(CATALOGO[o + 3]));
        a.valor = (uint16(uint8(CATALOGO[o + 4])) << 8) | uint16(uint8(CATALOGO[o + 5]));
    }

    /** La mascota debe existir y ser de quien llama. */
    function _mascotaDelSender(uint256 mascotaId) private view returns (IPolkaPetsLectura.MascotaView memory) {
        // ownerOf revierte si el NFT no existe.
        if (pets.ownerOf(mascotaId) != msg.sender) revert NoEresDueno(mascotaId);
        return pets.verMascota(mascotaId);
    }

    /**
     * @dev Reglas de lo que se puede tener puesto a la vez. Un accesorio/pared/piso ocupa un solo
     *      lugar; muebles y adornos, uno por categoría (máscara de bits) y un máximo total.
     */
    function _validarEquipo(uint256 mascotaId, uint16[] calldata equipados) private view {
        bool accesorio;
        bool ropa;
        bool pared;
        bool piso;
        uint8 muebles;
        uint8 adornos;
        uint16 categoriasMueble; // bit n = ya hay un mueble de la categoría n
        uint16 categoriasAdorno;

        for (uint256 i = 0; i < equipados.length; i++) {
            uint16 id = equipados[i];
            if (tokenComprado[mascotaId][id] == 0) revert NoComprado(mascotaId, id);
            Articulo memory a = _articulo(id);
            if (a.tipo == Tipo.Comida) revert NoSePonen(id);
            if (a.tipo == Tipo.Ropa) {
                if (ropa) revert LugarRepetido(Tipo.Ropa);
                ropa = true;
            } else if (a.tipo == Tipo.Accesorio) {
                if (accesorio) revert LugarRepetido(Tipo.Accesorio);
                accesorio = true;
            } else if (a.tipo == Tipo.Pared) {
                if (pared) revert LugarRepetido(Tipo.Pared);
                pared = true;
            } else if (a.tipo == Tipo.Piso) {
                if (piso) revert LugarRepetido(Tipo.Piso);
                piso = true;
            } else if (a.tipo == Tipo.Mueble) {
                uint16 bit = uint16(1) << a.categoria;
                if (categoriasMueble & bit != 0) revert CategoriaRepetida(Tipo.Mueble, a.categoria);
                if (muebles >= MAX_MUEBLES) revert SinLugar(Tipo.Mueble);
                categoriasMueble |= bit;
                muebles += 1;
            } else {
                uint16 bit = uint16(1) << a.categoria;
                if (categoriasAdorno & bit != 0) revert CategoriaRepetida(Tipo.Adorno, a.categoria);
                if (adornos >= MAX_ADORNOS) revert SinLugar(Tipo.Adorno);
                categoriasAdorno |= bit;
                adornos += 1;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Metadatos (tokenURI): JSON e imagen SVG generados en la cadena, sin servidor ni IPFS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Metadatos del NFT (estándar ERC-721 Metadata) como `data:` URI: nombre, descripción,
     *         atributos e imagen SVG con el objeto o trofeo y el nombre de su mascota. Los lee
     *         cualquier explorador o wallet sin depender de un servidor. La mascota se lee de
     *         PolkaPets (nombre y especie), así que si cambia su nombre, el NFT lo refleja.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 mascotaId = mascotaDe[tokenId];
        uint16 logroId = logroDe[tokenId];
        bool esTrofeo = logroId != 0;

        Visual memory v = esTrofeo ? _visualLogro(logroId) : _visualArticulo(articuloDe[tokenId]);
        string memory tipo = esTrofeo ? "Trofeo" : _nombreTipo(_articulo(articuloDe[tokenId]).tipo);
        IPolkaPetsLectura.MascotaView memory m = pets.verMascota(mascotaId);
        string memory mascota = _limpiar(m.nombre);

        string memory cabecera = string.concat(
            '{"name":"', v.nombre, '","description":"', tipo, " de ", mascota, unicode" · mascota #", Strings.toString(mascotaId),
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(_svg(v, mascota))), '",'
        );
        string memory utilidad = esTrofeo ? "Trofeo" : _textoUtilidad(_articulo(articuloDe[tokenId]));
        string memory atributos = _atributos(tipo, mascota, mascotaId, _especie(m.especie), utilidad);
        return string.concat("data:application/json;base64,", Base64.encode(bytes(string.concat(cabecera, atributos))));
    }

    function _atributos(string memory tipo, string memory mascota, uint256 mascotaId, string memory especie, string memory utilidad)
        private
        pure
        returns (string memory)
    {
        return string.concat(
            '"attributes":[{"trait_type":"Tipo","value":"', tipo,
            '"},{"trait_type":"Mascota","value":"', mascota,
            '"},{"trait_type":"Mascota #","value":"', Strings.toString(mascotaId),
            '"},{"trait_type":"Especie","value":"', especie,
            '"},{"trait_type":"Utilidad","value":"', utilidad, '"}]}'
        );
    }

    /**
     * Nombre, emoji y color de cada objeto (ids 1-61), empacados en el código para que el contrato
     * quepa en 24 KB: nombres y emoji separados por "|" y el color en 3 bytes por objeto (0 = emoji).
     * Deben coincidir con src/game/shop.ts y src/game/pantry.ts.
     */
    bytes private constant NOMBRES = unicode"Sombrero|Moño|Lentes|Flor|Corona|Pared rosa mexicano|Pared turquesa|Pared cempasúchil|Piso de barro|Pasto|Piedra|Sillón|Silla|Planta|Cactus|Lámpara|Camita|Cuadro|Reloj|Calaverita|Medalla|Estrella|Cinta de campeón|Amuleto|Sombrero de charro|Gorro de fiesta|Paliacate|Audífonos|Gorro de lana|Corona de flores|Gorra|Ladrillo|Papel tapiz floral|Pared de madera|Azulejo de talavera|Noche estrellada|Duela clara|Ajedrez|Mosaico|Arena|Puf|Hamaca|Mesita|Librero|Tele retro|Lámpara de pie|Girasol|Póster Polkadot|Espejo|Florero|Velas|Foquitos|Tamal|Pan de muerto|Elote|Agua de jamaica|Chocolate caliente|Mole de la abuela|Elixir de ajolote|Poncho|Rebozo";
    bytes private constant ICONOS = unicode"🎩|🎀|🕶️|🌺|👑|🟪|🟦|🟨|🟧|🟩|⬜|🛋️|🪑|🪴|🌵|🪔|🛏️|🖼️|🕰️|💀|🏅|⭐|🎗️|🧿|👒|🥳|🧣|🎧|🧶|💐|🧢|🧱|🌸|🪵|🔷|🌌|🟫|♟️|🔹|🏖️|🟣|🌈|🍽️|📚|📺|💡|🌻|🩷|🪞|🏺|🕯️|✨|🫔|🍞|🌽|🧃|☕|🍛|🧪|🧥|🧣";
    bytes private constant COLORES = hex"000000000000000000000000000000f3a6c88fd3d6f6c453c0643c6fae4f9aa0a8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b5533cfff3d6a8703ff7f3ea1f2a5ad9a86cf4f1e8f7f3eae9cf94000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    function _visualArticulo(uint16 id) private pure returns (Visual memory) {
        uint256 k = id == 0 || id > 61 ? 60 : id - 1;
        uint24 color = (uint24(uint8(COLORES[k * 3])) << 16) | (uint24(uint8(COLORES[k * 3 + 1])) << 8) | uint24(uint8(COLORES[k * 3 + 2]));
        return Visual(_segmento(NOMBRES, k), _segmento(ICONOS, k), color);
    }

    /** El texto número `k` (desde 0) de una lista separada por "|". */
    function _segmento(bytes memory lista, uint256 k) private pure returns (string memory) {
        uint256 i = 0;
        for (uint256 n = 0; n < k; i++) if (lista[i] == "|") n++;
        uint256 fin = i;
        while (fin < lista.length && lista[fin] != "|") fin++;
        bytes memory out = new bytes(fin - i);
        for (uint256 j = 0; j < out.length; j++) out[j] = lista[i + j];
        return string(out);
    }

    function _textoUtilidad(Articulo memory a) private pure returns (string memory) {
        string memory v = Strings.toString(a.valor);
        if (a.utilidad == Utilidad.Pesitos) return string.concat("+", v, "% pesitos");
        if (a.utilidad == Utilidad.Felicidad) return string.concat("+", v, "% felicidad");
        if (a.utilidad == Utilidad.Vida) return string.concat("+", v, " vida al usarla");
        if (a.utilidad == Utilidad.Saciedad) return string.concat("+", v, " a todas las necesidades al usarla");
        return "Decorativo";
    }

    function _visualLogro(uint16 id) private pure returns (Visual memory) {
        if (id == 1) return Visual(unicode"Primeros pasos", unicode"🐣", 0);
        if (id == 2) return Visual(unicode"Adolescente", unicode"🌱", 0);
        if (id == 3) return Visual(unicode"Adulta", unicode"🌳", 0);
        if (id == 4) return Visual(unicode"Resistente", unicode"💪", 0);
        if (id == 5) return Visual(unicode"Un día completo", unicode"📅", 0);
        if (id == 6) return Visual(unicode"Una semana", unicode"🏆", 0);
        if (id == 7) return Visual(unicode"Coleccionista", unicode"🎁", 0);
        if (id == 8) return Visual(unicode"Gran colección", unicode"🏺", 0);
        return Visual(unicode"Casa llena", unicode"🏠", 0);
    }

    /** Imagen 400×400: el emoji (o el color de la pared o el piso), el nombre y la mascota. */
    function _svg(Visual memory v, string memory mascota) private pure returns (string memory) {
        string memory arte = v.color == 0
            ? string.concat('<text x="200" y="240" font-size="150" text-anchor="middle">', v.icono, "</text>")
            : string.concat('<rect x="90" y="90" width="220" height="170" fill="#', _hex(v.color), '" stroke="#222" stroke-width="10"/>');
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#f6e7c8"/>',
            '<rect x="8" y="8" width="384" height="384" fill="none" stroke="#222" stroke-width="8"/>',
            arte,
            '<text x="200" y="310" font-size="28" text-anchor="middle" font-family="monospace" fill="#222">', v.nombre, "</text>",
            '<text x="200" y="352" font-size="20" text-anchor="middle" font-family="monospace" fill="#555">Mascota: ', mascota, "</text>",
            "</svg>"
        );
    }

    function _nombreTipo(Tipo tipo) private pure returns (string memory) {
        if (tipo == Tipo.Accesorio) return "Accesorio";
        if (tipo == Tipo.Pared) return "Pared";
        if (tipo == Tipo.Piso) return "Piso";
        if (tipo == Tipo.Mueble) return "Mueble";
        if (tipo == Tipo.Comida) return "Comida";
        if (tipo == Tipo.Ropa) return "Ropa";
        return "Adorno";
    }

    function _especie(uint8 especie) private pure returns (string memory) {
        if (especie == 0) return "Ajolote";
        if (especie == 1) return "Lobo";
        if (especie == 2) return "Oso grizzly";
        if (especie == 3) return "Tlacuache";
        return unicode"Manatí";
    }

    /** Color 0xRRGGBB como seis dígitos hexadecimales. */
    function _hex(uint24 color) private pure returns (string memory) {
        bytes16 digitos = "0123456789abcdef";
        bytes memory out = new bytes(6);
        for (uint256 i = 0; i < 6; i++) {
            out[5 - i] = digitos[(uint256(color) >> (4 * i)) & 0xf];
        }
        return string(out);
    }

    /**
     * @dev El nombre de la mascota lo escribe la persona y termina dentro de un SVG y un JSON:
     *      se reemplazan por espacio los caracteres que podrían romper o inyectar marcado
     *      (`< > & " ' \` y controles). Los bytes UTF-8 de letras y emojis no se tocan.
     */
    function _limpiar(string memory texto) private pure returns (string memory) {
        bytes memory entrada = bytes(texto);
        bytes memory salida = new bytes(entrada.length);
        for (uint256 i = 0; i < entrada.length; i++) {
            bytes1 c = entrada[i];
            bool peligroso = c < 0x20 || c == "<" || c == ">" || c == "&" || c == '"' || c == "'" || c == "\\";
            salida[i] = peligroso ? bytes1(" ") : c;
        }
        return string(salida);
    }

    /** Los objetos quedan ligados a su mascota: solo se pueden crear o quemar (comida usada), no mover. */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert NoTransferible();
        return super._update(to, tokenId, auth);
    }
}
