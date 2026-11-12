# Regresión del checkbox LRFD

## Reportes M1–M10, impresión y PDF (12/11/2026)

La suite incluye `reportes.spec.cjs`: cada módulo calculado mediante controles reales, los diez juntos, cobertura sin cálculos, falta del motor PDF, Ctrl+P y botón de impresión. Usa las mismas versiones Chart.js 4.4.1 y jsPDF 2.5.1 que la aplicación, instaladas solo como dependencias de desarrollo. Las bibliotecas se sirven desde el lockfile durante las pruebas; no se sustituyen por un PDF simulado.

El exportador real produce bytes PDF en memoria. La prueba conjunta verifica valores contra `STATE`, encabezados M1–M10, ausencia de `undefined`/`NaN`/`Infinity`, límites de texto A4 y números de página; guarda PDF descargable y PDF de impresión en `test-results` (ignorado por Git). Se bloquean las conexiones externas y se anula el registro de solicitantes: no se envían datos QA a Google Sheets ni a terceros.

La validación de impresión es virtual (Chromium/A4), no una prueba de impresora física. No constituye auditoría normativa integral ni cobertura completa de combinaciones de entrada, Firefox o WebKit.

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
