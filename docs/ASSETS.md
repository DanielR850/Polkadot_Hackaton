# Recursos audiovisuales

## Fuentes

| Archivo | Tipo | Autor/fuente | Licencia | Cambios |
|---|---|---|---|---|
| `public/assets/ui/fonts/PressStart2P-Regular.ttf` | Fuente (títulos y botones) | CodeMan38, vía Google Fonts | SIL OFL 1.1 (`PressStart2P-OFL.txt`) | Ninguno |
| `public/assets/ui/fonts/VT323-Regular.ttf` | Fuente (texto) | Peter Hull, vía Google Fonts | SIL OFL 1.1 (`VT323-OFL.txt`) | Ninguno |

## Animación del ajolote

`public/assets/pets/axolotl/animations.png` contiene 16 cuadros transparentes en una hoja de 4 columnas por 4 filas. Cada cuadro mide 356×276 px. `src/game/assets.ts` conecta los cuadros con las animaciones idle (0–3), juego (4–7), comer (8–11) y dormir (12–15).

La mascota cambia de ilustración en las etapas `teen` y `adult` usando `public/assets/pets/axolotl/teen.png` y `adult.png`. Son sprites estáticos transparentes de 1254×1254 px; sus acciones reutilizan la pose idle y la escena añade movimiento mediante tweens.

## Lobo, oso, tlacuache y manatí

Cada carpeta `public/assets/pets/{wolf,bear,opossum,manatee}/` contiene `idle.png` (bebé), `teen.png` y `adult.png`. Son ilustraciones transparentes de 1254×1254 px. Phaser usa el retrato de la edad actual y anima todos los estados mediante movimiento, escala, inclinación, color y filtros generados en runtime.

## Variantes y pixel art

Las variantes de color se generan sobre las ilustraciones originales en `src/game/variants.ts`. El filtro conserva la transparencia, sombras y rasgos de cada animal.

`src/game/sleepFace.ts` genera los ojos cerrados para las etapas que no tienen una hoja de sueño.

`src/game/wearables.ts` y `src/game/clothes.ts` generan sombreros y prendas como pixel art, sin PNG externos. `src/ui/pixelArt.ts` convierte los iconos de objetos, botones y acciones a la paleta pixel del juego. Por eso el bundle no incluye carpetas `public/assets/items/` ni `public/assets/ui/icons/`.

El modo visual `?pixel=1` aplica el filtro de pixel art real a los sprites.

`public/assets/pets/` contiene los sprites de las cinco especies. La interfaz no conserva material de referencia externo: todos los objetos e iconos se generan en runtime.

La versión web desplegada solo carga estos recursos desde `public/`:

- `public/app-logo.jpeg` para la pantalla de inicio y el favicon.
- `public/assets/pets/` para las mascotas y sus animaciones.
- `public/assets/ui/fonts/` para las fuentes locales.

El resto de la decoración, accesorios e iconos se dibuja en runtime para mantener el mismo estilo que `polkapets-v2` y conservar los `articleId` del contrato NFT actual.

## Especies y animaciones

Las cinco especies conservan el mismo ID en el juego local, el frontend NFT y el contrato:

| ID | Especie | Bebé | Adolescente | Adulto |
|---:|---|:---:|:---:|:---:|
| 0 | Ajolote | ✓ | ✓ | ✓ |
| 1 | Lobo | ✓ | ✓ | ✓ |
| 2 | Oso grizzly | ✓ | ✓ | ✓ |
| 3 | Tlacuache | ✓ | ✓ | ✓ |
| 4 | Manatí | ✓ | ✓ | ✓ |

La escena reproduce reposo, comer, jugar, dormir, baño, tristeza y muerte con tweens, variantes de color y filtros generados en runtime. El manatí flota, el oso se agacha y el tlacuache corre al jugar. El contrato guarda el ID de especie, propietario, nivel y necesidades, pero no guarda fotogramas. El contrato EVM desplegado responde `NUM_ESPECIES = 1`, así que el frontend usa el ajolote como especie NFT compatible cuando la dirección configurada no admite las demás.
