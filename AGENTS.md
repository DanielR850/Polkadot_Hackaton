# Instrucciones del proyecto

Antes de implementar una función, leer `README.md`, `docs/SPEC.md` y `docs/ARQUITECTURA.md`.
Consultar `docs/decisions/` si la tarea cambia límites entre módulos, red o SDK.

## Límites de código

- `src/game/`: reglas y tipos puros del juego (`petState.ts`, `config.ts`, `catalog.ts`,
  `storage.ts`) y renderizado Phaser (`petScene.ts`). Las reglas no importan Phaser, DOM ni
  paquetes Polkadot.
- `src/ui/`: representa información y devuelve intenciones del usuario. No ejecuta reglas de cadena.
- `src/app/`: compone módulos y coordina flujos (`application.ts`).
- `src/infrastructure/`: recursos del navegador (música con Web Audio).
- `src/polkadot/`: adaptador del mint y del leaderboard (`nftMint.ts`). No filtra SDK a las reglas.
- `game/src/contract/`: cliente de los contratos (viem, Host SDK, ABI y direcciones).
- `contrato/`: Solidity y Hardhat (`PolkaPets.sol`, `PolkaPetsRanking.sol`); se compila y despliega
  por separado del bundle web.

## Reglas de integración

- El estado local y las reglas de juego deben seguir funcionando sin wallet.
- Toda escritura de contrato valida sus permisos y límites dentro del Solidity; validar en UI solo
  mejora la experiencia.
- Las acciones frecuentes no crean transacciones automáticamente.
- Nunca colocar llaves, frases semilla o secretos en el código o en el bundle web.
- Verificar en documentación oficial que SDK, Host, red y VM coinciden antes de cambiar versiones.

## Comandos

- `pnpm dev`: prototipo local.
- `pnpm build`: typecheck y bundle de producción.
- Pruebas del cliente: `pnpm dlx --ignore-scripts vitest@2.1.0 run` desde `game/`.
- Pruebas del contrato: `npm install` y `npm test` desde `contrato/`.
