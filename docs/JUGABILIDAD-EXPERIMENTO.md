# Experimento de jugabilidad: atrapa la pelota

Rama: `codex/gameplay-experiment`. Este cambio afecta solo a la partida local y no modifica Solidity ni los NFT.

## Ciclo de juego

1. Observa las barras de felicidad, energía y sed.
2. Pulsa **Jugar** y atrapa hasta cinco pelotas en doce segundos.
3. Cada acierto da más felicidad; jugar también gasta energía, sed y algo de limpieza.
4. Decide si conviene jugar otra vez o atender primero otra necesidad.

Cerrar la ronda cancela sin aplicar el gasto. Si se acaba el tiempo, se aplican los aciertos conseguidos. La mascota puede morir por descuido igual que antes.

## Hipótesis para probar con personas

Una acción de diez a doce segundos, con resultado visible y costo comprensible, debería resultar más entretenida que pulsar **Jugar** una sola vez. Pide a alguien que no haya visto el cambio que juegue durante cinco minutos. Observa si entiende el objetivo sin explicación, si vuelve a jugar y si nota que la energía y la sed bajan. Si solo repite la ronda mecánicamente o ignora las demás necesidades, ajusta la duración, el movimiento o la recompensa antes de añadir más sistemas.

## Cómo verlo

Ejecuta `npm run dev` en la raíz. Crea una mascota local y pulsa **Jugar**. La versión anterior sigue en `codex/polkavm-product-wip` para comparar.
