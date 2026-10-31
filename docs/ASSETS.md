# Recursos audiovisuales

| Archivo | Tipo | Autor/fuente | Licencia | Cambios |
|---|---|---|---|---|
| `public/assets/ui/fonts/PressStart2P-Regular.ttf` | Fuente (títulos y botones) | CodeMan38, vía [google/fonts](https://github.com/google/fonts/tree/main/ofl/pressstart2p) | SIL OFL 1.1 (`PressStart2P-OFL.txt`) | Ninguno |
| `public/assets/ui/fonts/VT323-Regular.ttf` | Fuente (texto) | Peter Hull, vía [google/fonts](https://github.com/google/fonts/tree/main/ofl/vt323) | SIL OFL 1.1 (`VT323-OFL.txt`) | Ninguno |

No incluir imágenes, música, modelos o fuentes sin confirmar que su licencia permite usarlos y distribuirlos.

## Cómo agregar los sprites de las mascotas

Mientras no haya sprites, el juego dibuja un marcador con formas. Para usar los tuyos:

1. Guarda cada spritesheet en `public/assets/characters/`, con los fotogramas en una fila horizontal.
   Nombre: `<mascota>-<etapa>-<animación>.png`, por ejemplo `axolotl-baby-idle.png`.
   - Mascotas (`slug`): `axolotl` (Ajolote), `wolf` (Lobo), `grizzly` (Oso grizzly),
     `opossum` (Tlacuache), `manatee` (Manatí).
   - Etapas: `baby`, `teen`, `adult`.
   - Animaciones: `idle`, `eat`, `play`, `sleep`, `bath`, `sad`, `dead`. Si falta una, se usa `idle`.
2. Agrega una línea por archivo en `SPRITES` de `src/game/assets.ts` con el tamaño del fotograma y los fps.
3. Retrato de la pantalla "Elige tu mascota": `public/assets/characters/<slug>-portrait.png`
   (cuadrado, pixel art; se amplía sin suavizado). Si falta, se ve un marcador de color.
   Los nombres y descripciones de las 5 mascotas están en `PETS` de `src/game/catalog.ts`.
   No cambies el `id` (0–4).
4. Fondos opcionales en `public/assets/backgrounds/`, configurados en `BACKGROUNDS` de `src/game/assets.ts`.

Mantén los archivos ligeros: todo el bundle se sube al publicar y cada MB alarga la subida.
