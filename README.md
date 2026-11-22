# Tamagotchi Polkadot

Juego web con ajolote, lobo, oso grizzly, tlacuache y manatí. Cada especie tiene ilustraciones de bebé, adolescente y adulto, con movimiento para los estados del juego. Se publica como app de Polkadot en `polka-pets.dot`.

## Ejecutar

Desde la raíz del repositorio, con [pnpm](https://pnpm.io) 12.6.0 (las versiones del Product SDK están fijadas en `package.json` y `pnpm-workspace.yaml`):

```bash
pnpm install
pnpm dev
```

`pnpm build` genera la versión de producción en `dist/`. Para revisar la interfaz en otro dispositivo de la misma red, abre la dirección de red que muestra Vite; `localhost` solo funciona en la computadora que ejecuta el servidor.

## Modos de juego

- **Local:** permite elegir cualquiera de las cinco especies, no necesita wallet y guarda el progreso en este dispositivo. El menú de partida permite elegir otra mascota y reemplaza la partida local.
- **NFT en Polkadot Hub TestNet:** usa las mismas pantallas retro que el juego local (habitación, barras, menú de comida, baño, ranking y nombre). Adoptar y cada cuidado son transacciones que firma la persona:
  - dentro de Polkadot Desktop o la Polkadot App, con la cuenta del Host (Product SDK, `src/contract/host.ts`);
  - en un navegador normal, con una wallet EVM como MetaMask (`viem`).

Ambos modos usan la misma escena Phaser. El ranking NFT se lee del contrato. La raíz es el punto de entrada web y `contrato/` contiene el Solidity/Hardhat.

Si la mascota queda sin cuidados, sus necesidades bajan hasta que muere. La partida local muestra la animación de muerte, el tiempo vivido y botones para ver el ranking o empezar de nuevo; `?speed=100` acelera el reloj para probar ese desenlace.

## Especies y contrato

La selección de cinco especies funciona en el modo local. La dirección TestNet configurada para NFT es `0x758425A3b756079B34FF97cB9C7A764fD44C008a`. Confirmamos por lectura pública que responde como PolkaPets (PPET) y permite una especie (`NUM_ESPECIES = 1`): solo el ajolote puede adoptarse como NFT en ese despliegue, y la app oculta las demás especies leyendo ese valor. El Solidity de esta rama ya declara `NUM_ESPECIES = 5`; aplica solo si se despliega un contrato nuevo y se cambia la dirección en `src/contract/config.ts`.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [PolkaPets y contrato](docs/POLKAPETS.md)
- [Registro de assets y animaciones](docs/ASSETS.md)
- [Publicación en polka-pets.dot](docs/PUBLICACION.md)

Los commits de las ramas integradas se conservan en `codex/integracion-total`.
