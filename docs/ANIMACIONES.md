# Mascotas y animaciones

Las cinco especies conservan el mismo ID en el juego local, el frontend NFT y
las dos fuentes Solidity preparadas para nuevos despliegues:

| ID | Especie | Bebé | Adolescente | Adulto |
|---:|---|:---:|:---:|:---:|
| 0 | Ajolote | ✓ | ✓ | ✓ |
| 1 | Lobo | ✓ | ✓ | ✓ |
| 2 | Oso grizzly | ✓ | ✓ | ✓ |
| 3 | Tlacuache | ✓ | ✓ | ✓ |
| 4 | Manatí | ✓ | ✓ | ✓ |

Cada etapa tiene una ilustración diferente. La escena `src/game/petScene.ts`
reproduce siete estados sobre el arte de la etapa actual: reposo, comer, jugar,
dormir, bañarse, tristeza y muerte. Usa movimiento, escala, inclinación y color;
el manatí flota, el oso se agacha y el tlacuache corre al jugar. La hoja del
ajolote bebé aporta además fotogramas dibujados para reposo, juego, comida y sueño.
Los otros estados y especies usan animación de código sobre su ilustración.

La animación y las imágenes viven en el frontend. El contrato guarda el ID de
especie, propietario, nivel y necesidades; calcula la etapa al consultar y no
guarda fotogramas. El Solidity de
esta rama admite IDs 0–4, pero el contrato EVM ya desplegado aún responde
`NUM_ESPECIES = 1`. El frontend EVM consulta ese valor y desactiva los NFT que
esa dirección todavía no puede crear. El Product PolkaVM admitirá los cinco
cuando se despliegue y se instale su dirección real en `cdm.json`.
