# Seguridad y economía: qué decide la cadena y qué no

Con cartera (modos Pacífico y Competencia) la mascota es un NFT y **la cadena manda**. Sin cartera el
juego es local: no compite ni paga, y por eso nada de lo local se toma como verdad.

## Qué valida el contrato

| Tema | Cómo se protege |
|---|---|
| Vida y necesidades | Se calculan en `PolkaPets` con el tiempo del bloque. El juego las lee de la cadena (al abrir, cada 45 s y tras cada firma): editar `localStorage` se corrige solo. |
| Muerte y edad | La fecha de nacimiento y de muerte salen del contrato; la Competencia guarda la duración que calcula la cadena. |
| Sueño | `dormir` guarda desde cuándo duerme; la energía se recupera según lo dormido (400 s = toda) y se suma al despertar (`despertar` o el siguiente cuidado). La cadena sabe cuándo despertó (evento `Desperto`) y no se puede llenar la energía de golpe. |
| Logros | `reclamarLogro` revisa el tiempo vivido y los objetos comprados; se reclama una vez por mascota. Los pesitos del trofeo se acreditan ahí mismo. |
| Pesitos | Viven en `PolkaPetsItems.pesitos`. Nadie puede asignárselos: solo suben con `cobrarPesitos` o al reclamar un trofeo, y solo bajan al comprar. |
| Precios | Están en el contrato (`precio`); comprar cobra ese precio. Coinciden con la tienda (`npm run` → `checkCatalog.ts` lo comprueba). |
| Dueño | Cobrar, comprar, dormir y cuidar solo lo hace el dueño de una mascota viva. |
| Pagos | `PolkaPetsPagos` solo anota un pago a quien registró su wallet de cobro, una vez por semana y lugar, con el hash de la transacción. |

## El límite que sí existe: los minijuegos

Una cadena no puede ver si alguien jugó bien. Por eso **el cobro de pesitos tiene un cupo**: máximo 60 de
golpe y 10 por minuto (`CUPO_MAX`, `SEG_POR_PESITO`). Quien pida de más recibe solo lo que el cupo permite,
así que hacer trampa en un minijuego no rinde más que jugar sin parar. El Pac-Man de Brandon resuelve lo mismo
con un Worker que firma cada partida (EIP-712); si algún día se necesita más rigor, `cobrarPesitos` puede exigir
esa firma sin cambiar el resto.

## Lo que no protege la cadena

- Los controles de la interfaz (animaciones, decoración, qué tienes puesto) son locales.
- El modo sin cartera no tiene premios ni ranking.
- Quien administra el contrato (`owner`) puede pausar temporadas y anotar pagos: hay que guardar bien esa cuenta.
