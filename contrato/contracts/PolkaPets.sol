// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/**
 * @title PolkaPets
 * @notice Tamagotchi on-chain. Cada mascota es un NFT (ERC-721) con cinco necesidades
 *         (hambre, sed, energía, felicidad y limpieza) que bajan con el tiempo, y una
 *         barra de vida. Mientras alguna necesidad está en 0, la mascota pierde vida;
 *         cuando la vida llega a 0, muere. El ranking ordena las mascotas por cuánto
 *         tiempo vivieron.
 *
 * @dev    Nada se actualiza solo en la cadena: en storage se guardan los valores del
 *         momento de la última interacción y el estado "ahora" se calcula al leer
 *         (`_estado`). Así no hace falta un keeper externo. El instante exacto de la
 *         muerte también se calcula (`_momentoMuerte`), para que la duración del
 *         ranking no dependa de cuándo alguien mira a la mascota.
 */
contract PolkaPets is ERC721, ERC721Enumerable {
    // ─────────────────────────────────────────────────────────────────────────
    // Tipos
    // ─────────────────────────────────────────────────────────────────────────

    enum Etapa {
        Bebe, // nivel 1
        Joven, // nivel 2 a 9
        Adulta, // nivel 10 o más
        Enferma, // alguna necesidad en 0: está perdiendo vida
        Muerta
    }

    /** Valores guardados en el momento de `ultimaInteraccion`. */
    struct MascotaRaw {
        string nombre;
        uint64 nacimiento;
        uint64 ultimaInteraccion;
        uint8 especie;
        uint8 vida;
        uint8 hambre; // 100 = saciada, 0 = muerta de hambre
        uint8 sed; // 100 = hidratada
        uint8 energia; // 100 = descansada
        uint8 felicidad; // 100 = feliz
        uint8 limpieza; // 100 = limpia
        uint16 nivel;
        uint32 xp;
    }

    /** Estado "ahora" de una mascota, con el paso del tiempo ya aplicado. */
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
        uint64 duracion; // segundos vividos (hasta ahora, o hasta su muerte)
        uint64 muerte; // timestamp de la muerte; 0 si sigue viva
    }

    /** Una fila del ranking de longevidad. */
    struct FilaRanking {
        uint256 tokenId;
        address dueno;
        string nombre;
        uint8 especie;
        uint64 duracion;
        bool viva;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Parámetros del juego
    // ─────────────────────────────────────────────────────────────────────────

    uint8 public constant STAT_MAX = 100;
    uint8 public constant NUM_ESPECIES = 4; // 0 gato, 1 perro, 2 dragón, 3 pingüino
    uint8 public constant NOMBRE_MAX = 24;
    uint16 public constant XP_POR_NIVEL = 100;
    uint32 public constant XP_POR_CUIDADO = 10;

    /** Segundos que tarda cada necesidad en bajar 1 punto. */
    uint64 public constant SEG_HAMBRE = 60;
    uint64 public constant SEG_SED = 45;
    uint64 public constant SEG_ENERGIA = 120;
    uint64 public constant SEG_FELICIDAD = 90;
    uint64 public constant SEG_LIMPIEZA = 150;

    /**
     * Segundos de "necesidad en 0" que cuestan 1 punto de vida. Con una necesidad en 0
     * se pierde 1 de vida cada 30 s; con dos, cada 15 s; y así.
     */
    uint64 public constant SEG_VIDA = 30;

    /** Alimentar da comida y agua. */
    uint8 public constant GANA_COMIDA = 40;
    uint8 public constant GANA_AGUA = 40;
    /** Jugar alegra, pero cansa, da hambre y sed, y ensucia. */
    uint8 public constant GANA_JUEGO = 30;
    uint8 public constant COSTO_JUEGO_ENERGIA = 15;
    uint8 public constant COSTO_JUEGO_HAMBRE = 10;
    uint8 public constant COSTO_JUEGO_SED = 10;
    uint8 public constant COSTO_JUEGO_LIMPIEZA = 15;
    uint8 public constant GANA_SUENO = 50;
    uint8 public constant GANA_BANO = 50;
    /** Vida que recupera cada cuidado, si después de él ninguna necesidad queda en 0. */
    uint8 public constant GANA_VIDA = 5;

    /** Número de necesidades. Índices: 0 hambre, 1 sed, 2 energía, 3 felicidad, 4 limpieza. */
    uint256 private constant N = 5;

    // ─────────────────────────────────────────────────────────────────────────
    // Estado
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _siguienteId = 1;
    mapping(uint256 => MascotaRaw) private _mascotas;

    // ─────────────────────────────────────────────────────────────────────────
    // Eventos y errores
    // ─────────────────────────────────────────────────────────────────────────

    event MascotaNacida(uint256 indexed tokenId, address indexed dueno, string nombre, uint8 especie);
    event Cuidada(uint256 indexed tokenId, string accion);
    event NombreCambiado(uint256 indexed tokenId, string nombre);
    event SubioNivel(uint256 indexed tokenId, uint16 nivel);

    error NoExiste(uint256 tokenId);
    error NoEresDueno(uint256 tokenId);
    error EstaMuerta(uint256 tokenId);
    error NombreInvalido();
    error EspecieInvalida();

    constructor() ERC721("PolkaPets", "PPET") {}

    // ─────────────────────────────────────────────────────────────────────────
    // Acciones (transacciones)
    // ─────────────────────────────────────────────────────────────────────────

    /** @notice Adopta una mascota nueva. Nace con todo al máximo. */
    function mint(string calldata nombre, uint8 especie) external returns (uint256 tokenId) {
        _validarNombre(nombre);
        if (especie >= NUM_ESPECIES) revert EspecieInvalida();

        tokenId = _siguienteId++;
        uint64 ahora = uint64(block.timestamp);
        _mascotas[tokenId] = MascotaRaw({
            nombre: nombre,
            nacimiento: ahora,
            ultimaInteraccion: ahora,
            especie: especie,
            vida: STAT_MAX,
            hambre: STAT_MAX,
            sed: STAT_MAX,
            energia: STAT_MAX,
            felicidad: STAT_MAX,
            limpieza: STAT_MAX,
            nivel: 1,
            xp: 0
        });

        _safeMint(msg.sender, tokenId);
        emit MascotaNacida(tokenId, msg.sender, nombre, especie);
    }

    /** @notice Comida y agua: sube hambre y sed. */
    function alimentar(uint256 tokenId) external {
        (MascotaRaw storage m, uint8[5] memory s) = _prepararCuidado(tokenId);
        s[0] = _sumar(s[0], GANA_COMIDA);
        s[1] = _sumar(s[1], GANA_AGUA);
        _terminarCuidado(tokenId, m, s, "alimentar");
    }

    /** @notice Jugar: sube felicidad; baja energía, hambre, sed y limpieza. */
    function jugar(uint256 tokenId) external {
        (MascotaRaw storage m, uint8[5] memory s) = _prepararCuidado(tokenId);
        s[3] = _sumar(s[3], GANA_JUEGO);
        s[2] = _restar(s[2], COSTO_JUEGO_ENERGIA);
        s[0] = _restar(s[0], COSTO_JUEGO_HAMBRE);
        s[1] = _restar(s[1], COSTO_JUEGO_SED);
        s[4] = _restar(s[4], COSTO_JUEGO_LIMPIEZA);
        _terminarCuidado(tokenId, m, s, "jugar");
    }

    /** @notice Dormir: recupera energía. */
    function dormir(uint256 tokenId) external {
        (MascotaRaw storage m, uint8[5] memory s) = _prepararCuidado(tokenId);
        s[2] = _sumar(s[2], GANA_SUENO);
        _terminarCuidado(tokenId, m, s, "dormir");
    }

    /** @notice Bañar: recupera limpieza. */
    function banar(uint256 tokenId) external {
        (MascotaRaw storage m, uint8[5] memory s) = _prepararCuidado(tokenId);
        s[4] = _sumar(s[4], GANA_BANO);
        _terminarCuidado(tokenId, m, s, "banar");
    }

    /** @notice Cambia el nombre. No toca las necesidades ni cuenta como cuidado. */
    function cambiarNombre(uint256 tokenId, string calldata nombre) external {
        _validarNombre(nombre);
        if (_ownerOf(tokenId) == address(0)) revert NoExiste(tokenId);
        if (ownerOf(tokenId) != msg.sender) revert NoEresDueno(tokenId);
        _mascotas[tokenId].nombre = nombre;
        emit NombreCambiado(tokenId, nombre);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lectura (view, gratis)
    // ─────────────────────────────────────────────────────────────────────────

    /** @notice La mascota con el paso del tiempo aplicado a "ahora". */
    function verMascota(uint256 tokenId) external view returns (MascotaView memory v) {
        if (_ownerOf(tokenId) == address(0)) revert NoExiste(tokenId);
        MascotaRaw storage m = _mascotas[tokenId];
        uint64 ahora = uint64(block.timestamp);
        (uint8[5] memory s, uint8 vida, uint64 muerte) = _estado(m, ahora);

        v.tokenId = tokenId;
        v.nombre = m.nombre;
        v.especie = m.especie;
        v.nacimiento = m.nacimiento;
        v.ultimaInteraccion = m.ultimaInteraccion;
        v.vida = vida;
        v.hambre = s[0];
        v.sed = s[1];
        v.energia = s[2];
        v.felicidad = s[3];
        v.limpieza = s[4];
        v.nivel = m.nivel;
        v.xp = m.xp;
        v.viva = muerte == 0;
        v.muerte = muerte;
        v.duracion = (muerte == 0 ? ahora : muerte) - m.nacimiento;
        v.etapa = _etapa(m.nivel, s, muerte);
    }

    /** @notice tokenIds de las mascotas de un dueño. */
    function mascotasDe(address dueno) external view returns (uint256[] memory ids) {
        uint256 n = balanceOf(dueno);
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = tokenOfOwnerByIndex(dueno, i);
        }
    }

    /** @notice Cuántas mascotas se han adoptado en total. */
    function totalMascotas() external view returns (uint256) {
        return _siguienteId - 1;
    }

    /**
     * @notice Página del ranking: las mascotas `desde`..`desde+cantidad` (por orden de
     *         adopción) con su duración. El orden por duración lo hace quien lee.
     */
    function ranking(uint256 desde, uint256 cantidad) external view returns (FilaRanking[] memory filas) {
        uint256 total = _siguienteId - 1;
        if (desde >= total) return new FilaRanking[](0);
        uint256 fin = desde + cantidad > total ? total : desde + cantidad;
        filas = new FilaRanking[](fin - desde);
        uint64 ahora = uint64(block.timestamp);

        for (uint256 i = desde; i < fin; i++) {
            uint256 id = i + 1;
            MascotaRaw storage m = _mascotas[id];
            (, , uint64 muerte) = _estado(m, ahora);
            filas[i - desde] = FilaRanking({
                tokenId: id,
                dueno: _ownerOf(id),
                nombre: m.nombre,
                especie: m.especie,
                duracion: (muerte == 0 ? ahora : muerte) - m.nacimiento,
                viva: muerte == 0
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lógica del tiempo
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Necesidades, vida y momento de la muerte en el instante `ahora`.
     *      Cada necesidad baja 1 punto cada SEG_x segundos. Los segundos que cada una
     *      pasa en 0 se suman ("segundos en cero"); cada SEG_VIDA de ellos cuestan 1 de
     *      vida. Si la vida se agota, `muerte` es el timestamp exacto en que ocurrió.
     */
    function _estado(MascotaRaw storage m, uint64 ahora)
        private
        view
        returns (uint8[5] memory s, uint8 vida, uint64 muerte)
    {
        uint64 t = ahora - m.ultimaInteraccion;
        uint8[5] memory base = _base(m);
        uint64[5] memory seg = _segPorPunto();
        uint256[5] memory tCero; // segundos (desde la última interacción) en que cada una llega a 0
        uint256 ceroSeg;

        for (uint256 i = 0; i < N; i++) {
            s[i] = _decaer(base[i], t, seg[i]);
            tCero[i] = uint256(base[i]) * seg[i];
            if (t > tCero[i]) ceroSeg += t - tCero[i];
        }

        uint256 limite = uint256(m.vida) * SEG_VIDA;
        if (ceroSeg >= limite) {
            muerte = m.ultimaInteraccion + uint64(_momentoMuerte(tCero, limite));
            vida = 0;
            for (uint256 i = 0; i < N; i++) s[i] = 0;
        } else {
            vida = m.vida - uint8(ceroSeg / SEG_VIDA);
        }
    }

    /**
     * @dev Primer segundo T (desde la última interacción) en que los "segundos en cero"
     *      acumulados alcanzan `limite`. Entre dos instantes en que una necesidad llega a
     *      0, la acumulación crece a ritmo constante (tantas por segundo como necesidades
     *      en 0), así que basta recorrer esos tramos en orden.
     */
    function _momentoMuerte(uint256[5] memory c, uint256 limite) private pure returns (uint256) {
        if (limite == 0) return 0;

        // Orden ascendente (inserción; son 5 elementos).
        for (uint256 i = 1; i < N; i++) {
            uint256 x = c[i];
            uint256 j = i;
            while (j > 0 && c[j - 1] > x) {
                c[j] = c[j - 1];
                j--;
            }
            c[j] = x;
        }

        uint256 acum; // segundos en cero acumulados en el instante c[k]
        for (uint256 k = 0; k < N; k++) {
            uint256 activos = k + 1;
            if (k + 1 == N || acum + activos * (c[k + 1] - c[k]) >= limite) {
                return c[k] + (limite - acum + activos - 1) / activos;
            }
            acum += activos * (c[k + 1] - c[k]);
        }
        return c[N - 1]; // inalcanzable
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internos
    // ─────────────────────────────────────────────────────────────────────────

    /** Aplica el tiempo transcurrido y devuelve las necesidades para modificarlas. */
    function _prepararCuidado(uint256 tokenId) private returns (MascotaRaw storage m, uint8[5] memory s) {
        if (_ownerOf(tokenId) == address(0)) revert NoExiste(tokenId);
        if (ownerOf(tokenId) != msg.sender) revert NoEresDueno(tokenId);
        m = _mascotas[tokenId];

        uint8 vida;
        uint64 muerte;
        (s, vida, muerte) = _estado(m, uint64(block.timestamp));
        if (muerte != 0) revert EstaMuerta(tokenId);
        m.vida = vida;
    }

    /** Guarda las necesidades, recupera vida, suma XP y sube de nivel. */
    function _terminarCuidado(uint256 tokenId, MascotaRaw storage m, uint8[5] memory s, string memory accion)
        private
    {
        m.hambre = s[0];
        m.sed = s[1];
        m.energia = s[2];
        m.felicidad = s[3];
        m.limpieza = s[4];
        m.ultimaInteraccion = uint64(block.timestamp);

        if (!_algunaEnCero(s)) m.vida = _sumar(m.vida, GANA_VIDA);

        m.xp += XP_POR_CUIDADO;
        while (m.xp >= XP_POR_NIVEL) {
            m.xp -= XP_POR_NIVEL;
            m.nivel += 1;
            emit SubioNivel(tokenId, m.nivel);
        }

        emit Cuidada(tokenId, accion);
    }

    function _base(MascotaRaw storage m) private view returns (uint8[5] memory b) {
        b[0] = m.hambre;
        b[1] = m.sed;
        b[2] = m.energia;
        b[3] = m.felicidad;
        b[4] = m.limpieza;
    }

    function _segPorPunto() private pure returns (uint64[5] memory) {
        return [SEG_HAMBRE, SEG_SED, SEG_ENERGIA, SEG_FELICIDAD, SEG_LIMPIEZA];
    }

    function _etapa(uint16 nivel, uint8[5] memory s, uint64 muerte) private pure returns (Etapa) {
        if (muerte != 0) return Etapa.Muerta;
        if (_algunaEnCero(s)) return Etapa.Enferma;
        if (nivel >= 10) return Etapa.Adulta;
        if (nivel >= 2) return Etapa.Joven;
        return Etapa.Bebe;
    }

    function _algunaEnCero(uint8[5] memory s) private pure returns (bool) {
        for (uint256 i = 0; i < N; i++) {
            if (s[i] == 0) return true;
        }
        return false;
    }

    function _validarNombre(string calldata nombre) private pure {
        uint256 n = bytes(nombre).length;
        if (n == 0 || n > NOMBRE_MAX) revert NombreInvalido();
    }

    function _decaer(uint8 valor, uint64 transcurrido, uint64 segPorPunto) private pure returns (uint8) {
        uint64 perdida = transcurrido / segPorPunto;
        if (perdida >= valor) return 0;
        return uint8(valor - perdida);
    }

    function _sumar(uint8 valor, uint8 delta) private pure returns (uint8) {
        uint256 r = uint256(valor) + delta;
        return r > STAT_MAX ? STAT_MAX : uint8(r);
    }

    function _restar(uint8 valor, uint8 delta) private pure returns (uint8) {
        return delta >= valor ? 0 : valor - delta;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Overrides requeridos por ERC721 + ERC721Enumerable
    // ─────────────────────────────────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
