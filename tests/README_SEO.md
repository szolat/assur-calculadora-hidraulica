# Pruebas SEO sin Git

Ejecutar con Node.js, sin instalar paquetes:

```sh
node --test tests/seo.test.cjs
```

Para ejecutar desde otro directorio, pasar la ruta absoluta al archivo de pruebas entre comillas si contiene espacios. Los archivos de la aplicación y de referencia se localizan respecto a `__dirname`, no al directorio de trabajo actual.

## Referencia estable

`fixtures/seo-main-65ff146.json` contiene huellas SHA-256 del `index.html` de la base revisada, commit `65ff146d20532a032944e33adb21e2b3ec900510`. Registra cada bloque script ejecutable, incluido su tag, en orden de aparición, excluyendo JSON-LD; también registra el cuerpo posterior a `<body>`, eliminando únicamente whitespace final mediante `trimEnd()`.

La suite conserva las verificaciones de aislamiento del cambio SEO y de metadatos, pero ya no ejecuta procesos Git ni consulta `origin/main`. Puede ejecutarse desde un ZIP o exportación sin `.git`, sin historial, sin Git en PATH y sin descargar una referencia de red.

La referencia original se conserva como evidencia histórica del cambio exclusivamente SEO.

El 12/11/2026 se revisa explícitamente el nuevo alcance: integración de #5/#9, #10 y #11, detalle PDF Sanitario M7, cobertura M1–M10, impresión y paginación. La suite activa usa `fixtures/seo-release-2026-11-12.json`, identificado por esa revisión y por la base de procedencia, no como si fuera el commit del HTML original. Las regresiones M9, LRFD y reportes validan el comportamiento combinado. No se actualizan las huellas automáticamente en CI ni se elimina la referencia anterior.

Modificaciones intencionales posteriores a scripts o body exigen revisar el diff y actualizar explícitamente las huellas; no debe hacerse solo para silenciar una falla.

## Alcance

Validación realizada el 12/11/2026 en Linux con Node 20.20.2, incluyendo ruta con espacios y directorio de trabajo externo. No se requiere npm, dependencias ni navegador para esta suite; no sustituye un validador semántico externo o la revisión del DOM de producción.
