# Decisión 0001: arquitectura inicial del Tamagotchi

- **Estado:** aceptada para la primera etapa; partes blockchain pendientes de confirmar con el
  entorno del hackatón.
- **Fecha:** 2026-10-31.

## Decisión

- Mantener un Product web TypeScript/Vite en la raíz para no romper el prototipo actual.
- Separar `domain`, `ui`, `app`, `game` e `infrastructure` dentro de `src/`.
- Mantener el contrato como subproyecto independiente en `contracts/tamagotchi/` dentro del mismo
  repositorio. Compilación y despliegue serán separados del bundle web.
- Encapsular Host SDK y contratos en adaptadores `src/polkadot/`; el dominio no importa el SDK.
- Mantener el guardado local como adaptador inicial. Diseñar otro adaptador para el Host cuando se
  integre el Product SDK.
- No crear backend, base SQL ni microservicios para el prototipo actual.

## Razones

El juego puede arrancar y jugarse sin wallet. Un límite entre dominio y adaptadores permite añadir
Host/SDK/contrato sin acoplar la mascota a una red o hacer que cada click se convierta en una
transacción. El contrato debe guardar solo reglas/datos que otras personas necesiten verificar.

## Cómo evaluaremos nuevas propuestas de arquitectura

Antes de mover carpetas o cambiar SDK/red, registraremos una decisión breve que responda:

1. ¿Qué problema de usuario o límite técnico resuelve?
2. ¿Qué cambia en el flujo, el Host, las firmas, el costo y el despliegue?
3. ¿Es compatible con la red y la versión del SDK del hackatón?
4. ¿Cómo migramos y cómo volvemos atrás si falla?
5. ¿Qué documentación oficial y evidencia respaldan la propuesta?

Una propuesta nueva se compara contra esta decisión; no se migra solo porque exista una versión o
arquitectura más reciente.
