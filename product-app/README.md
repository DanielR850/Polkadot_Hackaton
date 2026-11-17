# Product `.paseo` en preparación

Este directorio contiene el cliente para `tamagotchiaxolotl.paseo`. Usa el
Product SDK para conectarse al Host, derivar la cuenta del Product y llamar al
contrato PolkaVM. Incluye selección de cinco especies, adopción, cuidados,
cambio de nombre, ranking y la escena animada de cada mascota.

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

El contrato PolkaVM preparado aquí admite cinco especies (ids 0–4). El contrato
EVM ya desplegado en Polkadot Hub TestNet admite solo el ajolote y no comparte
estado con esta instancia de Paseo. Los NFT EVM anteriores no aparecen aquí.

Cuando el NFT más reciente muere, el Product mantiene su escena y muestra su
tiempo vivido; desactiva cuidados y cambio de nombre. La persona puede abrir el
ranking o elegir adoptar otra mascota. Esto requiere desplegar el contrato y
probar el Product dentro del Host antes de la publicación.
