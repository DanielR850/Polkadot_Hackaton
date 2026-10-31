# Spec inicial: Tamagotchi Polkadot

## Objetivo
Crear un juego de mascota virtual atractivo y fácil de usar en web, tanto en celular como en computadora. Más adelante, explorar qué información merece persistirse en Polkadot mediante un contrato inteligente.

## Primera versión
- Mascota animada 2D en una habitación.
- Acciones de alimentar, jugar, limpiar y dormir.
- Indicadores comprensibles de hambre, energía, higiene y ánimo.
- Guardado local para que el juego funcione sin conectar una wallet.
- Interfaz adaptable a móvil y escritorio.

## Blockchain, fase posterior
- No pedir firmas para las acciones frecuentes del juego.
- Elegir explícitamente qué dato se guarda en cadena (por ejemplo, propiedad o logros verificables).
- Definir el contrato después del prototipo y revisar modelo de abuso, costo de gas y privacidad.

## Fuera de alcance por ahora
- Realidad virtual y 3D.
- Tokens, pagos y recompensas con valor monetario.
- Publicación de dominio `.dot`.

## Decisiones pendientes
- Especie, personalidad, nombre y estilo artístico de la mascota.
- Ritmo de deterioro de necesidades y modo de pausa/offline.
- Si se elige Phaser u otra librería para el prototipo.
- Qué aporta realmente el contrato al juego.
