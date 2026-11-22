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

Cada carpeta `public/assets/pets/{wolf,bear,opossum,manatee}/` contiene `idle.png` (bebé), `teen.png` y `adult.png`. Son ilustraciones transparentes de 1254×1254 px generadas con ImageGen para esta versión. La pantalla de selección muestra el bebé. Phaser usa el retrato de la edad actual y anima todos los estados: reposo, comer, jugar, dormir, baño, tristeza y muerte. El juego aplica movimiento, escala, inclinación y color mediante código; las especies nuevas todavía no tienen hojas de fotogramas dibujados para cada acción.

## Agregar más sprites

Coloca cada hoja de sprites en `public/assets/pets/<slug>/` y agrega sus datos a `SPRITES` en `src/game/assets.ts`: especie, etapa, acción, dimensiones de cuadro y FPS. Si varias acciones comparten una hoja, indica `firstFrame` y `lastFrame`. Especies o etapas sin sprite siguen usando el marcador dibujado por Phaser. La selección comparte los archivos de la escena; las especies están en `src/game/catalog.ts` y sus IDs persistidos (0–4) no deben cambiar.

Los fondos opcionales van en `public/assets/backgrounds/` y se configuran en `BACKGROUNDS`. Mantén los archivos ligeros y registra aquí su fuente y licencia. No distribuyas imágenes, música, modelos o fuentes sin confirmar que sus términos lo permiten.

## Variantes y pixel art

Las variantes de color se generan sobre las ilustraciones originales en `src/game/variants.ts`. El filtro conserva la transparencia, sombras y rasgos de cada animal. `src/game/sleepFace.ts` genera los ojos cerrados (dormir y parpadear) para las etapas que no tienen una hoja de sueño.

`src/game/wearables.ts` y `src/game/clothes.ts` generan sombreros y ropa como pixel art, sin PNG externos. `src/ui/pixelArt.ts` convierte los íconos de objetos, botones y acciones a la paleta del juego, así que el bundle no necesita `public/assets/items/` ni `public/assets/ui/icons/`. La opción del Menú "Dibujo: Pixel real" aplica el filtro de pixel art a los sprites.

## Recursos necesarios para el bundle

La versión web solo carga desde `public/`: `app-logo.jpeg` (inicio y favicon), `assets/pets/` (mascotas y animaciones) y `assets/ui/fonts/` (fuentes). La decoración, los accesorios y los íconos se dibujan en runtime y conservan los `articleId` del contrato NFT.

## Especies y animaciones

Las cinco especies conservan el mismo ID en el juego local, el frontend NFT y el contrato:

| ID | Especie | Bebé | Adolescente | Adulto |
|---:|---|:---:|:---:|:---:|
| 0 | Ajolote | ✓ | ✓ | ✓ |
| 1 | Lobo | ✓ | ✓ | ✓ |
| 2 | Oso grizzly | ✓ | ✓ | ✓ |
| 3 | Tlacuache | ✓ | ✓ | ✓ |
| 4 | Manatí | ✓ | ✓ | ✓ |

El contrato guarda el ID de especie, propietario, nivel y necesidades, pero no guarda fotogramas.
