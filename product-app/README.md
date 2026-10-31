# Product `.paseo` en preparación

Este directorio contiene el cliente para `tamagotchiaxolotl.paseo`. Usa el
Product SDK para conectarse al Host, derivar la cuenta del Product y llamar al
contrato PolkaVM. Incluye adopción, cuidados, cambio de nombre, ranking y la
escena animada del ajolote.

El manifiesto `src/cdm.json` contiene la ABI compilada, pero su dirección
`0x000…000` es provisional. El cliente muestra una pantalla de espera y no
permite firmar hasta que `cdm install @tamagotchiaxolotl/polkapets -n paseo`
instale la dirección del contrato desplegado.

## Antes de publicar

1. Financiar la cuenta propia de CDM en Paseo Asset Hub y obtener autorización Bulletin.
2. En `product-contract/`, ejecutar `cdm account map -n paseo` y `cdm deploy -n paseo`.
3. Desde este directorio, ejecutar `cdm install @tamagotchiaxolotl/polkapets -n paseo`.
4. Ejecutar `npm run build` y probar el bundle dentro de Polkadot Desktop.
5. Registrar y publicar `tamagotchiaxolotl.paseo` con `playground deploy`,
   sin volver a desplegar el contrato en ese paso.

El contrato EVM de Polkadot Hub TestNet no comparte estado con esta instancia
PolkaVM de Paseo. Los NFT EVM anteriores no aparecen aquí.
