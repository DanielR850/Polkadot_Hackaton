# Instrucciones del proyecto

Antes de implementar una función, leer `README.md`, `docs/SPEC.md` y `docs/ARQUITECTURA.md`.
Consultar `docs/decisions/` si la tarea cambia límites entre módulos, red o SDK.

## Límites de código

- `src/domain/`: reglas y tipos puros del juego. No importa Phaser, DOM, almacenamiento ni paquetes
  Polkadot.
- `src/ui/`: representa información y devuelve intenciones del usuario. No ejecuta reglas de cadena.
- `src/game/`: renderizado y animación Phaser.
- `src/app/`: compone módulos y coordina flujos.
- `src/infrastructure/`: implementaciones de almacenamiento u otros recursos externos.
- `src/polkadot/`: adaptadores del Host SDK y del cliente del contrato. No filtra SDK al dominio.
- `contracts/tamagotchi/`: Solidity y herramientas de contrato; se compila/despliega por separado
  del bundle web.

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
- Las pruebas del contrato se ejecutarán desde `contracts/tamagotchi/` una vez elegida la toolchain.
