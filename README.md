# Tamagotchi Polkadot

Juego web con ajolote, lobo, oso grizzly, tlacuache y manatí. Cada especie tiene ilustraciones de bebé, adolescente y adulto, con movimiento para los estados del juego.

## Ejecutar

Desde la raíz del repositorio:

```bash
npm install
npm run dev
```

`npm run build` genera la versión de producción en `dist/`.

## Modos de juego

- **Local:** permite elegir cualquiera de las cinco especies, no necesita wallet y guarda el progreso en este dispositivo. El menú de partida permite elegir otra mascota y reemplaza la partida local.
- **Polkadot Hub TestNet:** el botón de NFT abre el frontend de `game/`, que conecta una wallet EVM del navegador mediante `viem`; adoptar y cuidar requieren transacciones aprobadas por la persona.

Ambos modos usan la misma escena Phaser. El modo local incluye imágenes pixeladas y animaciones para las cinco especies; el modo NFT conserva el ajolote del contrato desplegado. La raíz es el punto de entrada web; `game/` contiene el frontend NFT existente y `contrato/` el Solidity/Hardhat. `product-app/` prepara por separado el Product para Polkadot App, todavía sin publicar.

La interfaz NFT usa el mismo estilo retro que el juego local. El ranking se puede consultar sin conectar una cuenta y muestra una invitación a vincularla para registrar un récord NFT. Para revisar la interfaz en otra computadora, ejecuta `npm run dev -- --host 0.0.0.0` y abre la dirección de red que muestra Vite; `127.0.0.1` solo funciona en la computadora que ejecuta el servidor.

Si la mascota queda sin cuidados, sus necesidades bajan hasta que muere. La partida local muestra la animación de muerte, el tiempo vivido y botones para ver el ranking o empezar de nuevo; `?speed=100` acelera el reloj para probar ese desenlace. El Product de Paseo conserva visible el NFT fallecido y ofrece adoptar otra mascota. Su muerte y duración las calcula el contrato; el Product todavía requiere su despliegue en Paseo para comprobarlo en la cadena.

## Especies y contrato

La selección de cinco especies funciona en el modo local. La dirección TestNet configurada para NFT es `0x758425A3b756079B34FF97cB9C7A764fD44C008a`. Confirmamos por lectura pública que responde como PolkaPets (PPET) y permite una especie (`NUM_ESPECIES = 1`): solo el ajolote puede adoptarse como NFT en ese despliegue. Aún falta comparar el Solidity exacto del despliegue con el fuente del repositorio.

Los ajustes visuales y del ranking del commit `1abcef1` no cambiaron Solidity y no requieren volver a desplegar el contrato EVM. Publicar `tamagotchiaxolotl.paseo` es un proceso distinto: `product-app/` necesita la dirección del contrato PolkaVM desplegado en Paseo antes de poder registrar NFT allí. El contrato EVM existente no comparte NFT ni estado con esa instancia.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [PolkaPets y contrato](docs/POLKAPETS.md)
- [Registro de assets](docs/ASSETS.md)
- [Mascotas y animaciones](docs/ANIMACIONES.md)
- [Publicación](docs/PUBLICACION.md)
- [Experimento de jugabilidad](docs/JUGABILIDAD-EXPERIMENTO.md)

Los commits de las ramas integradas se conservan en `codex/integracion-total`.

