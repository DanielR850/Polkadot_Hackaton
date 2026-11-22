# Publicar PolkaPets en polka-pets.dot

Sigue el taller Products Devnet ([capítulos 5 y 6](https://github.com/BrandonFilth/polkadot-devnet-workshop/tree/main/contenido)),
con `pad` 0.22.1 y Product SDK 0.39.0.

- Dominio: `polka-pets.dot` (Products Devnet, registrado).
- Contratos (Polkadot Hub TestNet, chain id 420420417, desplegados el 2026-11-22, v3):
  `PolkaPets` `0xAD517D892f40567200Ff698E031beA6B1995Ba74` (cinco especies, dificultad, modos y color en el NFT),
  `PolkaPetsItems` `0x32CC55CCccBcb9F0113026929B65BB888f0B2B3d` (61 objetos, comida y ropa) y
  `PolkaPetsTemporadas` `0x8011Febe48d99d2DEfF732523151Ee9A7256835A`. Direcciones en `src/contract/config.ts`
  y `contrato/deployments/polkadotHubTestnet-v2.json`. Los contratos v1 anteriores (`0x7584…`) ya no se usan.
- Dentro de Polkadot Desktop o la Polkadot App, adoptar, cuidar y renombrar se firman con el Host
  (`src/contract/host.ts`). En un navegador normal se firma con MetaMask.
- La cuenta del Host es una cuenta derivada de `polka-pets.dot`: es distinta de la de MetaMask, así
  que sus mascotas también son distintas.

## Ciclo de publicación

Desde la raíz del repositorio, en PowerShell, las cuatro líneas en la misma terminal:

```powershell
function pad { $env:PAD_UPDATE_CHECK = '0'; pnpm dlx --ignore-scripts @polkadot-community-foundation/polkadot-app-deploy@0.22.1 @args }
pnpm build
$env:APP_DOT = 'tmp' + (-join ((Get-Date -Format 'yyyyMMddHHmmss').ToCharArray() | ForEach-Object { [char](97 + [int]"$_") })) + '.dot'
pad .\dist $env:APP_DOT --env devnet --js-merkle
```

Nunca le pases `polka-pets.dot` a `pad`: sube a un nombre temporal y el CID se pega a mano.

Copia de la salida:

1. `CID: bafybei…` (el CID raíz, el que también sale en `Verified on-chain`).
2. El JSON de `Verified text[manifest]:`. Si los acentos salen raros (`cu├¡dalo`), corrígelos.

Después, en la Polkadot App o Desktop: `dotns.dot` → Profile → My Domains → fila de `polka-pets.dot`:

- **Resolve** → pega el CID → Save → firma en el teléfono.
- **Edit** → Custom Records → Add Record → key `manifest`, value el JSON → Save → firma.
  Solo hace falta otra vez si cambian el nombre, la descripción o el icono.

Bulletin borra el contenido a los ~14 días: vuelve a publicar antes (por ejemplo, el día 11) y
pega el CID nuevo con Resolve.

## Contratos v3 en TestNet

Ya están desplegados (arriba). Para volver a desplegar: `contrato/.env` con la llave de una cuenta de
pruebas con PAS (nunca se sube), `npm run deploy:v2:testnet` y `npm run aplicar:testnet` desde `contrato/`,
y después `pnpm build` y `pad`. `npm run verificar` solo lee y `npm run probar` hace una adopción y compras
reales con esa cuenta. El catálogo de objetos va empacado en el código del contrato: un constructor que
escribe los 61 objetos se queda sin gas en Polkadot Hub.

## Publicaciones

| Fecha | CID raíz | Icono | Contenido |
|---|---|---|---|
| 2026-10-31 | `bafybeihjop464rvo3ocpej6vixt3dqrv2bgijzcrchtsw3sdgafrmu7ulu` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Primera versión con firmas por el Host; NFT con estilo morado y solo ajolote |
| 2026-10-31 | `bafybeighs37itci77vmil4pc453f5iit6vqm5ab66fo3ojout5jearsbme` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Fusión con GitHub (`a478e1e`): cinco especies en local, modo NFT con la interfaz retro |
| 2026-11-21 | `bafybeiabgqbccej3w5giowgjzrrj2enp3vde7lyedztxpenssaphbe66wi` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | `polkapets-v2` (`07f5400`): animaciones, ropa mexicana, dormir echados y reacciones por especie. Subido a `tmpcacgbbcbcdabag.dot`; falta pegar el CID con Resolve en `polka-pets.dot`. El manifest no cambió |
