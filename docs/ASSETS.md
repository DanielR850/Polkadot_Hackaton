# Recursos audiovisuales

## Fuentes

| Archivo | Tipo | Autor/fuente | Licencia | Cambios |
|---|---|---|---|---|
| `public/assets/ui/fonts/PressStart2P-Regular.ttf` | Fuente (títulos y botones) | CodeMan38, vía Google Fonts | SIL OFL 1.1 (`PressStart2P-OFL.txt`) | Ninguno |
| `public/assets/ui/fonts/VT323-Regular.ttf` | Fuente (texto) | Peter Hull, vía Google Fonts | SIL OFL 1.1 (`VT323-OFL.txt`) | Ninguno |

## Animación del ajolote

`public/assets/pets/axolotl/animations.png` contiene 16 cuadros transparentes en una hoja de 4 columnas por 4 filas. Cada cuadro mide 356×276 px. `src/game/assets.ts` conecta los cuadros con las animaciones idle (0–3), juego (4–7), comer (8–11) y dormir (12–15).

La mascota cambia de ilustración en las etapas `teen` y `adult` usando `public/assets/pets/axolotl/teen.png` y `adult.png`. Son sprites estáticos transparentes de 1254×1254 px; sus acciones reutilizan la pose idle y la escena añade movimiento mediante tweens. Ambas ilustraciones se generaron con ImageGen usando la hoja del bebé como referencia de identidad y estilo.

## Lobo, oso, tlacuache y manatí

`public/assets/pets/{wolf,bear,opossum,manatee}/idle.png` contiene cuatro personajes transparentes de 1254×1254 px generados con ImageGen para esta versión. La pantalla de selección muestra esos retratos. Phaser los mueve de manera distinta según el estado: respiración, salto al jugar, inclinación al comer, sueño, baño, tristeza y muerte. También se escala el personaje al pasar de bebé a adolescente y adulto; todavía no hay una ilustración nueva para cada etapa de estas cuatro especies.

## Recursos recibidos en `TomoDachi/`

Las ilustraciones JPEG se conservan como referencias del equipo. Incluyen imágenes del ajolote, acciones de comer, beber, jugar y dormir, además de imágenes de comida y bebidas. Los nombres sugieren generación con Gemini, pero el repositorio no registra autoría verificable, prompts ni licencia. No son spritesheets y actualmente la interfaz no las carga.

La rama `main` añadió cinco JPEG de acciones (beber, jugar y dormir) a los originales. Se mantienen en sus carpetas de origen; aún no se convierten a sprites ni se usan en runtime. Antes de publicar, confirmar permiso de uso y distribución.

## Agregar más sprites

Coloca cada hoja de sprites en `public/assets/pets/<slug>/` y agrega sus datos a `SPRITES` en `src/game/assets.ts`: especie, etapa, acción, dimensiones de cuadro y FPS. Si varias acciones comparten una hoja, indica `firstFrame` y `lastFrame`. Especies o etapas sin sprite siguen usando el marcador dibujado por Phaser. La selección comparte los archivos de la escena; las especies están en `src/game/catalog.ts` y sus IDs persistidos (0–4) no deben cambiar.

Los fondos opcionales van en `public/assets/backgrounds/` y se configuran en `BACKGROUNDS`. Mantén los archivos ligeros y registra aquí su fuente y licencia. No distribuyas imágenes, música, modelos o fuentes sin confirmar que sus términos lo permiten.
