# Nota Técnica — M5 Perfil Hidráulico: Verificación de Velocidad Máxima

**Módulo:** M5 — Perfil Hidráulico del Colector  
**Tipo de cambio:** `feat` + `fix` — validación normativa  
**Rama:** `feature/m5-vmax-check`  
**Autor:** Sergio Zola Trasancos · ventas@assur.mx  
**Fecha:** 2026-07-07  
**Refs normativas:** SGAPDS-29 Sec. 3.1.2 · NMX-C-401-ONNCCE-2020 · ASTM C76 · NMX-E-215

---

## 1. Contexto y motivación

El módulo M5 ya implementa la verificación de **velocidad mínima** (v ≥ 0.60 m/s) para garantizar autolimpieza, conforme a SGAPDS-29 Sec. 3.1.2. Sin embargo, hasta este patch no existía ningún control sobre la **velocidad máxima**, condición que provoca erosión prematura del interior del tubo y falla estructural acelerada del sistema.

Las normas mexicanas y los manuales de diseño establecen límites diferenciados por material:

| Material | v\_máx (m/s) | Referencia normativa |
|---|---|---|
| Concreto reforzado (NMX-C-401 / NMX-C-402) | **5.0 m/s** | SGAPDS-29 Sec. 3.1.2 · ACI 318 comentarios |
| PVC liso / Novafort (NMX-E-215 / ISO 4435) | **3.0 m/s** | NMX-E-215 Sec. 8.4 · fabricante Amanco/Mexichem |
| PEAD corrugado PT Corr® (NMX-E-241) | **3.0 m/s** | NMX-E-241 Sec. 7 · CONAGUA MITD |

> **Justificación del límite 5.0 m/s para concreto:** El concreto reforzado Clase III–V (NMX-C-402) tolera velocidades más altas gracias a su resistencia superficial. La ACI 318 y SGAPDS-29 aceptan hasta 5.0 m/s en colectores de concreto en servicio continuo. Por encima de este valor se requiere revestimiento interior (polietileno, epoxi) o estudio de abrasión específico.  
>
> **Justificación del límite 3.0 m/s para PVC/PEAD:** Los termoplásticos presentan mayor susceptibilidad a la erosión abrasiva que el concreto. NMX-E-215 Sec. 8.4 fija 3.0 m/s como límite operacional permanente. Superar este umbral con material fino en suspensión produce erosión microestructural en < 5 años de vida útil.

---

## 2. Fórmula de velocidad aplicada

La velocidad a **sección llena** (condición más desfavorable para erosión) se calcula con Manning:

```
v = (1/n) · R^(2/3) · S_dis^(1/2)
```

donde:

| Variable | Descripción |
|---|---|
| `n` | Coeficiente de Manning del material seleccionado |
| `R = Di/4` | Radio hidráulico a sección llena (m) |
| `S_dis` | Pendiente de diseño aplicada (m/m) = máx(S_mín, S_ter) |

Esta es la misma expresión que ya utiliza `calcPerfil()` para mostrar la métrica "Velocidad a tubo lleno" en el panel de resultados.

**Nota:** La velocidad máxima de erosión ocurre a sección llena o ligeramente inferior (~94% del diámetro para Manning). Se usa sección llena como aproximación conservadora, consistente con el criterio aplicado en SGAPDS-29 y en M3 (Manning tubería).

---

## 3. Descripción del patch

### 3.1 Constante de límites por material (`V_MAX_TABLE`)

Se introduce un objeto de configuración que mapea el valor de `n` Manning al límite de velocidad máxima. Esto evita valores hardcoded dispersos en el código y facilita actualizaciones futuras.

```js
// Límites de velocidad máxima por material — SGAPDS-29 / NMX-E-215 / NMX-E-241
var V_MAX_TABLE = {
  0.009: { vmax: 3.0, label: 'PVC liso / Novafort',         ref: 'NMX-E-215 Sec.8.4'      },
  0.012: { vmax: 3.0, label: 'PEAD corrugado PT Corr®',     ref: 'NMX-E-241 Sec.7'         },
  0.013: { vmax: 5.0, label: 'Concreto reforzado NMX-C-402', ref: 'SGAPDS-29 Sec.3.1.2'    }
};
var V_MAX_DEFAULT = { vmax: 3.0, label: 'Material', ref: 'SGAPDS-29' };
```

### 3.2 Cambios en `calcPerfil()` — semáforo de resultado

Dentro del bloque `resMetricas` en `calcPerfil()` se añade:

1. **Cálculo del límite aplicable** según `n` del material seleccionado.
2. **Comparación** `velDis` vs `vmaxInfo.vmax`.
3. **Tarjeta de métrica** "V\_máx permitida" en el panel de indicadores.
4. **Bloque de alerta** debajo del semáforo si `velDis > vmaxInfo.vmax`, con color rojo y referencia normativa exacta.
5. **La alerta de exceso de velocidad NO bloquea el cálculo** — el perfil se genera igualmente para que el diseñador pueda evaluar opciones (reducir pendiente, aumentar DN, cambiar material).

### 3.3 Cambios en `validarSterRealtime()` — aviso preventivo en tiempo real

Antes de presionar "Generar Perfil", si la `S_ter` ingresada ya implica `v > v_máx` a sección llena, el aviso de tiempo real bajo el input lo comunica con estado `.error` diferenciado del estado de pendiente insuficiente. Esto permite al usuario ajustar parámetros sin necesidad de ejecutar el cálculo completo.

**Lógica de prioridad de avisos en `validarSterRealtime()`:**

```
S_ter < 0          → negativo (contraflujo)       [máxima prioridad]
S_ter = 0          → warn (plano)
S_ter > 0 y v>vmax → error_vmax (erosión)         [nueva condición]
S_ter < S_mín      → error (pendiente insuficiente)
S_ter ≈ S_mín      → warn (margen ajustado)
S_ter ≥ S_mín      → ok
```

---

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | Único archivo; CSS + JS + HTML inline |

**Líneas aproximadas afectadas** (base rama `main` commit `29754a0`):

| Sección | Descripción |
|---|---|
| CSS `<style>` | +0 líneas — los estilos `.pf-sval.error` ya cubren el nuevo caso |
| Antes de `function validarSterRealtime()` | +8 líneas — objeto `V_MAX_TABLE` |
| Dentro de `validarSterRealtime()` — rama `delta_pct >= 0` | +18 líneas — check `v > vmax` antes de rama `ok`/`warn` |
| Dentro de `calcPerfil()` — bloque `resMetricas.innerHTML` | +12 líneas — tarjeta v_máx + alerta condicional |

---

## 5. Casos de prueba

### Caso A — PVC DN200, S_ter = 2.0%
- Di = 182 mm (SDR-20), n = 0.009, R = 0.0455 m
- v = (1/0.009) · 0.0455^(2/3) · 0.02^(0.5) = **3.37 m/s > 3.0 m/s** ⚠️
- Esperado: alerta roja en tiempo real + bloque de error en resultado

### Caso B — Concreto DN600, S_ter = 1.0%  
- Di = 600 mm, n = 0.013, R = 0.15 m
- v = (1/0.013) · 0.15^(2/3) · 0.01^(0.5) = **2.88 m/s < 5.0 m/s** ✅
- Esperado: sin alerta de velocidad máxima

### Caso C — PVC DN110, S_ter = 5.0%
- Di = 99 mm (SDR-20), n = 0.009, R = 0.0248 m
- v = (1/0.009) · 0.0248^(2/3) · 0.05^(0.5) = **6.1 m/s >> 3.0 m/s** ❌
- Esperado: alerta en tiempo real Y en resultado, DN insuficiente para esa pendiente

### Caso D — Concreto DN1070, S_ter = 3.5%
- Di = 1070 mm, n = 0.013, R = 0.2675 m
- v ≈ (1/0.013) · 0.2675^(2/3) · 0.035^(0.5) = **7.1 m/s > 5.0 m/s** ❌
- Esperado: alerta — considerar disipadores de energía o trampa de lodos

---

## 6. Recomendaciones de diseño generadas por el sistema

Cuando `v > v_máx`, el aviso incluye sugerencias automáticas:

- **Aumentar DN** (reduce v para misma Q y S)
- **Reducir S\_dis** (si S\_ter lo permite sin violar v\_mín)
- **Cambiar material** a concreto si se usa PVC y la pendiente es estructuralmente necesaria
- **Consultar SGAPDS-29 Sec. 3.1.4** — disipadores de energía en pozos de caída

---

## 7. No-regresión

- M1–M4 y M6–M9: sin cambios.
- M3 (Manning tubería): ya calcula v\_máx con lógica independiente. M5 replica el mismo criterio normativo para coherencia entre módulos.
- `STATE.perfilData`: no se modifica la estructura — se añade `vmaxInfo` como campo opcional para uso futuro en el Reporte.

---

*Nota generada automáticamente por ASSUR Calculadora Hidráulica — sistema de auditoría técnica interna.*
