# Publicar PolkaPets en polka-pets.dot

Sigue el taller Products Devnet ([capítulos 5 y 6](https://github.com/BrandonFilth/polkadot-devnet-workshop/tree/main/contenido)),
con `pad` 0.22.1 y Product SDK 0.39.0.

- Dominio: `polka-pets.dot` (Products Devnet, registrado).
- Contratos (Polkadot Hub TestNet, chain id 420420417, desplegados el 2026-11-22, v4/v3):
  `PolkaPets` `0x3E9707f04412974452543d8916DdCC8E893aDf55` (cinco especies, dificultad, modos, color y sueño con hora),
  `PolkaPetsItems` `0xecBDf023dfaaf8D59A51C17f15fb3eAb544A63b8` (61 objetos, precios y pesitos en la cadena),
  `PolkaPetsTemporadas` `0xfF560afc9E55634850dEE9A28ba218F25C7B1964` y
  `PolkaPetsPagos` `0xcB2a49343aA9680200Df159e93fc6258191B0174` (wallets de cobro y pagos con su hash).
  Direcciones en `src/contract/config.ts` y `contrato/deployments/polkadotHubTestnet-v2.json`. Los anteriores
  (`0x7584…`, `0xAD51…`) ya no se usan. Cómo se protege la economía: `docs/SEGURIDAD.md`.
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
y después `pnpm build` y `pad`. `npm run verificar` solo lee y `npm run probar` hace una adopción, sueño, cobro
de pesitos, compras, wallet y pago reales con esa cuenta. `npm run deploy:pagos:testnet` vuelve a desplegar solo
los pagos (registro limpio) y `npm run transferir:testnet` pasa la administración a otra cuenta. El catálogo de objetos va empacado en el código del contrato: un constructor que
escribe los 61 objetos se queda sin gas en Polkadot Hub.

## Publicaciones

| Fecha | CID raíz | Icono | Contenido |
|---|---|---|---|
| 2026-10-31 | `bafybeihjop464rvo3ocpej6vixt3dqrv2bgijzcrchtsw3sdgafrmu7ulu` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Primera versión con firmas por el Host; NFT con estilo morado y solo ajolote |
| 2026-10-31 | `bafybeighs37itci77vmil4pc453f5iit6vqm5ab66fo3ojout5jearsbme` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Fusión con GitHub (`a478e1e`): cinco especies en local, modo NFT con la interfaz retro |
| 2026-11-21 | `bafybeiabgqbccej3w5giowgjzrrj2enp3vde7lyedztxpenssaphbe66wi` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | `polkapets-v2` (`07f5400`): animaciones, ropa mexicana, dormir echados y reacciones por especie. Subido a `tmpcacgbbcbcdabag.dot`; falta pegar el CID con Resolve en `polka-pets.dot`. El manifest no cambió |
| 2026-11-22 | `bafybeieznolb3tdwradfoo7itqlyutmohigr3vq65losqt2f6pnikvd4ci` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Versión final `4cc04cb`: contratos v3 de TestNet conectados. Subido a `tmpcacgbbccaacjee.dot`; falta el Resolve en `polka-pets.dot`. El manifest no cambió |
| 2026-11-22 | `bafybeiejxjjm335bpsnrtv7cytdjtaqw3r5akrvws5pe3v5hpwjsezt5oa` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | SDK 0.45.0 (TrUAPI 0.31) y firma en el pipeline 1 (PGAS). Reemplaza al CID `bafybeieznolb3…` anterior. Subido a `tmpcacgbbccbddedj.dot`; falta el Resolve en `polka-pets.dot` y probar la firma en un Host actualizado |
| 2026-11-22 | `bafybeiatn72ke4nz4ho7zrevxjs3bf76pnoturm4egnudntxwqcaoywyby` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Versión final con contratos v4/v3 (pesitos, sueño, vida y pagos en la cadena). Subido a `tmpcacgbbccbfedfj.dot`; reemplaza a `bafybeiejxjjm3…`. Falta el Resolve en `polka-pets.dot` |
| 2026-11-22 | `bafybeihc4fy4fx6utbeyf7ipyh23f4ns4a72guxnsnjapn2kmwiq24jjdq` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Versión final (`9fa0c6c`): contratos v4/v3 + mensaje claro sin cuenta conectada. Subido a `tmpcacgbbccbgbjaj.dot`; reemplaza a `bafybeiatn72ke…`. Falta el Resolve en `polka-pets.dot` (web: dotns.dev-dot.li → Sign in) |
| 2026-11-25 | `bafybeigor7iybtdpwzts37m45tmtucidtnra35peajkuiirtamasg5dfaq` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Versión final (`66c1b12`): toda mascota puede morir (sin modo Pacífico). Subido a `tmpcacgbbcfagdbca.dot`; reemplaza a `bafybeihc4fy4f…`. Falta el Resolve en `polka-pets.dot` |
