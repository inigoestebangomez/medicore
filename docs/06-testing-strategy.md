# 06-testing-strategy.md
## MediCore — Estrategia de Testing

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** todos los documentos anteriores aprobados

---

## Índice

1. [Filosofía de Testing](#1-filosofía-de-testing)
2. [Pirámide de Tests](#2-pirámide-de-tests)
3. [Herramientas y Configuración](#3-herramientas-y-configuración)
4. [Convenios de Nombrado y Estructura](#4-convenios-de-nombrado-y-estructura)
5. [Tests Unitarios — Dominio y Casos de Uso](#5-tests-unitarios--dominio-y-casos-de-uso)
6. [Tests de Integración — API e Infraestructura](#6-tests-de-integración--api-e-infraestructura)
7. [Tests E2E — Flujos Críticos](#7-tests-e2e--flujos-críticos)
8. [Tests de Contrato — Schemas Zod](#8-tests-de-contrato--schemas-zod)
9. [Tests de Seguridad — Tenant Isolation](#9-tests-de-seguridad--tenant-isolation)
10. [Fixtures y Factories Clínicas](#10-fixtures-y-factories-clínicas)
11. [Mocks de Servicios Externos](#11-mocks-de-servicios-externos)
12. [Cobertura por Módulo](#12-cobertura-por-módulo)
13. [Pipeline CI — Ejecución y Gates](#13-pipeline-ci--ejecución-y-gates)
14. [TDD en Práctica — Flujo de Trabajo](#14-tdd-en-práctica--flujo-de-trabajo)
15. [SDD en Práctica — Tests como Especificación Viva](#15-sdd-en-práctica--tests-como-especificación-viva)

---

## 1. Filosofía de Testing

En MediCore los tests no son una red de seguridad que se añade después del código. Son la **especificación ejecutable** del sistema: antes de escribir cualquier implementación, el test define exactamente qué debe ocurrir. Si el test pasa, la especificación está cumplida.

Tres principios guían toda la estrategia:

**Los tests del dominio clínico son los más importantes.** Una regla de negocio mal testeada en un sistema médico tiene consecuencias reales. Las reglas de alergia, los permisos de acceso a datos de pacientes, y la inmutabilidad de informes firmados tienen cobertura del 100% sin excepción. No es negociable.

**Un test que tarda más de 100ms en ejecutarse está mal diseñado.** Los tests unitarios son instantáneos porque no tocan base de datos, no llaman a APIs externas y no levantan el servidor HTTP. Si un test de lógica de negocio necesita Redis o PostgreSQL para ejecutarse, el diseño de la capa de dominio está acoplado a la infraestructura — ese es el bug real.

**Los tests documentan intenciones, no implementaciones.** El nombre de un test es una frase en español que describe el comportamiento esperado desde la perspectiva del dominio clínico, no desde la perspectiva del código. `debería_bloquear_prescripción_con_alergia_anafiláctica` es un buen nombre. `test_medication_service_create_409` es un mal nombre.

---

## 2. Pirámide de Tests

```
                    ┌─────────────┐
                    │   E2E (10%) │  Playwright
                    │  ~20 tests  │  Flujos críticos completos
                    └──────┬──────┘  Lentos (~30s/test)
                           │
               ┌───────────┴───────────┐
               │  Integración (20%)    │  Jest + Supertest
               │     ~80 tests         │  API endpoints + repositorios
               └──────────┬────────────┘  Medianos (~2s/test)
                          │
          ┌───────────────┴───────────────┐
          │       Unitarios (70%)         │  Jest (backend) + Vitest (frontend)
          │         ~300 tests            │  Dominio + casos de uso + componentes
          └───────────────────────────────┘  Rápidos (<50ms/test)

          + Tests de contrato (transversales)  ~30 tests
          + Tests de seguridad/tenant          ~20 tests
```

### Objetivos de cobertura mínima

```
Capa                               Cobertura mínima
─────────────────────────────────────────────────────
Domain (entidades, value objects)       100%
Application (use cases / handlers)       90%
Infrastructure (repositorios)            80%
API (controllers, guards, pipes)         85%
Frontend (componentes clínicos)          80%
Packages/contracts (schemas Zod)        100%
```

La cobertura se mide con `jest --coverage` y se reporta en CI. Un PR que baje la cobertura global por debajo del umbral de cada capa es rechazado automáticamente.

---

## 3. Herramientas y Configuración

### Backend (apps/api)

```json
// apps/api/package.json (devDependencies relevantes)
{
  "@nestjs/testing":       "^10.0.0",
  "jest":                  "^29.0.0",
  "ts-jest":               "^29.0.0",
  "supertest":             "^6.0.0",
  "@faker-js/faker":       "^8.0.0",
  "prisma-mock":           "^0.14.0"
}
```

```typescript
// apps/api/jest.config.ts
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '.*\\.spec\\.ts$',
  transform:            { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom:  ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory:    '../coverage',
  testEnvironment:      'node',
  // Tests unitarios y de integración separados por proyecto Jest
  projects: [
    {
      displayName: 'unit',
      testPathPattern: '(?<!integration)\\.spec\\.ts$',
      setupFilesAfterEach: ['<rootDir>/../test/setup-unit.ts'],
    },
    {
      displayName: 'integration',
      testPathPattern: '\\.integration\\.spec\\.ts$',
      setupFilesAfterEach: ['<rootDir>/../test/setup-integration.ts'],
      globalSetup:  '<rootDir>/../test/global-setup.ts',
      globalTeardown: '<rootDir>/../test/global-teardown.ts',
    },
  ],
}
```

### Frontend (apps/web)

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment:    'jsdom',
    globals:        true,
    setupFiles:     ['./test/setup.ts'],
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'lcov'],
      include:    ['src/components/**', 'src/lib/**'],
      exclude:    ['src/components/ui/**'],  // shadcn/ui — no testeamos librerías externas
    },
  },
})
```

### E2E (apps/web)

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir:   './e2e',
  timeout:   30_000,
  retries:   2,           // reintentos en CI para flakiness de red
  use: {
    baseURL:     process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace:       'on-first-retry',
    screenshot:  'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet',   use: { ...devices['iPad Pro'] } },
  ],
})
```

### Configuración de base de datos para tests de integración

```typescript
// apps/api/test/global-setup.ts
// Usa Neon branching: crea un branch de DB temporal para cada run de CI
// En local usa una DB de test local con Docker Compose

export async function setup() {
  if (process.env.CI) {
    // Neon API: crea branch de test
    const branch = await createNeonBranch(`test-${process.env.GITHUB_SHA}`)
    process.env.TEST_DATABASE_URL = branch.connectionString
  } else {
    process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/medicore_test'
  }

  // Aplica migraciones en la DB de test
  await execMigrations(process.env.TEST_DATABASE_URL)
}

export async function teardown() {
  if (process.env.CI) {
    await deleteNeonBranch(`test-${process.env.GITHUB_SHA}`)
  } else {
    await truncateAllTables(process.env.TEST_DATABASE_URL)
  }
}
```

---

## 4. Convenios de Nombrado y Estructura

### Archivos de test

```
Tipo          Sufijo                   Ubicación
────────────────────────────────────────────────────────────────────
Unitario      .spec.ts                 Junto al archivo que testea
Integración   .integration.spec.ts    Junto al controller/repository
E2E           .e2e.ts                 apps/web/e2e/
Contrato      .contract.spec.ts       packages/contracts/src/
```

### Estructura de un test (patrón AAA)

```typescript
// Arrange — Act — Assert: siempre en este orden, siempre separado visualmente

describe('CreatePatientHandler', () => {
  // Agrupa por comportamiento, no por método

  describe('cuando los datos son válidos', () => {
    it('debería crear el paciente con el NHC generado automáticamente', async () => {
      // Arrange
      const repository = new InMemoryPatientRepository()
      const handler    = new CreatePatientHandler(repository)
      const command    = makeCreatePatientCommand({ nhc: undefined })

      // Act
      const result = await handler.execute(command)

      // Assert
      expect(result.nhc).toMatch(/^2026-\d{5}$/)
      expect(repository.findAll()).toHaveLength(1)
    })
  })

  describe('cuando ya existe un paciente con datos similares', () => {
    it('debería lanzar DuplicatePatientError con los candidatos', async () => {
      // Arrange
      const repository = new InMemoryPatientRepository()
      await repository.save(makePatient({ lastName: 'García', birthDate: '1984-03-12' }))
      const handler = new CreatePatientHandler(repository)
      const command = makeCreatePatientCommand({
        lastName:  'García',
        birthDate: '1984-03-12',
        confirmDuplicate: false,
      })

      // Act & Assert
      await expect(handler.execute(command))
        .rejects.toThrow(DuplicatePatientError)
    })
  })
})
```

### Reglas de nombrado de tests

- El `describe` externo: nombre de la clase o componente bajo test
- El `describe` interno: condición o estado del sistema (`cuando...`, `si...`, `con...`)
- El `it`: comportamiento esperado en voz activa (`debería...`, `no debería...`)
- **Nunca** nombres técnicos: no `test_create_201`, no `should_call_repository`
- **Siempre** en español — el dominio clínico es en español, los tests también

---

## 5. Tests Unitarios — Dominio y Casos de Uso

Los tests unitarios son la base de la pirámide. No usan NestJS, no usan Prisma, no usan Redis. Son clases JavaScript puras con dependencias inyectadas como mocks o implementaciones en memoria.

### 5.1 Entidades de dominio

```typescript
// src/domain/patient/patient.entity.spec.ts

describe('Patient (entidad de dominio)', () => {

  describe('cálculo de edad', () => {
    it('debería calcular la edad correctamente a partir de birthDate', () => {
      const patient = Patient.create({ birthDate: new Date('1984-03-12'), ... })
      expect(patient.age).toBe(42)  // asumiendo fecha de test fijada a 2026-06-09
    })

    it('debería marcar al paciente como pediátrico si tiene menos de 14 años', () => {
      const patient = Patient.create({ birthDate: new Date('2015-01-01'), ... })
      expect(patient.isPediatric).toBe(true)
    })
  })

  describe('estado de alergias', () => {
    it('debería detectar alerta crítica cuando hay alergia con severidad ANAPHYLAXIS activa', () => {
      const patient = Patient.create({ ... })
      patient.addAllergy(makeAllergy({ severity: 'ANAPHYLAXIS', status: 'ACTIVE' }))
      expect(patient.hasCriticalAllergy).toBe(true)
    })

    it('no debería detectar alerta crítica si la alergia anafiláctica está inactiva', () => {
      const patient = Patient.create({ ... })
      patient.addAllergy(makeAllergy({ severity: 'ANAPHYLAXIS', status: 'INACTIVE' }))
      expect(patient.hasCriticalAllergy).toBe(false)
    })
  })
})
```

### 5.2 Casos de uso — Patients

```typescript
// src/application/patient/commands/create-patient.handler.spec.ts

describe('CreatePatientHandler', () => {

  describe('generación de NHC', () => {
    it('debería generar NHC secuencial si no se proporciona uno externo', async () => {
      const { handler, repository } = makeTestContext()
      await handler.execute(makeCreatePatientCommand({ nhc: undefined }))
      await handler.execute(makeCreatePatientCommand({ nhc: undefined }))

      const patients = repository.findAll()
      expect(patients[0].nhc).toBe('2026-00001')
      expect(patients[1].nhc).toBe('2026-00002')
    })

    it('debería aceptar NHC externo si no existe en la organización', async () => {
      const { handler } = makeTestContext()
      const result = await handler.execute(makeCreatePatientCommand({ nhc: 'EXT-2024-001' }))
      expect(result.nhc).toBe('EXT-2024-001')
    })

    it('debería rechazar NHC externo si ya existe en la organización', async () => {
      const { handler, repository } = makeTestContext()
      await repository.save(makePatient({ nhc: 'EXT-2024-001' }))

      await expect(
        handler.execute(makeCreatePatientCommand({ nhc: 'EXT-2024-001' }))
      ).rejects.toThrow(DuplicateNhcError)
    })
  })

  describe('detección de duplicados', () => {
    it('debería lanzar DuplicatePatientError si coinciden apellido + fecha nacimiento', async () => {
      const { handler, repository } = makeTestContext()
      await repository.save(makePatient({ lastName: 'García López', birthDate: '1984-03-12' }))

      const command = makeCreatePatientCommand({
        lastName:         'García López',
        birthDate:        '1984-03-12',
        confirmDuplicate: false,
      })

      await expect(handler.execute(command)).rejects.toThrow(DuplicatePatientError)
    })

    it('debería crear el paciente si confirmDuplicate es true aunque haya duplicados', async () => {
      const { handler, repository } = makeTestContext()
      await repository.save(makePatient({ lastName: 'García', birthDate: '1984-03-12' }))

      const command = makeCreatePatientCommand({
        lastName:         'García',
        birthDate:        '1984-03-12',
        confirmDuplicate: true,
      })

      await expect(handler.execute(command)).resolves.toBeDefined()
      expect(repository.findAll()).toHaveLength(2)
    })
  })
})
```

### 5.3 Casos de uso — Medications (reglas de alergia)

```typescript
// src/application/medication/commands/create-prescription.handler.spec.ts

describe('CreatePrescriptionHandler', () => {

  describe('alertas de alergia (BR-MED-001)', () => {
    it('debería bloquear la prescripción si el paciente tiene alergia ANAPHYLAXIS activa al principio activo', async () => {
      const { handler } = makeTestContextWithPatient({
        allergies: [makeAllergy({ substance: 'Amoxicilina', severity: 'ANAPHYLAXIS', status: 'ACTIVE' })]
      })

      await expect(
        handler.execute(makeCreatePrescriptionCommand({ activeIngredient: 'Amoxicilina' }))
      ).rejects.toThrow(CriticalAllergyConflictError)
    })

    it('debería permitir la prescripción con override explícito a pesar de alergia ANAPHYLAXIS', async () => {
      const { handler, auditRepository } = makeTestContextWithPatient({
        allergies: [makeAllergy({ substance: 'Amoxicilina', severity: 'ANAPHYLAXIS', status: 'ACTIVE' })]
      })

      const command = makeCreatePrescriptionCommand({
        activeIngredient:        'Amoxicilina',
        overrideCriticalAllergy: true,
      })

      await expect(handler.execute(command)).resolves.toBeDefined()

      // El override debe quedar auditado
      const auditEntry = auditRepository.findLast()
      expect(auditEntry.action).toBe('CRITICAL_ALLERGY_OVERRIDE')
    })

    it('debería emitir advertencia pero permitir prescripción si la alergia es MODERATE', async () => {
      const { handler } = makeTestContextWithPatient({
        allergies: [makeAllergy({ substance: 'Ibuprofeno', severity: 'MODERATE', status: 'ACTIVE' })]
      })

      const result = await handler.execute(
        makeCreatePrescriptionCommand({ activeIngredient: 'Ibuprofeno' })
      )

      expect(result.warnings).toContain('ALLERGY_CONFLICT_WARNING')
    })

    it('no debería alertar si la alergia está inactiva', async () => {
      const { handler } = makeTestContextWithPatient({
        allergies: [makeAllergy({ substance: 'Penicilina', severity: 'ANAPHYLAXIS', status: 'INACTIVE' })]
      })

      await expect(
        handler.execute(makeCreatePrescriptionCommand({ activeIngredient: 'Amoxicilina' }))
      ).resolves.toBeDefined()
    })
  })

  describe('duplicación de medicación (BR-MED-002)', () => {
    it('debería incluir advertencia si ya existe prescripción activa del mismo principio activo', async () => {
      const { handler } = makeTestContextWithPatient({
        activeMedications: [makeMedication({ activeIngredient: 'Ibuprofeno', status: 'ACTIVE' })]
      })

      const result = await handler.execute(
        makeCreatePrescriptionCommand({ activeIngredient: 'Ibuprofeno' })
      )

      expect(result.warnings).toContain('DUPLICATE_MEDICATION')
    })
  })
})
```

### 5.4 Casos de uso — Reports (ciclo de vida)

```typescript
// src/application/report/commands/sign-report.handler.spec.ts

describe('SignReportHandler', () => {

  it('debería firmar el informe y registrar signedAt y signedBy', async () => {
    const { handler, repository } = makeTestContext()
    const report = makeReport({ status: 'REVIEWED' })
    await repository.save(report)

    const result = await handler.execute({ reportId: report.id, userId: 'physician-uuid' })

    expect(result.status).toBe('SIGNED')
    expect(result.signedAt).toBeDefined()
    expect(result.signedBy).toBe('physician-uuid')
  })

  it('debería rechazar la firma si el informe está en estado DRAFT', async () => {
    const { handler, repository } = makeTestContext()
    const report = makeReport({ status: 'DRAFT' })
    await repository.save(report)

    await expect(
      handler.execute({ reportId: report.id, userId: 'physician-uuid' })
    ).rejects.toThrow(ReportNotReviewedError)
  })

  it('no debería permitir modificar un informe SIGNED (BR-REP-004)', async () => {
    const { handler, repository } = makeTestContext()
    const report = makeReport({ status: 'SIGNED' })
    await repository.save(report)

    await expect(
      new UpdateReportHandler(repository).execute({
        reportId: report.id,
        content:  'Contenido modificado'
      })
    ).rejects.toThrow(ReportImmutableError)
  })
})
```

### 5.5 Tests de RBAC

```typescript
// src/api/shared/guards/rbac.guard.spec.ts

describe('RBACGuard', () => {

  describe('rol VIEWER', () => {
    it('debería denegar la creación de consultas', () => {
      const guard   = makeRBACGuard({ role: 'VIEWER' })
      const context = makeExecutionContext({ method: 'POST', path: '/consultations' })
      expect(guard.canActivate(context)).toBe(false)
    })

    it('debería permitir la lectura de consultas', () => {
      const guard   = makeRBACGuard({ role: 'VIEWER' })
      const context = makeExecutionContext({ method: 'GET', path: '/consultations' })
      expect(guard.canActivate(context)).toBe(true)
    })
  })

  describe('rol ADMIN', () => {
    it('debería denegar el acceso a datos clínicos de pacientes', () => {
      const guard   = makeRBACGuard({ role: 'ADMIN' })
      const context = makeExecutionContext({ method: 'GET', path: '/patients' })
      expect(guard.canActivate(context)).toBe(false)
    })
  })

  describe('rol PHYSICIAN', () => {
    it('debería denegar la edición de consultas de otro médico', async () => {
      const { handler } = makeTestContext({ userId: 'physician-A' })
      const consultation = makeConsultation({ createdBy: 'physician-B' })

      await expect(
        handler.execute({ consultationId: consultation.id, userId: 'physician-A', ... })
      ).rejects.toThrow(ForbiddenError)
    })
  })
})
```

### 5.6 Tests de escalas clínicas

```typescript
// src/application/scale/commands/create-scale.handler.spec.ts

describe('CreateClinicalScaleHandler', () => {

  describe('cálculo de total (BR-SCA-002)', () => {
    it('debería calcular el total SNOT-22 sumando los 22 ítems', async () => {
      const { handler } = makeTestContext()
      const scores = Object.fromEntries(
        Array.from({ length: 22 }, (_, i) => [`q${i + 1}`, 3])
      ) // 22 ítems × 3 = 66

      const result = await handler.execute(makeCreateScaleCommand({
        scaleType: 'SNOT_22',
        scores,
      }))

      expect(result.scores.total).toBe(66)
    })

    it('debería ignorar el total enviado por el cliente y recalcularlo', async () => {
      const { handler } = makeTestContext()
      const result = await handler.execute(makeCreateScaleCommand({
        scaleType: 'SNOT_22',
        scores: { ...validSnot22Scores, total: 999 },  // total manipulado
      }))

      expect(result.scores.total).not.toBe(999)
    })
  })
})
```

---

## 6. Tests de Integración — API e Infraestructura

Los tests de integración usan la base de datos de test real (PostgreSQL) y el servidor NestJS levantado en modo test. No mockean la DB — sí mockean servicios externos (Anthropic, R2, BullMQ).

```typescript
// src/api/patients/patients.controller.integration.spec.ts

describe('PatientsController (integración)', () => {
  let app: INestApplication
  let db:  PrismaService
  let org: Organization
  let token: string  // JWT de test para el médico de test

  beforeAll(async () => {
    app   = await createTestApp()
    db    = app.get(PrismaService)
    org   = await db.organization.create({ data: makeOrganization() })
    token = makeTestJWT({ organizationId: org.id, role: 'PHYSICIAN' })
  })

  afterEach(async () => {
    await db.patient.deleteMany({ where: { organizationId: org.id } })
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /v1/patients', () => {

    it('debería crear un paciente y devolver 201 con el NHC generado', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/patients')
        .set('Cookie', `medicore-session=${token}`)
        .send(makeCreatePatientDto())
        .expect(201)

      expect(response.body.data.nhc).toMatch(/^\d{4}-\d{5}$/)
      expect(response.body.data.id).toBeDefined()
    })

    it('debería devolver 409 con candidatos duplicados si coinciden datos', async () => {
      await db.patient.create({ data: makePatientRow({ organizationId: org.id, lastName: 'García', birthDate: new Date('1984-03-12') }) })

      const response = await request(app.getHttpServer())
        .post('/v1/patients')
        .set('Cookie', `medicore-session=${token}`)
        .send(makeCreatePatientDto({ lastName: 'García', birthDate: '1984-03-12' }))
        .expect(409)

      expect(response.body.error).toBe('DUPLICATE_PATIENT')
      expect(response.body.details.similarPatients).toHaveLength(1)
    })

    it('debería crear el paciente con X-Confirm-Duplicate aunque haya duplicados', async () => {
      await db.patient.create({ data: makePatientRow({ organizationId: org.id, lastName: 'García', birthDate: new Date('1984-03-12') }) })

      await request(app.getHttpServer())
        .post('/v1/patients')
        .set('Cookie', `medicore-session=${token}`)
        .set('X-Confirm-Duplicate', 'true')
        .send(makeCreatePatientDto({ lastName: 'García', birthDate: '1984-03-12' }))
        .expect(201)
    })

    it('debería devolver 401 sin token de sesión', async () => {
      await request(app.getHttpServer())
        .post('/v1/patients')
        .send(makeCreatePatientDto())
        .expect(401)
    })

    it('debería devolver 403 si el rol es VIEWER', async () => {
      const viewerToken = makeTestJWT({ organizationId: org.id, role: 'VIEWER' })

      await request(app.getHttpServer())
        .post('/v1/patients')
        .set('Cookie', `medicore-session=${viewerToken}`)
        .send(makeCreatePatientDto())
        .expect(403)
    })
  })

  describe('GET /v1/patients', () => {

    it('debería devolver solo los pacientes de la organización del JWT', async () => {
      const otherOrg = await db.organization.create({ data: makeOrganization() })
      await db.patient.createMany({
        data: [
          makePatientRow({ organizationId: org.id }),
          makePatientRow({ organizationId: org.id }),
          makePatientRow({ organizationId: otherOrg.id }),  // de otra org
        ]
      })

      const response = await request(app.getHttpServer())
        .get('/v1/patients')
        .set('Cookie', `medicore-session=${token}`)
        .expect(200)

      // Solo devuelve los 2 de la org del médico — nunca el de otra org
      expect(response.body.data).toHaveLength(2)
    })
  })
})
```

### 6.1 Tests de repositorios Prisma

```typescript
// src/infrastructure/database/repositories/prisma-patient.repository.integration.spec.ts

describe('PrismaPatientRepository (integración)', () => {

  it('debería aplicar el filtro organizationId en findById', async () => {
    const orgA = await db.organization.create({ data: makeOrganization() })
    const orgB = await db.organization.create({ data: makeOrganization() })
    const patient = await db.patient.create({ data: makePatientRow({ organizationId: orgA.id }) })

    const repository = new PrismaPatientRepository(db)

    // Buscar el paciente de orgA con el contexto de orgB debe devolver null
    const result = await repository.findById(patient.id, orgB.id)
    expect(result).toBeNull()
  })

  it('no debería devolver pacientes con deletedAt', async () => {
    const org = await db.organization.create({ data: makeOrganization() })
    await db.patient.create({ data: makePatientRow({ organizationId: org.id, deletedAt: new Date() }) })

    const repository = new PrismaPatientRepository(db)
    const results    = await repository.findAll(org.id)

    expect(results).toHaveLength(0)
  })
})
```

---

## 7. Tests E2E — Flujos Críticos

Los tests E2E usan Playwright contra la aplicación completa. Solo cubren los flujos más críticos — son costosos y lentos. La regla es: si un flujo falla, un paciente real podría verse afectado.

```typescript
// e2e/patient-creation.e2e.ts

test.describe('Alta de nuevo paciente', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsTestPhysician(page)
  })

  test('debería completar el alta de un paciente con datos mínimos', async ({ page }) => {
    await page.goto('/patients/new')

    await page.fill('[name="firstName"]', 'Ana')
    await page.fill('[name="lastName"]',  'García López')
    await page.fill('[name="birthDate"]', '12/03/1984')
    await page.selectOption('[name="sex"]', 'FEMALE')

    await page.click('button:has-text("Guardar paciente")')

    // Debe navegar a la ficha del paciente nuevo
    await expect(page).toHaveURL(/\/patients\/[\w-]+$/)
    await expect(page.locator('h1')).toContainText('García López, Ana')
    await expect(page.locator('[data-testid="nhc"]')).toContainText('2026-')
  })

  test('debería mostrar el modal de duplicados y permitir confirmar', async ({ page }) => {
    // Seed: paciente existente con mismos datos
    await seedPatient({ lastName: 'García', birthDate: '1984-03-12' })

    await page.goto('/patients/new')
    await fillPatientForm(page, { lastName: 'García', birthDate: '12/03/1984' })
    await page.click('button:has-text("Guardar paciente")')

    // Debe aparecer el modal de duplicados
    await expect(page.locator('[data-testid="duplicate-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="duplicate-modal"]')).toContainText('García')

    // Confirmar que es un paciente nuevo
    await page.click('button:has-text("Crear de todas formas")')
    await expect(page).toHaveURL(/\/patients\/[\w-]+$/)
  })
})
```

```typescript
// e2e/report-lifecycle.e2e.ts

test.describe('Ciclo de vida de un informe clínico', () => {

  test('debería generar, revisar y firmar un informe', async ({ page }) => {
    const { patientId, consultationId } = await seedConsultationWithDiagnosis()

    await page.goto(`/patients/${patientId}/consultations/${consultationId}`)
    await page.click('button:has-text("Generar informe")')

    // Espera a que el informe se genere (polling)
    await expect(page.locator('[data-testid="report-status"]'))
      .toHaveText('BORRADOR', { timeout: 15_000 })

    // El médico edita el informe
    await page.click('[data-testid="report-content"]')
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Contenido revisado por el médico')

    // Cambia a revisado
    await page.click('button:has-text("Marcar como revisado")')
    await expect(page.locator('[data-testid="report-status"]')).toHaveText('REVISADO')

    // Firma el informe
    await page.click('button:has-text("Firmar informe")')
    await expect(page.locator('[data-testid="disclaimer-modal"]')).toBeVisible()
    await page.click('button:has-text("Confirmar firma")')

    await expect(page.locator('[data-testid="report-status"]')).toHaveText('FIRMADO')

    // El botón de editar ya no debe estar disponible
    await expect(page.locator('button:has-text("Editar")')).not.toBeVisible()
  })
})
```

```typescript
// e2e/allergy-alert.e2e.ts

test.describe('Alerta de alergia crítica', () => {

  test('debería mostrar banner de alergia ANAPHYLAXIS en todas las vistas del paciente', async ({ page }) => {
    const { patientId } = await seedPatientWithCriticalAllergy({
      substance: 'Penicilina', severity: 'ANAPHYLAXIS'
    })

    // El banner aparece en la ficha del paciente
    await page.goto(`/patients/${patientId}`)
    await expect(page.locator('[data-testid="critical-allergy-banner"]')).toBeVisible()

    // El banner aparece en la vista de consultas
    await page.click('[data-testid="tab-consultations"]')
    await expect(page.locator('[data-testid="critical-allergy-banner"]')).toBeVisible()

    // El banner aparece en la vista de medicación
    await page.click('[data-testid="tab-medication"]')
    await expect(page.locator('[data-testid="critical-allergy-banner"]')).toBeVisible()
  })
})
```

---

## 8. Tests de Contrato — Schemas Zod

Los schemas Zod del paquete `@medicore/contracts` son la fuente de verdad de los contratos API. Tienen su propia suite de tests que verifica casos límite clínicamente relevantes.

```typescript
// packages/contracts/src/patient.schema.contract.spec.ts

describe('CreatePatientSchema (contrato)', () => {

  it('debería aceptar los campos mínimos obligatorios', () => {
    const result = CreatePatientSchema.safeParse({
      firstName: 'Ana',
      lastName:  'García',
      birthDate: '1984-03-12',
      sex:       'FEMALE',
    })
    expect(result.success).toBe(true)
  })

  it('debería rechazar birthDate en el futuro', () => {
    const result = CreatePatientSchema.safeParse({
      firstName: 'Ana', lastName: 'García', sex: 'FEMALE',
      birthDate: '2030-01-01',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('birthDate')
  })

  it('debería rechazar sex con valor fuera del enum', () => {
    const result = CreatePatientSchema.safeParse({
      firstName: 'Ana', lastName: 'García', birthDate: '1984-03-12',
      sex: 'UNKNOWN_VALUE',
    })
    expect(result.success).toBe(false)
  })
})

// packages/contracts/src/consultation.schema.contract.spec.ts

describe('CreateConsultationSchema (contrato)', () => {

  it('debería rechazar más de un diagnóstico primary', () => {
    const result = CreateConsultationSchema.safeParse({
      ...validConsultationBase,
      diagnosisCodes: [
        { system: 'ICD10', code: 'J32.9', description: '...', type: 'primary' },
        { system: 'ICD10', code: 'J34.2', description: '...', type: 'primary' },
      ]
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/un único diagnóstico primary/)
  })

  it('debería rechazar más de 10 códigos diagnósticos en total', () => {
    const result = CreateConsultationSchema.safeParse({
      ...validConsultationBase,
      diagnosisCodes: Array.from({ length: 11 }, (_, i) => ({
        system: 'ICD10', code: `J${i}`, description: '...', type: 'secondary'
      }))
    })
    expect(result.success).toBe(false)
  })
})
```

---

## 9. Tests de Seguridad — Tenant Isolation

El aislamiento de datos entre organizaciones es el control de seguridad más crítico del sistema. Tiene su propia categoría de tests que se ejecutan en cada PR sin excepción.

```typescript
// src/api/security/tenant-isolation.spec.ts

describe('Tenant Isolation (seguridad crítica)', () => {

  let orgA: Organization, orgB: Organization
  let tokenA: string, tokenB: string
  let patientInOrgA: Patient

  beforeAll(async () => {
    orgA        = await createOrg()
    orgB        = await createOrg()
    tokenA      = makeTestJWT({ organizationId: orgA.id, role: 'PHYSICIAN' })
    tokenB      = makeTestJWT({ organizationId: orgB.id, role: 'PHYSICIAN' })
    patientInOrgA = await createPatient({ organizationId: orgA.id })
  })

  it('debería devolver 404 al intentar acceder a un paciente de otra organización', async () => {
    // El médico de orgB intenta acceder al paciente de orgA
    await request(app.getHttpServer())
      .get(`/v1/patients/${patientInOrgA.id}`)
      .set('Cookie', `medicore-session=${tokenB}`)
      .expect(404)  // No 403 — no se revela que el recurso existe
  })

  it('no debería listar pacientes de otra organización en GET /patients', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/patients')
      .set('Cookie', `medicore-session=${tokenB}`)
      .expect(200)

    const ids = response.body.data.map((p: any) => p.id)
    expect(ids).not.toContain(patientInOrgA.id)
  })

  it('debería devolver 404 al intentar crear una consulta en un paciente de otra org', async () => {
    await request(app.getHttpServer())
      .post(`/v1/patients/${patientInOrgA.id}/consultations`)
      .set('Cookie', `medicore-session=${tokenB}`)
      .send(makeCreateConsultationDto())
      .expect(404)
  })

  it('debería devolver 404 al intentar acceder a una imagen de otra organización', async () => {
    const study = await createImagingStudy({ organizationId: orgA.id, patientId: patientInOrgA.id })

    await request(app.getHttpServer())
      .get(`/v1/patients/${patientInOrgA.id}/imaging/${study.id}`)
      .set('Cookie', `medicore-session=${tokenB}`)
      .expect(404)
  })

  it('no debería incluir datos de contacto del paciente para rol VIEWER', async () => {
    const viewerToken = makeTestJWT({ organizationId: orgA.id, role: 'VIEWER' })

    const response = await request(app.getHttpServer())
      .get(`/v1/patients/${patientInOrgA.id}`)
      .set('Cookie', `medicore-session=${viewerToken}`)
      .expect(200)

    expect(response.body.data.phone).toBeUndefined()
    expect(response.body.data.email).toBeUndefined()
    expect(response.body.data.address).toBeUndefined()
    expect(response.body.data.idDocument).toBeUndefined()
  })
})
```

---

## 10. Fixtures y Factories Clínicas

Las factories generan datos de test realistas del dominio ORL. Usan `@faker-js/faker` con semilla fija para reproducibilidad.

```typescript
// apps/api/test/factories/patient.factory.ts

import { faker } from '@faker-js/faker'

faker.seed(42)  // Semilla fija para reproducibilidad en CI

export function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id:             faker.string.uuid(),
    organizationId: faker.string.uuid(),
    nhc:            `2026-${faker.number.int({ min: 1, max: 99999 }).toString().padStart(5, '0')}`,
    firstName:      faker.person.firstName(),
    lastName:       faker.person.lastName(),
    birthDate:      faker.date.birthdate({ min: 18, max: 85, mode: 'age' }),
    sex:            faker.helpers.arrayElement(['MALE', 'FEMALE']),
    bloodType:      'UNKNOWN',
    createdBy:      faker.string.uuid(),
    createdAt:      new Date(),
    updatedAt:      new Date(),
    deletedAt:      null,
    ...overrides,
  }
}

// Fixtures de patologías ORL frecuentes (datos 100% ficticios)

export const ORL_FIXTURES = {
  rinosinusitis_cronica: {
    patient:      makePatient({ firstName: 'Carmen', lastName: 'Rodríguez Vega' }),
    consultation: makeConsultation({
      chiefComplaint: 'Obstrucción nasal bilateral y cefalea frontal de 6 meses de evolución',
      diagnosisCodes: [{ system: 'ICD10', code: 'J32.9', description: 'Rinosinusitis crónica', type: 'primary' }],
    }),
    scale: makeClinicalScale({
      scaleType: 'SNOT_22',
      scores: { q1:4, q2:3, q3:5, q4:2, q5:3, q6:4, q7:2, q8:1, q9:3, q10:2, q11:3, q12:2, q13:1, q14:2, q15:3, q16:2, q17:1, q18:2, q19:1, q20:2, q21:1, q22:2, total: 51 }
    }),
  },

  vertigo_vppb: {
    patient:      makePatient({ firstName: 'Luis', lastName: 'Fernández Soto' }),
    consultation: makeConsultation({
      chiefComplaint: 'Vértigo posicional de inicio brusco hace 3 días',
      diagnosisCodes: [{ system: 'ICD10', code: 'H81.1', description: 'Vértigo posicional paroxístico benigno', type: 'primary' }],
    }),
    scale: makeClinicalScale({
      scaleType: 'DHI',
      scores: { physical: 20, functional: 18, emotional: 14, total: 52 }
    }),
  },

  hipoacusia_neurosensorial: {
    patient:      makePatient({ firstName: 'Marta', lastName: 'García Blanco', birthDate: new Date('1955-07-22') }),
    consultation: makeConsultation({
      chiefComplaint: 'Hipoacusia bilateral progresiva de 2 años de evolución y acúfeno continuo',
      diagnosisCodes: [{ system: 'ICD10', code: 'H90.3', description: 'Hipoacusia neurosensorial bilateral', type: 'primary' }],
    }),
  },
}
```

---

## 11. Mocks de Servicios Externos

Los servicios externos se mockean siempre en tests unitarios e integración. Nunca se llaman APIs reales en tests.

### Mock de Anthropic API

```typescript
// apps/api/test/mocks/anthropic.mock.ts

export const mockAnthropicService = {
  generateReport: jest.fn().mockResolvedValue({
    content: 'INFORME CLÍNICO GENERADO POR MOCK\n\nPaciente: Test...',
    model:   'claude-sonnet-4-20250514',
    inputTokens:  1200,
    outputTokens: 450,
  }),

  // Simulación de timeout para tests de BR-REP-008
  generateReportWithTimeout: jest.fn().mockRejectedValue(
    new Error('Anthropic API timeout after 60s')
  ),
}

// Uso en tests:
// jest.spyOn(anthropicService, 'generateReport').mockResolvedValue(mockResponse)
```

### Mock de Cloudflare R2

```typescript
// apps/api/test/mocks/r2-storage.mock.ts

export const mockR2StorageService = {
  upload: jest.fn().mockResolvedValue({
    key: 'org-uuid/patient-uuid/imaging/study-uuid/test-file.dcm',
    url: 'https://r2.test/test-file.dcm',
  }),

  getPresignedUrl: jest.fn().mockResolvedValue({
    url:       'https://r2.test/presigned/test-file.dcm?expires=900',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }),

  delete: jest.fn().mockResolvedValue({ deleted: true }),
}
```

### Mock de BullMQ

```typescript
// apps/api/test/mocks/bullmq.mock.ts

// En tests de integración los jobs se ejecutan de forma síncrona
// usando el módulo de testing de NestJS + BullMQ

export const mockQueueService = {
  add: jest.fn().mockImplementation(async (jobName, data) => {
    // Simula la ejecución síncrona del job para tests
    if (jobName === 'generate-report') {
      await executeGenerateReportJob(data)
    }
    return { id: 'mock-job-id' }
  }),
}
```

---

## 12. Cobertura por Módulo

```
Módulo / Capa                  Unitarios    Integración    E2E    Contrato
────────────────────────────────────────────────────────────────────────────
Auth / Sesión                     ✓✓✓          ✓✓           -        -
RBAC / Guards                     ✓✓✓          ✓✓           -        -
Tenant isolation                  ✓✓✓          ✓✓✓          -        -
Patients CRUD                     ✓✓✓          ✓✓           ✓✓       ✓✓
Allergies                         ✓✓✓          ✓✓           ✓        -
Consultations                     ✓✓✓          ✓✓           ✓        ✓✓
Surgeries                         ✓✓✓          ✓✓           ✓        ✓
Surgery status transitions        ✓✓✓          ✓            -        -
Imaging upload/access             ✓✓           ✓✓           ✓        -
Medications + allergy alerts      ✓✓✓          ✓✓           ✓        ✓
Clinical Scales                   ✓✓           ✓            -        ✓
Reports — generación IA           ✓✓           ✓✓           ✓✓       -
Reports — firma / inmutabilidad   ✓✓✓          ✓✓           ✓✓       -
Analytics queries                 ✓✓           ✓            -        -
Export paciente                   ✓✓           ✓            ✓        -
────────────────────────────────────────────────────────────────────────────
✓✓✓ = cobertura crítica (100%)   ✓✓ = cobertura alta (>85%)   ✓ = cobertura básica (>70%)
```

---

## 13. Pipeline CI — Ejecución y Gates

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    name: Lint + Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - run: pnpm test:unit --coverage
      - name: Coverage gate
        run: |
          # Falla si la cobertura de dominio baja del 90%
          pnpm coverage:check --threshold.domain=90 --threshold.application=85

  contract-tests:
    name: Contract Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - run: pnpm --filter @medicore/contracts test

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: medicore_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - run: pnpm test:integration

  security-tests:
    name: Tenant Isolation Tests
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - run: pnpm test:security

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.base_ref == 'main'  # Solo en PRs a main
    steps:
      - run: pnpm build
      - run: pnpm test:e2e
```

### Gates de calidad (bloquean el merge)

```
Gate                               Condición de fallo
────────────────────────────────────────────────────────────────────
Lint                               Cualquier error ESLint
Type check                         Cualquier error TypeScript
Cobertura dominio                  < 90%
Cobertura aplicación               < 85%
Cobertura global                   < 80%
Tests de contrato                  Cualquier fallo
Tests de tenant isolation          Cualquier fallo
Tests de alergia (BR-MED-001)      Cualquier fallo
Tests de informe firmado           Cualquier fallo
```

Los tests E2E no son gate de merge en PRs a `develop` — son gate solo en PRs a `main`.

---

## 14. TDD en Práctica — Flujo de Trabajo

El ciclo TDD en MediCore sigue estrictamente **Red → Green → Refactor**. Este es el flujo concreto para implementar una nueva feature.

### Ejemplo: implementar BR-SUR-003 (transiciones de estado de cirugía)

```
PASO 1 — RED: escribir el test que falla

  // create-surgery-status.handler.spec.ts
  it('debería rechazar la transición de COMPLETED a CANCELLED', async () => {
    const surgery = makeSurgery({ status: 'COMPLETED' })
    await expect(handler.execute({ surgeryId: surgery.id, newStatus: 'CANCELLED' }))
      .rejects.toThrow(InvalidSurgeryTransitionError)
  })

  → Ejecutar: pnpm test -- --testNamePattern "transición"
  → Resultado: FAIL (InvalidSurgeryTransitionError no existe aún)

PASO 2 — GREEN: escribir el mínimo código para que pase

  // surgery.entity.ts
  const ALLOWED_TRANSITIONS = {
    SCHEDULED:  ['COMPLETED', 'CANCELLED', 'POSTPONED'],
    POSTPONED:  ['SCHEDULED', 'CANCELLED'],
    COMPLETED:  [],
    CANCELLED:  [],
  }

  class Surgery {
    transition(newStatus: SurgeryStatus): void {
      if (!ALLOWED_TRANSITIONS[this.status].includes(newStatus)) {
        throw new InvalidSurgeryTransitionError(this.status, newStatus)
      }
      this.status = newStatus
    }
  }

  → Ejecutar: pnpm test -- --testNamePattern "transición"
  → Resultado: PASS

PASO 3 — REFACTOR: mejorar sin romper tests

  // Extraer la tabla de transiciones a una constante nombrada
  // Añadir tipado estricto con un tipo discriminado
  // Los tests siguen pasando

PASO 4 — Escribir los demás tests de la regla

  it('debería permitir SCHEDULED → COMPLETED')
  it('debería permitir SCHEDULED → CANCELLED')
  it('debería rechazar CANCELLED → SCHEDULED')
  // etc.
```

### Regla del Pull Request

Un PR no puede añadir lógica de negocio sin el test correspondiente. El reviewer verifica:
1. El test describe el comportamiento en lenguaje del dominio
2. El test fallaría si la implementación fuera incorrecta
3. La cobertura de la nueva feature es ≥ 85%

---

## 15. SDD en Práctica — Tests como Especificación Viva

Bajo SDD (Specification-Driven Development), los archivos `0x-*.md` son la especificación de alto nivel. Los tests son la especificación ejecutable de bajo nivel. Deben estar sincronizados.

### Trazabilidad especificación → test

Cada regla de negocio del `03-business-rules.md` tiene al menos un test que la verifica. La trazabilidad se mantiene mediante comentarios en los tests:

```typescript
// BR-REP-004: Un informe SIGNED no puede modificarse
it('no debería permitir modificar un informe SIGNED', async () => { ... })

// BR-MED-001: Bloqueo de prescripción con alergia ANAPHYLAXIS
it('debería bloquear la prescripción si hay alergia ANAPHYLAXIS activa', async () => { ... })

// BR-RBAC-002: VIEWER no recibe datos de contacto del paciente
it('no debería incluir teléfono ni email en la respuesta para rol VIEWER', async () => { ... })
```

### Cuando cambia una especificación

El proceso obligatorio ante cualquier cambio en los documentos `0x-*.md`:

```
1. Actualizar el documento de especificación
2. Identificar qué tests existentes invalida el cambio
3. Modificar o eliminar los tests afectados → RED
4. Implementar el cambio en el código → GREEN
5. Refactorizar si procede
6. El PR incluye siempre: cambio en spec + cambio en tests + cambio en código
```

Un PR que modifica lógica de negocio sin actualizar la especificación o los tests es rechazado en code review.

---

*Siguiente documento sugerido: `07-security-compliance.md` — Modelo de amenazas STRIDE, controles RGPD/ENS, gestión de consentimientos y política de backups.*