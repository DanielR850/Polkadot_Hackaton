# Tamagotchi Polkadot

Juego web de mascota virtual. La primera versión será 2D y funcionará en navegador de escritorio y móvil. Más adelante podremos evaluar una habitación 3D o modo WebXR.

# Integrantes del proyecto
- Ana Lucia Alonso Martínez
- Daniel Reyna Burnes
- Santiago Ernesto Diaz Rodriguez
- Guillermo Daniel Bonilla Morales 

## Recursos visuales y audio

Los recursos del juego viven en `public/assets/` y se organizan por tipo:

- `characters/`: spritesheets, retratos y animaciones de la mascota.
- `backgrounds/`: habitación y fondos.
- `ui/`: iconos y elementos gráficos de la interfaz.
- `sfx/`: efectos de sonido.
- `music/`: música del juego.
- `models-3d/`: modelos `.glb` si añadimos una versión 3D.

Usa nombres descriptivos y minúsculas, por ejemplo `axolotl-idle.png` o `room-day.webp`. Guarda aquí solo recursos que podamos usar legalmente y registra su fuente/licencia en `docs/ASSETS.md`.

## Código previsto

- `src/game/`: reglas y escenas del juego.
- `src/ui/`: interfaz y menús.
- `src/polkadot/`: integración posterior con Host, wallet y contrato.
- `docs/`: especificaciones, decisiones y registro de recursos.

## Cómo viajaría una acción hasta el smart contract

Este diagrama muestra la arquitectura que implementaríamos para una acción que sí debe quedar
registrada en Polkadot. Las acciones normales del juego pueden quedarse en el estado local y no
pedir una firma.

```mermaid
sequenceDiagram
    actor Persona
    participant UI as Interfaz (botón)
    participant Juego as Reglas del juego
    participant Puente as Adaptador del contrato
    participant SDK as Product SDK
    participant Host as Polkadot Host
    participant App as Polkadot App (firma)
    participant Red as Red Polkadot
    participant Contrato as Smart contract

    Persona->>UI: Toca «Guardar logro»
    UI->>Juego: Solicita la acción
    Juego->>Juego: Comprueba que el logro sea válido
    Juego->>Puente: Pide registrar el logro
    Puente->>SDK: Prepara llamada con ABI y dirección
    SDK->>Host: Solicita la cuenta derivada de este Product
    Host-->>SDK: Devuelve la dirección pública (no la llave)
    SDK->>Host: Simula la llamada (query)
    Host->>Red: Consulta de prueba
    Red->>Contrato: Ejecuta sin guardar cambios
    Contrato-->>Red: Simulación: válida o error
    Red-->>Host: Devuelve el resultado de prueba
    Host-->>SDK: Devuelve el resultado
    SDK-->>Puente: Válida o error
    alt La simulación falla
        Puente-->>UI: Muestra el error; no solicita firma
    else La simulación pasa
        Puente->>SDK: Solicita enviar la transacción (tx)
        SDK->>Host: Pide permiso para firmar
        Host->>App: Muestra detalles de la firma
        Persona->>App: Aprueba o rechaza
        App-->>Host: Firma aprobada (nunca entrega la llave)
        Host->>Red: Envía la transacción firmada
        Red->>Contrato: Incluye y ejecuta la llamada
        Contrato->>Red: Comprueba reglas y actualiza estado
        Contrato-->>Red: Emite evento del logro
        Red-->>Host: Confirma inclusión/finalización
        Host-->>SDK: Devuelve el resultado
        SDK-->>Puente: Éxito o error
        Puente->>SDK: Vuelve a consultar el estado
        SDK->>Host: Lectura del contrato
        Host->>Red: Lee el estado confirmado
        Red-->>Host: Devuelve el nuevo estado
        Host-->>SDK: Devuelve el nuevo estado
        SDK-->>Puente: Devuelve el nuevo estado
        Puente-->>UI: Devuelve el nuevo estado
        UI-->>Persona: Actualiza pantalla y muestra resultado
    end
```

La explicación completa, incluyendo qué se compila, qué se despliega y qué partes aún son diseño,
está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Estado

Prototipo jugable local. La integración con el Host, la wallet y el contrato todavía no están creados.
El diagrama anterior es el diseño propuesto, no una función ya conectada.
