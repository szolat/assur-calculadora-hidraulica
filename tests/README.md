# Pruebas M9 autocontenidas

Requisitos declarados: Node.js 20 o posterior y npm. Las dependencias se instalan con el lockfile; la suite no necesita Git, `.git`, ramas remotas, historial completo ni acceso de red durante su ejecución.

```sh
npm ci --ignore-scripts
npm test
```

Ejecutar estos comandos desde la raíz del proyecto. Para iniciar las pruebas desde otro directorio, usar `npm --prefix "/ruta/al/proyecto" test`; los archivos se localizan respecto a `__dirname`, no al directorio de trabajo del proceso.

`npm ci` requiere acceso al registro npm o una caché con todos los paquetes. La ejecución posterior de la suite usa jsdom con recursos externos desactivados, Chart simulado y telemetría anulada; no comprueba el PDF real ni sustituye una prueba en navegador.

## Referencia histórica

La fixture `fixtures/m9-pr5-26ecc91.html.gz` conserva, sin cambios, el `index.html` del commit `26ecc91ef16f7bca9e625fff1425a2f1d89129a3`. Se versiona comprimida para mantener la comparación de las cuatro funciones base y las regresiones anteriores sin depender de la existencia de ese objeto Git en la máquina de pruebas.

El manifiesto JSON contiguo registra procedencia, tamaño y SHA-256 de los bytes descomprimidos. La suite verifica el hash antes de ejecutar el HTML histórico; no se debe sustituir la fixture por el HTML actual ni actualizar su hash para silenciar una regresión.

Para regenerar exactamente el archivo a partir de un checkout que sí incluya el commit histórico:

```sh
git show 26ecc91ef16f7bca9e625fff1425a2f1d89129a3:index.html | gzip -n > tests/fixtures/m9-pr5-26ecc91.html.gz
```

Ese comando es solo de mantenimiento: Git y gzip no son requisitos para correr las pruebas. Node descomprime la referencia con `node:zlib`.

## Portabilidad y alcance

`npm test` usa el descubrimiento nativo de `node --test`, sin un comodín que dependa de expansión por parte del shell. No se agregan scripts de shell ni rutas absolutas a la suite.

La validación del 12/11/2026 cubre Linux con Node 20.20.2: checkout habitual, exportación sin `.git`, ruta con espacios, instalación limpia desde el lockfile, ejecución sin Git en PATH y arranque desde otro directorio. No se afirma que se haya ejecutado en Windows, macOS ni en todas las versiones de Node admitidas; no se configura CI en este cambio.
