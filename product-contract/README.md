# PolkaPets para PolkaVM

Esta carpeta adapta el Solidity ERC-721 de `../contrato/contracts/PolkaPets.sol` al
compilador `resolc` y al flujo `cdm` de Paseo Next Asset Hub. El nombre de registro
previsto es `@tamagotchiaxolotl/polkapets`.

## Estado

El contrato compiló con Hardhat Polkadot y se empaquetó con `cdm build`.
A partir de esta rama, la versión preparada para Paseo admite cinco especies
(ajolote, lobo, oso grizzly, tlacuache y manatí). Se debe recompilar y empaquetar
antes del despliegue; el contrato EVM ya publicado conserva su límite de una especie.
Aún no está desplegado ni registrado. La dirección EVM `0x758425A3b756079B34FF97cB9C7A764fD44C008a`
pertenece a otra ejecución y no es una dirección de este contrato PolkaVM.

Antes de desplegar, volver a compilar con `cdm build`. Un despliegue requiere
una cuenta propia de Paseo con PAS,
autorización Bulletin y mapeo de cuenta. No se deben registrar nombres con la cuenta
compartida de desarrollo `//Alice`.

El frontend Product deberá instalar el contrato mediante `cdm install` para obtener
su dirección y ABI en `cdm.json`, y llamar mediante `@parity/product-sdk-contracts`.
