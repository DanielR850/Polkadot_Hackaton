# Publicar el juego bajo un dominio Polkadot

> Todavía no se ha desplegado el Tamagotchi ni se ha reservado un dominio. Este documento describe
> el recorrido; antes de publicar elegiremos explícitamente la red y el nombre.

## Qué se publica

Se compila la aplicación web a una carpeta estática (`dist/`) con HTML, JavaScript, CSS e imágenes.
El flujo de publicación del ecosistema carga ese bundle en Bulletin y vincula su CID al nombre de
dotNS. El Host resuelve el nombre, obtiene el contenido y abre el Product. El dominio y el bundle
son recursos distintos: el nombre apunta a una versión del contenido.

```text
Código fuente → build estático → bundle/CID en Bulletin
                           └── nombre dotNS → CID
                                      └── Host abre y ejecuta el Product
```

## Etapas

1. **Preparar:** el juego funciona dentro del Host, tiene permisos manifiestos adecuados y usa el
   SDK y el contrato de la red seleccionada.
2. **Build:** el comando de compilación genera `dist/`. No se publica `node_modules`, las llaves ni
   los archivos de desarrollo.
3. **Registrar el nombre:** se reserva el nombre en dotNS si todavía no se tiene.
4. **Publicar el bundle:** la herramienta sube los archivos a Bulletin y produce un CID de
   contenido.
5. **Vincular nombre y CID:** dotNS hace que el dominio resuelva a esa versión.
6. **Abrir y verificar:** se prueba en Polkadot Desktop/App y, cuando exista, en la puerta web del
   entorno. Se comprueba la mascota, assets, SDK, contrato y permisos.
7. **Actualizar:** se crea otro build y se actualiza el CID al publicar la nueva versión.

Las guías oficiales actuales describen `playground build`/`playground deploy` y un TestNet Paseo
Next v2 cuyos nombres terminan en `.paseo`; el sufijo depende de la red. El repo del bootcamp usa
otra configuración (`pad` y `--env devnet`). Por tanto, no vamos a copiar comandos de publicación
sin verificar primero qué red y CLI utilizará el hackatón. [Guía oficial de despliegue](https://docs.polkadot.com/apps/deploy-your-app/) · [Nombres y actualización del bundle](https://docs.polkadot.com/apps/register-dot-domain/)

## Qué hace falta antes de ejecutar el despliegue

- Elegir si seguiremos el devnet del taller o el flujo oficial actual.
- Confirmar el sufijo disponible (`.dot` o `.paseo`) y el nombre deseado.
- Verificar autorización de almacenamiento y cuenta de despliegue en esa red.
- Confirmar el destino del contrato y su dirección/ABI/manifest, si el juego ya lo utiliza.
- Revisar el bundle y los permisos antes de firmar.

Por ahora solo tenemos el servidor de desarrollo local. La publicación en Bulletin o el registro del
dominio aún no se ha ejecutado.
