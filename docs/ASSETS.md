# Recursos audiovisuales

## Fuentes

| Archivo | Tipo | Autor/fuente | Licencia | Cambios |
|---|---|---|---|---|
| `public/assets/ui/fonts/PressStart2P-Regular.ttf` | Fuente (títulos y botones) | CodeMan38, vía Google Fonts | SIL OFL 1.1 (`PressStart2P-OFL.txt`) | Ninguno |
| `public/assets/ui/fonts/VT323-Regular.ttf` | Fuente (texto) | Peter Hull, vía Google Fonts | SIL OFL 1.1 (`VT323-OFL.txt`) | Ninguno |

## Animación del ajolote

`public/assets/pets/axolotl/animations.png` contiene 16 cuadros transparentes en una hoja de 4 columnas por 4 filas. Cada cuadro mide 356×276 px. `src/game/assets.ts` conecta los cuadros con las animaciones idle (0–3), juego (4–7), comer (8–11) y dormir (12–15). La escena las reproduce desde la selección de mascota y durante las acciones correspondientes.

## Recursos recibidos en `TomoDachi/`

Las ilustraciones JPEG se conservan como referencias del equipo. Incluyen imágenes del ajolote, acciones de comer, beber, jugar y dormir, además de imágenes de comida y bebidas. Los nombres sugieren generación con Gemini, pero el repositorio no registra autoría verificable, prompts ni licencia. No son spritesheets y actualmente la interfaz no las carga.

La rama `main` añadió cinco JPEG de acciones (beber, jugar y dormir) a los originales. Se mantienen en sus carpetas de origen; aún no se convierten a sprites ni se usan en runtime. Antes de publicar, confirmar permiso de uso y distribución.

## Agregar más sprites

Coloca cada hoja de sprites en `public/assets/characters/` y agrega sus datos a `SPRITES` en `src/game/assets.ts`: especie, etapa, acción, dimensiones de cuadro y FPS. Si varias acciones comparten una hoja, indica `firstFrame` y `lastFrame`. Especies o etapas sin sprite siguen usando el marcador dibujado por Phaser. Los retratos opcionales usan `<slug>-portrait.png`; las especies están en `src/game/catalog.ts` y sus IDs persistidos (0–4) no deben cambiar.

Los fondos opcionales van en `public/assets/backgrounds/` y se configuran en `BACKGROUNDS`. Mantén los archivos ligeros y registra aquí su fuente y licencia. No distribuyas imágenes, música, modelos o fuentes sin confirmar que sus términos lo permiten.
