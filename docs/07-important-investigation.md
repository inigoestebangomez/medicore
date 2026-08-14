# Módulo de Investigación — MediCore

> **Propósito de este documento:** especificación funcional del módulo de **Investigación** de MediCore, pensada para que un equipo (o una IA) de desarrollo pueda implementarla sin ambigüedad. No cubre el resto de la aplicación (historia clínica general, agenda, facturación, etc.), solo la parte de investigación clínica.

---

## 1. Visión general

El médico necesita una herramienta para **crear estudios de investigación clínica** (retrospectivos o prospectivos) sobre sus pacientes, en los que pueda:

1. Registrar datos de pacientes con un **núcleo de variables fijas** (siempre presentes) y un **conjunto de variables configurables** que varían según la patología o el objetivo del estudio.
2. Analizar esos datos con las pruebas estadísticas correctas según el tipo de variable.
3. (Visión a futuro, fuera del alcance de esta primera versión) generar automáticamente, con IA, un borrador de artículo científico a partir de los resultados del análisis.

La idea central es: **cada estudio de investigación es una entidad independiente con su propio esquema de variables**, construido por el médico a partir de una librería reutilizable de "campos" más un núcleo fijo obligatorio.

---

## 2. Modelo conceptual

### 2.1 Entidades principales

- **ResearchStudy (Estudio de investigación):** contenedor de un proyecto de investigación (p. ej. "Cirugía robótica ORL", "Tumores de orofaringe", "Vértigo ORL"). Tiene un nombre, una patología/ámbito asociado, y una **lista de variables** que se van a registrar y analizar en ese estudio.
- **StudyVariable (Variable de estudio):** definición de un campo de datos dentro de un estudio: nombre, tipo, unidad, si es obligatorio, si pertenece al núcleo fijo o es específica del estudio.
- **StudySubject / PatientEntry (Registro de paciente en el estudio):** los valores concretos que un paciente aporta a un estudio determinado (una fila de la base de datos de investigación).
- **StatisticalAnalysis (Análisis estadístico):** configuración y resultado de un análisis (descriptivo o inferencial) ejecutado sobre las variables de un estudio.

### 2.2 Núcleo fijo de variables (siempre disponible)

Estas variables deben estar disponibles **en todos los estudios**, sin necesidad de configurarlas manualmente. Deben poder quedar vacías sin que el sistema produzca error de validación; si un campo del núcleo fijo no se rellena, ese registro debe poder **excluirse automáticamente del análisis para esa variable en concreto** (no debe romper el estudio ni obligar a rellenar el resto).

| Variable | Tipo sugerido | Notas |
|---|---|---|
| Nombre | Texto (identificación, no analítico) | Dato identificativo del paciente, no forma parte del análisis estadístico. |
| Nº de historia clínica | Texto/ID | Identificador único de vínculo con la ficha clínica. |
| Edad | Cuantitativa continua/discreta | Años. |
| Alergias medicamentosas | Cualitativa (texto estructurado o catálogo) | Idealmente catálogo controlado, no texto libre. |
| Antecedentes patológicos | Cualitativa (catálogo múltiple) | |
| Antecedentes oncológicos | Cualitativa (catálogo múltiple) | |
| Antecedentes familiares | Cualitativa (catálogo múltiple) | |
| Antecedentes quirúrgicos | Cualitativa (catálogo múltiple) | |
| Profesión | Texto/catálogo | |
| Hábitos tóxicos | Cuantitativa + cualitativa combinadas | Ver detalle en 2.2.1 |
| Tratamiento crónico | Cualitativa (catálogo múltiple) | |
| Pruebas complementarias solicitadas | Cualitativa (catálogo múltiple: RM, TC, ecografía, PET, analíticas, etc.) | |
| Valores analíticos específicos | Cuantitativa (configurable) | El conjunto concreto de analíticas a registrar depende de la patología del estudio; ver 2.3. |

#### 2.2.1 Detalle: Hábitos tóxicos

Es una variable compuesta que requiere sub-campos estandarizados para poder analizarse:

- **Tabaco:** cuantificado en **paquetes/año (IPA)** — campo numérico calculado o introducido directamente.
- **Alcohol:** cuantificado en **gramos de alcohol / UBE (Unidad de Bebida Estándar)** — campo numérico.
- **Otros tóxicos** (inhalados o inyectables): catálogo de sustancias + sí/no o frecuencia.

> Regla de diseño: nunca almacenar hábitos tóxicos como texto libre; siempre como valores numéricos o dicotómicos estandarizados, para que sean analizables estadísticamente.

### 2.3 Variables configurables por estudio (a la carta)

Además del núcleo fijo, el médico debe poder **añadir o quitar variables** ("pestañas" o campos) según lo que quiera investigar en ese estudio concreto. Estas son las variables candidatas más habituales, a modo de librería reutilizable (no es una lista cerrada):

- Patología actual
- Intervención quirúrgica
- Tratamiento (médico, radioterapia, quimioterapia, inmunoterapia — puede ser multi-selección)
- Respuesta a tratamiento
- Complicaciones (ver 2.3.1: deben registrarse desglosadas, no como texto)
- Días de hospitalización (cuantitativa)
- Supervivencia total (cuantitativa, tiempo hasta evento / censura)
- Supervivencia libre de enfermedad (cuantitativa, tiempo hasta evento / censura)
- Valores de pruebas específicas (ejemplo ORL/vértigo): VHIT, audiometría tonal liminal, VEMPs, pruebas calóricas
- Radiología asociada (TAC, RM)
- Nº de hospitalizaciones (recurrente, no solo la actual)
- Nº de visitas a urgencias / centro de salud por el motivo del estudio
- Clínica de cada episodio (debe descomponerse en variables dicotómicas específicas, no texto libre)

**Requisito funcional clave:** el sistema debe permitir crear/editar la lista de variables de un estudio de forma dinámica (tipo "constructor de formulario"), no con un esquema fijo en base de datos por patología. Cada patología/estudio puede tener una combinación distinta.

#### 2.3.1 Ejemplo de descomposición correcta de "Complicaciones"

En lugar de un campo de texto libre "Complicaciones", debe modelarse como un conjunto de variables dicotómicas independientes, cada una analizable por separado, por ejemplo:

- Hemorragia: Sí/No (almacenado como 1/0)
- Infección: Sí/No
- Fallecimiento: Sí/No
- Absceso cerebral: Sí/No

Esta lógica de "una complicación = una variable dicotómica" debe aplicarse como patrón general cuando el médico defina nuevas variables cualitativas no dicotómicas de forma natural (el constructor de estudios debería sugerir o facilitar este patrón).

### 2.4 Casos de uso de ejemplo (para tests / QA funcional)

**Ejemplo 1 — Cirugía robótica ORL:**
Patología actual, Intervención quirúrgica, Respuesta a tratamiento, Complicaciones, Días de hospitalización.

**Ejemplo 2 — Tumores de orofaringe:**
Patología actual, Tratamiento (cirugía/radioterapia/quimioterapia/inmunoterapia), Respuesta a tratamiento, Complicaciones, Días de hospitalización, Supervivencia total, Supervivencia libre de enfermedad.

**Ejemplo 3 — Vértigo ORL:**
Patología actual, Tratamiento (médico/cirugía), Valores del VHIT, Radiología (TAC o RM), Audiometría tonal liminal, VEMPs, Pruebas calóricas, Respuesta a tratamiento, Complicaciones, Nº de hospitalizaciones, Nº de visitas a urgencias/centro de salud por ese motivo, Clínica de cada episodio (desglosada en variables dicotómicas).

Estos tres ejemplos deben usarse como casos de prueba de que el constructor de variables es realmente flexible y no un formulario cerrado.

---

## 3. Reglas de negocio para la definición de variables

Estas reglas deben aplicarse en el constructor/editor de variables de un estudio:

1. **Tipos de variable soportados:**
   - Cuantitativa continua (ej. edad, PCR, días de hospitalización)
   - Cuantitativa discreta (ej. nº de hospitalizaciones)
   - Cualitativa dicotómica (Sí/No, almacenada como 1/0)
   - Cualitativa nominal (categorías sin orden, ej. tipo de tratamiento)
   - Cualitativa ordinal (categorías con orden, ej. escalas tipo "mala/buena/muy buena")
   - Tiempo hasta evento / supervivencia (requiere valor de tiempo + indicador de censura, para Kaplan-Meier/Cox)
2. **Nunca texto libre no estructurado** para variables destinadas a análisis estadístico. Si el médico necesita capturar algo subjetivo (ej. satisfacción cosmética), debe forzarse a una escala numérica (0–10) o a una categórica ordinal predefinida, nunca a un campo de texto abierto.
3. **Las variables del núcleo fijo nunca deben ser obligatorias para poder guardar un registro**; un campo vacío se excluye del análisis de esa variable concreta sin generar error ni bloquear el guardado del resto del registro.
4. **Variables cualitativas no dicotómicas complejas** (ej. "complicaciones", "clínica del episodio") deben poder descomponerse en múltiples variables dicotómicas hijas, siguiendo el patrón de 2.3.1.
5. El constructor de variables debe permitir **añadir y quitar variables por estudio** sin afectar a otros estudios (esquema flexible tipo "campos dinámicos", no columnas fijas por patología a nivel de base de datos).

---

## 4. Motor de análisis estadístico

Este es el segundo bloque funcional del módulo: una vez recogidos los datos, el sistema debe guiar/automatizar la elección e interpretación de las pruebas estadísticas correctas.

### 4.1 Principio general

El análisis estadístico depende de dos factores:

1. El **tipo de variable** (cualitativa o cuantitativa).
2. El **objetivo del análisis**: describir, comparar entre grupos, buscar asociación, predecir, o medir concordancia/fiabilidad.

### 4.2 Tabla-resumen de tipos de variable

| Tipo de variable | Ejemplos | Cómo se describe | Pruebas estadísticas frecuentes |
|---|---|---|---|
| **Cuantitativa continua** | Edad, peso, presión arterial, glucemia | Media ± DE (si distribución normal) o mediana (RIQ) (si no normal) | t de Student, ANOVA, Mann-Whitney, Wilcoxon, Kruskal-Wallis, correlación de Pearson/Spearman, regresión lineal |
| **Cuantitativa discreta** | Número de ingresos, número de hijos | Igual que las continuas | Igual que las continuas, o modelos de Poisson |
| **Cualitativa nominal** | Sexo, fumador (sí/no), grupo sanguíneo | Frecuencia (nº) y porcentaje % | Chi-cuadrado, Fisher, regresión logística |
| **Cualitativa ordinal** | Dolor leve-moderado-grave, estadio I-IV | Frecuencia (nº) y porcentaje % | Chi-cuadrado para tendencia, Mann-Whitney, Kruskal-Wallis, Spearman |

### 4.3 Descripción de variables

**Variables cuantitativas:**
1. Comprobar previamente si siguen una **distribución normal**, mediante (en este orden de uso habitual): histograma, QQ-plot, test de Shapiro-Wilk (el más usado), Kolmogorov-Smirnov.
2. Si es **normal** → presentar como **media ± desviación estándar (DE)**. Ejemplo: Edad 65 ± 12 años.
3. Si **no es normal** → presentar como **mediana (rango intercuartílico, RIQ)**. Ejemplo: PCR 8 (3–20) mg/L.

**Variables cualitativas:**
- Nunca se presentan con medias.
- Se describen como **n (%)**.

Ejemplo (variable "Sexo"):

| Sexo | n (%) |
|---|---|
| Hombre | 80 (60%) |
| Mujer | 53 (40%) |

### 4.4 Selección de la prueba estadística (tabla de decisión)

| Objetivo del análisis | Nº de grupos / condición | Variable normal | Prueba estadística |
|---|---|---|---|
| Comparar cuantitativa entre grupos independientes | 2 grupos | Sí | t de Student |
| Comparar cuantitativa entre grupos independientes | 2 grupos | No | Mann-Whitney U |
| Comparar cuantitativa entre grupos apareados (antes/después) | 2 medidas | Sí | t de Student pareada |
| Comparar cuantitativa entre grupos apareados (antes/después) | 2 medidas | No | Wilcoxon |
| Comparar cuantitativa entre grupos independientes | 3 o más grupos | Sí | ANOVA |
| Comparar cuantitativa entre grupos independientes | 3 o más grupos | No | Kruskal-Wallis |
| Comparar variables cualitativas entre grupos | — | — | Chi-cuadrado (si frecuencias esperadas suficientes); Test exacto de Fisher (si alguna celda esperada < 5) |
| Asociación entre dos cuantitativas | — | Ambas normales | Correlación de Pearson (r) |
| Asociación entre dos cuantitativas | — | Alguna no normal | Correlación de Spearman (ρ) |
| Asociación entre cualitativa (2 grupos) y cuantitativa | — | Normal | t de Student |
| Asociación entre cualitativa (2 grupos) y cuantitativa | — | No normal | Mann-Whitney |
| Asociación entre dos cualitativas | — | — | Chi-cuadrado o Fisher |
| Predicción de resultado continuo | — | — | Regresión lineal → coeficiente β, IC95%, p |
| Predicción de resultado binario (Sí/No) | — | — | Regresión logística → Odds Ratio (OR), IC95%, p |
| Predicción de tiempo hasta evento | — | — | Kaplan-Meier (curvas) + Log-rank (comparación) + Regresión de Cox (multivariable) → Hazard Ratio (HR), IC95%, p |
| Concordancia entre observadores (variable cualitativa) | — | — | Kappa de Cohen |
| Concordancia entre observadores (variable continua) | — | — | Coeficiente de correlación intraclase (ICC) |
| Fiabilidad/consistencia interna de un cuestionario | — | — | Alfa de Cronbach |

Ejemplo de comparación de una variable cualitativa (complicaciones Sí/No) entre dos tratamientos, resuelto con Chi-cuadrado/Fisher:

| | Sí | No |
|---|---|---|
| Tratamiento A | 12 | 88 |
| Tratamiento B | 30 | 70 |

### 4.5 Árbol de decisión simplificado (para lógica de negocio / UX del asistente estadístico)

El sistema puede guiar al usuario (o decidir automáticamente la prueba sugerida) con esta secuencia:

1. **¿Qué tipo de variable dependiente (resultado) se analiza?**
   - Continua → ir a 2 (rama paramétrica/no paramétrica clásica)
   - Categórica (Sí/No o varias categorías) → Chi-cuadrado, Fisher o regresión logística
   - Tiempo hasta un evento → Kaplan-Meier / regresión de Cox
2. **¿Cuántos grupos se comparan?**
   - 2 grupos → t de Student o Mann-Whitney (cuantitativas); Chi-cuadrado o Fisher (cualitativas)
   - 3 o más grupos → ANOVA o Kruskal-Wallis
3. **¿La variable continua sigue una distribución normal?**
   - Sí → pruebas paramétricas (t de Student, ANOVA, Pearson)
   - No → pruebas no paramétricas (Mann-Whitney, Wilcoxon, Kruskal-Wallis, Spearman)

Esta lógica es la que debería poder automatizar (o al menos sugerir) el módulo de análisis: dado el tipo de las variables seleccionadas por el usuario y un test de normalidad, sugerir la prueba estadística adecuada.

### 4.6 Interpretación de resultados

- Los resultados inferenciales se expresan con un **intervalo de confianza del 95% (IC95%)** y un **valor p**.
- **Regla estándar de significación:** un valor es estadísticamente significativo si **p < 0,05**.
- Si **p > 0,05**, el resultado se considera no significativo: no puede afirmarse que la variable sea causante o modifique el resultado, aunque puede orientar a una tendencia que requiera confirmarse con una muestra (N) mayor.
- El sistema debe mostrar siempre, junto al resultado del test, el **tamaño muestral (N)** utilizado, ya que una N pequeña limita la capacidad de confirmar hallazgos aunque haya una tendencia.

### 4.7 Tabla resumen rápido de los tests más utilizados

Esta tabla es la referencia rápida que el "asistente estadístico" del sistema debería poder reproducir dado el objetivo y el tipo de variable elegidos por el usuario:

| Objetivo | Variable | Test |
|---|---|---|
| Describir variable continua normal | Cuantitativa | Media ± DE |
| Describir variable continua no normal | Cuantitativa | Mediana (RIQ) |
| Describir variable categórica | Cualitativa | n (%) |
| Comparar dos medias independientes | Cuantitativa | t de Student |
| Comparar dos medianas independientes | Cuantitativa | Mann-Whitney |
| Comparar antes-después | Cuantitativa | t pareada o Wilcoxon |
| Comparar tres o más grupos | Cuantitativa | ANOVA o Kruskal-Wallis |
| Comparar proporciones | Cualitativa | Chi-cuadrado |
| Comparar proporciones con muestras pequeñas | Cualitativa | Fisher |
| Correlación entre dos variables continuas normales | Cuantitativa | Pearson |
| Correlación no normal u ordinal | Cuantitativa/Ordinal | Spearman |
| Resultado continuo | Dependiente continua | Regresión lineal |
| Resultado binario | Dependiente sí/no | Regresión logística |
| Tiempo hasta un evento | Supervivencia | Kaplan-Meier + Log-rank + regresión de Cox |
| Concordancia entre evaluadores | Cualitativa | Kappa |
| Concordancia en variables continuas | Cuantitativa | ICC |
| Fiabilidad de escalas | Cuestionarios | Alfa de Cronbach |

### 4.8 Objetivo típico del análisis (contexto de negocio, no funcional per se)

El propósito habitual de estos análisis en investigación clínica es identificar **factores de riesgo** (aumentan la probabilidad de una patología o complicación) y **factores protectores** (la disminuyen), comparando la presencia de una variable (ej. tabaquismo) frente a un resultado clínico (ej. hipertensión arterial). Es útil que el módulo de resultados permita etiquetar/interpretar una asociación significativa como "factor de riesgo" o "factor protector" según el sentido del efecto (OR/HR > 1 o < 1).

---

## 5. Visión futura (fuera de alcance de esta fase, no implementar todavía)

El usuario ha expresado como objetivo a largo plazo — **no forma parte de esta iteración** — que el sistema pueda generar automáticamente, mediante IA, un borrador de artículo científico a partir de la base de datos de un estudio y los resultados estadísticos más relevantes. Se documenta aquí únicamente como contexto de producto, para que las decisiones de arquitectura actuales (estructura de datos, trazabilidad de qué test se aplicó a qué variables y con qué resultado) no dificulten esa funcionalidad en el futuro. Recomendación: guardar de forma estructurada y trazable cada análisis ejecutado (variables implicadas, test usado, resultado, p, IC95%) para que en el futuro pueda servir de "materia prima" a una generación de texto por IA.

---

## 6. Requisitos funcionales derivados (resumen para backlog)

1. CRUD de **estudios de investigación** (ResearchStudy).
2. Constructor dinámico de **variables por estudio**, con:
   - Selección de tipo de variable (ver §3, regla 1).
   - Marcado de variables del núcleo fijo (siempre presentes, nunca obligatorias) vs. variables específicas del estudio.
   - Soporte para variables compuestas (ej. hábitos tóxicos) y descomposición en dicotómicas hijas (ej. complicaciones).
3. Formulario de **registro de pacientes en un estudio**, que:
   - No bloquee el guardado si faltan variables del núcleo fijo.
   - Valide que las variables cualitativas no dicotómicas usen catálogos/escalas cerradas, no texto libre.
4. Motor de **análisis estadístico** que:
   - Calcule descripción de variables (media±DE o mediana(RIQ) según normalidad; n/% para cualitativas).
   - Ejecute el test de normalidad (Shapiro-Wilk como mínimo).
   - Sugiera o seleccione automáticamente el test adecuado según la tabla de decisión (§4.4–4.5, §4.7).
   - Muestre resultado con estadístico, IC95%, valor p y N.
5. Registro trazable de cada análisis ejecutado (variables, test, resultado) — pensado para dar soporte a la futura generación de artículos por IA (§5), sin implementarla todavía.

---

## 7. Glosario rápido

- **IPA:** Índice Paquetes-Año (consumo de tabaco).
- **UBE:** Unidad de Bebida Estándar (consumo de alcohol).
- **DE:** Desviación estándar.
- **RIQ:** Rango intercuartílico.
- **IC95%:** Intervalo de confianza del 95%.
- **OR:** Odds Ratio (regresión logística).
- **HR:** Hazard Ratio (regresión de Cox).
- **VHIT / VEMPs:** Pruebas vestibulares usadas en el estudio de ejemplo de vértigo ORL.