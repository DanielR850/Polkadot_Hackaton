# Tamagotchi Polkadot

Primera versión candidata: juego web de un solo compañero, el ajolote, con etapas de bebé, adolescente y adulto.

## Ejecutar

Desde la raíz del repositorio:

```bash
npm install
npm run dev
```

`npm run build` genera la versión de producción en `dist/`.

## Modos de juego

- **Local:** no necesita wallet; guarda el progreso en este dispositivo.
- **Polkadot Hub TestNet:** el botón de NFT abre el frontend de `game/`, que conecta una wallet EVM del navegador mediante `viem`; adoptar y cuidar requieren transacciones aprobadas por la persona.

Ambos modos usan la misma escena Phaser y los sprites del ajolote. La raíz es el punto de entrada web; `game/` contiene el frontend NFT existente y `contrato/` el Solidity/Hardhat. No se integró el Product SDK de Polkadot Desktop.

## Especie única y contrato

La interfaz solo ofrece el ajolote (id 0) y el Solidity actual rechaza otros IDs en nuevos despliegues. La dirección TestNet configurada es `0x08Ff3f07Bca56D0ebdD4346c815B320CDCBC3aec`. Confirmamos por lectura pública que responde como PolkaPets (PPET) y acepta cuatro IDs (`NUM_ESPECIES = 4`). Para imponer la restricción también en cadena hay que desplegar el Solidity actualizado y configurar la nueva dirección en `game/src/contract/config.ts`. No se desplegó un contrato como parte de esta versión.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [PolkaPets y contrato](docs/POLKAPETS.md)
- [Registro de assets](docs/ASSETS.md)
- [Publicación](docs/PUBLICACION.md)

Los commits de las ramas integradas se conservan en `codex/integracion-total`.

