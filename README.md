# Tamagotchi Polkadot

Juego web con ajolote, lobo, oso grizzly, tlacuache y manatí. Cada especie tiene etapas de bebé, adolescente y adulto.

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

## Especies y contrato

La selección de cinco especies funciona en el modo local. La dirección TestNet configurada para NFT es `0x758425A3b756079B34FF97cB9C7A764fD44C008a`. Confirmamos por lectura pública que responde como PolkaPets (PPET) y permite una especie (`NUM_ESPECIES = 1`): solo el ajolote puede adoptarse como NFT en ese despliegue. Aún falta comparar el Solidity exacto del despliegue con el fuente del repositorio.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [PolkaPets y contrato](docs/POLKAPETS.md)
- [Registro de assets](docs/ASSETS.md)
- [Publicación](docs/PUBLICACION.md)

Los commits de las ramas integradas se conservan en `codex/integracion-total`.

