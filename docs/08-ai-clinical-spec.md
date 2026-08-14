# 08-ai-clinical-spec.md
## MediCore — Especificación del Módulo de IA Clínica

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `02-data-schema.md`, `03-business-rules.md`, `07-security-compliance.md` aprobados

---

## Índice

1. [Principios del Módulo de IA](#1-principios-del-módulo-de-ia)
2. [Casos de Uso de IA en MediCore](#2-casos-de-uso-de-ia-en-medicore)
3. [Arquitectura de la Integración](#3-arquitectura-de-la-integración)
4. [Privacidad y Datos Enviados a Anthropic](#4-privacidad-y-datos-enviados-a-anthropic)
5. [Prompts por Tipo de Informe](#5-prompts-por-tipo-de-informe)
6. [Integración CIE-10 y SNOMED en los Informes](#6-integración-cie-10-y-snomed-en-los-informes)
7. [Validación Clínica de Outputs](#7-validación-clínica-de-outputs)
8. [Disclaimers Legales](#8-disclaimers-legales)
9. [Manejo de Errores y Fallbacks](#9-manejo-de-errores-y-fallbacks)
10. [Rate Limiting y Costes](#10-rate-limiting-y-costes)
11. [Auditoría de Generaciones IA](#11-auditoría-de-generaciones-ia)
12. [IA en el Motor de Importación](#12-ia-en-el-motor-de-importación)
13. [IA en el Motor de Investigación](#13-ia-en-el-motor-de-investigación)

---

## 1. Principios del Módulo de IA

**La IA genera borradores, el médico firma.** Ningún output de IA es entregable directo. Todo pasa por revisión explícita del médico antes de firmarse. La IA es un asistente de redacción, no un autor clínico.

**Mínimo dato personal al modelo.** Por cada llamada a la API de Anthropic, el sistema envía el mínimo de datos necesarios. Los datos de identidad del paciente (nombre completo, DNI, dirección) no se envían al modelo — se insertan en el documento generado en postprocesado local, nunca en el prompt.

**Transparencia total.** El médico sabe siempre cuando está leyendo contenido generado por IA. Los informes en DRAFT tienen un indicador visual permanente. El hash del prompt queda auditado.

**Degradación elegante.** Si la API de Anthropic no está disponible, el médico puede escribir el informe manualmente. La IA no es un punto de fallo crítico del sistema.

---

## 2. Casos de Uso de IA en MediCore

```
Caso de uso                    Modelo         Contexto enviado
────────────────────────────────────────────────────────────────────────────
Generar informe de consulta    claude-sonnet  Anamnesis, exploración, diagnóstico, plan
Generar informe quirúrgico     claude-sonnet  Técnica, hallazgos, complicaciones, AP
Generar carta de derivación    claude-sonnet  Historia resumida, motivo de derivación
Generar certificado médico     claude-sonnet  Datos clínicos mínimos relevantes
Generar informe de alta        claude-sonnet  Historia completa de ingreso
Analizar estructura Excel      claude-sonnet  Primeras 20 filas + nombres de columnas
Interpretar consulta natural   claude-sonnet  Query en texto libre + campos disponibles
```

En todos los casos se usa `claude-sonnet-4-6` — el balance correcto entre calidad clínica y coste para un SaaS con plan FREE incluido.

---

## 3. Arquitectura de la Integración

```typescript
// apps/api/src/infrastructure/ai/anthropic.service.ts

@Injectable()
export class AnthropicService {
  private client: Anthropic

  constructor(private config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    })
  }

  async generateClinicalReport(params: GenerateReportParams): Promise<GenerateReportResult> {
    const prompt = this.buildReportPrompt(params)
    const promptHash = createHash('sha256').update(JSON.stringify(prompt)).digest('hex')

    try {
      const response = await Promise.race([
        this.client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 2000,
          system:     prompt.system,
          messages:   [{ role: 'user', content: prompt.user }],
        }),
        // Timeout de 60 segundos — BR-REP-008
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 60_000)
        ),
      ]) as Anthropic.Message

      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as Anthropic.TextBlock).text)
        .join('')

      return {
        content,
        model:        response.model,
        inputTokens:  response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        promptHash,
      }

    } catch (error) {
      if (error.message === 'AI_TIMEOUT') throw new AiTimeoutError()
      if (error.status === 529)           throw new AiServiceUnavailableError()
      throw new AiGenerationError(error.message)
    }
  }

  // Postprocesado: insertar datos de identidad DESPUÉS de la generación
  // El nombre del paciente nunca entra en el prompt — se añade aquí
  injectPatientIdentity(content: string, patient: PatientIdentityData): string {
    return content
      .replace('{{PATIENT_NAME}}',      `${patient.lastName}, ${patient.firstName}`)
      .replace('{{PATIENT_BIRTHDATE}}', formatDate(patient.birthDate))
      .replace('{{PATIENT_NHC}}',       patient.nhc)
      .replace('{{PATIENT_AGE}}',       String(patient.age))
  }
}
```

---

## 4. Privacidad y Datos Enviados a Anthropic

### Qué se envía y qué no

```
SE ENVÍA al prompt                    NO SE ENVÍA al prompt
──────────────────────────────────────────────────────────────────
Edad del paciente (42 años)           Nombre completo
Sexo (mujer)                          DNI / NIE / Pasaporte
Datos clínicos (anamnesis,            Dirección
  exploración, diagnóstico)           Teléfono
Códigos CIE-10 y SNOMED              Email
Escalas clínicas (scores)            Número de historia clínica
Tipo de procedimiento quirúrgico     Nombre del médico (solo título)
Complicaciones
Medicación (nombre del fármaco,
  dosis, indicación)
```

El nombre del paciente, el NHC y el nombre del médico se insertan en el documento **después** de que la IA genera el texto, mediante sustitución de placeholders en el servidor.

### DPA con Anthropic

El DPA (Data Processing Agreement) con Anthropic debe estar firmado antes del lanzamiento. Puntos clave a verificar:

- Anthropic no usa datos enviados via API para entrenar modelos (por defecto en la API)
- Los datos se procesan en servidores de Anthropic en USA — requiere SCCs (Standard Contractual Clauses)
- El DPA se firma en: [https://privacy.anthropic.com/en/dpa](https://privacy.anthropic.com/en/dpa)

---

## 5. Prompts por Tipo de Informe

### Sistema base (común a todos los tipos)

```
Eres un asistente de redacción médica especializado en Otorrinolaringología (ORL).
Tu función es generar borradores de informes clínicos en español formal médico
a partir de los datos clínicos proporcionados.

REGLAS ESTRICTAS:
1. Usa únicamente los datos clínicos proporcionados. No inventes síntomas,
   hallazgos ni diagnósticos que no estén en el input.
2. Cuando un dato no esté disponible, omite ese apartado o indica "no consta".
   Nunca rellenes con datos plausibles pero no confirmados.
3. Usa terminología médica ORL precisa y actualizada.
4. El informe es un borrador para revisión del médico, no un documento final.
5. Usa los placeholders {{PATIENT_NAME}}, {{PATIENT_AGE}}, {{PATIENT_NHC}}
   para los datos de identidad — no los sustituyas tú.
6. El idioma es español formal médico. No uses coloquialismos.
```

### Prompt: Informe de Consulta (FOLLOW_UP_REPORT)

```
DATOS DE LA CONSULTA:
- Fecha: {date}
- Tipo: {consultationType}
- Paciente: {{PATIENT_NAME}}, {{PATIENT_AGE}} años, {sex}
- NHC: {{PATIENT_NHC}}

MOTIVO DE CONSULTA:
{chiefComplaint}

ANTECEDENTES RELEVANTES (resumen):
{relevantHistory}

EXPLORACIÓN FÍSICA:
{physicalExamSummary}

DIAGNÓSTICO PRINCIPAL:
{primaryDiagnosis} {primaryDiagnosisCode}

DIAGNÓSTICOS SECUNDARIOS:
{secondaryDiagnoses}

PLAN TERAPÉUTICO:
{treatmentPlan}

ESCALAS CLÍNICAS:
{clinicalScales}

---

Genera un informe de consulta ORL estructurado con los siguientes apartados:
1. Datos del paciente (usa los placeholders)
2. Motivo de consulta
3. Antecedentes de interés
4. Exploración física
5. Diagnóstico (incluye los códigos CIE-10 proporcionados)
6. Plan terapéutico
7. Próximo control (si se ha indicado fecha de seguimiento)

Extensión: 300-500 palabras. Tono: formal médico español.
```

### Prompt: Informe Quirúrgico (SURGICAL_REPORT)

```
DATOS DE LA INTERVENCIÓN:
- Fecha: {surgeryDate}
- Procedimiento: {procedureType} {procedureCodes}
- Duración: {duration} minutos
- Anestesia: {anesthesiaType}
- Clasificación ASA: {asa}
- Paciente: {{PATIENT_NAME}}, {{PATIENT_AGE}} años, {sex}

TÉCNICA QUIRÚRGICA:
{technique}

HALLAZGOS INTRAOPERATORIOS:
{findings}

COMPLICACIONES:
{complications}

RESULTADO ANATOMÍA PATOLÓGICA (si disponible):
{pathologyResult}

NOTAS POSTOPERATORIAS:
{postOpNotes}

---

Genera un informe quirúrgico ORL estructurado con:
1. Datos de la intervención
2. Técnica quirúrgica (descripción narrativa a partir de los datos estructurados)
3. Hallazgos
4. Incidencias / Complicaciones (si "0" o vacío: "Sin incidencias intraoperatorias")
5. Resultado anatomopatológico (si disponible)
6. Postoperatorio inmediato

Extensión: 400-600 palabras. Tono: formal médico quirúrgico.
```

### Prompt: Carta de Derivación (REFERRAL_LETTER)

```
MÉDICO REMITENTE: Dr./Dra. {physicianTitle} (ORL)
SERVICIO DESTINO: {referralTarget}
MOTIVO DE DERIVACIÓN: {referralReason}

DATOS DEL PACIENTE:
- Nombre: {{PATIENT_NAME}}, {{PATIENT_AGE}} años
- NHC: {{PATIENT_NHC}}

RESUMEN CLÍNICO:
{clinicalSummary}

PRUEBAS REALIZADAS:
{testsPerformed}

TRATAMIENTOS PREVIOS:
{previousTreatments}

DIAGNÓSTICO ACTUAL:
{currentDiagnosis} {diagnosisCodes}

---

Genera una carta de derivación médica formal con:
1. Encabezado (Estimado/a compañero/a)
2. Presentación del caso
3. Exploración y pruebas realizadas
4. Diagnóstico y razonamiento de la derivación
5. Información adicional relevante
6. Cierre formal

Extensión: 200-350 palabras. Tono: carta médica formal entre especialistas.
```

---

## 6. Integración CIE-10 y SNOMED en los Informes

### Los códigos no los genera la IA — los usa

La IA no inventa códigos diagnósticos ni de procedimiento. Los recibe del médico (que los seleccionó con el `DiagnosisCodePicker`) y los incorpora al informe generado en el lugar correcto.

```typescript
// Construcción del contexto de diagnósticos para el prompt
function buildDiagnosisContext(diagnosisCodes: DiagnosisCode[]): string {
  const primary   = diagnosisCodes.filter(d => d.type === 'primary')
  const secondary = diagnosisCodes.filter(d => d.type === 'secondary')

  const primaryText = primary
    .map(d => `${d.description} (${d.system}: ${d.code})`)
    .join(', ')

  const secondaryText = secondary
    .map(d => `${d.description} (${d.system}: ${d.code})`)
    .join('; ')

  return `Diagnóstico principal: ${primaryText}\nDiagnósticos secundarios: ${secondaryText}`
}
```

### Posición de los códigos en el informe

Los códigos CIE-10 aparecen en el informe de dos formas:
- **En el cuerpo del texto**: "...diagnosticado de Rinosinusitis crónica (J32.9)..."
- **En el pie del informe**: sección estructurada para facilitar la codificación administrativa

El modelo incluye los códigos en el cuerpo si están en el contexto del prompt. La sección estructurada del pie se genera siempre en postprocesado local, fuera del modelo.

---

## 7. Validación Clínica de Outputs

### Lo que el sistema NO valida

La IA puede generar texto médicamente incorrecto. El sistema no valida la corrección clínica del contenido — eso es responsabilidad del médico en la fase de revisión.

### Lo que el sistema SÍ verifica automáticamente

```typescript
// apps/api/src/application/report/services/report-validator.service.ts

export class ReportValidatorService {

  validate(content: string, context: ReportContext): ValidationResult {
    const warnings: string[] = []

    // 1. El informe no debe estar vacío
    if (!content || content.trim().length < 50) {
      return { valid: false, error: 'El informe generado está vacío o es demasiado corto' }
    }

    // 2. Los placeholders deben estar presentes (para el postprocesado)
    const requiredPlaceholders = ['{{PATIENT_NAME}}', '{{PATIENT_NHC}}']
    for (const placeholder of requiredPlaceholders) {
      if (!content.includes(placeholder)) {
        warnings.push(`El modelo no incluyó el placeholder ${placeholder}`)
      }
    }

    // 3. Si había códigos CIE-10 en el contexto, deben aparecer en el informe
    if (context.diagnosisCodes.length > 0) {
      const primaryCode = context.diagnosisCodes.find(d => d.type === 'primary')
      if (primaryCode && !content.includes(primaryCode.code)) {
        warnings.push(`El código diagnóstico principal ${primaryCode.code} no aparece en el informe`)
      }
    }

    // 4. Detectar alucinaciones obvias (números inventados)
    // Si el modelo incluye valores numéricos clínicos que no estaban en el contexto
    // (p.ej. "tensión arterial 120/80" cuando no se proporcionó) → warning
    // Esto es heurístico y no exhaustivo
    const suspiciousPatterns = [
      /\b\d{2,3}\/\d{2,3}\s*mmHg\b/,   // TA no proporcionada
      /\b\d{2,3}\s*lpm\b/,              // FC no proporcionada
    ]
    if (!context.includesVitalSigns) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          warnings.push('El informe incluye constantes vitales que no estaban en el contexto clínico')
        }
      }
    }

    return { valid: true, warnings }
  }
}
```

Los warnings se muestran al médico en la interfaz de revisión del informe como alertas no bloqueantes.

---

## 8. Disclaimers Legales

### Disclaimer en el informe DRAFT (visible en UI, no en PDF)

```
⚠ BORRADOR GENERADO CON ASISTENCIA DE IA
Este documento ha sido generado automáticamente a partir de los datos
clínicos registrados. Requiere revisión y validación por el médico
responsable antes de ser firmado. No tiene validez clínica ni legal
hasta su firma.
```

### Disclaimer en el PDF firmado (incluido en el documento, no editable)

```
El presente informe ha sido elaborado con asistencia de herramientas
de inteligencia artificial (MediCore IA, modelo Claude de Anthropic)
y ha sido revisado y firmado por el facultativo abajo firmante.
El médico firmante asume la responsabilidad clínica y legal del
contenido de este documento.
```

Este texto es fijo, generado en el PDF por `ReactPDFService`, y no puede ser eliminado ni modificado por ningún rol (BR-REP-005).

---

## 9. Manejo de Errores y Fallbacks

```
Error                          Causa                        Comportamiento
──────────────────────────────────────────────────────────────────────────────
AI_TIMEOUT (>60s)              Anthropic API lenta          Informe queda en DRAFT
                                                            con content vacío.
                                                            Notificación al médico.
                                                            Puede escribir manualmente.

AI_SERVICE_UNAVAILABLE (529)   Anthropic sobrecargado       Reintento automático x3
                                                            con backoff exponencial.
                                                            Si falla → igual que timeout.

CONTENT_EMPTY                  Modelo devuelve texto vacío  Reintento una vez.
                                                            Si falla → informe vacío
                                                            + notificación.

RATE_LIMIT_ANTHROPIC           Límite de tokens/min         BullMQ reintenta con
                                                            delay de 30s.

AI_LIMIT_MEDICORE (BR-REP-009) Límite del plan alcanzado    Error 422 inmediato.
                                                            Mensaje: "Has alcanzado
                                                            el límite de informes IA
                                                            de tu plan este mes."
```

### Cola de reintentos en BullMQ

```typescript
// apps/api/src/infrastructure/queue/jobs/generate-report.job.ts

export const generateReportJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type:  'exponential',
    delay: 5000,   // 5s, 25s, 125s
  },
  timeout: 70_000,  // 70s — ligeramente más que el timeout del servicio
  removeOnComplete: true,
  removeOnFail:     false,  // mantener en dead letter para debugging
}
```

---

## 10. Rate Limiting y Costes

### Límites por plan (BR-REP-009)

```
Plan        Informes IA/mes    Coste estimado Anthropic/mes
──────────────────────────────────────────────────────────────
FREE        20                 ~0.30€
PRO         200                ~3.00€
ENTERPRISE  Sin límite         Variable
```

Estimación basada en: ~1.500 tokens input + ~600 tokens output por informe, precio claude-sonnet-4-6.

### Contador de uso

```prisma
// Campo añadido a Organization para tracking de uso IA
model Organization {
  // ... campos existentes ...
  aiReportsThisMonth   Int      @default(0)
  aiReportsResetAt     DateTime @default(now())
}
```

El contador se resetea el día 1 de cada mes con un CRON job. Antes de encolar el job de generación, el handler verifica el contador y lanza `AiLimitExceededError` si el plan está al límite.

---

## 11. Auditoría de Generaciones IA

Cada generación queda registrada en `audit_logs` con la acción `AI_GENERATE` y en el propio `Report` con `aiPromptHash`.

```typescript
// El hash SHA-256 del prompt permite:
// 1. Saber exactamente qué contexto generó qué informe
// 2. Detectar si el mismo contexto genera outputs distintos (inconsistencia del modelo)
// 3. Auditorías regulatorias futuras sobre uso de IA en documentos médicos

const promptHash = createHash('sha256')
  .update(JSON.stringify({ system: prompt.system, user: prompt.user, model: 'claude-sonnet-4-6' }))
  .digest('hex')
```

---

## 12. IA en el Motor de Importación

Ver `12-import-research-spec.md` sección 3 para el detalle completo. Resumen técnico:

```typescript
// El prompt de análisis de Excel es diferente al de informes clínicos:
// - Contexto mucho más pequeño (20 filas máximo)
// - Output estructurado JSON (no texto libre)
// - No contiene datos de identidad del paciente
// - Temperatura más baja para mayor determinismo

const importAnalysisParams = {
  model:       'claude-sonnet-4-6',
  max_tokens:  500,           // solo necesita el JSON del mapeo
  temperature: 0,             // máximo determinismo para mapeo de columnas
}
```

---

## 13. IA en el Motor de Investigación

La búsqueda en lenguaje natural del Motor de Investigación usa IA para traducir una query libre a filtros estructurados:

```
Input del médico:
"pacientes mayores de 60 años operados de vaciamiento cervical con complicaciones"

Output del modelo (JSON):
{
  "filters": [
    { "field": "age", "operator": "greater_than", "value": 60 },
    { "field": "procedure", "source": "surgery", "operator": "contains", "value": "vaciamiento cervical" },
    { "field": "complications", "source": "surgery", "operator": "is_not_empty" }
  ],
  "confidence": 0.9,
  "interpretation": "Pacientes con edad > 60 años, cirugía que incluya 'vaciamiento cervical', y complicaciones registradas"
}
```

El médico ve la interpretación antes de ejecutar la consulta y puede corregir cualquier filtro. La IA propone — el médico decide.

---

*Siguiente documento: `09-devops-infra.md` — Entornos, pipelines CI/CD, migraciones y SLOs.*