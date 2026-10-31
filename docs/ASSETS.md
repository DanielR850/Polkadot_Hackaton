# Recursos audiovisuales

## Recursos recibidos

Los 12 JPEG llegaron en la rama `main`, dentro de `TomoDachi/`. Sus nombres sugieren que fueron generados con Gemini; el repositorio no incluye prompts, autoría verificable ni una licencia explícita. Antes de publicar el juego o redistribuir estos recursos, hay que confirmar que el equipo puede usarlos.

| Grupo | Cantidad | Archivos | Uso previsto |
|---|---:|---|---|
| Ajolote | 2 | `Animales/Ajolote/Gemini_Generated_Image_igz1z9igz1z9igz1.jpeg`; `Animales/Ajolote/Gemini_Generated_Image_l4henfl4henfl4he.jpeg` | Apariencia base y variante enmarcada |
| Ajolote comiendo | 3 | `Animales/Ajolote/Ajolote comiendo/Gemini_Generated_Image_fcvqqmfcvqqmfcvq.jpeg`; `.../Gemini_Generated_Image_jsluoojsluoojslu.jpeg`; `.../Gemini_Generated_Image_l838ial838ial838.jpeg` | Variantes visuales al alimentar |
| Ajolote con comida | 2 | `Animales/Ajolote/Con la comida/Gemini_Generated_Image_cqmsgcqmsgcqmsgc.jpeg`; `.../Gemini_Generated_Image_l73vycl73vycl73v.jpeg` | Variantes visuales al alimentar |
| Comida | 3 | `Comida_para_los_animales/Gemini_Generated_Image_4km5fr4km5fr4km5.jpeg`; `.../Gemini_Generated_Image_6r18my6r18my6r18.jpeg`; `.../Gemini_Generated_Image_l4yiqll4yiqll4yi.jpeg` | Objetos de comida para acciones o inventario |
| Bebidas | 2 | `bebidas/Gemini_Generated_Image_2a6vvq2a6vvq2a6v.jpeg`; `bebidas/Gemini_Generated_Image_ilufe8ilufe8iluf.jpeg` | Objetos de bebida para acciones o inventario |

Las rutas anteriores son relativas a `TomoDachi/`. Todos los archivos son JPEG; diez miden 2048×2048 y las dos bebidas miden 2400×1792 y 2752×1536. El conjunto ocupa aproximadamente 11.82 MB.

## Estado de integración

- Los 12 JPEG originales se conservan como material de referencia, pero el juego no los carga.
- Son imágenes completas, no spritesheets ni animaciones por cuadros. Las muestras del ajolote tienen un fondo blanco incrustado; mostrarlas sobre la escena actual puede dejar un rectángulo blanco.
- Para usarlas en Phaser hay que decidir una presentación compatible con ese fondo, adaptar tamaños para que el paquete web no cargue imágenes innecesariamente grandes y definir qué ilustración corresponde a cada estado del juego.
- La rama de interfaz `Guillermo-Interfaz` no aporta commits distintos del código inicial. No hay una segunda implementación de interfaz que conectar todavía.
- La integración de ramas mantiene los originales en `TomoDachi/`; no los convierte ni modifica.

## Licencia y procedencia

| Recurso | Fuente indicada por el nombre | Licencia | Cambios |
|---|---|---|---|
| 12 ilustraciones JPEG en `TomoDachi/` | Nombre de archivo `Gemini_Generated_Image_*`; falta confirmación del proceso exacto | Pendiente de confirmar antes de publicar | Ninguno |

No incluir imágenes, música, modelos o fuentes en una publicación hasta confirmar que su licencia permite ese uso y distribución.

## Animación del ajolote

`public/assets/pets/axolotl/animations.png` contiene 16 cuadros transparentes organizados en una hoja
de 4 columnas por 4 filas. Phaser los reproduce como cuatro animaciones: espera, feliz/juego, comida y
sueño. Los botones de cuidado cambian a la animación correspondiente y luego regresan al ciclo de
espera. Cada cuadro mide 356×276 px; el archivo completo mide 1424×1104 px y pesa unos 1.86 MB.

El personaje tiene un diseño de pixel art creado para el juego. La ilustración está en la hoja de
sprites; el código define cómo se reproducen sus cuadros y cómo responden a las acciones. Los JPEG
recibidos en `TomoDachi/` permanecen como referencias y no se cargan en la escena.

Confirmar los términos aplicables al arte generado antes de distribuir el juego.
