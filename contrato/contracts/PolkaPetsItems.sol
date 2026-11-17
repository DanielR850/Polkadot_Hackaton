// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/** Lo que este contrato lee de PolkaPets (mismo orden de campos que PolkaPets.MascotaView). */
interface IPolkaPetsLectura {
    enum Etapa { Bebe, Joven, Adulta, Enferma, Muerta }

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
    }

    function ownerOf(uint256 tokenId) external view returns (address);
    function verMascota(uint256 tokenId) external view returns (MascotaView memory);
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
 */
contract PolkaPetsItems is ERC721 {
    // ─────────────────────────────────────────────────────────────────────────
    // Tipos
    // ─────────────────────────────────────────────────────────────────────────

    enum Tipo {
        Accesorio, // 0
        Pared, // 1
        Piso, // 2
        Mueble, // 3
        Adorno // 4
    }

    /** Un objeto del catálogo. `categoria` distingue muebles y adornos que ocupan el mismo lugar. */
    struct Articulo {
        bool existe;
        Tipo tipo;
        uint8 categoria;
        bool exclusivo; // true = no se compra: solo se gana como recompensa de un logro
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

    // ─────────────────────────────────────────────────────────────────────────
    // Estado
    // ─────────────────────────────────────────────────────────────────────────

    IPolkaPetsLectura public immutable pets;

    uint256 private _siguienteId = 1;

    /**
     * Catálogo de objetos (ids 1–52). Debe coincidir con SHOP_CATALOG de src/game/shop.ts.
     * Va en el código y no en el almacenamiento: en Polkadot Hub cada entrada nueva de storage
     * cuesta peso y depósito, y escribir el catálogo en el constructor no cabía en el despliegue.
     * Un byte por id: 0x80 = exclusivo (solo por logro), bits 4–6 = Tipo, bits 0–3 = categoría.
     *   1–5 accesorios · 6–8 paredes · 9–11 pisos · 12–17 muebles · 18–20 adornos
     *   21–24 exclusivos (Medalla, Estrella, Cinta de campeón, Amuleto) · 25–31 accesorios
     *   32–36 paredes · 37–40 pisos · 41–47 muebles · 48–52 adornos
     * Muebles: 1 Asiento, 2 Planta, 3 Iluminación, 4 Cama, 5 Mesa, 6 Almacenamiento, 7 Entretenimiento.
     * Adornos: 1 Colgante, 2 Repisa, 3 Ofrenda, 4 Guirnalda.
     */
    bytes private constant CATALOGO =
        hex"ff_0000000000_101010_202020_313132323334_414243_80808080_00000000000000_1010101010_20202020_31343536373332_4141424344";
    uint16 public constant totalArticulos = 52;

    /** NFT de objeto → id del catálogo y mascota a la que pertenece. */
    mapping(uint256 => uint16) public articuloDe;
    mapping(uint256 => uint256) public mascotaDe;

    /** mascota → objeto → tokenId del NFT (0 = no lo ha comprado). */
    mapping(uint256 => mapping(uint16 => uint256)) public tokenComprado;
    mapping(uint256 => uint16[]) private _comprados;
    mapping(uint256 => Legado) private _legados;

    /** Logros: catálogo y trofeos ganados por cada mascota. */
    uint16 public constant totalLogros = 9;
    /** NFT de trofeo → id del logro (0 si el NFT es un objeto). */
    mapping(uint256 => uint16) public logroDe;
    /** mascota → logro → tokenId del NFT (0 = no lo ha ganado). */
    mapping(uint256 => mapping(uint16 => uint256)) public tokenLogro;
    mapping(uint256 => uint16[]) private _logrosGanados;

    // ─────────────────────────────────────────────────────────────────────────
    // Eventos y errores
    // ─────────────────────────────────────────────────────────────────────────

    event ArticuloComprado(uint256 indexed mascotaId, uint256 indexed tokenId, uint16 articuloId, address indexed dueno);
    event LogroReclamado(uint256 indexed mascotaId, uint256 indexed tokenId, uint16 logroId, address indexed dueno);
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

    constructor(address polkaPets) ERC721("PolkaPets Items", "PPETI") {
        pets = IPolkaPetsLectura(polkaPets);
        // El catálogo de objetos (CATALOGO) y el de logros (_catalogoLogros) van en el código.
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
        Articulo memory a = _catalogo(articuloId);
        if (!a.existe) revert ArticuloInvalido(articuloId);
        if (a.exclusivo) revert SoloPorLogro(articuloId);
        if (tokenComprado[mascotaId][articuloId] != 0) revert YaComprado(mascotaId, articuloId);

        tokenId = _entregar(mascotaId, articuloId, msg.sender);
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
        Logro memory l = _catalogoLogros(logroId);
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

    /** @notice Datos de un objeto del catálogo. */
    function articulo(uint16 articuloId) external view returns (Articulo memory) {
        return _catalogo(articuloId);
    }

    /** @notice Objetos (ids del catálogo) que ha comprado una mascota. */
    function compradosDe(uint256 mascotaId) external view returns (uint16[] memory) {
        return _comprados[mascotaId];
    }

    /** @notice Datos de un logro del catálogo. */
    function logro(uint16 logroId) external view returns (Logro memory) {
        return _catalogoLogros(logroId);
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

    /** Objeto del catálogo; `existe` es false fuera de los ids 1–52. */
    function _catalogo(uint16 id) private pure returns (Articulo memory) {
        if (id == 0 || id > totalArticulos) return Articulo(false, Tipo.Accesorio, 0, false);
        uint8 b = uint8(CATALOGO[id]);
        return Articulo(true, Tipo((b >> 4) & 0x07), b & 0x0f, b & 0x80 != 0);
    }

    /**
     * Logro del catálogo (id, segundos, objetos, recompensa). Debe coincidir con ACHIEVEMENTS de
     * src/game/achievements.ts. `existe` es false fuera de los ids 1–9.
     */
    function _catalogoLogros(uint16 id) private pure returns (Logro memory) {
        if (id == 1) return Logro(true, 10 minutes, 0, 0); // Primeros pasos
        if (id == 2) return Logro(true, 1 hours, 0, 0); // Adolescente
        if (id == 3) return Logro(true, 4 hours, 0, 21); // Adulta → Medalla
        if (id == 4) return Logro(true, 8 hours, 0, 0); // Resistente
        if (id == 5) return Logro(true, 1 days, 0, 22); // Un día completo → Estrella
        if (id == 6) return Logro(true, 7 days, 0, 23); // Una semana → Cinta de campeón
        if (id == 7) return Logro(true, 0, 3, 0); // Coleccionista
        if (id == 8) return Logro(true, 0, 8, 24); // Gran colección → Amuleto
        if (id == 9) return Logro(true, 0, 15, 0); // Casa llena
        return Logro(false, 0, 0, 0);
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
        bool pared;
        bool piso;
        uint8 muebles;
        uint8 adornos;
        uint16 categoriasMueble; // bit n = ya hay un mueble de la categoría n
        uint16 categoriasAdorno;

        for (uint256 i = 0; i < equipados.length; i++) {
            uint16 id = equipados[i];
            if (tokenComprado[mascotaId][id] == 0) revert NoComprado(mascotaId, id);
            Articulo memory a = _catalogo(id);

            if (a.tipo == Tipo.Accesorio) {
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
        string memory tipo = esTrofeo ? "Trofeo" : _nombreTipo(_catalogo(articuloDe[tokenId]).tipo);
        IPolkaPetsLectura.MascotaView memory m = pets.verMascota(mascotaId);
        string memory mascota = _limpiar(m.nombre);

        string memory cabecera = string.concat(
            '{"name":"', v.nombre, '","description":"', tipo, " de ", mascota, unicode" · mascota #", Strings.toString(mascotaId),
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(_svg(v, mascota))), '",'
        );
        string memory atributos = string.concat(
            '"attributes":[{"trait_type":"Tipo","value":"', tipo,
            '"},{"trait_type":"Mascota","value":"', mascota,
            '"},{"trait_type":"Mascota #","value":"', Strings.toString(mascotaId),
            '"},{"trait_type":"Especie","value":"', _especie(m.especie), '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(string.concat(cabecera, atributos))));
    }

    /** Nombre, emoji y color de cada objeto. Van en el código (no en el almacenamiento). */
    function _visualArticulo(uint16 id) private pure returns (Visual memory) {
        if (id == 1) return Visual(unicode"Sombrero", unicode"🎩", 0);
        if (id == 2) return Visual(unicode"Moño", unicode"🎀", 0);
        if (id == 3) return Visual(unicode"Lentes", unicode"🕶️", 0);
        if (id == 4) return Visual(unicode"Flor", unicode"🌺", 0);
        if (id == 5) return Visual(unicode"Corona", unicode"👑", 0);
        if (id == 6) return Visual(unicode"Pared rosa mexicano", unicode"🟪", 0xf3a6c8);
        if (id == 7) return Visual(unicode"Pared turquesa", unicode"🟦", 0x8fd3d6);
        if (id == 8) return Visual(unicode"Pared cempasúchil", unicode"🟨", 0xf6c453);
        if (id == 9) return Visual(unicode"Piso de barro", unicode"🟧", 0xc0643c);
        if (id == 10) return Visual(unicode"Pasto", unicode"🟩", 0x6fae4f);
        if (id == 11) return Visual(unicode"Piedra", unicode"⬜", 0x9aa0a8);
        if (id == 12) return Visual(unicode"Sillón", unicode"🛋️", 0);
        if (id == 13) return Visual(unicode"Silla", unicode"🪑", 0);
        if (id == 14) return Visual(unicode"Planta", unicode"🪴", 0);
        if (id == 15) return Visual(unicode"Cactus", unicode"🌵", 0);
        if (id == 16) return Visual(unicode"Lámpara", unicode"🪔", 0);
        if (id == 17) return Visual(unicode"Camita", unicode"🛏️", 0);
        if (id == 18) return Visual(unicode"Cuadro", unicode"🖼️", 0);
        if (id == 19) return Visual(unicode"Reloj", unicode"🕰️", 0);
        if (id == 20) return Visual(unicode"Calaverita", unicode"💀", 0);
        if (id == 21) return Visual(unicode"Medalla", unicode"🏅", 0);
        if (id == 22) return Visual(unicode"Estrella", unicode"⭐", 0);
        if (id == 23) return Visual(unicode"Cinta de campeón", unicode"🎗️", 0);
        if (id == 24) return Visual(unicode"Amuleto", unicode"🧿", 0);
        if (id == 25) return Visual(unicode"Sombrero de charro", unicode"👒", 0);
        if (id == 26) return Visual(unicode"Gorro de fiesta", unicode"🥳", 0);
        if (id == 27) return Visual(unicode"Paliacate", unicode"🧣", 0);
        if (id == 28) return Visual(unicode"Audífonos", unicode"🎧", 0);
        if (id == 29) return Visual(unicode"Gorro de lana", unicode"🧶", 0);
        if (id == 30) return Visual(unicode"Corona de flores", unicode"💐", 0);
        if (id == 31) return Visual(unicode"Gorra", unicode"🧢", 0);
        if (id == 32) return Visual(unicode"Ladrillo", unicode"🧱", 0xb5533c);
        if (id == 33) return Visual(unicode"Papel tapiz floral", unicode"🌸", 0xfff3d6);
        if (id == 34) return Visual(unicode"Pared de madera", unicode"🪵", 0xa8703f);
        if (id == 35) return Visual(unicode"Azulejo de talavera", unicode"🔷", 0xf7f3ea);
        if (id == 36) return Visual(unicode"Noche estrellada", unicode"🌌", 0x1f2a5a);
        if (id == 37) return Visual(unicode"Duela clara", unicode"🟫", 0xd9a86c);
        if (id == 38) return Visual(unicode"Ajedrez", unicode"♟️", 0xf4f1e8);
        if (id == 39) return Visual(unicode"Mosaico", unicode"🔹", 0xf7f3ea);
        if (id == 40) return Visual(unicode"Arena", unicode"🏖️", 0xe9cf94);
        if (id == 41) return Visual(unicode"Puf", unicode"🟣", 0);
        if (id == 42) return Visual(unicode"Hamaca", unicode"🌈", 0);
        if (id == 43) return Visual(unicode"Mesita", unicode"🍽️", 0);
        if (id == 44) return Visual(unicode"Librero", unicode"📚", 0);
        if (id == 45) return Visual(unicode"Tele retro", unicode"📺", 0);
        if (id == 46) return Visual(unicode"Lámpara de pie", unicode"💡", 0);
        if (id == 47) return Visual(unicode"Girasol", unicode"🌻", 0);
        if (id == 48) return Visual(unicode"Póster Polkadot", unicode"🩷", 0);
        if (id == 49) return Visual(unicode"Espejo", unicode"🪞", 0);
        if (id == 50) return Visual(unicode"Florero", unicode"🏺", 0);
        if (id == 51) return Visual(unicode"Velas", unicode"🕯️", 0);
        return Visual(unicode"Foquitos", unicode"✨", 0);
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

    /** Los objetos quedan ligados a su mascota: solo se pueden crear, no mover. */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert NoTransferible();
        return super._update(to, tokenId, auth);
    }
}
