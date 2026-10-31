# Especificación pendiente del contrato Tamagotchi

> Aún no es código Solidity ni autorización para desplegar. Este archivo separa las preguntas de
> producto de las decisiones de implementación.

## Candidato para la primera versión

Explorar un contrato pequeño que registre la propiedad de una mascota y/o logros públicos. El juego
debe seguir permitiendo jugar sin wallet. El contrato no debería guardar cada cambio visual ni cada
actualización frecuente de hambre, energía o ánimo.

## Preguntas que resolveremos antes de escribir Solidity

- ¿Cada jugador puede crear una mascota o solo una?
- ¿La mascota tiene dueño transferible o está ligada permanentemente a la cuenta del Product?
- ¿Qué dato debe recuperarse si la persona cambia de teléfono?
- ¿Qué logro puede comprobar el contrato sin confiar en que el frontend diga la verdad?
- ¿Qué acciones requieren firma y quién cubre el costo de gas en el devnet?
- ¿Qué versión del SDK, red, VM y herramientas de contrato exige el hackatón?

## Reglas de seguridad para el diseño

- No guardar frases semilla, llaves privadas ni datos personales.
- Validar permisos dentro del contrato; las validaciones del juego solo ayudan a la interfaz.
- Diseñar protección contra duplicados y llamadas repetidas.
- Mantener transacciones costosas fuera de acciones frecuentes de cuidado.
- Probar errores, límites y llamadas de cuentas distintas antes de desplegar.

## Estructura prevista

- `src/`: contrato Solidity cuando cerremos el diseño.
- `test/`: reglas y casos de abuso ejecutados en un entorno local.
- `scripts/`: compilación y despliegue para la red seleccionada.

Las herramientas se agregarán después de confirmar la red y el flujo del taller. No se instala una
toolchain de Hardhat/Foundry mezclando ejemplos de redes o máquinas virtuales distintas.
