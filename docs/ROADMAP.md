# Hoja de ruta del proyecto

Las fases se hacen en orden porque cada una aclara decisiones que la siguiente necesita.

## 0. Orden y base del proyecto — en esta rama

- Separar reglas del juego, interfaz, Phaser, persistencia y arranque.
- Definir una carpeta reservada para la integración Polkadot y otra para el proyecto Solidity.
- Documentar SDK, despliegue y decisiones de arquitectura.
- Mantener el prototipo jugable mientras añadimos capas.

**Listo cuando:** el proyecto compila y la separación se entiende leyendo README y los documentos.

## 1. Juego local y estilo retro

- Definir criatura, paleta, resolución base y tamaño de píxel.
- Crear/importar recursos con licencias registradas en `docs/ASSETS.md`.
- Probar alimentación, juego, limpieza, sueño, deterioro del tiempo y guardado local.
- Decidir qué sucede si la app se cierra durante días.

**Listo cuando:** se puede jugar sin Host ni wallet en escritorio y móvil.

## 2. Aprender e integrar el Product SDK

- Confirmar red de la hackatón, Host compatible, CLI, versiones del SDK y runtime del contrato.
- Probar primero una lectura simple y la identidad derivada del Product.
- Implementar adaptadores bajo `src/polkadot/`; dejar `domain/` sin dependencias Polkadot.
- Probar lógica con fakes y hacer una prueba real dentro del Host.

**Listo cuando:** sabemos explicar qué permiso solicita cada capacidad y la lectura funciona dentro del Host.

## 3. Especificar y construir el contrato

- Cerrar `contracts/tamagotchi/SPEC.md`: propietario, creación, acciones verificables y costo.
- Elegir toolchain según la red/VM del taller; escribir Solidity y pruebas independientes.
- Compilar para obtener ABI/artefactos y desplegar solo en el devnet acordado.
- Guardar dirección y versión de la ABI en configuración pública, nunca una llave privada.

**Listo cuando:** pruebas cubren casos válidos, límites, duplicados, permisos y errores.

## 4. Conectar juego y contrato

- Conectar interfaz → controlador → adaptador → SDK → Host → contrato.
- Simular antes de pedir firma, mostrar estados reales y manejar rechazo, falta de gas y demoras.
- Releer el estado confirmado antes de decir que una acción quedó guardada.
- Evitar escrituras en cadena para cada animación o actualización de necesidad.

**Listo cuando:** se puede completar una sola acción blockchain entendiendo cada pantalla y firma.

## 5. Publicar y mantener el Product

- Elegir el entorno y nombre (`.paseo` en el testnet que usan las guías actuales, u otro sufijo si
  el taller trabaja en otra red).
- Crear build, revisar permisos, subir bundle y enlazar su CID al nombre.
- Abrir el dominio desde el Host y probar assets, SDK y contrato.
- Registrar cómo se publica una versión nueva y cómo renovar el bundle si la red lo requiere.

**Listo cuando:** una persona puede encontrar el dominio, abrir el juego y completar la acción
elegida sin pasos secretos del desarrollador.

## Cuando aparezca una nueva arquitectura o versión del SDK

No cambiamos el proyecto solo porque haya una versión nueva. Primero anotamos en un ADR qué problema
resuelve, compatibilidad con la red/Host, costo de migración, evidencia oficial y plan para volver
atrás. Después se prueba en rama propia y se actualizan versiones de forma explícita.
