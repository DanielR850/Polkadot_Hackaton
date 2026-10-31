# Publicar PolkaPets en polka-pets.dot

Sigue el taller Products Devnet ([capítulos 5 y 6](https://github.com/BrandonFilth/polkadot-devnet-workshop/tree/main/contenido)),
con `pad` 0.22.1 y Product SDK 0.39.0.

- Dominio: `polka-pets.dot` (Products Devnet, registrado).
- Contrato: `0x758425A3b756079B34FF97cB9C7A764fD44C008a` en Polkadot Hub TestNet (chain id 420420417).
  El despliegue tiene `NUM_ESPECIES = 1`: como NFT solo se adopta el ajolote. El Solidity de esta
  rama ya declara cinco especies, pero no aplica hasta desplegar un contrato nuevo y cambiar la
  dirección en `game/src/contract/config.ts`.
- Dentro de Polkadot Desktop o la Polkadot App, adoptar, cuidar y renombrar se firman con el Host
  (`game/src/contract/host.ts`). En un navegador normal se firma con MetaMask.
- La cuenta del Host es una cuenta derivada de `polka-pets.dot`: es distinta de la de MetaMask, así
  que sus mascotas también son distintas.
- `product-app/` y `tamagotchiaxolotl.paseo` son otra ruta (contrato PolkaVM en Paseo) y no se
  publican con este ciclo. Su manifiesto todavía tiene la dirección provisional `0x000…000`.

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

## Publicaciones

| Fecha | CID raíz | Icono | Contenido |
|---|---|---|---|
| 2026-10-31 | `bafybeihjop464rvo3ocpej6vixt3dqrv2bgijzcrchtsw3sdgafrmu7ulu` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Primera versión con firmas por el Host; NFT con estilo morado y solo ajolote |
