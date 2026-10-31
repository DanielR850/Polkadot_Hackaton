# Product `.paseo` en preparación

Este directorio contiene el inicio de la migración de Tamagotchi Axolotl al
Host de Polkadot. El manifiesto `src/cdm.json` incluye la ABI compilada, pero
su dirección `0x000…000` es provisional: falta desplegar e instalar el contrato
PolkaVM con `cdm install`.

Todavía falta implementar `src/main.ts`, conectar los métodos mediante el
Product SDK y validar la app dentro de Polkadot Desktop. Este proyecto no debe
publicarse hasta completar esas tareas.
