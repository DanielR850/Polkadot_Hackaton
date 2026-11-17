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

## Recursos recibidos en `TomoDachi/`

Las ilustraciones JPEG se conservan como referencias del equipo. Incluyen imágenes del ajolote, acciones de comer, beber, jugar y dormir, además de imágenes de comida y bebidas. Los nombres sugieren generación con Gemini, pero el repositorio no registra autoría verificable, prompts ni licencia. No son spritesheets y actualmente la interfaz no las carga.

La rama `main` añadió cinco JPEG de acciones (beber, jugar y dormir) a los originales. Se mantienen en sus carpetas de origen; aún no se convierten a sprites ni se usan en runtime. Antes de publicar, confirmar permiso de uso y distribución.

## Agregar más sprites

Coloca cada hoja de sprites en `public/assets/pets/<slug>/` y agrega sus datos a `SPRITES` en `src/game/assets.ts`: especie, etapa, acción, dimensiones de cuadro y FPS. Si varias acciones comparten una hoja, indica `firstFrame` y `lastFrame`. Especies o etapas sin sprite siguen usando el marcador dibujado por Phaser. La selección comparte los archivos de la escena; las especies están en `src/game/catalog.ts` y sus IDs persistidos (0–4) no deben cambiar.

Los fondos opcionales van en `public/assets/backgrounds/` y se configuran en `BACKGROUNDS`. Mantén los archivos ligeros y registra aquí su fuente y licencia. No distribuyas imágenes, música, modelos o fuentes sin confirmar que sus términos lo permiten.

## Objetos de la tienda e iconos (pixel art)

Cada objeto de `SHOP_CATALOG` (`src/game/shop.ts`) apunta a un PNG con su campo `image`, relativo a `public/assets/`:

| Carpeta | Contenido | Tamaño del dibujo | Cómo se usa |
|---|---|---|---|
| `items/accessories/` | Accesorios | 24×24 px | Sobre la cabeza de la mascota, a ×2 |
| `items/walls/` | Paredes | 16×16 px | Azulejo que se repite en la pared, a ×2.5 |
| `items/floors/` | Pisos | 16×16 px | Azulejo que se repite en el piso, a ×2.5 |
| `items/furniture/` | Muebles | 32×32 px | En el piso, apoyados en la orilla de abajo, a ×2.5 |
| `items/decor/` | Adornos | 24×24 px | Colgados en la pared, a ×2.5 |
| `ui/icons/` | Botones Tienda, Accesorios, Mi espacio y Trofeos | 16×16 px | En la pantalla de juego |

Para cambiar cómo se ve un objeto, reemplaza su PNG por otro con el mismo nombre, o cambia la ruta en `shop.ts`. Usa fondo transparente y dibuja a tamaño real, sin suavizado: el juego amplía los píxeles sin difuminarlos. Si un archivo falta o no carga, se ve el emoji `icon` del objeto. Para paredes y pisos se ve el color `color`.

`tools/pixel-art/generate.mjs` dibuja los PNG originales con código (autoría propia del proyecto, misma licencia que el repositorio). `node tools/pixel-art/generate.mjs` crea solo los que faltan y no toca los que ya reemplazaste. Con `--force` los vuelve a crear todos. `node tools/pixel-art/preview.mjs` guarda una hoja ampliada de todo el arte para revisarla.

Un objeto nuevo necesita su PNG, su entrada en `SHOP_CATALOG` con un `articleId` nuevo, y la misma entrada en el constructor y en `_visualArticulo` de `contrato/contracts/PolkaPetsItems.sol`. Sin eso no se puede comprar en modo NFT.
