# Cómo trabajaremos en GitHub

## Ramas

- `main`: versión estable del proyecto; debe compilar.
- `codex/<tema>`: trabajo asistido en una tarea acotada, por ejemplo
  `codex/project-architecture` o `codex/product-sdk-host`.
- Una rama se crea desde `main`, se sube a GitHub y conserva sus commits. Al terminar una tarea se
  integra en `main` y se elimina solo la rama ya integrada cuando deje de ser útil.

## Commits

Cada commit representa un cambio entendible y pequeño. Ejemplos:

- `refactor: separate pet domain and view`
- `docs: explain Product SDK and deployment`
- `feat: connect Host account`
- `feat: add Tamagotchi contract`

Antes de cerrar una rama revisamos `git status`, el diff, `git diff --check` y el build o las
pruebas que correspondan a los archivos modificados. No se incluyen `node_modules`, `dist`, semillas,
llaves privadas ni archivos `.env`.

## Versiones de red y SDK

Antes de integrar una capability Polkadot se registra la red, Host/CLI y las versiones exactas de
paquetes en `package.json` y el lockfile. Un ejemplo del curso no se copia a ciegas si usa otra red,
VM o versión del SDK.
