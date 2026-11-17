# Qué es el Product SDK de Polkadot

## En una frase

Un **SDK** (*Software Development Kit*) es un conjunto de herramientas y librerías para que una
aplicación use una plataforma sin tener que implementar todos sus protocolos a mano.

El **Polkadot Product SDK** es el kit TypeScript para Products `.dot`. El juego pide capacidades al
Host usando llamadas del SDK. El Host controla el acceso a cuentas, firmas, cadena y almacenamiento;
el SDK no contiene la llave privada ni reemplaza al smart contract. [Documentación oficial del
Product SDK](https://docs.polkadot.com/apps/product-sdk/)

## Analogía

Imagina que el juego es una persona dentro de un edificio seguro:

- El **Product** es la persona que pide hacer algo.
- El **SDK** es el teléfono y los formularios con los que presenta la petición.
- El **Host** es la recepción que comprueba permisos y lleva la solicitud al lugar correcto.
- La **Polkadot App** presenta la firma para que la persona apruebe con la llave que permanece en
  su teléfono.
- El **smart contract** es el reglamento compartido que la red ejecuta.

El SDK no hace que una operación sea gratuita ni automática. Para cambiar estado en cadena se
necesita una transacción y la persona debe autorizar la firma; también aplican las reglas de gas y
permisos del entorno elegido.

## Capacidades que probablemente usaríamos

La documentación organiza las capacidades en paquetes. Los nombres actuales incluyen:

| Necesidad del Tamagotchi | Paquete/capacidad | Uso previsto |
|---|---|---|
| Identidad del Product y firma | `@parity/product-sdk-signer` | Obtener la cuenta derivada del Product y solicitar firmas al Host. |
| Leer datos de cadena | `@parity/product-sdk-chain-client` | Consultar información on-chain mediante el Host. |
| Llamar smart contracts | `@parity/product-sdk-contracts` | Consultar y escribir en contratos compatibles del entorno documentado. |
| Guardar preferencias por Product/dispositivo | `@parity/product-sdk-local-storage` | Reemplazar el guardado directo en `localStorage` dentro del Host. |
| Paquete agrupador | `@parity/product-sdk` | Reexporta varias capacidades si preferimos una sola dependencia. |

No instalamos estos paquetes en el prototipo todavía. Primero fijaremos la red del hackatón y
compararemos sus versiones con el SDK que esa red y el Host soportan. La guía oficial evoluciona y
ahora describe Contracts para `pallet-revive` en Asset Hub; el repo del taller trae versiones y
configuración propias. Hay que seguir un solo conjunto compatible y no mezclar ejemplos antiguos y
nuevos. [SDK y capacidades](https://docs.polkadot.com/apps/product-sdk/) · [Contratos desde un
Product](https://docs.polkadot.com/apps/product-sdk/contracts/)

## Lo que confirma la documentación vigente

- El Product es una aplicación web de una sola página que se carga dentro de un Host. No guarda las
  llaves, no elige un RPC ni habla directamente con la cadena: el Host media esas capacidades.
- Podemos usar el paquete agrupador `@parity/product-sdk` o instalar solo paquetes por capacidad. La
  guía de Polkadot favorece los paquetes individuales en sus ejemplos de construcción; elegiremos
  según las capacidades reales para evitar dependencias innecesarias.
- `createFakeApp` sirve para probar wallet y almacenamiento local. No trae un cliente de cadena falso
  por defecto; la lectura de cadena requiere una interfaz nuestra y pruebas específicas de integración.
- La página actual de Contracts cubre contratos `pallet-revive` en Asset Hub. El cliente toma la
  dirección y ABI desde `cdm.json`; las lecturas `query` entregan `success`, las escrituras `tx`
  requieren firma, y una cuenta nueva debe mapearse a H160 antes de enviar.
- Por eso aún no agrego dependencias ni código de contrato: primero hay que confirmar si el proyecto
  seguirá el devnet del taller o el flujo actual del Product SDK. Los dos ejemplos pueden usar
  herramientas, manifiestos y redes diferentes.

## Cómo entra en el Tamagotchi

```text
Botón «Guardar logro»
    → controlador del juego
    → interfaz TamagotchiGateway (nuestra frontera)
    → implementación usando Product SDK
    → Host (permisos, firma, acceso a cadena)
    → smart contract
```

El controlador dependerá de una interfaz propia, no directamente del SDK. Así las reglas del juego
pueden seguir funcionando en el navegador normal y se pueden probar con un adaptador falso. El
adaptador real del Product SDK se agrega cuando el juego corre en un Host compatible.

## Desarrollo y pruebas

- `npm run dev` sirve el prototipo web normal para trabajar en la mascota y la interfaz.
- Fuera del Host no se debe suponer que el SDK puede firmar o consultar una cadena real.
- Para probar la lógica del Product sin teléfono, el SDK ofrece un Host falso (`createFakeApp` y
  fakes de capacidades). Esos fakes verifican nuestra lógica y estados de UI; no demuestran que la
  conexión real a la red funcione.
- La integración real se valida abriendo el servidor de desarrollo dentro de Polkadot Desktop o el
  Host del hackatón y completando una lectura y una firma de prueba.

La documentación oficial indica que las operaciones del SDK pasan por el Host y que sus fakes son
para pruebas; una integración real requiere un Host compatible. [SDK: pruebas fuera del Host](https://docs.polkadot.com/apps/product-sdk/)

## Orden de aprendizaje que seguiremos

1. Detectar si el juego está dentro de un Host.
2. Leer el estado de la cuenta derivada del Product, sin pedir una firma.
3. Sustituir el almacenamiento local mediante un adaptador, si hace falta.
4. Leer el estado del contrato.
5. Simular una escritura y explicar el resultado antes de pedir firma.
6. Solicitar una firma de prueba y mostrar progreso, rechazo y errores.
7. Releer la cadena y actualizar el juego solo al confirmar el resultado.
