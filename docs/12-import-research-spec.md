# 12-import-research-spec.md
## MediCore — Importación de Datos y Motor de Investigación Clínica

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `02-data-schema.md`, `03-business-rules.md`, `04-design-spec.md` aprobados
> **Contexto:** Este documento nace del análisis de bases de datos reales de médicos ORL.
> Los archivos analizados muestran la realidad del trabajo clínico:
> fechas como seriales Excel, NHC mezclados con nombres completos, campos vacíos
> aleatorios, notas libres intercaladas con datos estructurados, y secciones
> sin estructura formal. La solución no puede exigir orden donde no lo hay.

---

## Índice

1. [Cambio de Paradigma](#1-cambio-de-paradigma)
2. [Módulo de Importación — Visión General](#2-módulo-de-importación--visión-general)
3. [Pipeline de Importación con IA](#3-pipeline-de-importación-con-ia)
4. [Cruce y Deduplicación de Pacientes](#4-cruce-y-deduplicación-de-pacientes)
5. [Recordatorio Periódico de Importación](#5-recordatorio-periódico-de-importación)
6. [Cambios en el Schema de Datos](#6-cambios-en-el-schema-de-datos)
7. [Motor de Investigación Clínica — Visión General](#7-motor-de-investigación-clínica--visión-general)
8. [Arquitectura del Motor de Filtrado](#8-arquitectura-del-motor-de-filtrado)
9. [Tipos de Filtros y Operadores](#9-tipos-de-filtros-y-operadores)
10. [Visualizaciones y Outputs](#10-visualizaciones-y-outputs)
11. [Guardado de Consultas y Colecciones](#11-guardado-de-consultas-y-colecciones)
12. [Cambios en Documentos Existentes](#12-cambios-en-documentos-existentes)
13. [Roadmap de Implementación — Fases](#13-roadmap-de-implementación--fases)

---

## 1. Cambio de Paradigma

Los documentos anteriores diseñaron MediCore como una herramienta de **registro prospectivo**: el médico introduce datos en el momento de la consulta. Ese flujo sigue siendo válido y deseable.

Pero la realidad observada en los archivos reales revela un segundo flujo completamente distinto: el médico ya tiene datos en Excel heterogéneos acumulados durante años, y los usa retrospectivamente cuando quiere publicar un estudio.

Estos dos flujos no son contradictorios — son complementarios. MediCore debe soportar ambos:

```
FLUJO A — Prospectivo (lo diseñado hasta ahora)
  Médico ve paciente → registra en MediCore en tiempo real
  Datos estructurados, campos conocidos, historia completa

FLUJO B — Retrospectivo (lo nuevo)
  Estadista del hospital entrega Excel → médico importa a MediCore
  Datos heterogéneos, campos variables, solo los datos del estudio

FLUJO C — Híbrido (el objetivo a largo plazo)
  El médico importa periódicamente todos sus pacientes del hospital
  MediCore cruza los nuevos con los existentes
  Con el tiempo, la base de datos se vuelve completa y actualizada
  El médico nunca más necesita pedir datos al estadista
```

El Flujo C es el diferencial real de MediCore. Un médico que importa sus pacientes cada dos semanas durante 3 años tiene una base de datos clínica propia, estructurada y explorable que ningún hospital le puede dar.

---

## 2. Módulo de Importación — Visión General

### Formatos soportados

```
Excel (.xlsx, .xls)     Prioridad máxima — formato universal en hospitales
CSV (.csv)              Alternativa común de sistemas HIS
TSV (.tsv)              Menos frecuente pero presente
```

### Principios de diseño

**Tolerancia total a la imperfección.** El sistema nunca rechaza un archivo por estar "mal formateado". Todo archivo tiene alguna información útil. El sistema extrae lo que puede y deja al médico decidir qué hacer con el resto.

**IA como intérprete, médico como validador.** Claude analiza la estructura del archivo y propone el mapeo. El médico confirma, corrige o rechaza. Nunca se importa nada sin confirmación explícita.

**Conservación del original.** Los datos originales del Excel se guardan íntegros en `importedData` JSONB. Aunque el mapeo sea imperfecto, el dato original siempre está disponible para reinterpretarse después.

**Cruce inteligente.** El sistema busca activamente pacientes existentes para enriquecer fichas en lugar de crear duplicados.

---

## 3. Pipeline de Importación con IA

El pipeline tiene 5 etapas. El médico solo interviene en las etapas 2 y 4.

```
ETAPA 1 — ANÁLISIS AUTOMÁTICO (segundos)
  Sistema lee el archivo
  Claude analiza estructura: detecta columnas, tipos de dato, filas basura
  Genera propuesta de mapeo + lista de problemas detectados

ETAPA 2 — CONFIRMACIÓN DEL MÉDICO (UI)
  Médico ve el mapeo propuesto
  Puede corregir columna por columna
  Puede excluir columnas que no le interesan
  Puede marcar columnas como "campo personalizado"
  Confirma o cancela

ETAPA 3 — LIMPIEZA AUTOMÁTICA (segundos)
  Conversión de fechas seriales Excel a fechas reales
  Normalización de capitalización (Periamigdalino / periamigdalino / PERiamigdalino → periamigdalino)
  Extracción de NHC de celdas mixtas ("EDUARDO MARTINEZ ALVAREZ (45)" → NHC no extraíble, marcar)
  Detección y exclusión de filas basura (totales, medias, notas del investigador)
  Eliminación de filas sin datos mínimos identificables

ETAPA 4 — RESOLUCIÓN DE CRUCES (UI, si hay matches)
  Sistema muestra pacientes del Excel que ya existen en MediCore
  Médico confirma: "sí, es el mismo paciente" o "no, crear nuevo"
  Para los confirmados: elige qué datos del Excel enriquecen la ficha existente

ETAPA 5 — IMPORTACIÓN FINAL
  Persiste los datos confirmados
  Crea registro ImportBatch con metadatos completos
  Genera resumen: X pacientes nuevos, Y fichas enriquecidas, Z filas descartadas
```

### Detalle de la Etapa 1 — Prompt a Claude

El prompt enviado a Claude incluye:
- Las primeras 20 filas del archivo (nunca datos de identificación innecesarios)
- Los nombres de todas las columnas
- Una lista de los campos estándar de MediCore a los que puede mapear

```typescript
// apps/api/src/infrastructure/ai/import-analyzer.service.ts

const systemPrompt = `
Eres un asistente especializado en analizar bases de datos médicas de hospitales españoles.
Recibirás las primeras filas de un archivo Excel de un médico y debes:

1. Identificar qué columna corresponde a cada campo clínico estándar
2. Detectar problemas de calidad de datos
3. Identificar filas que NO son datos de pacientes (totales, notas, medias, metadatos)
4. Proponer un mapeo de columnas a campos estándar

Campos estándar disponibles:
- nhc: número de historia clínica del paciente
- patientName: nombre completo del paciente
- birthDate: fecha de nacimiento
- age: edad en años
- sex: sexo (H/M/Hombre/Mujer/Male/Female)
- admissionDate: fecha de ingreso o de la intervención
- diagnosis: diagnóstico principal
- procedure: procedimiento realizado
- [cualquier otro campo se mapea como campo personalizado]

Responde SOLO con JSON válido, sin texto adicional.
`

const userPrompt = `
Columnas del archivo: ${columnNames.join(', ')}

Primeras filas (tab-separado):
${sampleRows}

Devuelve un JSON con esta estructura exacta:
{
  "columnMapping": {
    "NombreColumnaOriginal": "nhc" | "patientName" | "birthDate" | "age" | "sex" | 
                             "admissionDate" | "diagnosis" | "procedure" | "custom" | "ignore"
  },
  "customFieldNames": {
    "NombreColumnaOriginal": "nombre legible para el médico"
  },
  "junkRows": [índices de filas que NO son datos de pacientes],
  "issues": ["descripción del problema detectado"],
  "confidence": 0.0-1.0,
  "notes": "observaciones relevantes para el médico"
}
`
```

### Detalle de la Etapa 3 — Limpieza automática

```typescript
// apps/api/src/application/import/services/data-cleaner.service.ts

export class DataCleanerService {

  // Conversión de serial Excel a fecha
  // Excel cuenta días desde 1900-01-01 (con bug del año bisiesto de Lotus 123)
  convertExcelDate(serial: number): Date {
    return new Date((serial - 25569) * 86400 * 1000)
  }

  // Normalización de texto clínico
  normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')                    // descompone acentos
      .replace(/[\u0300-\u036f]/g, '')     // elimina diacríticos para comparar
      .trim()
  }

  // Extracción de NHC de celdas mixtas
  // "EDUARDO MARTINEZ ALVAREZ (45)" → { name: "EDUARDO MARTINEZ ALVAREZ", age: 45, nhc: null }
  // "1.8685362E7" → { nhc: "18685362" }
  // "13046043" → { nhc: "13046043" }
  parsePatientIdentifier(cell: string): { nhc: string | null; name: string | null; age: number | null } {
    // Número puro → NHC
    if (/^\d+(\.\d+)?(E\d+)?$/.test(cell.trim())) {
      const nhc = Math.round(parseFloat(cell)).toString()
      return { nhc, name: null, age: null }
    }
    // Nombre con edad entre paréntesis
    const nameWithAge = cell.match(/^(.+?)\s*\((\d+)\)$/)
    if (nameWithAge) {
      return { nhc: null, name: nameWithAge[1].trim(), age: parseInt(nameWithAge[2]) }
    }
    // Nombre con sexo y edad: "NOMBRE (HOME, 25 anys)" / "NOMBRE (DONA, 71 anys)"
    const nameWithSexAge = cell.match(/^(.+?)\s*\((HOME|DONA|H|M),\s*(\d+).*\)$/i)
    if (nameWithSexAge) {
      return { nhc: null, name: nameWithSexAge[1].trim(), age: parseInt(nameWithSexAge[3]) }
    }
    // Texto puro → nombre
    return { nhc: null, name: cell.trim(), age: null }
  }

  // Detección de filas basura
  // "X=2,4", "X: 112", "robot daVinci Xi.", filas de totales/medias
  isJunkRow(row: Record<string, unknown>): boolean {
    const values = Object.values(row).filter(Boolean)
    if (values.length === 0) return true
    if (values.length === 1) {
      const v = String(values[0])
      // Una sola celda con texto que parece nota o metadato
      if (v.startsWith('X=') || v.startsWith('X:')) return true
      if (v.toLowerCase().includes('robot') || v.toLowerCase().includes('daVinci')) return true
    }
    // Fila donde el único valor numérico es un promedio (tiene decimales, sin NHC)
    const hasPatientId = Object.values(row).some(v => {
      const s = String(v ?? '')
      return /^\d{6,}/.test(s) || /\d+E\d+/.test(s)
    })
    return !hasPatientId && values.length < 3
  }
}
```

---

## 4. Cruce y Deduplicación de Pacientes

### Estrategia de cruce por confianza

No todos los datos tienen la misma fiabilidad para identificar a un paciente. El sistema usa un sistema de puntuación:

```
Campo coincidente          Puntos    Razonamiento
────────────────────────────────────────────────────────────────
NHC exacto                  100      Identificador inequívoco
NHC + organización          100      El más fiable posible
Nombre completo exacto       60      Puede haber homónimos
Nombre + fecha nacimiento    90      Muy fiable
Nombre + edad aproximada     50      Edad puede variar por año
Nombre parcial (apellidos)   30      Poco fiable solo

Umbral para match automático:    ≥ 90 puntos → cruce automático, aviso al médico
Umbral para sugerencia:          50-89 puntos → el médico decide
Por debajo de 50:                se crea como paciente nuevo
```

### Lógica de enriquecimiento

Cuando se confirma un cruce entre un paciente del Excel y uno existente en MediCore, el sistema no sobreescribe datos — los enriquece:

```typescript
// Reglas de enriquecimiento
// Los datos manuales (registrados directamente en MediCore) tienen prioridad
// sobre los importados. La excepción son los campos personalizados del Excel,
// que siempre se añaden porque son datos nuevos que no existían antes.

async enrichPatient(existingPatient: Patient, importedData: ImportedRow) {
  const updates: Partial<Patient> = {}

  // Solo actualiza campos estándar si estaban vacíos
  if (!existingPatient.birthDate && importedData.birthDate) {
    updates.birthDate = importedData.birthDate
  }
  if (!existingPatient.sex && importedData.sex) {
    updates.sex = importedData.sex
  }

  // Los campos personalizados siempre se añaden/actualizan
  // Se acumulan en importedData agrupados por importBatchId
  const existingImportedData = existingPatient.importedData as Record<string, unknown> ?? {}
  updates.importedData = {
    ...existingImportedData,
    [importedData.batchId]: importedData.customFields,
  }

  await this.patientRepository.update(existingPatient.id, updates)
}
```

### UI de resolución de cruces

```
┌─────────────────────────────────────────────────────────────────────┐
│  Revisión de duplicados — 3 posibles coincidencias encontradas      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Excel: IVAN RUMI VALLEJO · NHC 13046043 · 50 años                 │
│                                                                     │
│  ┌─ Coincidencia en MediCore ──────────────────────────── 95 pts ─┐ │
│  │  Iván Rumí Vallejo · NHC 2026-00012 · 50 años · H             │ │
│  │  Última consulta: 15/03/2025                                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ¿Qué hacer?                                                        │
│  ● Es el mismo paciente — enriquecer ficha existente               │
│  ○ No es el mismo — crear paciente nuevo                           │
│                                                                     │
│  Datos que se añadirán a la ficha:                                  │
│  ✓ Fecha IQ: 31/03/2025                                            │
│  ✓ Abordaje: Laterocervical derecha                                │
│  ✓ Diagnóstico: Quiste branquial                                   │
│  ✓ Tiempo quirúrgico: 138 min                                      │
│  ✓ EVA: 8/10                                                       │
│                                                                     │
│                      [Aplicar a todos similares]  [Confirmar]       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Recordatorio Periódico de Importación

### Lógica del recordatorio

El objetivo es que el médico mantenga su base de datos actualizada sin tener que recordarlo. Un recordatorio cada 15 días (configurable) lo hace sostenible sin ser molesto.

```typescript
// apps/api/src/infrastructure/queue/jobs/import-reminder.job.ts

// CRON: cada día a las 09:00 — verifica qué organizaciones necesitan recordatorio
// No se envía el recordatorio el mismo día ni si el médico acaba de importar

async checkImportReminders() {
  const organizations = await this.organizationRepository.findAll()

  for (const org of organizations) {
    const lastImport  = await this.importRepository.findLastByOrg(org.id)
    const reminderGap = org.settings.importReminderDays ?? 15  // configurable por org

    const daysSinceLastImport = lastImport
      ? differenceInDays(new Date(), lastImport.createdAt)
      : Infinity  // nunca ha importado → recordar desde el día 1

    if (daysSinceLastImport >= reminderGap) {
      await this.notificationService.sendImportReminder(org)
    }
  }
}
```

### UI del recordatorio

No es un email — es un banner no intrusivo dentro de la propia app, visible al entrar al dashboard:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📥  Han pasado 18 días desde tu última importación.               │
│  Importa los pacientes de las últimas semanas para mantener        │
│  tu base de datos actualizada.                                      │
│                              [Importar ahora]  [Recordarme en 7d]  │
└─────────────────────────────────────────────────────────────────────┘
```

- El banner aparece en la parte superior del dashboard, debajo del header
- No bloquea el acceso a ninguna funcionalidad
- "Recordarme en 7 días" pospone el recordatorio sin desactivarlo
- Desaparece automáticamente en cuanto el médico realiza una importación
- Configurable en Ajustes → Importación: frecuencia (7, 15, 30 días) o desactivar

---

## 6. Cambios en el Schema de Datos

### Nuevos modelos Prisma

```prisma
// Añadir a apps/api/prisma/schema.prisma

model ImportBatch {
  id              String   @id @default(uuid())
  organizationId  String
  createdBy       String   // userId del médico que importó

  // Metadata del archivo original
  fileName        String
  fileSize        Int      // bytes
  originalFormat  String   // "xlsx" | "csv" | "tsv"

  // Resultado del análisis IA
  columnMapping   Json     // { "Nº HISTORIA": "nhc", "Edad": "age", ... }
  aiConfidence    Float    // 0.0 - 1.0

  // Resultado de la importación
  totalRows       Int      // filas en el archivo original
  importedRows    Int      // pacientes creados o enriquecidos
  enrichedRows    Int      // pacientes existentes enriquecidos
  createdRows     Int      // pacientes nuevos creados
  skippedRows     Int      // filas descartadas (basura, sin datos mínimos)
  pendingRows     Int      // filas pendientes de resolución manual

  // Estado
  status          ImportStatus @default(PENDING)

  createdAt       DateTime @default(now())
  completedAt     DateTime?

  organization    Organization @relation(fields: [organizationId], references: [id])
  patients        Patient[]    // pacientes creados o enriquecidos en este batch

  @@index([organizationId])
  @@index([organizationId, createdAt])
  @@map("import_batches")
}

enum ImportStatus {
  PENDING       // análisis en curso
  CONFIRMING    // esperando confirmación del médico
  PROCESSING    // importando datos
  COMPLETED     // importación finalizada
  FAILED        // error durante la importación
}
```

### Cambios en el modelo Patient

```prisma
model Patient {
  // ... todos los campos existentes ...

  // Datos de importación
  importedData    Json?    // { "batch-uuid-1": { campo: valor, ... }, "batch-uuid-2": { ... } }
  importSource    String?  // "excel" | "csv" | "manual" (null = registro manual)
  importBatchId   String?  // último batch que creó o enriqueció esta ficha

  importBatch     ImportBatch? @relation(fields: [importBatchId], references: [id])

  @@index([organizationId, importBatchId])
}
```

### Estructura del `importedData` JSONB

```json
{
  "batch-uuid-1": {
    "_batchName": "TORS_abordaje_laterocervical.xlsx",
    "_importedAt": "2026-06-09T10:00:00Z",
    "Abordaje": "Laterocervical derecha",
    "Sospecha diagnóstica": "Quiste branquial",
    "IQ": "Vaciamiento II-III",
    "Tiempo quirúrgico (min)": 138,
    "Complicaciones": "0",
    "EVA": 8,
    "satisfacción cosmética": "satisfet",
    "Tabaco": "fumador 15 cigarrillos/día x 25 años"
  },
  "batch-uuid-2": {
    "_batchName": "IN_OFFICE_LARINGE.xlsx",
    "_importedAt": "2026-09-15T10:00:00Z",
    "Prueba": "EMG simple",
    "Diagnóstico": "P NLR Izdo",
    "Fecha de realización": "2025-11-20"
  }
}
```

Cada batch añade su propio bloque. Los datos de diferentes estudios conviven sin pisarse. El médico puede ver "este paciente aparece en 3 de mis bases de datos".

---

## 7. Motor de Investigación Clínica — Visión General

El módulo de Analytics actual (diseñado en `04-design-spec.md`) era un dashboard fijo de KPIs. Este módulo es algo fundamentalmente diferente: un **explorador de datos ad hoc**.

El médico llega aquí con una pregunta — "¿cuál es el tiempo quirúrgico medio en mis septoplastias en pacientes mayores de 50 años con ASA II?" — y el sistema le permite construir esa consulta visualmente, obtener el resultado, y guardarlo para el futuro.

### El problema central que resuelve

```
Sin MediCore (situación actual):
  Médico quiere publicar → pide datos al estadista
  Estadista entrega Excel → médico limpia manualmente
  Médico calcula medias en Excel → médico hace gráficas en Excel
  Médico descubre que falta un campo → vuelve al estadista
  Semanas de trabajo para un análisis básico

Con MediCore (objetivo):
  Médico abre el Motor de Investigación
  Construye el filtro visualmente en 2 minutos
  Obtiene gráficas, medias y tabla al instante
  Guarda la consulta como "Estudio Septoplastias 2024-2026"
  Puede actualizar los resultados en un clic cuando importa nuevos pacientes
```

---

## 8. Arquitectura del Motor de Filtrado

### Modelo mental: el Explorador de Datos

```
┌─────────────────────────────────────────────────────────────────────┐
│  Motor de Investigación                                             │
├─────────────────┬───────────────────────────────────────────────────┤
│  FUENTE         │  Todos mis pacientes                         ▾    │
├─────────────────┼───────────────────────────────────────────────────┤
│  FILTROS        │  [+ Añadir filtro]                               │
│                 │                                                   │
│                 │  Diagnóstico  contiene  "rinitis"            [×]  │
│                 │  Edad         mayor que  40                  [×]  │
│                 │  Fecha IQ     entre  01/01/2024 y 31/12/2025 [×] │
│                 │  Sexo         es  Mujer                      [×]  │
│                 │                                                   │
├─────────────────┼───────────────────────────────────────────────────┤
│  CAMPOS A VER   │  Nombre  ·  NHC  ·  Edad  ·  Diagnóstico        │
│                 │  Tiempo quirúrgico  ·  Complicaciones            │
│                 │  [+ Añadir campo]                                 │
├─────────────────┼───────────────────────────────────────────────────┤
│  RESULTADO      │  47 pacientes encontrados                        │
│                 │                                                   │
│                 │  [Tabla]  [Gráficas]  [Estadísticas]             │
│                 │                                                   │
│  [Guardar consulta]  [Exportar CSV]  [Exportar PDF]                │
└─────────────────────────────────────────────────────────────────────┘
```

### Modelo de datos de una consulta guardada

```typescript
// packages/contracts/src/research-query.schema.ts

const FilterSchema = z.object({
  field:    z.string(),     // "age" | "diagnosis" | campo personalizado del importedData
  source:   z.enum(['standard', 'imported', 'consultation', 'surgery', 'medication']),
  operator: z.enum([
    'equals', 'not_equals',
    'contains', 'not_contains', 'starts_with',
    'greater_than', 'less_than', 'between',
    'is_empty', 'is_not_empty',
    'in_list',
    'date_before', 'date_after', 'date_between',
    'boolean_true', 'boolean_false',
  ]),
  value:    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  valueTo:  z.union([z.string(), z.number()]).optional(),  // para operadores "between"
})

const ResearchQuerySchema = z.object({
  id:             z.string().uuid(),
  organizationId: z.string().uuid(),
  name:           z.string(),           // "Estudio Septoplastias 2024-2026"
  description:    z.string().optional(),

  // Fuente de datos
  dataSource:     z.enum(['all_patients', 'import_batch', 'manual_only', 'imported_only']),
  importBatchIds: z.array(z.string()).optional(),  // si dataSource = 'import_batch'

  // Filtros (AND entre ellos por defecto, OR configurable)
  filters:        z.array(FilterSchema),
  filterLogic:    z.enum(['AND', 'OR']).default('AND'),

  // Campos a mostrar en el resultado
  displayFields:  z.array(z.string()),

  // Visualizaciones activas
  visualizations: z.array(z.enum(['table', 'bar_chart', 'line_chart', 'scatter', 'stats'])),

  createdAt:      z.string().datetime(),
  updatedAt:      z.string().datetime(),
})
```

### Backend: traducción de filtros a Prisma

El motor traduce los filtros del médico a queries Prisma en tiempo de ejecución. Los campos estándar van a columnas de la tabla `patients`; los campos personalizados van al operador `@>` de PostgreSQL sobre el JSONB de `importedData`.

```typescript
// apps/api/src/application/research/queries/execute-research-query.handler.ts

export class ExecuteResearchQueryHandler {

  buildPrismaWhere(filters: Filter[], organizationId: string): Prisma.PatientWhereInput {
    const where: Prisma.PatientWhereInput = { organizationId, deletedAt: null }

    for (const filter of filters) {
      if (filter.source === 'standard') {
        // Campos estándar → columnas de la tabla patients
        where[filter.field] = this.buildPrismaOperator(filter)

      } else if (filter.source === 'imported') {
        // Campos personalizados → búsqueda en JSONB importedData
        // Usa path expressions de PostgreSQL sobre el JSONB anidado
        where.importedData = {
          path:    ['$[*]', filter.field],   // busca en cualquier batch
          ...this.buildJsonbOperator(filter),
        }

      } else if (filter.source === 'consultation') {
        // Filtra por datos de consultas asociadas
        where.consultations = {
          some: {
            [filter.field]: this.buildPrismaOperator(filter),
            deletedAt: null,
          }
        }
      }
      // etc. para surgery, medication
    }

    return where
  }

  buildPrismaOperator(filter: Filter): unknown {
    switch (filter.operator) {
      case 'equals':       return { equals: filter.value }
      case 'contains':     return { contains: filter.value, mode: 'insensitive' }
      case 'greater_than': return { gt: filter.value }
      case 'less_than':    return { lt: filter.value }
      case 'between':      return { gte: filter.value, lte: filter.valueTo }
      case 'is_empty':     return null
      case 'in_list':      return { in: filter.value as string[] }
      // ...
    }
  }
}
```

---

## 9. Tipos de Filtros y Operadores

### Campos filtrables y sus operadores disponibles

```
CAMPOS ESTÁNDAR DEL PACIENTE
─────────────────────────────────────────────────────────────────────
age / birthDate        entre, mayor que, menor que, es exacto
sex                    es (H/M/Otro)
diagnosis (CIE-10)     contiene, es exacto, empieza por, en lista
procedure (CIE-10-PCS) contiene, es exacto, en lista
bloodType              es
createdAt              antes de, después de, entre fechas
importSource           es (manual / importado / ambos)

CAMPOS DE CONSULTA
─────────────────────────────────────────────────────────────────────
chiefComplaint         contiene, no contiene
assessment             contiene
consultationType       es, en lista
consultationDate       antes de, después de, entre
physicianId            es (filtrar por médico en org con varios)

CAMPOS DE CIRUGÍA
─────────────────────────────────────────────────────────────────────
procedureType          contiene, es exacto, en lista
surgeryDate            antes de, después de, entre
asa                    es, mayor que
duration               entre, mayor que, menor que
complications          contiene, está vacío, no está vacío
anesthesiaType         es, en lista
surgeryStatus          es

CAMPOS DE MEDICACIÓN
─────────────────────────────────────────────────────────────────────
drugName               contiene, es exacto
activeIngredient       contiene, es exacto
medicationStatus       es
startDate              antes de, después de, entre

ESCALAS CLÍNICAS
─────────────────────────────────────────────────────────────────────
scaleType              es (SNOT_22, DHI, VHI, etc.)
totalScore             entre, mayor que, menor que
scaleDate              antes de, después de, entre

CAMPOS IMPORTADOS (dinámicos)
─────────────────────────────────────────────────────────────────────
[cualquier campo de importedData]
  Si es numérico:      entre, mayor que, menor que
  Si es texto:         contiene, es exacto, no está vacío
  Si es fecha:         antes de, después de, entre
  Si es booleano:      es verdadero, es falso
```

### Búsqueda por texto libre global

Además de los filtros estructurados, el médico puede escribir una query en lenguaje natural:

```
[🔍 Busca en todo... "pacientes con sangrado en cirugías de amígdalas en 2024"]
```

Claude interpreta la query y la traduce a filtros estructurados que el médico puede ver, editar y confirmar. No es magia — es una forma rápida de construir el filtro inicial.

---

## 10. Visualizaciones y Outputs

### Tipos de visualización disponibles

**Tabla de datos**
Vista tabular con todos los campos seleccionados. Ordenable por cualquier columna. Exportable a CSV/Excel.

```
NHC          Nombre              Edad  Diagnóstico           Tiempo IQ  EVA
2026-00012   Iván Rumí Vallejo   50    Quiste branquial      138 min    8/10
2026-00034   Ana García López    42    Rinosinusitis crónica —          —
...
```

**Estadísticas descriptivas**
Para campos numéricos seleccionados, automáticamente:

```
Tiempo quirúrgico (min)     N=7
  Media:    110.6
  Mediana:  114.0
  Mín:       86     Máx: 138
  DE:        17.4
  IC 95%:   [94.5 — 126.7]
```

**Gráficas**

```
Tipos disponibles:
  Barras       → distribución de diagnósticos, procedimientos, sexo
  Línea        → evolución temporal de cualquier métrica
  Dispersión   → correlación entre dos variables numéricas (ej: edad vs tiempo IQ)
  Box plot     → distribución de variable numérica por categoría
  Pastel       → proporciones (sexo, ASA, complicaciones sí/no)
  Histograma   → distribución de variable numérica (edades, tiempos)
```

Todas las gráficas usan Recharts. El médico puede:
- Cambiar el tipo de gráfica con un clic
- Cambiar los ejes X e Y
- Exportar como imagen PNG
- Incluir en el informe PDF de investigación

**Cuestionarios y escalas agrupadas**

Cuando el resultado incluye pacientes con escalas clínicas del mismo tipo, el sistema muestra automáticamente:

```
SNOT-22 (N=23 pacientes con esta escala en el período seleccionado)

  PRE-CIRUGÍA              POST-CIRUGÍA (3 meses)
  Media: 62.4              Media: 18.3
  Mediana: 58.0            Mediana: 15.0

  [Gráfica de evolución pre/post para cada paciente]
  [Distribución por severidad: severo/moderado/leve]
```

**Galería de imágenes**

Si los pacientes del resultado tienen imágenes diagnósticas, el médico puede:
- Ver todas las imágenes de los pacientes filtrados en modo galería
- Filtrar por tipo (TAC, RMN, endoscopia...)
- Seleccionar imágenes para incluir en publicación

---

## 11. Guardado de Consultas y Colecciones

### Consultas guardadas

El médico puede guardar cualquier combinación de filtros como una consulta con nombre:

```
"Estudio TORS 2024-2025"
  Filtros: procedimiento=TORS, fecha 01/01/2024-31/12/2025
  Última ejecución: hace 2 días · 7 pacientes
  [Ejecutar de nuevo]  [Editar]  [Exportar]

"Rinitis alérgica con cirugía"
  Filtros: diagnóstico contiene "rinitis", tiene cirugía
  Última ejecución: hace 1 semana · 34 pacientes
  [Ejecutar de nuevo]  [Editar]  [Exportar]
```

Cada vez que el médico importa nuevos pacientes, puede re-ejecutar sus consultas guardadas con un clic y ver si aparecen pacientes nuevos que cumplen los criterios.

### Colecciones de pacientes

Una colección es un grupo de pacientes seleccionados manualmente o por consulta. Permite:
- Seguimiento longitudinal de una cohorte específica
- Anotaciones a nivel de colección ("estos son los pacientes del estudio de TORS publicado en Otolaryngology 2026")
- Compartir con otro médico de la misma organización

```prisma
model PatientCollection {
  id              String   @id @default(uuid())
  organizationId  String
  createdBy       String
  name            String
  description     String?
  queryId         String?  // si viene de una consulta guardada
  isLocked        Boolean  @default(false)  // colección de estudio publicado — no modificar

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  patients        PatientCollectionMember[]
}

model PatientCollectionMember {
  collectionId  String
  patientId     String
  addedAt       DateTime @default(now())
  addedBy       String
  notes         String?  // nota específica de este paciente en esta colección

  collection    PatientCollection @relation(fields: [collectionId], references: [id])
  patient       Patient           @relation(fields: [patientId], references: [id])

  @@id([collectionId, patientId])
}
```

### Export para publicación

Cuando el médico tiene su cohorte lista, puede exportar:

```
[Exportar para publicación]

  ☑ Tabla de características de la muestra (Tabla 1)
     → Word/Excel con medias, DE, rangos de todas las variables
  ☑ Gráficas seleccionadas
     → PNG 300dpi para revista científica
  ☑ Dataset anonimizado
     → CSV sin nombres, con ID interno no reversible
     → Para adjuntar como supplementary data
  ☑ Estadísticas descriptivas completas
     → PDF con todas las métricas
```

Todo el export es **anonimizado por defecto** — los nombres se sustituyen por IDs internos no reversibles (BR-ANA-002).

---

## 12. Cambios en Documentos Existentes

### `02-data-schema.md`

Añadir:
- Modelos `ImportBatch`, `PatientCollection`, `PatientCollectionMember`
- Campos `importedData`, `importSource`, `importBatchId` en `Patient`
- Índice GIN sobre `importedData` para búsquedas JSONB eficientes:
  ```sql
  CREATE INDEX idx_patients_imported_data ON patients USING GIN (imported_data);
  ```

### `03-business-rules.md`

Añadir sección **BR-IMP — Importación**:

```
BR-IMP-001  El sistema nunca importa datos sin confirmación explícita del médico
BR-IMP-002  Los datos originales del Excel se conservan íntegros en importedData
BR-IMP-003  Un campo importado nunca sobreescribe un campo manual con datos
BR-IMP-004  El cruce automático requiere ≥ 90 puntos de confianza
BR-IMP-005  El médico puede revertir una importación (soft delete del batch y sus datos)
BR-IMP-006  Límite de filas por importación: FREE=500, PRO=10.000, ENTERPRISE=ilimitado
BR-IMP-007  Los campos de teléfono detectados en Excel no se importan — RGPD
```

Añadir sección **BR-RES — Motor de Investigación**:

```
BR-RES-001  Las consultas guardadas son privadas por defecto (solo el creador las ve)
BR-RES-002  Los exports de investigación son siempre anonimizados — sin nombres reales
BR-RES-003  Las colecciones marcadas como "publicadas" no pueden modificarse
BR-RES-004  Las gráficas con N < 5 no se muestran — riesgo de re-identificación
```

### `04-design-spec.md`

La sección de Analytics se divide en dos:

- **Analytics operativo** (el diseñado hasta ahora): KPIs del dashboard, métricas de consulta
- **Motor de Investigación** (nuevo): el explorador de datos ad hoc descrito aquí

El Motor de Investigación tiene su propio apartado en el sidebar, separado de Analytics.

### `10-implementation-roadmap.md`

Añadir **Fase 11 — Importación de Datos** y **Fase 12 — Motor de Investigación** como fases posteriores al MVP core, con sus WUs detalladas.

---

## 13. Roadmap de Implementación — Fases

### Fase 11 — Importación de Datos

```
WU-11-01  Schema Prisma: ImportBatch + campos en Patient + migración
WU-11-02  FileParserService: lectura de xlsx/csv/tsv con detección de estructura
WU-11-03  DataCleanerService: conversión serial Excel, normalización, detección filas basura
WU-11-04  ImportAnalyzerService: integración Claude API para propuesta de mapeo
WU-11-05  PatientMatcherService: lógica de cruce y puntuación de confianza
WU-11-06  ImportBatch use cases: CreateImport, ConfirmImport, RevertImport
WU-11-07  API: endpoints de importación (upload, análisis, confirmar, revertir)
WU-11-08  BullMQ job: process-import (la importación real ocurre en background)
WU-11-09  Recordatorio periódico: CRON + banner en dashboard
WU-11-10  Frontend: wizard de importación en 3 pasos (subir → revisar mapeo → resolver cruces)
```

**Tests críticos:**
```typescript
it('debería convertir serial Excel 46023 a la fecha correcta')
it('debería detectar "EDUARDO MARTINEZ (45)" como nombre + edad, sin NHC')
it('debería excluir filas de totales y medias del archivo')
it('debería cruzar automáticamente si NHC coincide exactamente — 100 puntos')
it('debería sugerir cruce si nombre + edad coincide — 50 puntos — médico decide')
it('no debería importar campos de teléfono — BR-IMP-007')
it('debería revertir una importación borrando todos los datos del batch')
```

### Fase 12 — Motor de Investigación

```
WU-12-01  Schema Prisma: ResearchQuery, PatientCollection, PatientCollectionMember
WU-12-02  FilterBuilderService: traducción de filtros UI a Prisma/SQL
WU-12-03  JsonbSearchService: búsqueda sobre importedData JSONB con índice GIN
WU-12-04  StatsCalculatorService: medias, medianas, DE, IC95% para campos numéricos
WU-12-05  Use cases: ExecuteQuery, SaveQuery, CreateCollection, ExportResults
WU-12-06  API: endpoints del motor de investigación
WU-12-07  Frontend: UI del explorador (selector de fuente, constructor de filtros, selector de campos)
WU-12-08  Frontend: componentes de visualización (tabla, stats, gráficas con Recharts)
WU-12-09  Frontend: galería de imágenes de la cohorte
WU-12-10  Frontend: export para publicación (Word Tabla 1, PNG gráficas, CSV anonimizado)
WU-12-11  Búsqueda en lenguaje natural: Claude interpreta query → genera filtros → médico confirma
```

**Tests críticos:**
```typescript
it('debería filtrar por campo de importedData en cualquier batch del paciente')
it('debería calcular media y DE correctamente para tiempo quirúrgico')
it('debería excluir pacientes con N < 5 en gráficas — BR-RES-004')
it('el export CSV nunca debe incluir nombres reales de pacientes — BR-RES-002')
it('una colección marcada como publicada no debe poder modificarse — BR-RES-003')
it('re-ejecutar una consulta guardada debe incluir pacientes de nuevas importaciones')
```

---

*Este módulo convierte MediCore de una herramienta de registro en una plataforma de investigación clínica personal. El médico que use MediCore durante 3 años tendrá una base de datos que ningún hospital puede darle: estructurada, explorable, y completamente suya.*