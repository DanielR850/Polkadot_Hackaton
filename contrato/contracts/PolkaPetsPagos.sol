// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PolkaPetsPagos
 * @notice Billeteras de cobro y registro de los premios pagados, como en el Pac-Man del taller.
 *
 * Cada jugador registra la wallet (dirección EVM) a la que quiere recibir sus premios. Cuando el
 * administrador paga un premio de la temporada (Competencia semanal de PolkaPetsTemporadas), anota aquí
 * el hash de la transacción del pago: cualquiera puede revisar quién cobró, cuánto, a qué wallet y
 * con qué transacción. El contrato no mueve dinero: el pago se hace desde la wallet del administrador
 * y aquí solo queda el registro verificable.
 */
contract PolkaPetsPagos is Ownable {
    /** Lugares premiados por semana: 1.º, 2.º y 3.º. */
    uint8 public constant LUGARES = 3;

    /** Un premio pagado. */
    struct Pago {
        address cuenta; // cuenta del jugador en el juego (la que ve el contrato de mascotas como msg.sender)
        address billetera; // wallet a la que se envió el premio
        uint32 semana; // semana de la temporada
        uint8 lugar; // 1, 2 o 3
        uint64 monto; // monto pagado (dólares enteros)
        bytes32 txHash; // hash de la transacción del pago
        uint64 pagadoEn; // hora (Unix, segundos) en que se registró; 0 = no existe
    }

    /** Wallet de cobro de cada jugador. 0x000… si no ha registrado una. */
    mapping(address => address) public billeteraDe;

    Pago[] private _pagos;
    /** semana → lugar → índice+1 en `_pagos` (0 = sin pago). */
    mapping(uint32 => mapping(uint8 => uint256)) private _indice;

    event BilleteraRegistrada(address indexed cuenta, address billetera);
    event PagoRegistrado(uint32 indexed semana, uint8 indexed lugar, address indexed cuenta, address billetera, uint64 monto, bytes32 txHash);

    error SinBilletera(address cuenta);
    error LugarInvalido(uint8 lugar);
    error PagoYaRegistrado(uint32 semana, uint8 lugar);
    error MontoInvalido();
    error TxInvalido();
    error NoExistePago(uint256 indice);

    constructor() Ownable(msg.sender) {}

    // ───────────────────────────────────────────────────────────── jugadores

    /** @notice Registra o cambia tu wallet de cobro (dirección EVM). Con 0x000… la borras. */
    function setBilletera(address billetera) external {
        billeteraDe[msg.sender] = billetera;
        emit BilleteraRegistrada(msg.sender, billetera);
    }

    // ────────────────────────────────────────────────────────────── administrador

    /**
     * @notice Anota el pago del premio de `lugar` en `semana` a `cuenta`, con el hash del envío.
     *         La wallet de destino es la que la persona registró: no se puede pagar a otra.
     */
    function registrarPago(uint32 semana, uint8 lugar, address cuenta, uint64 monto, bytes32 txHash) external onlyOwner {
        if (lugar == 0 || lugar > LUGARES) revert LugarInvalido(lugar);
        if (monto == 0) revert MontoInvalido();
        if (txHash == bytes32(0)) revert TxInvalido();
        address billetera = billeteraDe[cuenta];
        if (billetera == address(0)) revert SinBilletera(cuenta);
        if (_indice[semana][lugar] != 0) revert PagoYaRegistrado(semana, lugar);

        _pagos.push(Pago(cuenta, billetera, semana, lugar, monto, txHash, uint64(block.timestamp)));
        _indice[semana][lugar] = _pagos.length;
        emit PagoRegistrado(semana, lugar, cuenta, billetera, monto, txHash);
    }

    // ─────────────────────────────────────────────────────────────────── leer

    function totalPagos() external view returns (uint256) {
        return _pagos.length;
    }

    function pago(uint256 indice) external view returns (Pago memory) {
        if (indice >= _pagos.length) revert NoExistePago(indice);
        return _pagos[indice];
    }

    /** @notice El pago de un lugar en una semana (pagadoEn = 0 si aún no se paga). */
    function pagoDe(uint32 semana, uint8 lugar) external view returns (Pago memory p) {
        if (lugar == 0 || lugar > LUGARES) revert LugarInvalido(lugar);
        uint256 i = _indice[semana][lugar];
        if (i != 0) p = _pagos[i - 1];
    }

    /** @notice Los tres lugares de una semana, en orden (pagadoEn = 0 en los que faltan). */
    function pagosDeSemana(uint32 semana) external view returns (Pago[] memory lista) {
        lista = new Pago[](LUGARES);
        for (uint8 l = 1; l <= LUGARES; l++) {
            uint256 i = _indice[semana][l];
            if (i != 0) lista[l - 1] = _pagos[i - 1];
        }
    }

    /** @notice Todos los pagos que ha recibido una cuenta. */
    function pagosDe(address cuenta) external view returns (Pago[] memory lista) {
        uint256 n;
        for (uint256 i = 0; i < _pagos.length; i++) if (_pagos[i].cuenta == cuenta) n++;
        lista = new Pago[](n);
        uint256 k;
        for (uint256 i = 0; i < _pagos.length; i++) if (_pagos[i].cuenta == cuenta) lista[k++] = _pagos[i];
    }

    /** @notice Las wallets de cobro de varias cuentas (para el panel del administrador). */
    function billeterasDe(address[] calldata cuentas) external view returns (address[] memory wallets) {
        wallets = new address[](cuentas.length);
        for (uint256 i = 0; i < cuentas.length; i++) wallets[i] = billeteraDe[cuentas[i]];
    }

    function version() external pure returns (uint8) {
        return 1;
    }
}
