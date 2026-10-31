# PolkaPets para PolkaVM

Esta carpeta adapta el Solidity ERC-721 de `../contrato/contracts/PolkaPets.sol` al
compilador `resolc` y al flujo `cdm` de Paseo Next Asset Hub. El nombre de registro
previsto es `@tamagotchiaxolotl/polkapets`.

## Estado

El contrato está copiado para comprobar su compilación PolkaVM. Aún no está
compilado, desplegado ni registrado. La dirección EVM `0x758425A3b756079B34FF97cB9C7A764fD44C008a`
pertenece a otra ejecución y no es una dirección de este contrato PolkaVM.

Antes de desplegar, compilar con `cdm build` y resolver cualquier incompatibilidad
que señale `resolc`. Un despliegue requiere una cuenta propia de Paseo con PAS,
autorización Bulletin y mapeo de cuenta. No se deben registrar nombres con la cuenta
compartida de desarrollo `//Alice`.

El frontend Product deberá instalar el contrato mediante `cdm install` para obtener
su dirección y ABI en `cdm.json`, y llamar mediante `@parity/product-sdk-contracts`.
