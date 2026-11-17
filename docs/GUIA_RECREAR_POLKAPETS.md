# Guía para recrear una aplicación NFT en Polkadot con dominio `.dot`

## 1. Qué se construyó

PolkaPets es un juego tipo Tamagotchi. Cada mascota adoptada se acuña como un NFT
ERC-721 en Polkadot Hub TestNet. La persona puede:

- elegir el nombre y la especie;
- adoptar una mascota;
- alimentarla, jugar, dormir y bañarla;
- cambiarle el nombre;
- consultar su estado y el ranking de longevidad.

El contrato calcula el paso del tiempo a partir de `block.timestamp`. No existe un
proceso externo que actualice la mascota cada segundo: se guardan los valores de la
última interacción y el contrato calcula el estado actual al leerlo.

Hay que distinguir dos partes del repositorio:

1. **Juego local raíz:** usa Phaser y almacenamiento local del navegador. Sirve para
   jugar sin wallet y contiene las cinco especies y sus animaciones.
2. **PolkaPets blockchain:** está en [`game/`](../game/). Usa Vite, TypeScript,
   `viem`, wallets EVM y, cuando se abre desde Polkadot Desktop o la Polkadot App,
   el Product SDK para que el Host gestione la cuenta y las firmas.

La aplicación publicada como Product usa el build de la raíz (`dist/`), que incluye
la entrada al frontend blockchain. El proyecto [`product-app/`](../product-app/)
es una ruta experimental separada para un Product PolkaVM en Paseo; no comparte
estado ni NFT con el contrato EVM de PolkaPets y no debe confundirse con la versión
publicada en `polka-pets.dot`.

## 2. Herramientas utilizadas

### Frontend

- Node.js y pnpm.
- Vite para desarrollo y build.
- TypeScript para tipos y compilación.
- Phaser para la escena visual del juego local.
- `viem` para conectar con el RPC EVM, leer contratos, simular llamadas y enviar
  transacciones desde una wallet EVM.
- Product SDK de Polkadot para conectarse al Host cuando la app corre dentro de
  Polkadot Desktop o la Polkadot App.

Las versiones fijadas en el proyecto principal son:

```text
@parity/product-sdk              0.39.0
@parity/product-sdk-descriptors  0.14.0-pcf.1
polkadot-api                     3.2.1
phaser                           4.2.1
viem                             2.56.9
typescript                       5.9.3
vite                             8.3.1
pnpm                             12.6.0
```

No se deben mezclar instalaciones con npm o yarn. En este repositorio se utiliza
pnpm y el lockfile es `pnpm-lock.yaml`.

### Contratos

- Solidity `0.8.28`.
- OpenZeppelin ERC-721.
- Hardhat y TypeScript para compilar, probar y desplegar el contrato de la carpeta
  [`contrato/`](../contrato/).
- Remix + MetaMask es una alternativa válida para desplegar contratos Solidity en
  el flujo Products Devnet.
- Blockscout para revisar direcciones, transacciones y contratos.

### Publicación

- `@polkadot-community-foundation/polkadot-app-deploy` (`pad`) 0.22.1.
- Bulletin para alojar el contenido estático.
- `dotns.dot` para asociar el CID con el dominio `.dot`.

## 3. Arquitectura del proyecto

```text
src/
  app/application.ts         Controlador: pantallas, cuidados, mint, registro y música
  ui/                        Pantallas y diálogos (inicio, mascota, mint, juego, registro, ranking)
  game/                      Reglas, catálogo, guardado local y escena Phaser
  polkadot/nftMint.ts        Adaptador: conectar, mint, registrar partida y leer leaderboard
game/src/
  contract/
    config.ts                RPC, chain ID, direcciones y timeouts
    pets.ts                  Lecturas, simulación y escrituras con viem
    host.ts                  Cuenta, gas y firmas a través del Product SDK
    wallets.ts                Detección EIP-6963 de wallets
    polkapets.ts              ABI y decodificación de resultados
    ranking.ts               Lectura y registro del ranking
  hub/hub.ts, engine/        Modo NFT con firma por cuidado (src/app/chainApplication.ts; no se abre hoy)
contrato/
  contracts/PolkaPets.sol    NFT y lógica del Tamagotchi
  contracts/PolkaPetsRanking.sol
                              Contrato adicional del ranking de muertes
  scripts/deploy.ts          Despliegue y guardado de dirección
  scripts/exportAbi.ts       Exportación de ABI al frontend
  test/                      Pruebas del contrato
public/assets/               Sprites, fuentes e iconos
dist/                        Build que se publica
```

El patrón importante es separar responsabilidades:

- los componentes visuales no llaman directamente al contrato;
- `hub.ts` mantiene el estado y coordina las acciones;
- `pets.ts` conoce el ABI, las direcciones y el transporte;
- `host.ts` solo se ocupa de la integración con el Host;
- el contrato vuelve a validar todas las reglas, aunque el frontend ya las haya
  comprobado.

### 3.1. Qué significa cada extensión de archivo

Una extensión no es un detalle decorativo: normalmente indica qué herramienta
interpreta el archivo y en qué momento se utiliza.

| Extensión | Qué contiene | Quién lo interpreta | Cuándo se usa |
|---|---|---|---|
| `.ts` | TypeScript sin HTML embebido | TypeScript y Vite | lógica de UI, dominio, red y scripts |
| `.tsx` | TypeScript con JSX | TypeScript + el plugin del framework | no es la extensión principal de esta app; se usa en proyectos React |
| `.js` | JavaScript | Node.js o el navegador | configuración o código que no necesita tipos |
| `.mjs` | JavaScript tratado explícitamente como módulo ES | Node.js | configuración de `pad` |
| `.sol` | Solidity | solc, Hardhat o Remix | contratos que se compilan a bytecode EVM |
| `.json` | datos estructurados | Node.js, Vite o el navegador | `package.json`, ABI, configuración y manifest |
| `.jsonl` | JSON por línea | herramientas de logs | no forma parte del runtime de PolkaPets |
| `.css` | estilos | Vite y el navegador | colores, distribución, tipografía y responsive |
| `.html` | documento base | navegador y Vite | contiene el elemento raíz donde se monta la app |
| `.abi.json` | ABI del contrato en JSON | `viem` o Product SDK | traduce nombres de funciones y tipos a llamadas EVM |
| `.png`, `.jpeg`, `.ttf` | recursos binarios | navegador/Phaser | sprites, iconos y fuentes |
| `.yaml` / `.yml` | configuración declarativa | pnpm o herramientas externas | lockfiles y workspace; no es código de la app |
| `.lock` | versiones exactas resueltas | pnpm | reproduce las dependencias instaladas |

#### Diferencia entre `.ts`, `.js` y `.mjs`

`package.json` declara `"type": "module"`, por lo que los archivos JavaScript
usan módulos ES (`import` y `export`). TypeScript (`.ts`) se transforma a
JavaScript durante `pnpm build`; el navegador no ejecuta TypeScript directamente.

- [`src/main.ts`](../src/main.ts) es código de aplicación: arranca la interfaz.
- [`vite.config.ts`](../vite.config.ts) es código de configuración de Vite.
- [`polkadot-app-deploy.config.mjs`](../polkadot-app-deploy.config.mjs) es una
  configuración que `pad` carga con Node.js; no se incluye como pantalla del juego.
- `game/vite.config.ts` pertenece al proyecto independiente `game/`, no al build
  principal.

#### Diferencia entre `.sol`, `.abi.json` y la dirección

Estos tres elementos cumplen funciones diferentes:

1. **`.sol`:** el código fuente legible del contrato. Define reglas, storage,
   eventos y errores.
2. **Bytecode:** resultado compilado que se despliega en una dirección. La red
   ejecuta bytecode, no el archivo `.sol`.
3. **`.abi.json`:** descripción de la interfaz pública. Le dice al frontend que
   existe, por ejemplo, `mint(string,uint8)` y cómo codificar sus argumentos.
4. **Dirección:** ubicación concreta de una instancia desplegada en una red
   concreta, por ejemplo `PETS_ADDRESS`.

Si se modifica `PolkaPets.sol`, no basta con copiar el archivo al frontend:
hay que recompilar, desplegar una nueva instancia, exportar la ABI y cambiar la
dirección. ABI y dirección deben pertenecer al mismo contrato.

#### Diferencia entre `.json` y `.abi.json`

Ambos son JSON válido, pero el sufijo comunica intención:

- `package.json` describe dependencias y scripts;
- `tsconfig.json` describe cómo comprobar TypeScript;
- `polkapets.abi.json` describe la interfaz del contrato;
- un manifest describe cómo el Host presenta la aplicación.

El frontend importa la ABI como dato y la convierte al tipo que espera la librería:

```ts
import type { Abi } from "viem";
import abiJson from "./polkapets.abi.json";

export const polkaPetsAbi = abiJson as unknown as Abi;
```

No se deben confundir los `artifacts/` de Hardhat con la ABI final que consume la
app: los artifacts también contienen bytecode, metadata y datos de compilación.

### 3.2. Los cuatro proyectos que aparecen en el árbol

El repositorio parece grande porque contiene varias rutas relacionadas, pero no
todas se ejecutan juntas.

#### A. Proyecto raíz

Es el producto que se construye con el `package.json` de la raíz. Su entrada es
[`index.html`](../index.html) y su código está en `src/`. Incluye el juego local,
Phaser, assets y el enlace hacia el modo NFT.

Comandos:

```powershell
pnpm dev
pnpm build
pnpm preview
```

#### B. `game/`

Es un frontend blockchain independiente, con su propio `package.json`,
`vite.config` y `tsconfig`. Su código es TypeScript sin React: crea elementos DOM
con funciones como `el(...)` y los conecta desde `app.ts`.

Su `pnpm dev` sirve el frontend directamente, pero ese servidor solo sirve para
revisar la interfaz en un navegador normal. No demuestra que el Host, el dominio
`.dot`, las firmas y PGAS estén funcionando.

#### C. `contrato/`

Es el workspace de Hardhat para EVM. Tiene su propio `package.json`, contratos,
tests, artifacts y scripts. `contrato/` no es una página web y no se copia dentro
de `dist/`.

Sus scripts hacen cosas distintas:

| Script | Responsabilidad |
|---|---|
| `compile` | convierte Solidity y genera artifacts |
| `test` | ejecuta pruebas locales del contrato |
| `deploy:testnet` | despliega una nueva instancia |
| `abi` | exporta la ABI al frontend |
| `balance` | consulta saldo de la cuenta de despliegue |
| `probar` | realiza una prueba de humo contra la red |

#### D. `product-app/`

Es otro prototipo de Product SDK/PolkaVM. Tiene su propio `package.json`,
`index.html`, `src/` y manifest. No es simplemente otra carpeta del mismo
frontend: usa otra ruta de contrato y otra arquitectura. La dirección provisional
que tenga allí no cambia el contrato EVM de `game/`.

### 3.3. Qué ocurre al abrir la aplicación

El recorrido técnico del navegador es:

```text
index.html
  -> src/main.ts
  -> src/app/bootstrap.ts / application.ts
  -> pantallas de src/ui (nombre, mascota, paso 3: adoptar NFT)
  -> src/polkadot/nftMint.ts
  -> game/src/contract/pets.ts o host.ts (y ranking.ts al morir)
  -> RPC EVM o Host
  -> contratos PolkaPets y PolkaPetsRanking
```

`index.html` solo aporta el documento y el elemento raíz. `main.ts` importa el CSS
y arranca la aplicación. `application.ts` crea las pantallas de `src/ui` y decide cuándo
pedir una firma: al adoptar y, si la mascota muere, al registrar la partida.

> Lo que sigue describe el hub (`game/src/hub/hub.ts`), que usa el modo NFT con firma por
> cuidado. El flujo principal hace lo mismo desde `application.ts` y `nftMint.ts`.

Los componentes no conocen detalles de RPC. Cuando alguien pulsa **Adoptar**:

1. el componente llama al callback que recibió al crearse;
2. el callback llega a `hub.adoptar`;
3. `hub` valida que exista una sesión y un nombre;
4. `hub` llama a `contract/pets.ts`;
5. `pets.ts` simula y envía la transacción;
6. `hub` vuelve a cargar la mascota;
7. los listeners reciben el nuevo `HubState`;
8. el componente vuelve a dibujar los valores.

Este flujo evita tener `fetch`, claves privadas o lógica de contrato dentro de un
botón visual.

### 3.4. Estado, dominio y transporte

Hay tres conceptos que deben mantenerse separados:

- **Estado de interfaz:** pantalla actual, mensaje visible, operación ocupada y
  lista de wallets.
- **Estado de dominio:** vida, hambre, sed, experiencia, etapa y duración.
- **Estado de cadena:** propietario, token ID, timestamp, eventos y valores
  almacenados en el contrato.

El estado de interfaz puede cambiar inmediatamente a “firmando”, pero eso no
significa que la cadena haya cambiado. Solo después de `receipt.status === success`
y una lectura nueva se muestra el resultado como confirmado.

`bigint` se usa para cantidades EVM como `tokenId`; no conviene convertir un ID de
token o un valor grande de contrato a `number`, porque JavaScript puede perder
precisión. Los timestamps y barras pequeñas se convierten a `number` en el
decodificador porque sus límites son conocidos.

### 3.5. Por qué hay dos clientes de red

Hay dos caminos de transporte:

```text
Navegador + MetaMask
  lectura: viem -> ETH-RPC
  escritura: viem -> proveedor EIP-1193 -> MetaMask -> ETH-RPC

Polkadot Desktop / Polkadot App
  lectura: viem -> ETH-RPC
  escritura: Product SDK -> Host -> wallet del usuario -> Asset Hub
```

La lectura pública puede usar el ETH-RPC porque no necesita una clave. La escritura
dentro del Product debe pasar por el Host para conservar el aislamiento y permitir
que la persona apruebe desde su wallet. `host.ts` carga el SDK dinámicamente para
que el navegador normal no dependa de APIs que solo existen dentro del Host.

### 3.6. Qué hace cada dependencia

| Dependencia | Problema que resuelve |
|---|---|
| `vite` | servidor de desarrollo, resolución de módulos y build |
| `typescript` | tipos y detección de errores antes de ejecutar |
| `phaser` | escena, sprites, animaciones y tweens del juego local |
| `viem` | ABI encoding, lecturas RPC, simulación, envío y recibos |
| `@parity/product-sdk` | acceso del Product al Host y a la cadena |
| `@parity/product-sdk-descriptors` | descripción de Asset Hub para el SDK |
| `polkadot-api` | tipos/transporte subyacente del ecosistema del SDK |
| `hardhat` | compilación, tests y despliegue Solidity |
| `@openzeppelin/contracts` | implementación revisada de ERC-721 |
| `dotenv` | carga local de variables de despliegue; nunca debe publicar secretos |

Una librería no es lo mismo que una herramienta del sistema: `viem` se importa
desde TypeScript; `pnpm` instala paquetes; Remix y Blockscout son sitios o
interfaces externas; MetaMask es el custodio que pide firmas.

## 4. Preparar la red de Polkadot

La versión usada se conectó a **Polkadot Hub TestNet / Paseo Asset Hub 1000**:

| Campo | Valor |
|---|---|
| RPC EVM | `https://eth-rpc-testnet.polkadot.io` |
| Chain ID | `420420417` |
| Símbolo | `PAS` |
| Explorador | <https://blockscout-testnet.polkadot.io> |
| Faucet | <https://faucet.polkadot.io> |

En MetaMask se agrega una red personalizada con esos datos. Después se solicitan
PAS de prueba en el faucet seleccionando Paseo y Asset Hub (1000).

No se debe elegir la red `Paseo PassetHub (420420422)`, ni Asset Hub Next. Son
redes diferentes. Para una aplicación nueva hay que verificar siempre el chain ID
que devuelve `eth_chainId`.

## 5. Diseñar y desplegar el contrato NFT

### 5.1. Modelo de datos

`PolkaPets.sol` hereda de `ERC721` y `ERC721Enumerable`. Cada token guarda:

- nombre;
- especie;
- nacimiento y última interacción;
- hambre, sed, energía, felicidad, limpieza;
- vida, experiencia y nivel.

Las funciones principales son:

```solidity
mint(string nombre, uint8 especie)
alimentar(uint256 tokenId)
jugar(uint256 tokenId)
dormir(uint256 tokenId)
banar(uint256 tokenId)
cambiarNombre(uint256 tokenId, string nombre)
verMascota(uint256 tokenId)
ranking(uint256 desde, uint256 cantidad)
```

Las funciones de lectura son `view`; las acciones que cambian estado son
transacciones. El contrato usa errores personalizados como `NoEresDueno`,
`EstaMuerta`, `NombreInvalido` y `EspecieInvalida`.

Un contrato nunca puede saber si una persona realmente pulsó un botón fuera de la
cadena. Por eso las reglas de autoridad se basan en `msg.sender`, y el contrato
comprueba el dueño del NFT en cada acción.

### 5.2. Compilar y probar

Desde la carpeta del contrato:

```powershell
cd contrato
pnpm install
pnpm compile
pnpm test
```

Antes de desplegar conviene probar:

- que un nombre vacío o mayor de 24 bytes revierte;
- que una especie fuera de rango revierte;
- que solo el dueño puede cuidar o renombrar;
- que una mascota muerta no puede volver a cuidarse;
- que las lecturas calculan correctamente la disminución por tiempo.

### 5.3. Desplegar

La configuración de Hardhat contiene la red `polkadotHubTestnet`. El script
[`deploy.ts`](../contrato/scripts/deploy.ts) crea el contrato, espera la confirmación
y guarda la dirección en `contrato/deployments/`.

```powershell
pnpm deploy:testnet
```

La cuenta que despliega necesita PAS. La clave privada debe permanecer en un archivo
local no versionado como `contrato/.env`; nunca se copia a la aplicación ni se
publica.

Después se copia la dirección impresa por Hardhat a
[`game/src/contract/config.ts`](../game/src/contract/config.ts), en `PETS_ADDRESS`.
También se revisa la dirección en Blockscout.

### 5.4. Obtener la ABI

La ABI describe las funciones, parámetros, eventos y errores del contrato. Cada vez
que se cambia y se vuelve a desplegar el Solidity, hay que actualizar tanto la
dirección como la ABI:

```powershell
pnpm abi
```

La ABI exportada se coloca en `game/src/contract/`. No se debe editar manualmente
una ABI vieja después de cambiar el contrato.

### 5.5. Contrato del ranking

[`PolkaPetsRanking.sol`](../contrato/contracts/PolkaPetsRanking.sol) es un contrato
separado. Cuando una mascota muere, el dueño puede registrar su duración. El
contrato verifica que:

- quien llama sea el dueño del NFT;
- el token no se haya registrado antes;
- la duración sea mayor que cero y no exceda el tiempo transcurrido;
- el nombre y la especie sean válidos.

Por eso el ranking requiere otra transacción y otra firma. La dirección configurada
actualmente está en `RANKING_ADDRESS`.

## 6. Cómo se conecta el frontend con el contrato

### 6.1. Lecturas

`game/src/contract/pets.ts` crea un cliente público de `viem` usando:

```text
https://eth-rpc-testnet.polkadot.io
```

Las lecturas no requieren firma. Ejemplos:

- `NUM_ESPECIES` para saber cuántas especies admite el despliegue real;
- `mascotasDe(address)` para obtener los tokens de una cuenta;
- `verMascota(tokenId)` para obtener el estado actual;
- `ranking(...)` para leer el leaderboard.

La UI vuelve a consultar la mascota aproximadamente cada 20 segundos. Entre lecturas
el frontend simula el paso de los segundos para que las barras se vean vivas, pero
la fuente definitiva siempre es la lectura del contrato.

### 6.2. Wallet EVM en navegador

En un navegador normal, `wallets.ts` detecta wallets mediante EIP-6963, por ejemplo
MetaMask, Talisman, SubWallet o Nova si exponen un proveedor EVM.

Al conectar:

1. se solicita `eth_requestAccounts`;
2. se comprueba `eth_chainId`;
3. si hace falta, se pide cambiar a la red `420420417`;
4. si la red no existe, se solicita agregarla;
5. se utiliza la cuenta `0x...` elegida por la wallet.

La wallet nunca entrega la clave privada al frontend.

### 6.3. Simular antes de pedir la firma

Todas las escrituras siguen este orden:

1. el usuario pulsa un botón;
2. el frontend bloquea operaciones paralelas;
3. `publicClient.simulateContract(...)` ejecuta una simulación;
4. si la simulación revierte, se muestra el error y no se abre la wallet;
5. si pasa, `writeContract(...)` solicita la firma;
6. se espera el recibo;
7. se vuelve a leer la mascota.

Este orden evita abrir una ventana de firma para una operación que el contrato ya
rechazaría. La simulación no reemplaza la validación del contrato: entre la
simulación y la inclusión en un bloque el estado puede cambiar.

### 6.4. De una función TypeScript a una función Solidity

Supongamos que la persona pulsa el botón **Alimentar**:

```text
Juego.ts
  -> onCuidar("alimentar")
  -> hub.cuidar("alimentar")
  -> pets.cuidar(firmante, "alimentar", tokenId)
  -> escribir(firmante, {
       functionName: "alimentar",
       args: [tokenId]
     })
  -> simulateContract(...)
  -> firmante.enviar(...)
  -> contrato PolkaPets.alimentar(tokenId)
```

La propiedad `functionName` debe coincidir exactamente con el nombre público de
Solidity. El orden y los tipos de `args` también deben coincidir. La ABI es la
tabla que permite a `viem` codificar esta llamada como calldata EVM.

Para `mint`, por ejemplo:

```ts
{
  functionName: "mint",
  args: [nombre.trim(), especie]
}
```

`viem` convierte esa estructura en una transacción EVM. La wallet añade la firma.
El contrato recibe los datos, usa `msg.sender` como dueño y emite
`MascotaNacida`. El frontend no inventa el `tokenId`: lo obtiene leyendo de nuevo
los tokens de la cuenta después de confirmar.

### 6.5. Lecturas, simulaciones y transacciones no son lo mismo

| Operación | Cambia blockchain | Firma | Paga gas | Ejemplo |
|---|---:|---:|---:|---|
| Lectura `view` | no | no | no | `verMascota(tokenId)` |
| Simulación | no | no | no | `simulateContract` |
| Transacción | sí, si termina bien | sí | sí | `alimentar(tokenId)` |
| Lectura posterior | no | no | no | confirmar el nuevo estado |

Una simulación puede pasar y luego la transacción fallar si otro bloque cambió el
estado, si cambió el dueño del NFT o si se agotó el permiso de gas. Por eso se
mantienen las validaciones en Solidity y se informa el error real.

### 6.6. Decodificación de structs

Solidity devuelve `struct MascotaView`. `viem` lo entrega como un objeto cuyos
campos pueden ser `bigint`, `number`, `string` o boolean. El archivo
[`polkapets.ts`](../game/src/contract/polkapets.ts) normaliza esa respuesta:

```ts
{
  tokenId: bigint,
  hambre: number,
  etapa: Etapa,
  viva: boolean
}
```

El enum `Etapa` debe conservar el mismo orden numérico que Solidity:

```text
0 Bebe, 1 Joven, 2 Adulta, 3 Enferma, 4 Muerta
```

Si se cambia el orden del enum en Solidity pero no en TypeScript, la pantalla
podría mostrar “Adulta” cuando el contrato realmente devuelve “Enferma”. Por eso
los tipos del frontend deben actualizarse junto con el contrato y su ABI.

## 7. Firmas dentro de Polkadot Desktop o Polkadot App

Cuando la aplicación se abre desde su dominio `.dot` dentro del Host, no se usan
extensiones de navegador. `game/src/contract/host.ts` hace lo siguiente:

1. comprueba si la aplicación está dentro del Host;
2. obtiene el `productId` desde el contexto del Product o desde el dominio;
3. crea un `SignerManager`;
4. solicita la cuenta derivada del Product;
5. obtiene la dirección pública en SS58 y su representación H160 `0x...`;
6. solicita el recurso `SmartContractAllowance`;
7. crea el cliente de cadena con el descriptor
   `devnet_asset_hub`;
8. verifica que Asset Hub responde;
9. simula la llamada;
10. pide al Host que envíe la transacción;
11. el Host muestra la solicitud de firma en el teléfono o wallet;
12. espera estados de broadcasting, in-block y finalized.

La cuenta derivada del Product es distinta de la cuenta MetaMask que desplegó el
contrato. Por ello, las mascotas creadas desde el `.dot` pertenecen a la cuenta del
Product, no a la cuenta del desarrollador.

### Ventanas y mensajes que ve la persona

La pantalla de conexión puede mostrar:

- **Conectando con la Polkadot App...**: se está estableciendo la sesión;
- **Acepta los permisos en tu teléfono**: el Host solicita la cuenta;
- **Permiso de gas**: se solicita `SmartContractAllowance`;
- **Preparando / simulando**: todavía no se pidió una firma;
- **Firma**: hay una transacción pendiente de aprobación;
- **Confirmando**: la firma fue aceptada y se espera inclusión/finalización;
- **Leyendo**: se vuelve a consultar el contrato.

En cada operación solo se permite una firma a la vez. Si el usuario cancela, la UI
indica que la operación no fue aprobada. No se muestra la operación como exitosa
hasta que la transacción termina y la lectura posterior confirma el nuevo estado.

El gas de la app se obtiene como PGAS mediante `SmartContractAllowance`; no se debe
pedir al usuario que envíe PAS a la cuenta derivada solo para cuidar una mascota.
El despliegue desde Remix/Hardhat sí utiliza PAS de la cuenta del desarrollador.

### 7.1. Qué ocurre exactamente durante una firma del Host

Una firma no es una ventana HTML creada por el juego. La app solicita una operación
al Host y el Host la presenta en su interfaz segura. El juego solo muestra el
estado de espera.

El orden conceptual es:

```text
Product
  -> requestResourceAllocation(SmartContractAllowance)
  -> .query() / simulación
  -> Host recibe la petición .tx()
  -> Host muestra los datos a la persona
  -> persona aprueba o rechaza
  -> wallet firma sin revelar la clave
  -> Host transmite
  -> estados: broadcasting -> in-block -> finalized
  -> Product relee el contrato
```

La cuenta de Product tiene dos representaciones:

- SS58: formato nativo que usa la wallet/Host;
- H160 `0x...`: formato que ve el contrato EVM como `msg.sender`.

No son dos cuentas distintas: son representaciones de la misma cuenta derivada.
Sí son distintas de la cuenta MetaMask usada para desplegar.

Si el usuario rechaza la cuenta, el permiso de gas o la transacción, el flujo debe
terminar con un mensaje de cancelación. No se debe ejecutar una segunda firma
automática ni mostrar “adoptado” antes de la confirmación.

## 8. Flujo completo para adoptar y cuidar una mascota

1. La persona pulsa **Empezar partida**.
2. El frontend detecta si está en Host o en navegador.
3. En navegador elige una wallet; en Host pulsa conexión con Polkadot App.
4. Se lee `NUM_ESPECIES` del contrato real.
5. Se buscan las mascotas existentes de la cuenta.
6. Si ya hay una viva, se muestra directamente.
7. Si no, se solicita un nombre de 1 a 24 bytes.
8. Se elige una especie habilitada.
9. `mint(nombre, especie)` se simula y luego se firma.
10. Se espera el recibo y se identifica el nuevo `tokenId`.
11. La escena muestra las barras y la mascota.
12. Cada acción de cuidado repite simulación, firma, confirmación y relectura.
13. Al morir, se puede registrar la duración en el contrato de ranking.

El contrato desplegado en la versión documentada devolvía `NUM_ESPECIES = 1`, por
lo que en cadena solo estaba disponible el ajolote. El Solidity del repositorio
declara cinco especies, pero para habilitarlas hay que desplegar una nueva instancia
y actualizar su dirección.

## 9. Build y publicación en un dominio `.dot`

### 9.1. Preparar el build

Desde la raíz:

```powershell
pnpm install
pnpm build
```

El build genera `dist/`. En [`vite.config.ts`](../vite.config.ts) se usa
`base: './'` porque Bulletin sirve la aplicación desde un CID y no desde la raíz
de un dominio HTTP tradicional.

El plugin `soloDescriptorDevnet` elimina del bundle los descriptores de cadenas que
no se usan y conserva `devnet-asset-hub`. Esto reduce el tamaño y evita empaquetar
metadatos de redes innecesarias.

### 9.2. Publicar en Bulletin

La configuración de publicación está en
[`polkadot-app-deploy.config.mjs`](../polkadot-app-deploy.config.mjs). Contiene el
nombre, descripción, icono y ejecutable `./dist`.

El flujo usa un nombre temporal, nunca el nombre final:

```powershell
function pad {
  $env:PAD_UPDATE_CHECK = '0'
  pnpm dlx --ignore-scripts @polkadot-community-foundation/polkadot-app-deploy@0.22.1 @args
}

pnpm build
$env:APP_DOT = 'tmp' + (-join ((Get-Date -Format 'yyyyMMddHHmmss').ToCharArray() |
  ForEach-Object { [char](97 + [int]"$_") })) + '.dot'
pad .\dist $env:APP_DOT --env devnet --js-merkle
```

La salida contiene:

- un **CID raíz** del contenido;
- un JSON de `Verified text[manifest]`;
- normalmente un CID del icono.

Se deben guardar el CID raíz y el JSON del manifest. Bulletin es almacenamiento
temporal: la documentación del proyecto indica que el contenido puede desaparecer
aproximadamente después de 14 días, por lo que hay que republicar antes de ese
plazo o al sacar una nueva versión.

### 9.3. Asociar el CID al dominio

Desde Polkadot Desktop o la Polkadot App:

1. abrir `dotns.dot`;
2. entrar a **Profile → My Domains**;
3. localizar `polka-pets.dot`;
4. pulsar **Resolve**;
5. pegar el CID raíz;
6. guardar y aprobar la firma;
7. editar **Custom Records**;
8. crear el registro con key `manifest`;
9. pegar el JSON `Verified text[manifest]`;
10. guardar y aprobar la firma.

El registro `manifest` se agrega al dominio principal sin anteponer `app.`. La
cuenta que controla el dominio debe tener saldo para las operaciones del nombre.

Una publicación de prueba puede usar `--no-manifest`, resolviendo solo el CID. Para
la publicación final se usa la configuración con icono, nombre y descripción.

## 10. Cómo recrear el proyecto desde cero sin IA

1. Define el juego fuera de la cadena: estados, acciones, límites, muerte y
   ranking.
2. Crea el contrato Solidity con errores personalizados y pruebas unitarias.
3. Decide si usarás OpenZeppelin ERC-721 y fija la versión.
4. Configura la red de Polkadot Hub TestNet y consigue PAS de prueba.
5. Compila y despliega desde Hardhat o Remix.
6. Guarda la dirección, la ABI y el explorador del contrato.
7. Crea el frontend Vite con TypeScript.
8. Implementa primero lecturas públicas con `viem`.
9. Implementa una única función de escritura con el patrón
   `simulateContract -> firma -> receipt -> relectura`.
10. Añade detección de wallets EIP-6963.
11. Añade el adaptador Host y la cuenta derivada del Product.
12. Añade mensajes explícitos para conectar, simular, firmar, confirmar y fallar.
13. Bloquea firmas concurrentes.
14. Configura `base: './'` y prueba el build estático.
15. Publica a un nombre temporal con `pad`.
16. Resuelve el CID desde el dominio `.dot`.
17. Añade el manifest y abre el Product desde el Host.
18. Prueba en el dominio publicado: conexión, una lectura, una adopción y un
   cuidado. `localhost` sirve para revisar la interfaz, pero no sustituye la prueba
   del Host, las firmas ni el PGAS.
19. Para una actualización, vuelve a compilar, publica un CID nuevo y reemplaza el
   `contenthash` del dominio.

## 11. Errores comunes

- **Usar otra red:** comprobar siempre `420420417`.
- **Cambiar solo la dirección:** una nueva instancia necesita también su ABI nueva.
- **Firmar sin simular:** primero ejecutar `simulateContract`.
- **Permitir dos operaciones:** mantener un estado `ocupado` y bloquear botones.
- **Esperar PAS en la cuenta del Product:** dentro del Host se usa PGAS.
- **Publicar directamente al dominio final con `pad`:** usar un nombre temporal y
  luego resolver el CID desde `dotns.dot`.
- **Usar rutas absolutas:** Bulletin necesita assets relativos y `base: './'`.
- **Confundir `product-app/` con `game/`:** son proyectos y flujos de contrato
  distintos.
- **Leer una mascota solo una vez:** el estado cambia con `block.timestamp`; releer
  y calcular el estado actual.
- **Guardar claves en el frontend:** la wallet o el Host deben custodiar siempre la
  clave privada.

## 12. Enlaces útiles

- [Documentación de Polkadot](https://docs.polkadot.com/)
- [Products y Product SDK](https://docs.polkadot.com/apps/)
- [Workshop de Products Devnet](https://github.com/BrandonFilth/polkadot-devnet-workshop)
- [Faucet de Paseo](https://faucet.polkadot.io/)
- [Blockscout de Polkadot Hub TestNet](https://blockscout-testnet.polkadot.io/)
- [Remix](https://remix.ethereum.org/)
- [OpenZeppelin Contracts 5.x](https://docs.openzeppelin.com/contracts/5.x)
- [Viem](https://viem.sh/)
- [Vite](https://vite.dev/)
- [Phaser](https://phaser.io/)
- [EIP-6963: descubrimiento de wallets](https://eips.ethereum.org/EIPS/eip-6963)
- [Documentación de `dotns`](https://docs.polkadot.com/)

Para datos específicos de Products Devnet, consultar las referencias curadas del
entorno incluidas en la guía de trabajo del proyecto: red, SDK, contratos y
publicación. Las direcciones, CIDs y resultados de pruebas de esta guía describen
el estado de este repositorio; al crear otra app se deben sustituir por los valores
de la nueva instancia. Las APIs y versiones pueden cambiar, así que conviene
confirmarlas en la documentación oficial antes de publicar:
[Polkadot Apps](https://docs.polkadot.com/apps/),
[Products](https://docs.polkadot.com/reference/apps/),
[smart contracts](https://docs.polkadot.com/smart-contracts/) y
[Polkadot Community Foundation](https://docs.polkadotcommunity.foundation/).
