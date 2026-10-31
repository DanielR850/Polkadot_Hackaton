# Tamagotchi Polkadot

Juego web de mascota virtual. La primera versión será 2D y funcionará en navegador de escritorio y móvil. Más adelante podremos evaluar una habitación 3D o modo WebXR.

## Recursos visuales y audio

Los recursos del juego viven en `public/assets/` y se organizan por tipo:

- `characters/`: spritesheets, retratos y animaciones de la mascota.
- `backgrounds/`: habitación y fondos.
- `ui/`: iconos y elementos gráficos de la interfaz.
- `sfx/`: efectos de sonido.
- `music/`: música del juego.
- `models-3d/`: modelos `.glb` si añadimos una versión 3D.

Usa nombres descriptivos y minúsculas, por ejemplo `axolotl-idle.png` o `room-day.webp`. Guarda aquí solo recursos que podamos usar legalmente y registra su fuente/licencia en `docs/ASSETS.md`.

## Código previsto

- `src/game/`: reglas y escenas del juego.
- `src/ui/`: interfaz y menús.
- `src/polkadot/`: integración posterior con Host, wallet y contrato.
- `docs/`: especificaciones, decisiones y registro de recursos.

## Estado

Repositorio inicial. La integración con blockchain y el contrato todavía no están creados. Primero construiremos un prototipo jugable local; después definiremos qué datos conviene guardar en cadena.
