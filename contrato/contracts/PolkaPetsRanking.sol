// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/** Lo que este ranking lee de PolkaPets (mismo orden de campos que PolkaPets.MascotaView). */
interface IPolkaPets {
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
 * @title PolkaPetsRanking
 * @notice Ranking de longevidad del juego. Cuando una mascota muere en el juego, su dueño
 *         firma una vez para registrar cuánto vivió. Cada NFT se registra una sola vez.
 *
 * @dev    Los cuidados del juego son locales, así que el contrato no puede comprobar la
 *         duración exacta. Sí comprueba lo que puede saber por su cuenta:
 *          - que quien registra es el dueño del NFT en PolkaPets;
 *          - que ese NFT no se registró antes;
 *          - que la duración no supera el tiempo transcurrido desde que se adoptó el NFT;
 *          - que el nombre y la especie están dentro de los límites del juego.
 *         El orden por duración lo hace quien lee (`registros`).
 */
contract PolkaPetsRanking {
    uint8 public constant NOMBRE_MAX = 24; // bytes UTF-8, igual que PolkaPets
    uint8 public constant NUM_ESPECIES = 5; // 0 ajolote, 1 lobo, 2 oso, 3 tlacuache, 4 manatí

    struct Registro {
        uint256 tokenId;
        address dueno;
        string nombre;
        uint8 especie;
        uint64 duracion; // segundos que vivió en el juego
        uint64 registrado; // timestamp del registro
    }

    IPolkaPets public immutable pets;
    Registro[] private _registros;
    mapping(uint256 => bool) public registrado;

    event MuerteRegistrada(uint256 indexed tokenId, address indexed dueno, string nombre, uint8 especie, uint64 duracion);

    error NoEresDueno(uint256 tokenId);
    error YaRegistrada(uint256 tokenId);
    error DuracionInvalida();
    error NombreInvalido();
    error EspecieInvalida();

    constructor(address polkaPets) {
        pets = IPolkaPets(polkaPets);
    }

    /** @notice Registra la duración de una mascota que murió en el juego. */
    function registrarMuerte(uint256 tokenId, string calldata nombre, uint8 especie, uint64 duracion) external {
        // ownerOf revierte si el NFT no existe.
        if (pets.ownerOf(tokenId) != msg.sender) revert NoEresDueno(tokenId);
        if (registrado[tokenId]) revert YaRegistrada(tokenId);
        uint256 n = bytes(nombre).length;
        if (n == 0 || n > NOMBRE_MAX) revert NombreInvalido();
        if (especie >= NUM_ESPECIES) revert EspecieInvalida();
        uint64 nacimiento = pets.verMascota(tokenId).nacimiento;
        if (duracion == 0 || duracion > block.timestamp - nacimiento) revert DuracionInvalida();

        registrado[tokenId] = true;
        _registros.push(Registro(tokenId, msg.sender, nombre, especie, duracion, uint64(block.timestamp)));
        emit MuerteRegistrada(tokenId, msg.sender, nombre, especie, duracion);
    }

    /** @notice Cuántas muertes se han registrado. */
    function total() external view returns (uint256) {
        return _registros.length;
    }

    /** @notice Registros en orden de llegada, por páginas. */
    function registros(uint256 desde, uint256 cantidad) external view returns (Registro[] memory filas) {
        uint256 t = _registros.length;
        if (desde >= t) return new Registro[](0);
        uint256 hasta = desde + cantidad > t ? t : desde + cantidad;
        filas = new Registro[](hasta - desde);
        for (uint256 i = desde; i < hasta; i++) filas[i - desde] = _registros[i];
    }
}
