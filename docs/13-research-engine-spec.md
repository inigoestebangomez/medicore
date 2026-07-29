# 13-research-engine-spec.md
## MediCore — Motor de Investigación Clínica

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `12-import-research-spec.md` aprobado
> **Contexto:** Este documento nace del análisis de publicaciones reales en revistas
> ORL de primer nivel (Laryngoscope, Clinical Otolaryngology, Otolaryngology Head &
> Neck Surgery) y del patrón estadístico universal de la investigación clínica quirúrgica.
> El objetivo es que el médico nunca más abra Excel para investigar.

---

## Índice

1. [Qué necesita realmente un médico para publicar](#1-qué-necesita-realmente-un-médico-para-publicar)
2. [Arquitectura del Motor](#2-arquitectura-del-motor)
3. [Módulo 1 — Constructor de Cohortes](#3-módulo-1--constructor-de-cohortes)
4. [Módulo 2 — Estadística Descriptiva (Tabla 1)](#4-módulo-2--estadística-descriptiva-tabla-1)
5. [Módulo 3 — Estadística Analítica](#5-módulo-3--estadística-analítica)
6. [Módulo 4 — Visualizaciones y Gráficas](#6-módulo-4--visualizaciones-y-gráficas)
7. [Módulo 5 — Análisis de Supervivencia](#7-módulo-5--análisis-de-supervivencia)
8. [Módulo 6 — Comparación de Grupos](#8-módulo-6--comparación-de-grupos)
9. [Módulo 7 — Export para Publicación](#9-módulo-7--export-para-publicación)
10. [Módulo 8 — Consultas Guardadas y Cohortes Vivas](#10-módulo-8--consultas-guardadas-y-cohortes-vivas)
11. [Schema de Datos del Motor](#11-schema-de-datos-del-motor)
12. [Backend — Cálculos Estadísticos](#12-backend--cálculos-estadísticos)
13. [Frontend — UX del Motor de Investigación](#13-frontend--ux-del-motor-de-investigación)
14. [Reglas de Negocio](#14-reglas-de-negocio)
15. [Roadmap de Implementación](#15-roadmap-de-implementación)

---

## 1. Qué necesita realmente un médico para publicar

Después de analizar el patrón estadístico de decenas de publicaciones quirúrgicas ORL, la estructura es siempre la misma. No varía entre revistas. El médico necesita producir exactamente esto:

### La Tabla 1 — Características de la muestra

Es la tabla universal de toda publicación clínica. Aparece en el 100% de los estudios. Describe quiénes son los pacientes del estudio.

```
Tabla 1. Características basales de los pacientes (N=47)

Variable                          Total (N=47)        Grupo A (n=23)    Grupo B (n=24)    p
──────────────────────────────────────────────────────────────────────────────────────────────
Edad (años), media ± DE           48.3 ± 12.7         46.1 ± 11.2       50.4 ± 13.9       0.221
Sexo masculino, n (%)             28 (59.6%)          14 (60.9%)        14 (58.3%)         0.853
IMC (kg/m²), mediana (RIQ)        26.4 (23.1–29.8)   25.9 (22.7–29.1)  26.9 (23.5–30.4)  0.412
ASA I/II, n (%)                   39 (83.0%)          20 (87.0%)        19 (79.2%)         0.463
Tiempo quirúrgico (min), media ± DE  94.2 ± 23.1     88.6 ± 19.4       99.7 ± 25.6       0.073
Complicaciones, n (%)              6 (12.8%)           2 (8.7%)          4 (16.7%)          0.421
──────────────────────────────────────────────────────────────────────────────────────────────
DE: desviación estándar. RIQ: rango intercuartílico. p: prueba t de Student o χ².
```

### Las tablas de resultados

Comparaciones pre/post, entre grupos, correlaciones. Con p-values y tamaños del efecto.

### Las gráficas

Barras, líneas de evolución temporal, box plots, curvas de Kaplan-Meier para supervivencia/recurrencia, scatter plots de correlación, forest plots de regresión.

### Los tests estadísticos correctos

El médico no tiene que elegir el test — el sistema lo elige automáticamente según el tipo de variable y la distribución de los datos. Eso es lo que hacen SPSS y GraphPad Prism. MediCore lo hace igual, pero integrado con los datos clínicos reales.

---

## 2. Arquitectura del Motor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MOTOR DE INVESTIGACIÓN MEDICORE                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  MÓDULO 1 — CONSTRUCTOR DE COHORTES                                 │    │
│  │  "¿Sobre qué pacientes quiero investigar?"                          │    │
│  │  Filtros visuales sobre TODOS los datos disponibles                 │    │
│  └───────────────────────────┬─────────────────────────────────────────┘    │
│                              │ N pacientes seleccionados                    │
│  ┌───────────────────────────▼─────────────────────────────────────────┐    │
│  │  MÓDULO 2 — TABLA 1 AUTOMÁTICA                                      │    │
│  │  "¿Cómo son mis pacientes?"                                         │    │
│  │  Estadística descriptiva completa lista para publicar               │    │
│  └───────────────────────────┬─────────────────────────────────────────┘    │
│                              │                                              │
│         ┌────────────────────┼─────────────────────────────────┐            │
│         │                   │                                  │            │
│  ┌──────▼──────┐    ┌───────▼────────┐    ┌───────────────────▼──────┐     │
│  │  MÓDULO 3   │    │   MÓDULO 5     │    │       MÓDULO 6           │     │
│  │ Estadística │    │  Supervivencia │    │   Comparación grupos     │     │
│  │ Analítica   │    │  Kaplan-Meier  │    │   A vs B con p-value     │     │
│  └──────┬──────┘    └───────┬────────┘    └───────────────────┬──────┘     │
│         │                   │                                  │            │
│  ┌──────▼───────────────────▼──────────────────────────────────▼──────┐     │
│  │  MÓDULO 4 — VISUALIZACIONES                                         │     │
│  │  Gráficas interactivas listas para publicación científica           │     │
│  └───────────────────────────┬─────────────────────────────────────────┘    │
│                              │                                              │
│  ┌───────────────────────────▼─────────────────────────────────────────┐    │
│  │  MÓDULO 7 — EXPORT PARA PUBLICACIÓN                                 │    │
│  │  Word (Tabla 1 formateada), PNG 300dpi, CSV anonimizado, PDF        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  MÓDULO 8 — CONSULTAS GUARDADAS Y COHORTES VIVAS                           │
│  "Mis estudios" — guardar, reutilizar, actualizar con nuevos pacientes     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Fuentes de datos que el motor puede consultar:**

```
Datos manuales registrados en MediCore:
  · Consultas (diagnósticos CIE-10, exploración, plan)
  · Cirugías (procedimiento, técnica, duración, ASA, complicaciones)
  · Medicación (fármacos, dosis, duración)
  · Escalas clínicas (SNOT-22, DHI, VHI, Epworth...)
  · Imágenes (tipo de prueba, fecha, hallazgos)

Datos importados de Excel/CSV:
  · Todos los campos de importedData JSONB
  · Campos de cualquier estudio anterior
  · Datos del estadista del hospital

Datos calculados:
  · Edad en el momento del procedimiento
  · Tiempo entre eventos (días consulta→cirugía, días cirugía→complicación)
  · Evolución de escalas (diferencia pre/post)
```

---

## 3. Módulo 1 — Constructor de Cohortes

### Filosofía de diseño

El médico construye su cohorte de investigación de forma visual, progresiva y sin conocimiento de SQL. Cada filtro que añade reduce el número de pacientes y el sistema lo muestra en tiempo real.

### UI del constructor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔬 Nuevo estudio                               [Guardar como...]  [Limpiar] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FUENTE DE DATOS                                                            │
│  ● Todos mis pacientes   ○ Solo importados   ○ Solo registros manuales     │
│  ○ Importación específica: [Seleccionar batch...]                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  FILTROS                                              [AND] ○ OR            │
│                                                                             │
│  ┌─── Filtro 1 ──────────────────────────────────────────────────────┐     │
│  │  Campo: [Procedimiento quirúrgico          ▾]                      │     │
│  │  Operador: [contiene                       ▾]                      │     │
│  │  Valor: [ septoplastia                      ]                      │     │
│  └────────────────────────────────────────────────────────── [×] ────┘     │
│                                                                             │
│  ┌─── Filtro 2 ──────────────────────────────────────────────────────┐     │
│  │  Campo: [Fecha de cirugía                  ▾]                      │     │
│  │  Operador: [entre                          ▾]                      │     │
│  │  Valor: [ 01/01/2023 ] y [ 31/12/2025 ]                           │     │
│  └────────────────────────────────────────────────────────── [×] ────┘     │
│                                                                             │
│  ┌─── Filtro 3 ──────────────────────────────────────────────────────┐     │
│  │  Campo: [Edad en cirugía                   ▾]                      │     │
│  │  Operador: [mayor que                      ▾]                      │     │
│  │  Valor: [ 18 ]                                                     │     │
│  └────────────────────────────────────────────────────────── [×] ────┘     │
│                                                                             │
│  [+ Añadir filtro]                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  💬 O describe tu estudio en lenguaje natural:                              │
│  [ Pacientes operados de septoplastia entre 2023 y 2025 mayores de 18 años]│
│                                                    [Interpretar con IA →]  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ 34 pacientes encontrados                    [Ver lista]  [Continuar →] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Campos filtrables — catálogo completo

```
SECCIÓN: Datos demográficos
  Edad actual / Edad en la fecha de un evento específico
  Sexo
  Fecha de nacimiento (rango)
  Grupo sanguíneo

SECCIÓN: Diagnósticos
  Código CIE-10 (búsqueda por código o descripción)
  Código SNOMED
  Diagnóstico principal / secundario / diferencial
  Texto libre de la impresión diagnóstica (contiene / no contiene)

SECCIÓN: Cirugías
  Tipo de procedimiento (contiene / es exacto / en lista)
  Código de procedimiento (CIE-10-PCS / SNOMED)
  Fecha de cirugía (rango)
  Duración (minutos): entre / mayor que / menor que
  Clasificación ASA: es / en lista
  Tipo de anestesia
  Complicaciones: tiene / no tiene / contiene texto
  Estado: completada / programada / cancelada

SECCIÓN: Consultas
  Motivo de consulta (contiene)
  Tipo de consulta (primera visita / revisión / postoperatoria...)
  Fecha (rango)
  Tiene informe firmado: sí / no

SECCIÓN: Medicación
  Nombre del fármaco (contiene / es exacto)
  Principio activo
  Estado: activa / discontinuada
  Fecha de inicio (rango)
  Indicación (contiene)

SECCIÓN: Escalas clínicas
  Tipo de escala (SNOT-22 / DHI / VHI / Epworth / cualquier custom)
  Puntuación total: entre / mayor que / menor que
  Fecha de medición (rango)
  Tiene medición pre-cirugía: sí / no
  Tiene medición post-cirugía: sí / no
  Mejora post-cirugía: sí (puntuación bajó) / no (puntuación subió o igual)

SECCIÓN: Imágenes
  Tiene imagen de tipo: TAC / RMN / Audiometría / Nasofibroscopia...
  Fecha de la imagen (rango)

SECCIÓN: Datos importados (dinámico)
  [cualquier columna detectada en las importaciones de la organización]
  Con operadores adaptados al tipo de dato detectado

SECCIÓN: Eventos y tiempos calculados
  Tiempo entre primera consulta y cirugía (días)
  Tiempo de seguimiento (días desde cirugía hasta última consulta)
  Número de consultas totales
  Número de cirugías
  Tiene recurrencia registrada: sí / no
```

---

## 4. Módulo 2 — Estadística Descriptiva (Tabla 1)

Este módulo genera automáticamente la **Tabla 1** de cualquier publicación médica: las características basales de la cohorte, con el formato exacto que exigen las revistas científicas.

### Lógica de selección automática de estadístico

El sistema detecta el tipo de cada variable y aplica el estadístico correcto sin que el médico tenga que elegirlo:

```
Tipo de variable              Test de normalidad        Estadístico mostrado
────────────────────────────────────────────────────────────────────────────
Continua + normal             Shapiro-Wilk p>0.05       Media ± DE
Continua + no normal          Shapiro-Wilk p≤0.05       Mediana (RIQ)
Categórica dicotómica         —                          n (%)
Categórica múltiple           —                          n (%) por categoría
Tiempo / duración             Siempre no normal          Mediana (RIQ)
Puntuación de escala          Shapiro-Wilk              Media ± DE o Mediana (RIQ)
```

### UI de la Tabla 1

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TABLA 1 — Características de la muestra               [Editar campos]     │
│  Cohorte: "Septoplastias 2023-2025" · N=34 pacientes                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CAMPOS A INCLUIR EN LA TABLA                                               │
│                                                                             │
│  ✓ Edad (años)                    Estadístico: Media ± DE      [cambiar]   │
│  ✓ Sexo                           Estadístico: n (%)           [cambiar]   │
│  ✓ IMC                            Estadístico: Mediana (RIQ)   [cambiar]   │
│  ✓ ASA                            Estadístico: n (%)           [cambiar]   │
│  ✓ Duración IQ (min)              Estadístico: Media ± DE      [cambiar]   │
│  ✓ Complicaciones                 Estadístico: n (%)           [cambiar]   │
│  ✓ SNOT-22 preoperatorio          Estadístico: Media ± DE      [cambiar]   │
│  ✓ Seguimiento (meses)            Estadístico: Mediana (RIQ)   [cambiar]   │
│  ○ Tabaquismo                     [Añadir]                                 │
│  ○ Tiempo quirúrgico (datos import.) [Añadir]                              │
│                                                                             │
│  [+ Añadir campo]                                                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  PREVISUALIZACIÓN                                                           │
│                                                                             │
│  Variable                      N=34                                        │
│  ─────────────────────────────────────────────────                         │
│  Edad (años), media ± DE       48.3 ± 12.7                                 │
│  Sexo masculino, n (%)         20 (58.8%)                                  │
│  ASA I, n (%)                  18 (52.9%)                                  │
│  ASA II, n (%)                 14 (41.2%)                                  │
│  ASA III, n (%)                 2 (5.9%)                                   │
│  Duración IQ (min), media ± DE 94.2 ± 23.1                                │
│  Complicaciones, n (%)          4 (11.8%)                                  │
│  SNOT-22 preop, media ± DE     62.4 ± 18.3                                 │
│  Seguimiento (meses), med (RIQ) 14.0 (9.0–22.5)                           │
│  ─────────────────────────────────────────────────                         │
│  DE: desviación estándar. RIQ: rango intercuartílico.                      │
│                                                                             │
│             [Exportar Word]  [Exportar CSV]  [Copiar al portapapeles]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tabla 1 con dos grupos (comparativa)

Cuando el médico divide la cohorte en dos grupos (por ejemplo, técnica A vs técnica B), la Tabla 1 automáticamente añade la columna de p-value con el test correcto:

```
Variable                    Grupo A (n=17)    Grupo B (n=17)    p
──────────────────────────────────────────────────────────────────────
Edad (años), media ± DE     46.1 ± 11.2       50.4 ± 13.9       0.221  ← t de Student
Sexo masculino, n (%)       10 (58.8%)        10 (58.8%)         1.000  ← χ²
Duración IQ, media ± DE     88.6 ± 19.4       99.7 ± 25.6       0.073  ← t de Student
Complicaciones, n (%)        2 (11.8%)         2 (11.8%)          1.000  ← Fisher exacto
SNOT-22 preop, media ± DE   63.2 ± 17.1       61.6 ± 19.8       0.771  ← t de Student
```

---

## 5. Módulo 3 — Estadística Analítica

### Tests disponibles y cuándo se aplican

```
TESTS PARA VARIABLES CONTINUAS
────────────────────────────────────────────────────────────────────────────
t de Student (dos grupos, normalidad)
  → "¿Difiere el tiempo quirúrgico entre técnica A y técnica B?"

Mann-Whitney U (dos grupos, no normalidad)
  → "¿Difiere la puntuación SNOT-22 preop entre fumadores y no fumadores?"

ANOVA (tres o más grupos, normalidad)
  → "¿Difiere la duración IQ entre ASA I, II y III?"

Kruskal-Wallis (tres o más grupos, no normalidad)
  → variante no paramétrica del ANOVA

t de Student apareado (mismo paciente, dos momentos)
  → "¿Mejoró el SNOT-22 tras la cirugía?"

Wilcoxon (mismo paciente, no normalidad)
  → variante no paramétrica del t apareado

TESTS PARA VARIABLES CATEGÓRICAS
────────────────────────────────────────────────────────────────────────────
Chi-cuadrado (χ²)
  → "¿Hay más complicaciones en fumadores que en no fumadores?"

Fisher exacto (tablas 2×2 con N pequeño)
  → igual que χ² pero para muestras pequeñas (<5 en alguna celda)

CORRELACIONES
────────────────────────────────────────────────────────────────────────────
Pearson (dos variables continuas, relación lineal)
  → "¿Correlaciona la edad con el tiempo quirúrgico?"

Spearman (dos variables, no normalidad o relación no lineal)
  → "¿Correlaciona la puntuación ASA con las complicaciones?"

REGRESIÓN
────────────────────────────────────────────────────────────────────────────
Regresión lineal
  → "¿Qué variables predicen el tiempo quirúrgico?"
  → Output: coeficiente, IC 95%, p-value, R²

Regresión logística
  → "¿Qué variables predicen la aparición de complicaciones?"
  → Output: Odds Ratio, IC 95%, p-value

Regresión de Cox (supervivencia)
  → "¿Qué variables predicen la recurrencia?"
  → Output: Hazard Ratio, IC 95%, p-value
```

### UI del análisis estadístico

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANÁLISIS ESTADÍSTICO                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Tipo de análisis:                                                          │
│  ● Comparar dos grupos     ○ Comparar tres grupos o más                    │
│  ○ Evolución pre/post      ○ Correlación entre variables                   │
│  ○ Regresión               ○ Supervivencia / Kaplan-Meier                  │
│                                                                             │
│  ── Comparar dos grupos ─────────────────────────────────────────────────  │
│                                                                             │
│  Variable a comparar: [SNOT-22 postoperatorio (3 meses)           ▾]       │
│                                                                             │
│  Definir grupos:                                                            │
│  Grupo A: pacientes con [Técnica quirúrgica] = [Endoscópica]               │
│  Grupo B: pacientes con [Técnica quirúrgica] = [Abierta]                   │
│                                                                             │
│  [Calcular]                                                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  RESULTADO                                                                  │
│                                                                             │
│  Test aplicado: t de Student (distribución normal, Shapiro-Wilk p=0.412)   │
│                                                                             │
│  SNOT-22 postop         Grupo A (n=17)    Grupo B (n=17)    p              │
│  ───────────────────────────────────────────────────────────────           │
│  Media ± DE             18.3 ± 8.1        24.7 ± 10.2       0.038 *        │
│  Mediana (RIQ)          16.0 (12–24)      22.0 (17–31)                     │
│  Rango                  4–38              8–44                              │
│                                                                             │
│  * p < 0.05. Diferencia estadísticamente significativa.                    │
│                                                                             │
│  Tamaño del efecto: d de Cohen = 0.70 (efecto grande)                      │
│  Potencia estadística: 0.78 (con α=0.05)                                   │
│                                                                             │
│  [Añadir gráfica box plot]  [Exportar resultado]                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Análisis pre/post (el más frecuente en ORL)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EVOLUCIÓN PRE/POST CIRUGÍA                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Variable: [SNOT-22                                               ▾]        │
│  Momento pre: [Escala más cercana a la cirugía (≤30 días antes)  ▾]        │
│  Momento post: [Escala a los 3 meses (±15 días)                  ▾]        │
│                                                                             │
│  Pacientes con ambas mediciones: 28 de 34                                  │
│  [Los 6 sin medición post: ver lista]                                       │
│                                                                             │
│  [Calcular]                                                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  RESULTADO                                                                  │
│                                                                             │
│  Test: t de Student apareado (N=28, normalidad confirmada p=0.38)          │
│                                                                             │
│  SNOT-22               PRE              POST             Diferencia   p     │
│  ─────────────────────────────────────────────────────────────────────     │
│  Media ± DE            62.4 ± 18.3      18.3 ± 8.1      -44.1 ± 16.2 <0.001│
│  Mediana (RIQ)         60.5 (48–76)     16.0 (12–24)    -44.0               │
│  Rango                 28–98            4–38                                │
│                                                                             │
│  Reducción media: 70.7% (IC 95%: 64.1%–77.3%)                             │
│  Pacientes con mejoría clínicamente significativa (>8.9 puntos): 26/28     │
│  (92.9%)                                                                    │
│                                                                             │
│  [Añadir gráfica de evolución]  [Añadir box plot pre/post]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Módulo 4 — Visualizaciones y Gráficas

Todas las gráficas son **interactivas** en pantalla y **exportables en 300dpi** para publicación. El médico elige el tipo, los ejes, los colores, y puede añadir anotaciones.

### Catálogo de gráficas disponibles

#### Barras (distribución de variables categóricas)

```
Uso: diagnósticos más frecuentes, distribución de ASA, tipos de procedimiento,
     distribución de complicaciones por tipo.

Variantes:
  · Barras simples (una serie)
  · Barras agrupadas (dos grupos, A vs B)
  · Barras apiladas (proporciones)
  · Barras horizontales (cuando los labels son largos)

Output publicación: PNG 300dpi, mínimo 1200×900px
```

#### Box plot (distribución de variables continuas)

```
Uso: comparar distribuciones entre grupos. El más usado en publicaciones
     quirúrgicas ORL para tiempo quirúrgico, puntuaciones de escalas, edades.

Muestra: mediana, RIQ (caja), rango (bigotes), outliers (puntos)
Variantes: con puntos individuales superpuestos (recomendado cuando N<30)

Ejemplo: Box plot de SNOT-22 pre vs post, separado por técnica quirúrgica
```

#### Línea de evolución temporal

```
Uso: evolución de una métrica a lo largo del tiempo. Escalas clínicas en
     múltiples visitas, número de procedimientos por mes/año.

Con banda de error (media ± DE o IC 95%)
Con puntos individuales superpuestos si N<20
```

#### Scatter plot + línea de regresión

```
Uso: correlación entre dos variables continuas.
     "¿Correlaciona la edad con el tiempo quirúrgico?"
     "¿Correlaciona el SNOT-22 preop con la mejora postop?"

Muestra: coeficiente R de Pearson o Rho de Spearman + p-value en el gráfico
```

#### Histograma

```
Uso: distribución de una variable continua (edades, tiempos, puntuaciones)
Con curva de densidad normal superpuesta para visualizar normalidad
```

#### Pastel / Donut

```
Uso: solo para proporciones simples (sexo, ASA, presencia/ausencia)
Limitado a 5 categorías máximo — más categorías → barras automáticamente
```

#### Gráfica de dispersión pre/post (Bland-Altman)

```
Uso: comparar dos mediciones del mismo paciente (pre vs post cirugía)
     Estándar de publicación para estudios de concordancia
Muestra: límites de concordancia al 95%, sesgo medio
```

#### Forest plot (regresión logística o Cox)

```
Uso: mostrar odds ratios o hazard ratios de múltiples variables simultáneamente.
     Estándar en publicaciones de análisis multivariante.
     El más pedido por revisores de revistas.

Estructura:
  Variable             OR    IC 95%     p
  Edad                 1.03  [1.01–1.05] 0.012 ●────────|────
  Sexo masculino       0.87  [0.42–1.81] 0.710     ●────|────
  ASA ≥ III            2.41  [1.12–5.18] 0.024         ●──|──────
  Duración IQ          1.01  [0.99–1.03] 0.231      ●──|──
                                                   0.5  1   2    5
```

#### Curva de Kaplan-Meier (supervivencia / recurrencia)

```
Uso: probabilidad acumulada de un evento (recurrencia, complicación,
     supervivencia) a lo largo del tiempo. Ver Módulo 5.
```

---

## 7. Módulo 5 — Análisis de Supervivencia

El análisis de supervivencia es el estándar estadístico para estudios de recurrencia, tiempo hasta complicación, o seguimiento oncológico. No existe en Excel de forma accesible. MediCore lo hace en un clic.

### Configuración

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANÁLISIS DE SUPERVIVENCIA / KAPLAN-MEIER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Evento de interés:                                                         │
│  [Recurrencia de la patología                                     ▾]        │
│    ○ Complicación postoperatoria                                            │
│    ○ Nueva cirugía (reintervención)                                         │
│    ○ Éxitus                                                                 │
│    ○ [Campo personalizado de importación: "Recurrencia (S/N)"]             │
│                                                                             │
│  Tiempo desde: [Fecha de cirugía                                  ▾]        │
│  Tiempo hasta: [Fecha del evento  ▾]  o  [Última consulta si no evento]    │
│                                                                             │
│  Comparar por grupos: [ASA                                        ▾]        │
│  Grupo 1: ASA I   Grupo 2: ASA II-III                                      │
│                                                                             │
│  [Calcular curva]                                                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  RESULTADO                                                                  │
│                                                                             │
│  [Curva Kaplan-Meier interactiva]                                          │
│                                                                             │
│  Probabilidad de supervivencia libre de recurrencia                        │
│  1.0 │───────────────                                                       │
│      │               ╲──── ASA I (n=18)                                    │
│  0.8 │                 ────────────────                                     │
│      │                         ╲──── ASA II-III (n=16)                     │
│  0.6 │                              ──────────                              │
│      │                                                                      │
│  0.4 │                                                                      │
│      └─────────────────────────────────────────                            │
│        0    6    12    18    24    30    36 meses                           │
│                                                                             │
│  Log-rank test: p = 0.041                                                  │
│                                                                             │
│  Mediana de seguimiento: 18.0 meses (RIQ: 12.0–24.5)                      │
│                                                                             │
│  Supervivencia libre de recurrencia a 12 meses:                            │
│  ASA I: 88.9% (IC 95%: 74.4%–100%)                                        │
│  ASA II-III: 68.8% (IC 95%: 47.7%–99.0%)                                  │
│                                                                             │
│  [Exportar curva 300dpi]  [Exportar tabla de supervivencia]                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Módulo 6 — Comparación de Grupos

Este módulo permite dividir la cohorte en dos grupos y comparar **todas las variables simultáneamente**, generando la tabla completa de resultados que va en el cuerpo del artículo (no solo la Tabla 1).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPARACIÓN DE GRUPOS                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Definir grupos:                                                            │
│  Grupo A (nombre): [Técnica endoscópica]                                   │
│  Criterio A: [Abordaje] = [Endoscópico]                                    │
│                                                                             │
│  Grupo B (nombre): [Técnica abierta]                                       │
│  Criterio B: [Abordaje] = [Abierto]                                        │
│                                                                             │
│  Grupo A: 17 pacientes  Grupo B: 17 pacientes                              │
│                                                                             │
│  Variables a comparar: [Seleccionar todas]  [Personalizar]                 │
│  ✓ Variables demográficas   ✓ Cirugía   ✓ Escalas   ✓ Complicaciones       │
│                                                                             │
│  [Comparar]                                                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  TABLA DE RESULTADOS COMPARATIVA                                            │
│                                                                             │
│  Variable            Endoscópica (n=17)  Abierta (n=17)   p       Test    │
│  ───────────────────────────────────────────────────────────────────────── │
│  Edad, media±DE      47.2 ± 11.8         49.4 ± 13.6      0.582    t       │
│  Sexo M, n(%)        9 (52.9%)           11 (64.7%)        0.490    χ²      │
│  Duración, media±DE  88.6 ± 19.4         99.7 ± 25.6      0.073    t       │
│  Sangrado (ml)       42.3 ± 18.1         87.4 ± 34.2      <0.001 * t       │
│  Compl., n(%)         2 (11.8%)           2 (11.8%)        1.000    Fisher  │
│  SNOT-22 preop       63.2 ± 17.1         61.6 ± 19.8      0.771    t       │
│  SNOT-22 postop      18.3 ± 8.1          24.7 ± 10.2      0.038 *  t       │
│  Mejora SNOT-22      44.9 ± 15.3         36.9 ± 17.1      0.108    t       │
│  Seguimiento (m)     14.0 (9–23)         15.0 (10–22)     0.891    Mann-W  │
│  ───────────────────────────────────────────────────────────────────────── │
│  * p < 0.05. t: t de Student. χ²: chi-cuadrado. Mann-W: Mann-Whitney.     │
│                                                                             │
│       [Exportar tabla Word]  [Exportar CSV]  [Añadir al informe]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Módulo 7 — Export para Publicación

El médico ha hecho su análisis. Ahora necesita llevarlo a la revista. Este módulo genera todos los archivos que necesita, en el formato exacto que piden las revistas.

### Formatos de export

```
WORD (.docx)
  · Tabla 1 con formato APA/Vancouver
  · Tabla de resultados comparativos
  · Tabla de análisis de regresión
  · Leyendas de tablas en pie
  Estilo: Times New Roman 12pt, interlineado doble (estándar de revistas)

PNG / TIFF (para figuras)
  · 300 dpi mínimo (requerimiento universal de revistas)
  · Fondo blanco
  · Sin logo de MediCore (el médico lo publica como suyo — lo es)
  · Leyenda de la figura incluible en el export

CSV anonimizado (supplementary data)
  · Sin nombre, sin DNI, sin NHC real
  · ID interno no reversible
  · Todos los campos del análisis
  · Para adjuntar como datos suplementarios al artículo

PDF del análisis completo
  · Resumen de todos los resultados generados en la sesión
  · Incluye los parámetros de los tests aplicados
  · Para documentación interna / sesión con el estadista

SPSS / R syntax (avanzado)
  · Genera el código R o SPSS equivalente que produciría los mismos resultados
  · Para el médico que quiere verificar con su estadista habitual
  · O para reproducibilidad del análisis
```

### UI del export

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXPORTAR PARA PUBLICACIÓN                                                  │
│  Estudio: "Septoplastias 2023-2025" · N=34                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TABLAS                                                                     │
│  ☑ Tabla 1 — Características de la muestra          [Word]  [CSV]          │
│  ☑ Tabla 2 — Comparativa técnica endoscópica vs abierta  [Word]  [CSV]    │
│  ☑ Tabla 3 — Análisis de regresión logística        [Word]  [CSV]          │
│                                                                             │
│  FIGURAS                                                                    │
│  ☑ Figura 1 — Box plot SNOT-22 pre/post             [PNG 300dpi] [TIFF]   │
│  ☑ Figura 2 — Curva Kaplan-Meier recurrencia        [PNG 300dpi] [TIFF]   │
│  ☑ Figura 3 — Forest plot regresión logística       [PNG 300dpi] [TIFF]   │
│                                                                             │
│  DATOS SUPLEMENTARIOS                                                       │
│  ☑ Dataset anonimizado completo                     [CSV]                  │
│                                                                             │
│  DOCUMENTACIÓN DEL ANÁLISIS                                                 │
│  ☑ Informe estadístico completo (para el estadista) [PDF]                  │
│  ☑ Código R equivalente                             [.R]                   │
│                                                                             │
│  Formato de citas estadísticas:  ● Vancouver  ○ APA  ○ Personalizado      │
│                                                                             │
│              [Descargar todo como ZIP]  [Descargar seleccionados]          │
│                                                                             │
│  ⚠ Los datos exportados están anonimizados. Los nombres reales de         │
│  pacientes no aparecen en ningún archivo. (BR-RES-002)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Módulo 8 — Consultas Guardadas y Cohortes Vivas

### El concepto de cohorte viva

Una cohorte viva es un estudio guardado que se **actualiza automáticamente** cuando el médico importa nuevos pacientes. Si el médico tiene guardado "Septoplastias 2023-2026", cada vez que importe pacientes nuevos que cumplan los criterios, aparecen en el estudio.

Esto resuelve el problema central: el médico no tiene que recordar qué estudios tiene activos. El sistema los alimenta solo.

### UI de "Mis estudios"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MIS ESTUDIOS                                          [+ Nuevo estudio]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 Septoplastias 2023-2025                              COHORTE VIVA      │
│     34 pacientes · Última actualización: hace 3 días                       │
│     Filtros: Procedimiento contiene "septoplastia" + Fecha 2023-2025       │
│     [Abrir]  [Re-ejecutar]  [Exportar]  [...]                              │
│                                                                             │
│  📊 TORS abordaje laterocervical                         ARCHIVADO         │
│     7 pacientes · Publicado en Acta Otorrinolaringol. 2025                 │
│     🔒 Congelado — no se actualiza con nuevas importaciones                │
│     [Abrir]  [Ver análisis]  [...]                                          │
│                                                                             │
│  📊 Vértigo posicional — escala DHI                      COHORTE VIVA      │
│     23 pacientes · ⚡ 2 pacientes nuevos desde la última vez               │
│     [Abrir]  [Ver nuevos pacientes]  [Re-ejecutar análisis]                │
│                                                                             │
│  📊 In-office laringe 2024                               BORRADOR           │
│     12 pacientes · Incompleto — faltan mediciones post                     │
│     [Abrir]  [Continuar]  [...]                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Estados de un estudio

```
BORRADOR        El médico está construyendo la cohorte y el análisis
COHORTE VIVA    Guardado y activo — se actualiza con nuevas importaciones
ARCHIVADO       Publicado o cerrado — se puede ver pero no recibe nuevos pacientes
CONGELADO       Igual que archivado pero con indicación explícita de publicación
```

---

## 11. Schema de Datos del Motor

```prisma
// Añadir a schema.prisma

model ResearchStudy {
  id              String        @id @default(uuid())
  organizationId  String
  createdBy       String        // userId

  name            String        // "Septoplastias 2023-2025"
  description     String?
  status          StudyStatus   @default(DRAFT)

  // Definición de la cohorte (los filtros)
  dataSource      String        @default("all")  // "all"|"imported"|"manual"|"batch"
  importBatchIds  String[]      // si dataSource = "batch"
  filters         Json          // array de FilterSchema
  filterLogic     String        @default("AND")  // "AND"|"OR"

  // Caché del resultado (se invalida al importar nuevos pacientes)
  cachedPatientIds  String[]    // IDs de los pacientes que cumplen los filtros
  cachedAt          DateTime?   // cuándo se calculó el caché
  patientCount      Int         @default(0)

  // Análisis guardados dentro del estudio
  analyses          Json        @default("[]")   // array de análisis completados

  // Si está publicado
  publicationRef    String?     // "Acta Otorrinolaringol 2025;76(3):123-131"
  frozenAt          DateTime?   // cuando se congeló (publicación)

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([organizationId, createdBy])
  @@map("research_studies")
}

enum StudyStatus {
  DRAFT
  ACTIVE      // cohorte viva
  ARCHIVED
  FROZEN      // publicado, no recibe nuevos pacientes
}
```

---

## 12. Backend — Cálculos Estadísticos

Todos los cálculos estadísticos se ejecutan en el backend con **mathjs** para las operaciones básicas y una librería de estadística para los tests. No se usa R ni Python — JavaScript puro para mantener la arquitectura simple.

```typescript
// apps/api/src/application/research/services/statistics.service.ts

import * as math from 'mathjs'
import { jStat } from 'jstat'  // tests estadísticos en JS

@Injectable()
export class StatisticsService {

  // ── Estadística descriptiva ──────────────────────────────────────────

  describe(values: number[]): DescriptiveStats {
    const sorted = [...values].sort((a, b) => a - b)
    const n = values.length

    const mean   = math.mean(values) as number
    const std    = math.std(values) as number
    const median = math.median(values) as number
    const q1     = sorted[Math.floor(n * 0.25)]
    const q3     = sorted[Math.floor(n * 0.75)]

    return { n, mean, std, median, q1, q3, min: sorted[0], max: sorted[n-1] }
  }

  // ── Test de normalidad (Shapiro-Wilk) ────────────────────────────────
  // Determina si usar tests paramétricos o no paramétricos

  shapiroWilk(values: number[]): { statistic: number; pValue: number; isNormal: boolean } {
    // Implementación de Shapiro-Wilk para N ≤ 50
    // Para N > 50: Kolmogorov-Smirnov automático
    const result = this.calculateShapiroWilk(values)
    return { ...result, isNormal: result.pValue > 0.05 }
  }

  // ── Tests para dos grupos ─────────────────────────────────────────────

  tTest(group1: number[], group2: number[]): TestResult {
    const t  = jStat.tscore(group1) // implementación simplificada
    const df = group1.length + group2.length - 2
    const p  = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df))
    return { test: 't de Student', statistic: t, df, pValue: p, significant: p < 0.05 }
  }

  mannWhitneyU(group1: number[], group2: number[]): TestResult {
    // Test U de Mann-Whitney para distribuciones no normales
    const { U, pValue } = this.calculateMannWhitney(group1, group2)
    return { test: 'Mann-Whitney U', statistic: U, pValue, significant: pValue < 0.05 }
  }

  pairedTTest(before: number[], after: number[]): TestResult {
    const diffs = before.map((b, i) => after[i] - b)
    const meanDiff = math.mean(diffs) as number
    const stdDiff  = math.std(diffs) as number
    const t  = meanDiff / (stdDiff / Math.sqrt(diffs.length))
    const df = diffs.length - 1
    const p  = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df))
    return { test: 't apareado', statistic: t, df, pValue: p, significant: p < 0.05,
             meanDifference: meanDiff, ci95: this.ci95(diffs) }
  }

  // ── Tests categóricos ─────────────────────────────────────────────────

  chiSquare(observed: number[][]): TestResult {
    const chiSq  = jStat.chisquare.pdf(observed)
    const df     = (observed.length - 1) * (observed[0].length - 1)
    const pValue = 1 - jStat.chisquare.cdf(chiSq, df)
    return { test: 'χ²', statistic: chiSq, df, pValue, significant: pValue < 0.05 }
  }

  fisherExact(a: number, b: number, c: number, d: number): TestResult {
    // Fisher exacto para tablas 2×2 con N pequeño
    const pValue = this.calculateFisherExact(a, b, c, d)
    return { test: 'Fisher exacto', pValue, significant: pValue < 0.05 }
  }

  // ── Selección automática del test correcto ────────────────────────────

  selectTest(group1: number[], group2: number[], paired = false): string {
    const n1 = group1.length
    const n2 = group2.length

    if (paired) {
      const diffs = group1.map((v, i) => group2[i] - v)
      return this.shapiroWilk(diffs).isNormal ? 't apareado' : 'Wilcoxon'
    }

    const normal1 = n1 >= 30 || this.shapiroWilk(group1).isNormal
    const normal2 = n2 >= 30 || this.shapiroWilk(group2).isNormal

    return (normal1 && normal2) ? 't de Student' : 'Mann-Whitney U'
  }

  selectTestCategorical(table: number[][]): string {
    const minExpected = this.minExpectedFrequency(table)
    return minExpected >= 5 ? 'χ²' : 'Fisher exacto'
  }

  // ── Correlación ───────────────────────────────────────────────────────

  pearson(x: number[], y: number[]): CorrelationResult {
    const r = jStat.corrcoeff(x, y)
    const t = r * Math.sqrt((x.length - 2) / (1 - r * r))
    const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), x.length - 2))
    return { r, rSquared: r * r, pValue: p, method: 'Pearson', n: x.length }
  }

  // ── Tamaño del efecto ─────────────────────────────────────────────────

  cohenD(group1: number[], group2: number[]): number {
    const pooledSD = Math.sqrt(
      ((group1.length - 1) * Math.pow(math.std(group1) as number, 2) +
       (group2.length - 1) * Math.pow(math.std(group2) as number, 2)) /
      (group1.length + group2.length - 2)
    )
    return Math.abs((math.mean(group1) as number) - (math.mean(group2) as number)) / pooledSD
  }

  interpretCohenD(d: number): string {
    if (d < 0.2) return 'despreciable'
    if (d < 0.5) return 'pequeño'
    if (d < 0.8) return 'mediano'
    return 'grande'
  }
}
```

---

## 13. Frontend — UX del Motor de Investigación

### Principio de diseño

**El médico nunca debe sentir que está usando una herramienta estadística.** La estadística ocurre entre bastidores. El médico solo ve preguntas en lenguaje clínico y respuestas en lenguaje clínico. El nombre del test (t de Student, Mann-Whitney) aparece en letra pequeña como referencia, nunca como elemento central.

### Flujo de usuario tipo

```
1. Médico entra a "Investigación"
2. Crea nuevo estudio o abre uno existente
3. Filtra sus pacientes hasta llegar a la cohorte que le interesa
4. Ve el número de pacientes en tiempo real mientras filtra
5. Hace clic en "Analizar"
6. El sistema genera automáticamente:
   - La Tabla 1 completa
   - Un resumen descriptivo con las variables más relevantes
   - Sugerencias de análisis ("Tienes escalas SNOT-22 pre y post en 28 pacientes
     — ¿quieres ver la evolución pre/post?")
7. El médico acepta o ignora las sugerencias, añade las que quiera
8. Genera las gráficas necesarias con un clic
9. Exporta todo con un clic
```

### Sugerencias automáticas del sistema

El sistema analiza los datos de la cohorte y sugiere los análisis más relevantes:

```
💡 Sugerencias para tu cohorte (34 pacientes):

  ● 28 pacientes tienen SNOT-22 medido antes y después de la cirugía.
    ¿Quieres ver si la mejora es estadísticamente significativa?
    [Análisis pre/post →]

  ● Tienes pacientes con dos técnicas quirúrgicas distintas (endoscópica/abierta).
    ¿Quieres comparar los resultados entre grupos?
    [Comparar grupos →]

  ● El tiempo de seguimiento varía entre 3 y 36 meses.
    ¿Quieres ver la tasa de recurrencia en el tiempo (Kaplan-Meier)?
    [Análisis de supervivencia →]
```

---

## 14. Reglas de Negocio

```
BR-RES-001  Las consultas guardadas son privadas por defecto. Solo el creador las ve.
            Un OWNER puede ver todos los estudios de la organización.

BR-RES-002  Los exports de investigación son siempre anonimizados.
            Ningún archivo exportado contiene nombre, DNI, teléfono o email real.
            Los pacientes se identifican por un ID interno no reversible.

BR-RES-003  Los estudios marcados como FROZEN no pueden recibir nuevos pacientes
            ni modificarse. El análisis queda congelado tal como estaba al publicar.

BR-RES-004  Las visualizaciones con N < 5 muestran un aviso: "Muestra insuficiente
            para este análisis". No se bloquea el análisis — se advierte.

BR-RES-005  El sistema selecciona automáticamente el test estadístico correcto.
            El médico puede cambiarlo manualmente si lo desea, pero el sistema
            registra el cambio y muestra el test original sugerido.

BR-RES-006  Los p-values se muestran siempre con 3 decimales o como "<0.001".
            Nunca como "0.000" — eso es estadísticamente incorrecto.

BR-RES-007  Toda gráfica exportada incluye en el pie: N, test estadístico usado,
            y nivel de significación (α=0.05 por defecto, configurable).

BR-RES-008  Las cohortes vivas se recalculan automáticamente tras cada importación.
            El médico recibe una notificación: "Tu estudio X tiene 3 nuevos pacientes."

BR-RES-009  Un estudio solo puede ser FROZEN por el creador o por un OWNER.
            El congelamiento es irreversible — si el médico quiere modificarlo,
            debe crear una nueva versión del estudio.

BR-RES-010  Los análisis de regresión logística o de Cox requieren N mínimo de 10
            eventos por variable predictora. El sistema advierte si no se cumple.
```

---

## 15. Roadmap de Implementación

```
WU-RES-01  StatisticsService — todos los tests estadísticos con suite de tests unitarios
           Tests críticos:
             it('t apareado debería detectar mejora significativa SNOT-22 pre/post')
             it('debería seleccionar Mann-Whitney cuando Shapiro-Wilk p<0.05')
             it('Fisher exacto para tablas con frecuencia esperada < 5')
             it('p-value nunca debería mostrarse como 0.000')

WU-RES-02  ResearchStudy schema + repositorio + casos de uso básicos
           (CreateStudy, SaveStudy, FreezeStudy, ListStudies)

WU-RES-03  FilterBuilderService — traducción de filtros UI a Prisma
           (reutilizar de 12-import-research-spec.md WU-12-02)

WU-RES-04  DescriptiveStatsHandler — genera la Tabla 1 completa con selección
           automática de estadístico por tipo de variable

WU-RES-05  ComparativeAnalysisHandler — dos grupos, selección automática de test,
           tabla comparativa completa con p-values

WU-RES-06  PrePostAnalysisHandler — análisis apareado, con matching temporal
           de escalas (la más cercana a la cirugía en cada dirección)

WU-RES-07  CorrelationHandler + RegressionHandler — Pearson/Spearman,
           regresión lineal y logística con output de OR/IC95%

WU-RES-08  KaplanMeierHandler — cálculo de supervivencia, log-rank test

WU-RES-09  API — endpoints del motor de investigación

WU-RES-10  Frontend — Constructor de cohortes con filtros visuales y contador
           en tiempo real

WU-RES-11  Frontend — Tabla 1 interactiva con edición de campos y estadísticos

WU-RES-12  Frontend — Módulo de estadística analítica (comparación grupos,
           pre/post, correlación)

WU-RES-13  Frontend — Visualizaciones (box plot, barras, scatter, línea, histograma)
           con Recharts + export PNG 300dpi

WU-RES-14  Frontend — Kaplan-Meier interactivo + forest plot

WU-RES-15  Frontend — Módulo de export (Word tablas, PNG figuras, CSV, PDF, código R)

WU-RES-16  Frontend — "Mis estudios" con cohortes vivas, notificaciones de
           nuevos pacientes, estados (borrador/activo/archivado/congelado)

WU-RES-17  Sugerencias automáticas de análisis (detección de escalas pre/post,
           grupos diferenciados, tiempo de seguimiento suficiente)
```

**Tests E2E críticos:**
```typescript
it('el médico puede crear una cohorte, generar la Tabla 1 y exportarla a Word')
it('el análisis pre/post detecta mejora estadísticamente significativa correctamente')
it('el export CSV no contiene nombre ni DNI de ningún paciente')
it('una cohorte viva se actualiza tras importar nuevos pacientes elegibles')
it('un estudio FROZEN no recibe nuevos pacientes tras la importación')
it('el sistema selecciona t de Student para distribución normal y Mann-Whitney si no')
```

---

*Este módulo convierte a MediCore en la herramienta que ningún hospital da a sus médicos:
un sistema de investigación clínica personal, integrado con los datos reales de consulta,
que produce en minutos lo que antes costaba semanas de trabajo con el estadista.*