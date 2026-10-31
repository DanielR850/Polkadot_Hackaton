# 🐾 PolkaPets — Tamagotchi NFT en Polkadot

Un juego tipo **Tamagotchi** donde cada mascota es un **NFT (ERC-721)** en **Polkadot Hub
TestNet**. La cuidas con transacciones: comida, juego, sueño y baño. Sus necesidades bajan
con el tiempo (`block.timestamp`); si las descuidas pierde vida y muere. El ranking guarda
cuánto duró cada mascota.

Arquitectura inspirada en el
[workshop de Polkadot de AnaLucia-cs](https://github.com/AnaLucia-cs/polkadot-devnet-workshop/tree/main/game):
lógica pura separada del DOM y de la red, tests junto a cada módulo, y una capa `contract/`
que encapsula todo lo que va a la cadena.

## Flujo del juego

1. **Inicio** → *Empezar partida* (o ver el *Ranking* sin cuenta).
2. **Vincula tu cuenta** → elige tu wallet. Se detectan con EIP-6963: MetaMask y las wallets
   de Polkadot compatibles con EVM (Talisman, SubWallet, Nova). La app agrega o cambia la red
   a Polkadot Hub TestNet.
3. **Nombre** de la mascota (1 a 24 bytes).
4. **Elige la mascota**: 🐱 Gato, 🐶 Perro, 🐲 Dragón o 🐧 Pingüino. *Adoptar* mintea el NFT.
5. **Juego principal**: seis atributos y los botones *Alimentación*, *Jugar*, *Dormir*,
   *Bañar*, *Nombre* y *Ranking*.

Si la cuenta ya tiene una mascota viva, al conectar se va directo al juego. Cuando muere, se
muestra cuánto vivió y se puede empezar una partida nueva.

## Mecánicas

| Atributo  | Baja 1 punto cada | Lo recupera                               |
| --------- | ----------------- | ----------------------------------------- |
| Hambre    | 60 s              | 🍖 Alimentación (+40)                     |
| Sed       | 45 s              | 🍖 Alimentación (+40)                     |
| Energía   | 120 s             | 💤 Dormir (+50)                           |
| Felicidad | 90 s              | 🎾 Jugar (+30; cuesta 15 de energía, 10 de hambre, 10 de sed y 15 de limpieza) |
| Limpieza  | 150 s             | 🛁 Bañar (+50)                            |
| ❤️ Vida   | ver abajo         | +5 con cada cuidado que deje todo por encima de 0 |

- Mientras una necesidad está en 0, la mascota pierde **1 de vida cada 30 s** (con dos en 0,
  cada 15 s, y así). Con la vida en 0 muere, y no se puede revivir.
- El contrato calcula el **segundo exacto de la muerte**, así que la duración del ranking no
  depende de cuándo alguien mire a la mascota. Sin ningún cuidado, una mascota dura 1 h 52 min 30 s.
- Cada cuidado da 10 XP; cada 100 XP sube de nivel. Etapas: Bebé (nivel 1), Joven (2–9),
  Adulta (10+), Enferma (alguna necesidad en 0), Muerta.
- *Nombre* cambia el nombre con una transacción; no cuenta como cuidado.

Nada se actualiza solo en la cadena. El contrato guarda los valores de la última interacción
y calcula el estado actual al leer (`verMascota` y `ranking` son `view`). El frontend simula la
misma fórmula cada segundo (`game/src/engine/tiempo.ts`) para que las barras bajen en vivo, y
vuelve a leer la cadena cada 20 s.

## Estructura

```
.
├── contrato/                   # Smart contract (Solidity + Hardhat)
│   ├── contracts/PolkaPets.sol  # ERC-721 con la lógica del juego y el ranking
│   ├── scripts/
│   │   ├── deploy.ts            # despliega y guarda la dirección en deployments/
│   │   ├── exportAbi.ts         # copia la ABI a game/src/contract/
│   │   ├── balance.ts           # cuenta de despliegue y saldo (no imprime la llave)
│   │   └── probar.ts            # prueba de humo contra la testnet
│   ├── test/PolkaPets.test.ts   # 13 tests
│   └── hardhat.config.ts        # red polkadotHubTestnet (chainId 420420417)
│
└── game/                       # Frontend (Vite + TypeScript + viem, sin framework)
    └── src/
        ├── contract/            # config, ABI, tipos, wallets (EIP-6963) y cliente viem
        ├── engine/              # lógica pura: tiempo, salud, ranking (+ tests)
        ├── hub/                 # estado de la partida; única pieza que habla con la red
        ├── components/          # pantallas y modales
        ├── lib/                 # formato y traducción de errores (+ tests)
        ├── app.ts               # arma el DOM y conecta todo
        └── main.ts
```

## Puesta en marcha

Requisitos: Node.js 18+, una wallet con **PAS** de prueba
([faucet](https://faucet.polkadot.io/)) y, solo para desplegar, la clave privada en
`contrato/.env` (copia `contrato/.env.example`; nunca la subas al repo).

Cada carpeta se instala por separado (la raíz del repo es el prototipo con Phaser):

```bash
cd contrato
npm install
npm test                   # tests del contrato
npm run deploy:testnet     # despliega; pega la dirección en game/src/contract/config.ts
npm run abi                # exporta la ABI al frontend

cd ../game
npm install
npm test                   # tests del frontend
npm run dev                # http://127.0.0.1:5173
```

## Despliegue actual

- Contrato PolkaPets: `0x022e6adE3D707EA9E7D96D50FD388922A58cEF8E`
  ([explorador](https://blockscout-testnet.polkadot.io/address/0x022e6adE3D707EA9E7D96D50FD388922A58cEF8E))
- Prueba de humo: `npm run probar` dentro de `contrato/` (adopta, cuida con cada acción,
  cambia el nombre y lee el ranking).

## Notas de red

- RPC: `https://eth-rpc-testnet.polkadot.io` · Chain ID `420420417` · Explorer
  https://blockscout-testnet.polkadot.io/
- Se compila con `solc` para EVM (`evmVersion: cancun`, que exige OpenZeppelin 5.x) y se
  despliega con Hardhat. Polkadot Hub ejecuta ese bytecode con REVM.
- `contrato/` usa TypeScript 5 porque Hardhat 2 (vía `ts-node`) no funciona con TypeScript 7.
- La **Polkadot App** (la de los Products con dominio `.dot`, que usa el repo de referencia)
  no está integrada: requiere `@parity/product-sdk` y publicar la app dentro de la Polkadot
  App. Hoy se juega con wallets de navegador.
