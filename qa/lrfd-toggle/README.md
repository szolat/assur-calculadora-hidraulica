# Regresión del checkbox LRFD

Pruebas de Chromium con clic y teclado reales sobre el HTML de la aplicación, sin servidor ni despliegue. El paquete está aislado para no introducir dependencias de navegador en la suite M9 del PR #9.

Desde la raíz del repositorio, con Node >=20 y npm:

```sh
npm --prefix qa/lrfd-toggle ci --ignore-scripts
npm --prefix qa/lrfd-toggle exec -- playwright install chromium
npm --prefix qa/lrfd-toggle test
```

También se puede entrar en `qa/lrfd-toggle` y ejecutar `npm ci --ignore-scripts`, `npx playwright install chromium` y `npm test`. La instalación necesita registro npm, descarga del navegador y las dependencias de sistema de Chromium; en Linux puede ser necesario instalar estas últimas con el procedimiento oficial de Playwright.

La suite no necesita Git, historial, un servidor local, acceso a producción ni credenciales. Durante cada prueba se sirve una fixture desde el HTML local, se omiten scripts CDN, se simula Chart y se desactiva la telemetría; el resto de las solicitudes se bloquea. No se prueba Chart, PDF ni los servicios externos.

Se comprueban el nombre accesible, el estado inicial, la activación/desactivación por clic directo, Espacio y cabecera, una secuencia mixta y un único recálculo por interacción. La configuración no reintenta fallos, y conserva trazas y capturas únicamente cuando hay un fallo.

Para comprobar que detecta el bug anterior, `ASSUR_QA_HTML` permite usar otro archivo HTML local. No permite navegar a producción ni habilitar tráfico externo; la regresión debe fallar al retirar `event.stopPropagation()` del checkbox.

Esta suite usa un archivo `.spec.cjs` y paquete propios; no se incorpora implícitamente al descubrimiento `node --test` de M9. Ejecutar ambos comandos cuando se quiera cubrir ambas suites, y no interpretar un resultado M9 como si incluyera esta prueba de navegador.
