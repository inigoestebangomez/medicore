# 05-api-spec.md
## MediCore — Especificación de API REST

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `01-architecture.md`, `02-data-schema.md`, `03-business-rules.md` aprobados

---

## Índice

1. [Principios Generales](#1-principios-generales)
2. [Autenticación y Autorización](#2-autenticación-y-autorización)
3. [Convenciones de Request y Response](#3-convenciones-de-request-y-response)
4. [Manejo de Errores](#4-manejo-de-errores)
5. [Paginación y Filtrado](#5-paginación-y-filtrado)
6. [Rate Limiting](#6-rate-limiting)
7. [Endpoints — Auth](#7-endpoints--auth)
8. [Endpoints — Organizations](#8-endpoints--organizations)
9. [Endpoints — Patients](#9-endpoints--patients)
10. [Endpoints — Consultations](#10-endpoints--consultations)
11. [Endpoints — Surgeries](#11-endpoints--surgeries)
12. [Endpoints — Imaging Studies](#12-endpoints--imaging-studies)
13. [Endpoints — Medications](#13-endpoints--medications)
14. [Endpoints — Clinical Scales](#14-endpoints--clinical-scales)
15. [Endpoints — Reports](#15-endpoints--reports)
16. [Endpoints — Analytics](#16-endpoints--analytics)
17. [Endpoints — Export](#17-endpoints--export)
18. [Webhooks internos (BullMQ jobs)](#18-webhooks-internos-bullmq-jobs)
19. [Versionado de la API](#19-versionado-de-la-api)

---

## 1. Principios Generales

**Base URL:**
```
Production:  https://api.medicore.app/v1
Staging:     https://api-staging.medicore.app/v1
Development: http://localhost:3001/v1
```

**Protocolo:** HTTPS obligatorio en staging y producción. HTTP solo en desarrollo local.

**Formato:** JSON en todas las peticiones y respuestas. `Content-Type: application/json` obligatorio en peticiones con body.

**Idempotencia:** Los endpoints `PUT` y `DELETE` son idempotentes. Los `POST` no lo son, salvo los indicados explícitamente con el header `Idempotency-Key`.

**Diseño REST estricto:**
- `GET` — lectura, nunca modifica estado
- `POST` — creación de nuevo recurso
- `PUT` — sustitución completa del recurso (se envía el objeto completo)
- `PATCH` — actualización parcial (solo los campos a modificar)
- `DELETE` — eliminación (soft delete en entidades clínicas)

**OpenAPI:** La especificación OpenAPI 3.1 completa se genera automáticamente desde los decoradores `@nestjs/swagger` y está disponible en `/v1/docs` (solo en desarrollo y staging).

---

## 2. Autenticación y Autorización

### Flujo de autenticación

La autenticación OAuth ocurre en el frontend (Auth.js v5). Una vez completado el flujo OAuth, Auth.js emite un JWT firmado que se almacena en una cookie HttpOnly. El backend NestJS valida este JWT en cada petición.

```
Frontend                    Auth.js (Next.js)           NestJS API
   │                               │                        │
   │── GET /auth/signin ──────────▶│                        │
   │                               │── OAuth redirect ────▶ Google/Microsoft
   │                               │◀─ OAuth callback ───── Google/Microsoft
   │                               │── emite JWT ──────────▶ cookie HttpOnly
   │◀─ redirige a /dashboard ──────│                        │
   │                               │                        │
   │── GET /api/v1/patients ──────────────────────────────▶│
   │   (cookie: session=JWT)       │                        │
   │                               │             AuthGuard valida JWT
   │                               │             TenantInterceptor extrae orgId
   │◀─ 200 { data: [...] } ─────────────────────────────────│
```

### Headers requeridos en cada petición

```http
Cookie: medicore-session=<JWT>
Content-Type: application/json
```

El JWT no se envía como `Authorization: Bearer` — solo via cookie HttpOnly para prevenir XSS.

### Estructura del JWT payload

```json
{
  "sub":            "user-uuid-here",
  "email":          "medico@clinica.com",
  "name":           "Dr. Carlos Martínez",
  "organizationId": "org-uuid-here",
  "role":           "PHYSICIAN",
  "iat":            1718000000,
  "exp":            1718000900
}
```

### Guards de NestJS

```
AuthGuard      → verifica JWT válido y no expirado
TenantGuard    → verifica que organizationId del JWT coincide con el recurso solicitado
RBACGuard      → verifica que el rol tiene el permiso requerido para la acción
```

Todos los endpoints protegidos llevan los tres guards en orden. No existe un endpoint que requiera RBAC sin AuthGuard.

---

## 3. Convenciones de Request y Response

### Estructura de respuesta exitosa

```json
// Recurso único
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123def456"
  }
}

// Colección paginada
{
  "data": [ ... ],
  "meta": {
    "requestId": "req_abc123def456",
    "pagination": {
      "page":       1,
      "pageSize":   20,
      "total":      247,
      "totalPages": 13
    }
  }
}
```

### Campos de fecha

Todas las fechas se transmiten en formato ISO 8601 UTC:
```
"2026-06-09T10:30:00.000Z"
```

El frontend gestiona la conversión a la zona horaria local del usuario. El servidor nunca asume zona horaria.

### Campos sensibles omitidos por rol

Los campos de datos de contacto del paciente (`phone`, `email`, `address`, `idDocument`) se omiten automáticamente de la respuesta cuando el solicitante tiene rol `VIEWER` (BR-RBAC-002). El campo no aparece en el objeto — no se devuelve `null`.

### Nomenclatura de campos

`camelCase` en todos los campos JSON. Los nombres de campos son los mismos en request y response.

---

## 4. Manejo de Errores

### Estructura de error estándar (BR-TRX-007)

```json
{
  "statusCode": 422,
  "error":      "VALIDATION_ERROR",
  "message":    "El campo birthDate es obligatorio",
  "details": [
    {
      "field":   "birthDate",
      "message": "Required"
    }
  ],
  "requestId": "req_abc123def456"
}
```

### Catálogo de códigos de error

```
HTTP   error                        Descripción
────────────────────────────────────────────────────────────────────────
400    BAD_REQUEST                  Petición malformada
401    UNAUTHORIZED                 JWT ausente, expirado o inválido
403    FORBIDDEN                    Autenticado pero sin permiso (RBAC)
404    NOT_FOUND                    Recurso no existe o no pertenece a la org
409    CONFLICT                     Conflicto: NHC duplicado, slug en uso, etc.
422    VALIDATION_ERROR             Datos no pasan validación Zod
429    RATE_LIMIT_EXCEEDED          Límite de peticiones alcanzado
500    INTERNAL_ERROR               Error interno no esperado
503    AI_SERVICE_UNAVAILABLE       Anthropic API no disponible
```

### Errores de negocio específicos

Para errores de reglas de negocio, el campo `error` usa un código específico del dominio:

```
DUPLICATE_PATIENT              BR-PAT-002: posible duplicado detectado
ALLERGY_CONFLICT_CRITICAL      BR-MED-001: alergia con severidad ANAPHYLAXIS
ALLERGY_CONFLICT_WARNING       BR-MED-001: alergia moderada/severa
SURGERY_INVALID_TRANSITION     BR-SUR-003: transición de estado no permitida
REPORT_IMMUTABLE               BR-REP-004: intento de modificar informe SIGNED
LAST_OWNER_REMOVAL             BR-ORG-003: intento de eliminar el último OWNER
AI_GENERATION_FAILED           BR-REP-008: job de generación IA falló
AI_LIMIT_EXCEEDED              BR-REP-009: límite mensual de informes IA
```

---

## 5. Paginación y Filtrado

### Query params de paginación (BR-TRX-006)

```
page        integer   default: 1       Número de página (base 1)
pageSize    integer   default: 20      Registros por página (max: 100)
sortBy      string    default: varies  Campo de ordenación
sortOrder   string    default: desc    "asc" | "desc"
```

### Query params de filtrado comunes

```
search      string    Búsqueda full-text sobre campos configurados por endpoint
from        ISO date  Filtro de fecha inicio
to          ISO date  Filtro de fecha fin
```

Ejemplo:
```http
GET /v1/patients?search=garcia&page=1&pageSize=20&sortBy=lastName&sortOrder=asc
GET /v1/consultations?patientId=uuid&from=2026-01-01&to=2026-06-30
```

---

## 6. Rate Limiting

Rate limiting aplicado por `organizationId` + `userId`, no por IP.

```
Endpoint group                Límite          Ventana
────────────────────────────────────────────────────────
General (lectura)             300 req         1 minuto
General (escritura)           100 req         1 minuto
POST /reports/generate        plan FREE: 20   1 mes
                              plan PRO: 200   1 mes
                              ENTERPRISE: ∞   —
POST /export/*                10 req          1 hora
GET  /analytics/*             30 req          1 minuto
```

Al superar el límite, la API responde con:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718001234
```

---

## 7. Endpoints — Auth

### `POST /v1/auth/switch-organization`

Cambia la organización activa en la sesión. Rota el JWT con el nuevo `organizationId`.

**Auth:** Requiere JWT válido (cualquier rol)

**Request:**
```json
{ "organizationId": "org-uuid-here" }
```

**Response `200`:**
```json
{
  "data": {
    "organizationId": "org-uuid-here",
    "organizationName": "Clínica ORL Dr. Martínez",
    "role": "PHYSICIAN"
  }
}
```

**Errores:**
- `403 FORBIDDEN` — el usuario no es miembro de la organización solicitada

---

### `POST /v1/auth/logout`

Invalida la sesión activa y borra la cookie.

**Auth:** Requiere JWT válido

**Response `204 No Content`**

---

### `GET /v1/auth/me`

Devuelve los datos del usuario autenticado y sus membresías en organizaciones.

**Auth:** Requiere JWT válido

**Response `200`:**
```json
{
  "data": {
    "id":        "user-uuid",
    "email":     "medico@clinica.com",
    "name":      "Dr. Carlos Martínez",
    "avatarUrl": "https://...",
    "memberships": [
      {
        "organizationId":   "org-uuid-1",
        "organizationName": "Clínica ORL Dr. Martínez",
        "organizationSlug": "clinica-orl-martinez",
        "role":             "OWNER",
        "isActive":         true
      }
    ]
  }
}
```

---

## 8. Endpoints — Organizations

### `POST /v1/organizations`

Crea una nueva organización. El usuario autenticado se convierte en `OWNER`.

**Auth:** Requiere JWT válido

**Request:**
```json
{
  "name":    "Clínica ORL Martínez",
  "type":    "CLINIC",
  "logoUrl": "https://..."
}
```

**Validaciones Zod:**
- `name`: string, min 2, max 100, requerido
- `type`: enum `CLINIC | SOLO_PRACTICE | HOSPITAL_DEPT`, requerido
- `logoUrl`: url válida, opcional

**Response `201`:**
```json
{
  "data": {
    "id":        "org-uuid",
    "name":      "Clínica ORL Martínez",
    "slug":      "clinica-orl-martinez",
    "type":      "CLINIC",
    "plan":      "FREE",
    "createdAt": "2026-06-09T10:00:00.000Z"
  }
}
```

---

### `GET /v1/organizations/:orgId`

Devuelve los datos de la organización activa.

**Auth:** `OWNER` | `ADMIN`

**Response `200`:**
```json
{
  "data": {
    "id":        "org-uuid",
    "name":      "Clínica ORL Martínez",
    "slug":      "clinica-orl-martinez",
    "type":      "CLINIC",
    "plan":      "FREE",
    "settings":  { "formTemplates": [], "defaultScale": "SNOT_22" },
    "logoUrl":   null,
    "createdAt": "2026-06-09T10:00:00.000Z",
    "memberCount": 3
  }
}
```

---

### `GET /v1/organizations/:orgId/members`

Lista los miembros de la organización.

**Auth:** `OWNER` | `ADMIN`

**Response `200`:**
```json
{
  "data": [
    {
      "userId":   "user-uuid",
      "name":     "Dr. Carlos Martínez",
      "email":    "carlos@clinica.com",
      "role":     "OWNER",
      "joinedAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 } }
}
```

---

### `POST /v1/organizations/:orgId/invitations`

Invita a un nuevo miembro. Envía email con token de invitación (TTL 72h).

**Auth:** `OWNER` | `ADMIN`

**Request:**
```json
{
  "email": "residente@clinica.com",
  "role":  "VIEWER"
}
```

**Response `201`:**
```json
{
  "data": {
    "invitationId": "inv-uuid",
    "email":        "residente@clinica.com",
    "role":         "VIEWER",
    "expiresAt":    "2026-06-12T10:00:00.000Z"
  }
}
```

---

### `PATCH /v1/organizations/:orgId/members/:userId`

Modifica el rol de un miembro.

**Auth:** `OWNER`

**Request:**
```json
{ "role": "PHYSICIAN" }
```

**Errores:**
- `409 LAST_OWNER_REMOVAL` — intento de degradar al último OWNER (BR-ORG-003)

---

### `DELETE /v1/organizations/:orgId/members/:userId`

Elimina a un miembro de la organización.

**Auth:** `OWNER` | `ADMIN`

**Errores:**
- `409 LAST_OWNER_REMOVAL` — si el miembro es el único OWNER

**Response `204 No Content`**

---

## 9. Endpoints — Patients

### `GET /v1/patients`

Lista los pacientes de la organización activa.

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Query params:**
```
search      string    Búsqueda en lastName, firstName, nhc, idDocument
page        integer
pageSize    integer
sortBy      "lastName" | "createdAt" | "nhc"   default: "lastName"
sortOrder   "asc" | "desc"                      default: "asc"
```

**Response `200`:**
```json
{
  "data": [
    {
      "id":        "patient-uuid",
      "nhc":       "2026-00034",
      "firstName": "Ana",
      "lastName":  "García López",
      "birthDate": "1984-03-12",
      "sex":       "FEMALE",
      "age":       42,
      "hasActiveAllergies":   true,
      "hasCriticalAllergy":   true,
      "lastConsultationDate": "2026-06-05T09:00:00.000Z"
    }
  ],
  "meta": { "pagination": { ... } }
}
```

*Nota: `phone`, `email`, `address`, `idDocument` no se incluyen en el listado — solo en el detalle.*

---

### `POST /v1/patients`

Crea un nuevo paciente.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "firstName": "Ana",
  "lastName":  "García López",
  "birthDate": "1984-03-12",
  "sex":       "FEMALE",
  "idDocument": "12345678X",
  "idDocType":  "DNI",
  "phone":      "+34 612 345 678",
  "email":      "ana.garcia@email.com",
  "bloodType":  "O_POS",
  "nhc":        "EXT-2024-001"
}
```

**Validaciones Zod:**
- `firstName`: string min 1, max 100, requerido
- `lastName`: string min 1, max 150, requerido
- `birthDate`: fecha ISO, no futura, requerido
- `sex`: enum `MALE | FEMALE | OTHER | UNKNOWN`, requerido
- `idDocument`: string opcional, max 20
- `phone`: string opcional, formato E.164 o libre
- `nhc`: string opcional — si se omite, el servidor genera uno automático (BR-PAT-001)

**Response `201`:**
```json
{
  "data": {
    "id":        "patient-uuid",
    "nhc":       "2026-00035",
    "firstName": "Ana",
    "lastName":  "García López",
    "birthDate": "1984-03-12",
    "sex":       "FEMALE",
    "age":       42,
    "createdAt": "2026-06-09T10:30:00.000Z"
  }
}
```

**Errores:**
- `409 DUPLICATE_PATIENT` — posibles duplicados detectados. El body incluye los pacientes similares:
```json
{
  "statusCode": 409,
  "error": "DUPLICATE_PATIENT",
  "message": "Se encontraron pacientes con datos similares",
  "details": {
    "similarPatients": [
      { "id": "uuid", "nhc": "2026-00010", "fullName": "Ana García López", "birthDate": "1984-03-12" }
    ],
    "confirmationRequired": true
  }
}
```

Para confirmar que es un paciente nuevo a pesar de los duplicados, reenviar la petición con el header:
```http
X-Confirm-Duplicate: true
```

---

### `GET /v1/patients/:patientId`

Devuelve el detalle completo de un paciente, incluyendo datos de contacto.

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER` (VIEWER recibe respuesta sin datos de contacto)

**Response `200`:**
```json
{
  "data": {
    "id":              "patient-uuid",
    "nhc":             "2026-00034",
    "firstName":       "Ana",
    "lastName":        "García López",
    "birthDate":       "1984-03-12",
    "sex":             "FEMALE",
    "age":             42,
    "idDocument":      "12345678X",
    "idDocType":       "DNI",
    "phone":           "+34 612 345 678",
    "email":           "ana.garcia@email.com",
    "bloodType":       "O_POS",
    "address": {
      "street":     "Calle Mayor 1",
      "city":       "Madrid",
      "province":   "Madrid",
      "postalCode": "28001",
      "country":    "ES"
    },
    "emergencyContact": {
      "name":         "Pedro García",
      "relationship": "Cónyuge",
      "phone":        "+34 612 999 888"
    },
    "notes":    null,
    "allergies": [
      {
        "id":          "allergy-uuid",
        "substance":   "Penicilina",
        "reaction":    "Anafilaxia",
        "severity":    "ANAPHYLAXIS",
        "status":      "ACTIVE"
      }
    ],
    "createdAt": "2026-01-15T09:00:00.000Z",
    "updatedAt": "2026-06-09T10:00:00.000Z"
  }
}
```

---

### `PATCH /v1/patients/:patientId`

Actualización parcial de los datos de un paciente.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:** cualquier subconjunto de campos editables (excepto `nhc`, `id`, timestamps)

**Response `200`:** objeto paciente actualizado (mismo formato que GET)

---

### `DELETE /v1/patients/:patientId`

Soft delete del paciente.

**Auth:** `OWNER` | `PHYSICIAN`

**Errores:**
- `409 CONFLICT` — el paciente tiene cirugías en estado `SCHEDULED` (BR-PAT-005)

**Response `204 No Content`**

---

### `POST /v1/patients/:patientId/allergies`

Añade una alergia al paciente.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "substance":     "Ibuprofeno",
  "substanceCode": "387207008",
  "reaction":      "Urticaria generalizada",
  "severity":      "MODERATE",
  "status":        "ACTIVE",
  "onsetDate":     "2022-05-10"
}
```

**Response `201`:** objeto alergia creado

---

## 10. Endpoints — Consultations

### `GET /v1/patients/:patientId/consultations`

Lista las consultas de un paciente ordenadas por fecha descendente.

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Query params:** `page`, `pageSize`, `from`, `to`, `type`

**Response `200`:**
```json
{
  "data": [
    {
      "id":             "consultation-uuid",
      "date":           "2026-06-05T09:00:00.000Z",
      "type":           "FOLLOW_UP",
      "chiefComplaint": "Revisión 3 meses post-septoplastia",
      "physicianName":  "Dr. Carlos Martínez",
      "diagnosisCodes": [
        { "system": "ICD10", "code": "J32.9", "description": "Rinosinusitis crónica", "type": "primary" }
      ],
      "hasReport":    true,
      "reportStatus": "SIGNED",
      "createdAt":    "2026-06-05T09:30:00.000Z"
    }
  ],
  "meta": { "pagination": { ... } }
}
```

---

### `POST /v1/patients/:patientId/consultations`

Crea una nueva consulta.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "date":           "2026-06-09T10:00:00.000Z",
  "type":           "FOLLOW_UP",
  "chiefComplaint": "Paciente refiere mejoría de la obstrucción nasal bilateral.",
  "currentIllness": "Intervenida de septoplastia hace 3 meses...",
  "physicalExam": {
    "septum": "Centrado",
    "otoscopy_right_membrane": "intact",
    "otoscopy_left_membrane": "intact"
  },
  "assessment":     "Buena evolución post-septoplastia. Discreta hipertrofia de cornetes.",
  "diagnosisCodes": [
    { "system": "ICD10", "code": "J32.9", "description": "Rinosinusitis crónica, no especificada", "type": "primary" }
  ],
  "plan":           "Continuar lavados nasales. Alta provisional.",
  "followUpDate":   "2026-09-15",
  "generateReport": true
}
```

**Validaciones Zod:**
- `date`: ISO date, no más de 24h en el futuro (BR-CON-002)
- `chiefComplaint`: string requerido, min 3, max 2000
- `diagnosisCodes`: array, si presente cada item debe tener `system`, `code`, `description`, `type` (BR-CON-006)
- `diagnosisCodes`: máximo 1 `primary`, máximo 9 en total (BR-CON-007)
- `generateReport`: boolean opcional, default false

**Response `201`:**
```json
{
  "data": {
    "id":        "consultation-uuid",
    "date":      "2026-06-09T10:00:00.000Z",
    "type":      "FOLLOW_UP",
    "patientId": "patient-uuid",
    "reportId":  "report-uuid",
    "reportStatus": "DRAFT",
    "createdAt": "2026-06-09T10:05:00.000Z"
  }
}
```

Si `generateReport: true`, el campo `reportId` referencia el informe en DRAFT que se está generando de forma asíncrona. El cliente puede hacer polling sobre `GET /v1/reports/:reportId` para conocer el estado.

---

### `GET /v1/patients/:patientId/consultations/:consultationId`

Devuelve el detalle completo de una consulta.

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Response `200`:** objeto completo con todos los campos de la consulta, incluyendo `physicalExam` completo y `diagnosisCodes`.

---

### `PATCH /v1/patients/:patientId/consultations/:consultationId`

Actualización parcial de una consulta.

**Auth:** `OWNER` (cualquier consulta) | `PHYSICIAN` (solo sus propias consultas — BR-RBAC-001)

**Response `200`:** objeto consulta actualizado

---

### `DELETE /v1/patients/:patientId/consultations/:consultationId`

Soft delete de una consulta.

**Auth:** `OWNER` (cualquier consulta) | `PHYSICIAN` (solo sus propias consultas)

**Response `204 No Content`**

---

## 11. Endpoints — Surgeries

### `GET /v1/patients/:patientId/surgeries`

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Response `200`:** lista de cirugías con `id`, `date`, `procedureType`, `status`, `asa`, `duration`, `physicianName`.

---

### `POST /v1/patients/:patientId/surgeries`

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "date":           "2026-03-20T08:30:00.000Z",
  "status":         "COMPLETED",
  "procedureType":  "Septoplastia + CENS bilateral",
  "procedureCodes": [
    { "system": "ICD10PCS", "code": "09UM0ZZ", "description": "Repair Nasal Septum, Open Approach" }
  ],
  "asa":            "ASA_I",
  "anesthesiaType": "General",
  "duration":       95,
  "technique": {
    "approach":       "endonasal",
    "turbinoplasty":  true,
    "turbinoplastyType": "submucosal",
    "hemostasis":     "bipolar",
    "packing":        "bilateral_merocel"
  },
  "findings":       "Desviación septal caudal con componente óseo. Cornetes inferiores hipertróficos.",
  "complications":  null,
  "postOpNotes":    "Buena hemostasia. Paciente extubada sin incidencias."
}
```

**Validaciones:**
- `asa`: requerido si `status = COMPLETED` (BR-SUR-002)
- `status`: solo transiciones permitidas (BR-SUR-003)
- `date`: si `status = COMPLETED`, no puede ser futura (BR-SUR-004)

**Response `201`:** objeto cirugía creado

---

### `PATCH /v1/patients/:patientId/surgeries/:surgeryId`

Actualización parcial. Si se modifica una cirugía `COMPLETED`, requiere el campo `editReason` (BR-SUR-005).

**Request con `editReason`:**
```json
{
  "duration": 105,
  "editReason": "Corrección de duración registrada erróneamente"
}
```

**Auth:** `OWNER` (cualquier) | `PHYSICIAN` (solo propias)

---

### `PATCH /v1/patients/:patientId/surgeries/:surgeryId/status`

Endpoint dedicado para cambios de estado (transición explícita).

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "status":        "CANCELLED",
  "statusReason":  "Paciente solicita aplazamiento por motivos personales"
}
```

**Errores:**
- `422 SURGERY_INVALID_TRANSITION` — transición no permitida (BR-SUR-003)

---

## 12. Endpoints — Imaging Studies

### `GET /v1/patients/:patientId/imaging`

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Response `200`:** lista con `id`, `type`, `date`, `description`, `fileCount`, `findings`.

---

### `POST /v1/patients/:patientId/imaging`

Crea un registro de estudio de imagen con metadatos. Los archivos se suben por separado.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "type":           "CT_SCAN",
  "date":           "2025-11-15",
  "description":    "TAC senos paranasales con contraste",
  "surgeryId":      null,
  "consultationId": "consultation-uuid"
}
```

**Response `201`:** objeto `ImagingStudy` con `id` y array `files: []`.

---

### `POST /v1/patients/:patientId/imaging/:studyId/files`

Sube uno o más archivos a un estudio existente. Endpoint `multipart/form-data`.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:** `Content-Type: multipart/form-data`
```
files[]:   File   (uno o más archivos — BR-IMG-001, BR-IMG-002)
```

**Proceso:**
1. Backend valida tipo MIME y tamaño
2. Genera clave R2: `{orgId}/{patientId}/imaging/{studyId}/{timestamp}-{filename}`
3. Sube a Cloudflare R2
4. Actualiza `ImagingStudy.files` añadiendo los metadatos de cada archivo

**Response `200`:**
```json
{
  "data": {
    "studyId": "study-uuid",
    "filesAdded": 3,
    "files": [
      {
        "key":       "org-uuid/patient-uuid/imaging/study-uuid/1718000000-scan_001.dcm",
        "name":      "scan_001.dcm",
        "mimeType":  "application/dicom",
        "sizeBytes": 4521234
      }
    ]
  }
}
```

---

### `GET /v1/patients/:patientId/imaging/:studyId/files/:fileKey/url`

Genera una URL pre-firmada para acceder a un archivo (TTL 15 minutos).

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Response `200`:**
```json
{
  "data": {
    "url":       "https://r2.medicore.app/org-uuid/...?X-Amz-Expires=900&...",
    "expiresAt": "2026-06-09T11:00:00.000Z"
  }
}
```

---

## 13. Endpoints — Medications

### `GET /v1/patients/:patientId/medications`

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Query params:** `status` (`ACTIVE | DISCONTINUED | ALL`, default: `ACTIVE`)

**Response `200`:** lista de prescripciones con todos sus campos.

---

### `POST /v1/patients/:patientId/medications`

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "drugName":       "Amoxicilina",
  "activeIngredient": "Amoxicilina",
  "dosage":         "500mg",
  "frequency":      "cada 8 horas",
  "route":          "oral",
  "form":           "comprimidos",
  "startDate":      "2026-06-09",
  "endDate":        "2026-06-19",
  "duration":       "10 días",
  "reason":         "Sinusitis bacteriana aguda",
  "instructions":   "Tomar con alimentos"
}
```

**Lógica de alerta de alergia (BR-MED-001):**

Si hay conflicto con `severity = ANAPHYLAXIS`, responde `422`:
```json
{
  "statusCode": 422,
  "error":      "ALLERGY_CONFLICT_CRITICAL",
  "message":    "El paciente tiene alergia anafiláctica registrada a Amoxicilina (Penicilinas)",
  "details": {
    "allergyId":  "allergy-uuid",
    "substance":  "Penicilina",
    "reaction":   "Anafilaxia",
    "canOverride": true
  }
}
```

Para prescribir bajo responsabilidad explícita del médico:
```http
X-Override-Critical-Allergy: confirmed
```
Esto persiste la prescripción y genera registro de auditoría con el override.

---

### `PATCH /v1/patients/:patientId/medications/:medicationId/discontinue`

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "discontinuationReason": "Completado el ciclo de tratamiento"
}
```

**Validación:** `discontinuationReason` requerido (BR-MED-003)

**Response `200`:** prescripción actualizada con `status: DISCONTINUED`

---

## 14. Endpoints — Clinical Scales

### `GET /v1/patients/:patientId/scales`

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Query params:** `scaleType`, `from`, `to`

**Response `200`:** lista de escalas ordenadas por fecha descendente, con `id`, `scaleType`, `date`, `scores`, `notes`.

---

### `POST /v1/patients/:patientId/scales`

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "scaleType":      "SNOT_22",
  "consultationId": "consultation-uuid",
  "date":           "2026-06-09",
  "scores": {
    "q1": 3, "q2": 2, "q3": 4, "q4": 1, "q5": 2,
    "q6": 3, "q7": 1, "q8": 0, "q9": 2, "q10": 1,
    "q11": 2, "q12": 1, "q13": 0, "q14": 1, "q15": 2,
    "q16": 1, "q17": 0, "q18": 1, "q19": 0, "q20": 1,
    "q21": 0, "q22": 1
  },
  "notes": "Mejoría significativa respecto a evaluación pre-quirúrgica"
}
```

El servidor calcula y almacena el `total` automáticamente para escalas predefinidas (BR-SCA-002).

**Response `201`:** objeto escala con `total` calculado incluido en `scores`.

---

## 15. Endpoints — Reports

### `GET /v1/patients/:patientId/reports`

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Query params:** `status`, `type`

**Response `200`:** lista con `id`, `type`, `status`, `title`, `aiGenerated`, `signedAt`, `createdAt`.

---

### `POST /v1/patients/:patientId/reports/generate`

Genera un informe clínico con IA de forma asíncrona.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "type":       "FOLLOW_UP_REPORT",
  "sourceType": "consultation",
  "sourceId":   "consultation-uuid",
  "title":      "Informe de revisión — Rinosinusitis crónica"
}
```

**Proceso:**
1. Valida contexto mínimo (BR-REP-001)
2. Verifica límite de generación del plan (BR-REP-009)
3. Crea `Report` en estado `DRAFT` con `content: ""`
4. Encola job `generate-report` en BullMQ
5. Responde inmediatamente con el `reportId`

**Response `202 Accepted`:**
```json
{
  "data": {
    "reportId":  "report-uuid",
    "status":    "DRAFT",
    "message":   "Generando informe. Consulta el estado en GET /v1/reports/report-uuid"
  }
}
```

**Errores:**
- `422 AI_LIMIT_EXCEEDED` — límite mensual alcanzado (BR-REP-009)
- `422 VALIDATION_ERROR` — contexto clínico insuficiente (BR-REP-001)

---

### `POST /v1/patients/:patientId/reports`

Crea un informe manualmente (sin IA).

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "type":           "MEDICAL_CERTIFICATE",
  "title":          "Certificado médico — Baja laboral",
  "content":        "El/la paciente Ana García López...",
  "diagnosisCodes": [ ... ],
  "procedureCodes": []
}
```

**Response `201`:** objeto `Report` en estado `DRAFT`.

---

### `GET /v1/patients/:patientId/reports/:reportId`

Devuelve el detalle completo del informe incluyendo el `content`.

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Response `200`:**
```json
{
  "data": {
    "id":           "report-uuid",
    "type":         "FOLLOW_UP_REPORT",
    "status":       "DRAFT",
    "title":        "Informe de revisión — Rinosinusitis crónica",
    "content":      "INFORME DE REVISIÓN\n\nPaciente: Ana García López...",
    "aiGenerated":  true,
    "aiModel":      "claude-sonnet-4-20250514",
    "diagnosisCodes": [ ... ],
    "procedureCodes": [],
    "pdfUrl":       null,
    "signedAt":     null,
    "createdAt":    "2026-06-09T10:10:00.000Z",
    "updatedAt":    "2026-06-09T10:10:45.000Z"
  }
}
```

---

### `PATCH /v1/patients/:patientId/reports/:reportId`

Edita el contenido de un informe en estado `DRAFT` o `REVIEWED`.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "content":        "INFORME DE REVISIÓN\n\n[contenido editado por el médico]",
  "status":         "REVIEWED",
  "diagnosisCodes": [ ... ]
}
```

**Errores:**
- `422 REPORT_IMMUTABLE` — intento de editar un informe `SIGNED` (BR-REP-004)

---

### `POST /v1/patients/:patientId/reports/:reportId/sign`

Firma el informe. Transición `REVIEWED → SIGNED` y encola generación del PDF.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "confirmDisclaimer": true
}
```

`confirmDisclaimer` requerido y debe ser `true` — confirma que el médico ha leído el disclaimer de responsabilidad (BR-REP-005).

**Response `200`:**
```json
{
  "data": {
    "reportId":  "report-uuid",
    "status":    "SIGNED",
    "signedAt":  "2026-06-09T11:00:00.000Z",
    "signedBy":  "user-uuid",
    "message":   "PDF generándose. Disponible en breve en Report.pdfUrl"
  }
}
```

---

### `GET /v1/patients/:patientId/reports/:reportId/pdf`

Genera y devuelve una URL pre-firmada para descargar el PDF del informe firmado.

**Auth:** `OWNER` | `PHYSICIAN` | `VIEWER`

**Errores:**
- `404` — el informe no está en estado `SIGNED` o el PDF aún no se ha generado

**Response `200`:**
```json
{
  "data": {
    "url":       "https://r2.medicore.app/...",
    "expiresAt": "2026-06-09T11:15:00.000Z"
  }
}
```

---

## 16. Endpoints — Analytics

### `GET /v1/analytics/overview`

KPIs generales del dashboard principal.

**Auth:** `OWNER` | `PHYSICIAN`

**Query params:** `from`, `to` (default: últimos 12 meses)

**Response `200`:**
```json
{
  "data": {
    "totalPatients":       247,
    "newPatients":         38,
    "totalConsultations":  612,
    "totalSurgeries":      38,
    "avgConsultationsPerPatient": 4.2,
    "reportsGenerated":    189,
    "aiReportsGenerated":  145,
    "period": { "from": "2025-06-01", "to": "2026-06-01" }
  }
}
```

---

### `GET /v1/analytics/diagnoses`

Distribución de diagnósticos por código CIE-10 o SNOMED.

**Auth:** `OWNER` | `PHYSICIAN`

**Query params:** `from`, `to`, `system` (`ICD10 | SNOMED`, default: `ICD10`), `limit` (default: 10)

**Response `200`:**
```json
{
  "data": [
    {
      "code":        "J32.9",
      "description": "Rinosinusitis crónica, no especificada",
      "count":       62,
      "percentage":  25.1
    }
  ]
}
```

---

### `GET /v1/analytics/scales/:scaleType`

Evolución y estadísticas de una escala clínica a nivel de cohorte.

**Auth:** `OWNER` | `PHYSICIAN`

**Query params:** `from`, `to`, `diagnosisCode` (filtrar cohorte por diagnóstico)

**Response `200`:**
```json
{
  "data": {
    "scaleType":    "SNOT_22",
    "sampleSize":   45,
    "avgScore":     42.3,
    "medianScore":  38.0,
    "distribution": {
      "mild":     8,
      "moderate": 22,
      "severe":   15
    },
    "trend": [
      { "month": "2025-11", "avgScore": 58.2, "sampleSize": 12 },
      { "month": "2026-01", "avgScore": 44.1, "sampleSize": 18 },
      { "month": "2026-03", "avgScore": 31.4, "sampleSize": 15 }
    ],
    "warning": null
  }
}
```

Si `sampleSize < 20`, el campo `warning` contiene: `"Tamaño de muestra insuficiente para significancia estadística"` (BR-ANA-003).

---

## 17. Endpoints — Export

### `POST /v1/export/patients/:patientId`

Exporta la historia clínica completa de un paciente.

**Auth:** `OWNER` | `PHYSICIAN`

**Request:**
```json
{
  "format":      "pdf",
  "includeDeleted": false,
  "sections":    ["consultations", "surgeries", "imaging", "medications", "reports"]
}
```

**Proceso asíncrono:** devuelve `202` con un `jobId`. El PDF/JSON se genera en background y se notifica al médico cuando está listo.

**Response `202`:**
```json
{
  "data": {
    "jobId":     "job-uuid",
    "message":   "Exportación en proceso. Recibirás una notificación cuando esté lista."
  }
}
```

---

### `GET /v1/export/jobs/:jobId`

Consulta el estado de un job de exportación.

**Response `200`:**
```json
{
  "data": {
    "jobId":   "job-uuid",
    "status":  "COMPLETED",
    "url":     "https://r2.medicore.app/exports/...",
    "expiresAt": "2026-06-10T10:00:00.000Z"
  }
}
```

---

## 18. Webhooks internos (BullMQ jobs)

Los jobs de BullMQ no son endpoints HTTP externos, sino workers internos del mismo proceso NestJS. Se documentan aquí por completitud.

```
Job name                  Trigger                         Worker action
────────────────────────────────────────────────────────────────────────────────
generate-report           POST /reports/generate          Llama Anthropic API,
                                                          actualiza Report.content

generate-report-pdf       POST /reports/:id/sign          Genera PDF con react-pdf,
                                                          sube a R2, actualiza pdfUrl

generate-export-pdf       POST /export/patients/:id       Genera PDF de historial,
                                                          sube a R2, envía notificación

extract-dicom-metadata    POST /imaging/:id/files         Extrae metadatos del DICOM,
                                                          actualiza ImagingStudy

purge-expired-records     CRON diario 02:00               Borra físicamente registros
                                                          cuyo deletedAt supera
                                                          el período de retención
```

Todos los jobs tienen:
- Reintentos automáticos: 3 intentos con backoff exponencial
- TTL máximo: 60 segundos para generación IA (BR-REP-008)
- Dead letter queue para jobs fallidos con alerta a Sentry

---

## 19. Versionado de la API

La API usa versionado por prefijo de URL (`/v1/`). La estrategia de versiones:

- **Breaking changes** (modificación de campos existentes, eliminación de endpoints) → nueva versión `/v2/`
- **Non-breaking changes** (nuevos endpoints, nuevos campos opcionales en responses) → no requieren nueva versión
- Las versiones anteriores se mantienen activas un mínimo de 6 meses tras el lanzamiento de la siguiente
- Los headers de deprecación se incluyen en las respuestas de versiones antiguas:

```http
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://api.medicore.app/v2/>; rel="successor-version"
```

---