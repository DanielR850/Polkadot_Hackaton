# Publicar PolkaPets en polka-pets.dot

Sigue el taller Products Devnet ([capítulos 5 y 6](https://github.com/BrandonFilth/polkadot-devnet-workshop/tree/main/contenido)),
con `pad` 0.22.1 y Product SDK 0.39.0.

- Dominio: `polka-pets.dot` (Products Devnet, registrado).
- Contrato: `0x758425A3b756079B34FF97cB9C7A764fD44C008a` en Polkadot Hub TestNet (chain id 420420417).
  El despliegue tiene `NUM_ESPECIES = 1`: como NFT solo se adopta el ajolote. El Solidity de esta
  rama ya declara cinco especies, pero no aplica hasta desplegar un contrato nuevo y cambiar la
  dirección en `src/contract/config.ts`.
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

## Contratos v3 en TestNet (para que la app sea funcional y no solo interfaz)

Los contratos de TestNet son v1 (una sola especie, 52 objetos de Ana). Los v3 agregan las cinco
especies como NFT, dificultad y modos, temporadas semanales, comida, ropa y el color guardado en el
NFT (`mint` con `variante`, `varianteDe`). La app detecta la versión y sigue funcionando con v1.

1. En `contrato/`, copiar `.env.example` a `.env` y poner la llave de una cuenta **solo de pruebas** con
   PAS del faucet (nunca subir el `.env`; Git lo ignora).
2. `npm run deploy:v2:testnet` (despliega PolkaPets, PolkaPetsItems y PolkaPetsTemporadas, y autoriza a
   Items como operador). Guarda las direcciones en `contrato/deployments/polkadotHubTestnet-v2.json`.
3. `npm run aplicar:testnet` pega esas tres direcciones en `src/contract/config.ts`
   (`PROBAR=1 npm run aplicar:testnet` muestra el cambio sin escribir).
4. `pnpm build` y publicar con `pad` (ciclo de arriba). Dentro del Host se prueba con el `.dot`:
   ningún Host se conecta a `localhost`.

Esto reemplaza el contrato de objetos de Ana: sus ids 1 a 52 se conservan; se suman comida (53 a 59) y
ropa (60 y 61). Las mascotas ya adoptadas en los contratos v1 no se mueven al v3.

## Publicaciones

| Fecha | CID raíz | Icono | Contenido |
|---|---|---|---|
| 2026-10-31 | `bafybeihjop464rvo3ocpej6vixt3dqrv2bgijzcrchtsw3sdgafrmu7ulu` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Primera versión con firmas por el Host; NFT con estilo morado y solo ajolote |
| 2026-10-31 | `bafybeighs37itci77vmil4pc453f5iit6vqm5ab66fo3ojout5jearsbme` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | Fusión con GitHub (`a478e1e`): cinco especies en local, modo NFT con la interfaz retro |
| 2026-11-21 | `bafybeiabgqbccej3w5giowgjzrrj2enp3vde7lyedztxpenssaphbe66wi` | `bafk2bzacebhbstrmm2asv46ogqimiwehspkbsnomx5hagjkpsquuujuw6p5o4` | `polkapets-v2` (`07f5400`): animaciones, ropa mexicana, dormir echados y reacciones por especie. Subido a `tmpcacgbbcbcdabag.dot`; falta pegar el CID con Resolve en `polka-pets.dot`. El manifest no cambió |
