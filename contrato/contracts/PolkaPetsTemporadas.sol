// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/** Lo que este contrato lee de PolkaPets v2 (mismo orden de campos que PolkaPets.MascotaView). */
interface IPolkaPetsV2 {
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
        uint64 durmiendoDesde;
    }

    function ownerOf(uint256 tokenId) external view returns (address);
    function verMascota(uint256 tokenId) external view returns (MascotaView memory);
}

/**
 * @title PolkaPetsTemporadas
 * @notice Modo Competencia por temporadas semanales. La temporada abre el lunes a las 00:00 y
 *         cierra al terminar el viernes (hora configurable, por defecto México UTC-6). Solo entran
 *         mascotas en modo Competencia adoptadas durante esa temporada. Cuando una muere, su dueño
 *         la registra; la duración la calcula PolkaPets en la cadena (cada cuidado de Competencia es
 *         una transacción), así que nadie puede inventar su tiempo.
 *
 *         Al cerrar una temporada se guarda para siempre el podio (top 3 de cada dificultad: 1 h,
 *         7 h y 12 h) y se borran los demás registros de esa semana. El lunes siguiente el ranking
 *         empieza vacío.
 */
contract PolkaPetsTemporadas is Ownable {
    uint64 public constant SEMANA = 7 days;
    uint8 public constant TOP = 3;
    /** Registros por semana: acota el gas de `cerrarTemporada`. */
    uint16 public constant MAX_POR_SEMANA = 300;

    struct Registro {
        uint256 tokenId;
        address dueno;
        string nombre;
        uint8 especie;
        uint8 horas;
        uint64 duracion;
        uint64 registrado;
    }

    IPolkaPetsV2 public immutable pets;
    /** Timestamp del lunes 00:00 (hora local) de la semana 0. */
    uint64 public inicio;
    /** Días abierta desde el lunes (5 = lunes a viernes). */
    uint8 public diasAbierta;
    bool public pausada;

    mapping(uint256 => Registro[]) private _registros;
    mapping(uint256 => Registro[]) private _podio;
    mapping(uint256 => bool) public cerrada;
    mapping(uint256 => bool) public registrado;
    uint256[] private _semanasCerradas;

    event Registrada(uint256 indexed semana, uint256 indexed tokenId, address indexed dueno, uint8 horas, uint64 duracion);
    event TemporadaCerrada(uint256 indexed semana, uint256 registros, uint256 podio);
    event CalendarioCambiado(uint64 inicio, uint8 diasAbierta);
    event Pausa(bool pausada);

    error TemporadaCerradaAhora();
    error EnPausa();
    error NoEresDueno(uint256 tokenId);
    error NoEsCompetencia(uint256 tokenId);
    error SigueViva(uint256 tokenId);
    error DeOtraTemporada(uint256 tokenId);
    error YaRegistrada(uint256 tokenId);
    error TemporadaLlena();
    error TemporadaEnCurso(uint256 semana);
    error YaCerrada(uint256 semana);
    error CalendarioInvalido();

    /**
     * @param polkaPets dirección de PolkaPets v2.
     * @param inicio_ un lunes a las 00:00 hora local, en Unix. México (UTC-6): 367200 + k·604800.
     */
    constructor(address polkaPets, uint64 inicio_) Ownable(msg.sender) {
        pets = IPolkaPetsV2(polkaPets);
        _setCalendario(inicio_, 5);
    }

    function version() external pure returns (uint8) {
        return 2;
    }

    // ─────────────────────────────────────────────────────────────── calendario

    /** @notice Semana en curso, si está abierta y cuándo abre y cierra (timestamps). */
    function semanaActual() public view returns (uint256 semana, bool abierta, uint64 abre, uint64 cierra) {
        uint64 ahora = uint64(block.timestamp);
        semana = ahora < inicio ? 0 : (ahora - inicio) / SEMANA;
        abre = inicio + uint64(semana) * SEMANA;
        cierra = abre + uint64(diasAbierta) * 1 days;
        abierta = ahora >= abre && ahora < cierra && !pausada;
    }

    // ─────────────────────────────────────────────────────────────── acciones

    /**
     * @notice Registra la partida de una mascota de Competencia que ya murió. Solo cuentan las
     *         adoptadas en la temporada abierta. La duración y el nombre se leen de PolkaPets.
     */
    function registrar(uint256 tokenId) external {
        if (pausada) revert EnPausa();
        (uint256 semana, bool abierta, uint64 abre, ) = semanaActual();
        if (!abierta) revert TemporadaCerradaAhora();
        if (pets.ownerOf(tokenId) != msg.sender) revert NoEresDueno(tokenId);
        if (registrado[tokenId]) revert YaRegistrada(tokenId);
        IPolkaPetsV2.MascotaView memory m = pets.verMascota(tokenId);
        if (m.modo != IPolkaPetsV2.Modo.Competencia) revert NoEsCompetencia(tokenId);
        if (m.viva) revert SigueViva(tokenId);
        if (m.nacimiento < abre) revert DeOtraTemporada(tokenId);
        Registro[] storage lista = _registros[semana];
        if (lista.length >= MAX_POR_SEMANA) revert TemporadaLlena();

        registrado[tokenId] = true;
        lista.push(Registro(tokenId, msg.sender, m.nombre, m.especie, m.horas, m.duracion, uint64(block.timestamp)));
        emit Registrada(semana, tokenId, msg.sender, m.horas, m.duracion);
    }

    /**
     * @notice Cierra una temporada que ya terminó: guarda el podio (top 3 por dificultad) y borra
     *         los demás registros. Cualquiera puede llamarla (el juego lo hace al abrir el ranking).
     */
    function cerrarTemporada(uint256 semana) external {
        if (cerrada[semana]) revert YaCerrada(semana);
        (uint256 actual, , , ) = semanaActual();
        uint64 cierre = inicio + uint64(semana) * SEMANA + uint64(diasAbierta) * 1 days;
        if (semana > actual || block.timestamp < cierre) revert TemporadaEnCurso(semana);

        Registro[] storage lista = _registros[semana];
        uint8[3] memory dificultades = [uint8(1), 7, 12];
        uint256 guardados;
        for (uint256 d = 0; d < 3; d++) {
            // Selección de los TOP mejores de esta dificultad (n ≤ 300, k = 3).
            bool[] memory usado = new bool[](lista.length);
            for (uint256 k = 0; k < TOP; k++) {
                uint256 mejor = type(uint256).max;
                for (uint256 i = 0; i < lista.length; i++) {
                    if (usado[i] || lista[i].horas != dificultades[d]) continue;
                    if (mejor == type(uint256).max || _gana(lista[i], lista[mejor])) mejor = i;
                }
                if (mejor == type(uint256).max) break;
                usado[mejor] = true;
                _podio[semana].push(lista[mejor]);
                guardados++;
            }
        }
        uint256 cantidad = lista.length;
        delete _registros[semana];
        cerrada[semana] = true;
        _semanasCerradas.push(semana);
        emit TemporadaCerrada(semana, cantidad, guardados);
    }

    // ─────────────────────────────────────────────────────────────── admin

    /** @notice Cambia el calendario (lunes de referencia y días abierta). Solo el dueño. */
    function setCalendario(uint64 inicio_, uint8 diasAbierta_) external onlyOwner {
        _setCalendario(inicio_, diasAbierta_);
    }

    /** @notice Pausa o reanuda los registros. Solo el dueño. */
    function setPausada(bool valor) external onlyOwner {
        pausada = valor;
        emit Pausa(valor);
    }

    // ─────────────────────────────────────────────────────────────── lectura

    function total(uint256 semana) external view returns (uint256) {
        return _registros[semana].length;
    }

    /** @notice Registros de una temporada (en curso o sin cerrar), por páginas. */
    function registros(uint256 semana, uint256 desde, uint256 cantidad) external view returns (Registro[] memory filas) {
        Registro[] storage lista = _registros[semana];
        if (desde >= lista.length) return new Registro[](0);
        uint256 hasta = desde + cantidad > lista.length ? lista.length : desde + cantidad;
        filas = new Registro[](hasta - desde);
        for (uint256 i = desde; i < hasta; i++) filas[i - desde] = lista[i];
    }

    /** @notice Podio guardado de una temporada cerrada (top 3 de cada dificultad, de mejor a peor). */
    function podio(uint256 semana) external view returns (Registro[] memory) {
        return _podio[semana];
    }

    /** @notice Semanas cerradas, de la más vieja a la más nueva. */
    function semanasCerradas() external view returns (uint256[] memory) {
        return _semanasCerradas;
    }

    // ─────────────────────────────────────────────────────────────── internos

    /** Más duración gana; en empate, quien se registró primero. */
    function _gana(Registro storage a, Registro storage b) private view returns (bool) {
        return a.duracion > b.duracion || (a.duracion == b.duracion && a.registrado < b.registrado);
    }

    function _setCalendario(uint64 inicio_, uint8 diasAbierta_) private {
        if (diasAbierta_ == 0 || diasAbierta_ > 7) revert CalendarioInvalido();
        inicio = inicio_;
        diasAbierta = diasAbierta_;
        emit CalendarioCambiado(inicio_, diasAbierta_);
    }
}
