# 10-implementation-roadmap.md
## MediCore — Roadmap de Implementación

> **Versión:** 1.0 | **Estado:** Activo | **Fecha:** 2026-06
> **Contexto:** Un desarrollador. Nivel mid. Objetivo: construir bien desde el principio.
> **Prerequisito:** todos los documentos `01`–`09` aprobados y comprendidos.

---

## Cómo usar este documento

Cada **Fase** es un bloque de trabajo cohesionado que produce algo funcional y desplegable.
Cada **Work Unit (WU)** es la unidad mínima de trabajo: un commit o una sesión.
Cada WU tiene:
- Qué construir exactamente
- Por dónde empezar (el test TDD)
- **Done** — la señal inequívoca de que está terminada
- **⚠ Aprende antes** — cuando el stack puede sorprenderte si no lo conoces

No empieces la siguiente WU hasta que la anterior tenga su **Done** cumplido.
No empieces la siguiente Fase hasta que todas sus WUs estén completas.

---

## Mapa de dependencias entre módulos

```
[Fase 0: Scaffolding]
        ↓
[Fase 1: Auth + Org]
        ↓
[Fase 2: Pacientes]          ← todo lo demás depende de esto
        ↓
[Fase 3: Consultas] ──────────────────────────┐
        ↓                                      ↓
[Fase 4: Cirugías]                    [Fase 5: Imágenes]
        ↓                                      ↓
[Fase 6: Medicación + Escalas]                 ↓
        ↓                                      ↓
[Fase 7: Informes IA] ←────────────────────────┘
        ↓
[Fase 8: Analytics]
        ↓
[Fase 9: Export + RGPD]
        ↓
[Fase 10: Deploy MVP]
```

No hay atajos en este mapa. Pacientes es el núcleo — sin él no existe nada clínico.

---

## Fase 0 — Scaffolding del Monorepo

**Objetivo:** tener el esqueleto del proyecto funcionando con CI verde antes de escribir una sola línea de dominio.

---

### WU-00-01 — Inicializar monorepo con pnpm + Turborepo

**Construye:**
- `pnpm-workspace.yaml` con las apps y packages definidas en `01-architecture.md`
- `turbo.json` con los pipelines: `build`, `test`, `lint`, `type-check`
- `tooling/tsconfig/base.json` y las extensiones por app
- `tooling/eslint-config/` con reglas TypeScript estrictas

**Test TDD de inicio:**
No aplica TDD aquí — es configuración pura. El "test" es:
```bash
pnpm install          # sin errores
pnpm turbo run build  # todas las apps compilan
pnpm turbo run lint   # sin warnings
```

**Done:**
- `pnpm turbo run build` completa sin errores desde la raíz
- La estructura de carpetas coincide exactamente con `01-architecture.md` sección 5
- `.gitignore` incluye todos los secretos listados en `07-security-compliance.md` sección 7

**⚠ Aprende antes:** Turborepo cachea outputs por hash de inputs. Si un cambio no parece reflejarse, `turbo run build --force`. Leer: [https://turbo.build/repo/docs/core-concepts/caching](https://turbo.build/repo/docs/core-concepts/caching)

---

### WU-00-02 — Package `@medicore/contracts` con schemas Zod base

**Construye:**
- `packages/contracts/src/shared.schema.ts` — tipos base: `UuidSchema`, `IsoDateSchema`, `PaginationSchema`, respuesta estándar
- `packages/contracts/src/index.ts` — barrel export
- `packages/contracts/package.json` — con `exports` correctos para que NestJS y Next.js lo importen
- Suite de tests del contrato base

**Test TDD de inicio:**
```typescript
// packages/contracts/src/shared.schema.contract.spec.ts
it('UuidSchema debería rechazar strings que no son UUID v4', () => {
  expect(UuidSchema.safeParse('not-a-uuid').success).toBe(false)
})
it('PaginationSchema debería usar page=1 y pageSize=20 por defecto', () => {
  const result = PaginationSchema.safeParse({})
  expect(result.data).toEqual({ page: 1, pageSize: 20 })
})
```

**Done:**
- `pnpm --filter @medicore/contracts test` pasa al 100%
- `apps/api` puede importar `@medicore/contracts` sin errores de TypeScript
- `apps/web` puede importar `@medicore/contracts` sin errores de TypeScript

---

### WU-00-03 — NestJS base: app module, Prisma service, variables de entorno

**Construye:**
- `apps/api/src/main.ts` con Helmet, CORS, rate limiting (ver `07-security-compliance.md` sección 10)
- `apps/api/src/app.module.ts` esqueleto
- `apps/api/src/infrastructure/database/prisma.service.ts`
- `apps/api/prisma/schema.prisma` — solo los modelos `User`, `Organization`, `OrganizationMember` por ahora
- Primera migración: `pnpm prisma migrate dev --name "init-identity"`
- `apps/api/src/infrastructure/database/prisma-tenant.middleware.ts` (el middleware de seguridad de `07-security-compliance.md` sección 2)

**Test TDD de inicio:**
```typescript
// apps/api/src/infrastructure/database/prisma.service.spec.ts
it('PrismaService debería conectarse a la base de datos de test', async () => {
  const prisma = new PrismaService()
  await expect(prisma.$connect()).resolves.not.toThrow()
})
```

**Done:**
- `pnpm prisma migrate dev` aplica la migración sin errores contra Neon dev branch
- `GET /v1/health` responde `{ status: 'ok' }` — endpoint mínimo de health check
- El middleware de tenant safety lanza error en dev si una query clínica omite `organizationId` (no aplica aún porque no hay modelos clínicos, pero el middleware está instalado)

**⚠ Aprende antes:** NestJS `PrismaService` debe extender `OnModuleInit` y `OnModuleDestroy` para gestionar el ciclo de vida de la conexión correctamente. Sin esto tendrás connection leaks en tests. Ver patrón en la documentación oficial de NestJS + Prisma.

---

### WU-00-04 — Next.js base: App Router, Auth.js v5, variables de entorno

**Construye:**
- `apps/web/app/layout.tsx` — layout raíz con providers
- `apps/web/app/(auth)/login/page.tsx` — página de login con botones OAuth
- `apps/web/app/api/auth/[...nextauth]/route.ts` — handler de Auth.js v5
- `apps/web/lib/auth.ts` — configuración Auth.js: providers Google + Microsoft, callbacks JWT
- Middleware de Next.js para proteger rutas del dashboard

**Test TDD de inicio:**
```typescript
// apps/web/lib/auth.spec.ts
it('el callback JWT debería incluir organizationId cuando el usuario tiene una membresía activa', () => {
  const token = buildJwtCallback({ user: makeUserWithMembership() })
  expect(token.organizationId).toBeDefined()
})
it('el callback JWT debería ser null para organizationId si el usuario no tiene membresías', () => {
  const token = buildJwtCallback({ user: makeUserWithoutMembership() })
  expect(token.organizationId).toBeNull()
})
```

**Done:**
- El flujo OAuth completo funciona en local (Google o Microsoft)
- Un usuario no autenticado que accede a `/dashboard` es redirigido a `/login`
- Un usuario autenticado sin organización es redirigido a `/onboarding`
- El JWT incluye `organizationId` y `role`

**⚠ Aprende antes:** Auth.js v5 (NextAuth v5) tiene una API diferente a v4. Los callbacks `jwt` y `session` funcionan distinto. No uses documentación de v4. La documentación de v5 está en [https://authjs.dev](https://authjs.dev). La diferencia más importante: en v5 el `session` callback recibe `token` directamente, no un objeto separado.

---

### WU-00-05 — GitHub Actions CI pipeline

**Construye:**
- `.github/workflows/ci.yml` con los jobs definidos en `06-testing-strategy.md` sección 13
- Scripts en `package.json` raíz: `test:unit`, `test:integration`, `test:security`, `test:e2e`, `lint`, `type-check`
- Badge de CI en `README.md`

**Done:**
- Un PR abierto contra `develop` ejecuta el pipeline y lo muestra en verde
- Un test fallido bloquea el merge (branch protection activado en GitHub)
- TruffleHog escanea el código sin alertas

---

## Fase 1 — Auth y Organizaciones

**Objetivo:** cualquier usuario puede registrarse, crear su workspace y gestionar miembros. El sistema de permisos RBAC está operativo.

---

### WU-01-01 — Dominio: entidades User y Organization

**Construye:**
- `apps/api/src/domain/organization/organization.entity.ts`
- `apps/api/src/domain/organization/value-objects/organization-slug.vo.ts` — encapsula la lógica de generación y validación del slug
- `apps/api/src/domain/organization/organization.repository.interface.ts`
- `apps/api/src/domain/user/user.entity.ts`
- `apps/api/src/domain/user/user.repository.interface.ts`

**Test TDD de inicio:**
```typescript
// organization.entity.spec.ts
it('debería generar un slug válido a partir del nombre de la organización', () => {
  const org = Organization.create({ name: 'Clínica ORL Martínez' })
  expect(org.slug).toBe('clinica-orl-martinez')
})
it('debería eliminar caracteres especiales del slug', () => {
  const org = Organization.create({ name: 'Clínica & Salud ORL' })
  expect(org.slug).toMatch(/^[a-z0-9-]+$/)
})
```

**Done:**
- Todas las entidades de dominio están en la capa `domain/` sin ningún import de NestJS, Prisma o librerías externas
- Los tests del dominio pasan en < 50ms cada uno
- `pnpm test:unit` verde

---

### WU-01-02 — Infraestructura: repositorios Prisma para User y Organization

**Construye:**
- `apps/api/src/infrastructure/database/repositories/prisma-organization.repository.ts`
- `apps/api/src/infrastructure/database/repositories/prisma-user.repository.ts`
- Tests de integración de ambos repositorios

**Test TDD de inicio:**
```typescript
// prisma-organization.repository.integration.spec.ts
it('findBySlug debería devolver null para un slug que no existe', async () => {
  const repo = new PrismaOrganizationRepository(prisma)
  const result = await repo.findBySlug('slug-que-no-existe')
  expect(result).toBeNull()
})
```

**Done:**
- Los tests de integración de repositorios pasan contra la DB de test
- El repositorio nunca hace `findMany` sin filtros — verificado en los tests

---

### WU-01-03 — Application: casos de uso de organización

**Construye:**
- `CreateOrganizationHandler` — crea org y asigna OWNER al creador
- `InviteMemberHandler` — genera token de invitación (BR-ORG-004)
- `ChangeMemberRoleHandler` — con validación de último OWNER (BR-ORG-003)
- `RemoveMemberHandler`
- `InMemoryOrganizationRepository` para tests unitarios

**Test TDD de inicio:**
```typescript
// create-organization.handler.spec.ts
it('debería asignar automáticamente el rol OWNER al creador', async () => {
  const { handler, memberRepository } = makeTestContext()
  const result = await handler.execute({ name: 'Mi Clínica', userId: 'user-1' })
  const member = await memberRepository.findByUserAndOrg('user-1', result.id)
  expect(member.role).toBe('OWNER')
})
// change-member-role.handler.spec.ts
it('debería lanzar LastOwnerError al intentar degradar al único OWNER', async () => {
  // BR-ORG-003
  ...
})
```

**Done:**
- Todos los use cases tienen tests unitarios con `InMemoryOrganizationRepository`
- Ningún use case importa Prisma directamente
- Cobertura de la capa application para este módulo ≥ 90%

---

### WU-01-04 — API: controllers de Auth y Organization + guards

**Construye:**
- `apps/api/src/api/shared/guards/auth.guard.ts` — valida JWT de cookie
- `apps/api/src/api/shared/guards/tenant.guard.ts`
- `apps/api/src/api/shared/guards/rbac.guard.ts` — con la matriz de permisos de `03-business-rules.md` sección 4
- `apps/api/src/api/shared/interceptors/tenant.interceptor.ts`
- `apps/api/src/api/shared/interceptors/audit.interceptor.ts`
- `apps/api/src/api/auth/auth.controller.ts` — endpoints de `05-api-spec.md` sección 7
- `apps/api/src/api/organizations/organizations.controller.ts` — endpoints de sección 8
- Tests de integración de los controllers

**Test TDD de inicio:**
```typescript
// rbac.guard.spec.ts — empieza por el guard más crítico
it('debería denegar al rol ADMIN acceso a cualquier endpoint clínico', () => { ... })
it('debería denegar al rol VIEWER operaciones de escritura', () => { ... })
// organizations.controller.integration.spec.ts
it('POST /organizations debería devolver 401 sin cookie de sesión', async () => { ... })
```

**Done:**
- Todos los endpoints de `05-api-spec.md` secciones 7 y 8 responden correctamente
- Los tests de seguridad de tenant isolation de `06-testing-strategy.md` sección 9 pasan
- `GET /v1/auth/me` devuelve el usuario con sus membresías

**⚠ Aprende antes:** En NestJS, el orden de los guards importa: `AuthGuard` siempre antes de `RBACGuard` porque RBAC necesita el usuario autenticado del contexto. Los guards se aplican con `@UseGuards(AuthGuard, TenantGuard, RBACGuard)`. Si los aplicas en orden incorrecto, el error es confuso.

---

### WU-01-05 — Frontend: login, onboarding y selector de organización

**Construye:**
- `apps/web/app/(auth)/login/page.tsx` — botones Google y Microsoft
- `apps/web/app/(auth)/onboarding/page.tsx` — formulario de creación de organización
- `apps/web/app/(dashboard)/settings/members/page.tsx` — gestión de miembros
- `apps/web/lib/api-client.ts` — cliente HTTP tipado que usa los schemas de `@medicore/contracts`

**Done:**
- Un usuario nuevo puede hacer OAuth → crear organización → llegar al dashboard vacío
- El cambio de organización activa funciona si el usuario tiene más de una
- El cliente API usa los mismos schemas Zod que el backend — un cambio en `@medicore/contracts` rompe ambos lados simultáneamente (eso es correcto)

---

## Fase 2 — Módulo Pacientes

**Objetivo:** el médico puede crear, buscar, ver y gestionar pacientes. Es el módulo más importante del sistema — todo lo clínico depende de él.

---

### WU-02-01 — Schema Prisma: modelo Patient y Allergy + migración

**Construye:**
- Añadir modelos `Patient` y `Allergy` al `schema.prisma` completos (ver `02-data-schema.md`)
- Migración: `pnpm prisma migrate dev --name "add-patient-allergy"`
- Seed básico: 3 pacientes de test con patologías ORL del fixture `ORL_FIXTURES` de `06-testing-strategy.md`

**Done:**
- `pnpm prisma migrate dev` sin errores
- `pnpm prisma db seed` crea los 3 pacientes de test
- `pnpm prisma studio` muestra los registros correctamente

---

### WU-02-02 — Contracts: schemas Zod de Patient y Allergy

**Construye:**
- `packages/contracts/src/patient.schema.ts` — `CreatePatientSchema`, `UpdatePatientSchema`, `PatientResponseSchema`
- `packages/contracts/src/allergy.schema.ts` — `CreateAllergySchema`, `AllergyResponseSchema`
- Tests de contrato exhaustivos para los casos límite clínicos

**Test TDD de inicio:**
```typescript
// patient.schema.contract.spec.ts
it('debería rechazar birthDate en el futuro')
it('debería requerir firstName, lastName, birthDate y sex como mínimo')
it('debería aceptar nhc externo opcional')
it('debería rechazar sex con valor fuera del enum')
```

**Done:**
- `pnpm --filter @medicore/contracts test` pasa al 100%
- Cobertura de `patient.schema.ts` y `allergy.schema.ts` al 100%

---

### WU-02-03 — Dominio: entidad Patient con lógica de negocio

**Construye:**
- `apps/api/src/domain/patient/patient.entity.ts`
  - Propiedades calculadas: `age`, `isPediatric`, `hasCriticalAllergy`, `hasActiveAllergies`
  - Métodos: `addAllergy()`, `softDelete()`, `anonymize()`
- `apps/api/src/domain/patient/value-objects/nhc.vo.ts` — generación y validación del NHC `YYYY-NNNNN`
- `apps/api/src/domain/patient/value-objects/patient-id.vo.ts`
- `apps/api/src/domain/patient/patient.repository.interface.ts`
- `apps/api/src/domain/patient/errors/` — `DuplicatePatientError`, `DuplicateNhcError`, `PatientNotFoundError`

**Test TDD de inicio:**
```typescript
// patient.entity.spec.ts — empieza por las propiedades calculadas
it('debería calcular la edad correctamente a partir de birthDate')
it('debería marcar al paciente como pediátrico si tiene menos de 14 años')
it('debería detectar alerta crítica cuando hay alergia ANAPHYLAXIS activa')
it('no debería detectar alerta crítica si la alergia ANAPHYLAXIS está inactiva')
// nhc.vo.spec.ts
it('debería generar NHC con formato YYYY-NNNNN')
it('debería rechazar NHC con formato inválido')
```

**Done:**
- La entidad `Patient` no importa nada fuera de `src/domain/`
- Todos los tests del dominio pasan en < 50ms
- `DuplicatePatientError` incluye la lista de candidatos en su payload

---

### WU-02-04 — Application: comandos CreatePatient y UpdatePatient

**Construye:**
- `CreatePatientCommand` + `CreatePatientHandler`
  - Lógica de generación de NHC secuencial (BR-PAT-001)
  - Detección de duplicados por `lastName + birthDate` (BR-PAT-002)
  - Flag `confirmDuplicate` para sobrepasar la detección
- `UpdatePatientHandler`
- `SoftDeletePatientHandler` — con verificación de cirugías SCHEDULED (BR-PAT-005)
- `InMemoryPatientRepository`
- Tests unitarios exhaustivos

**Test TDD de inicio — empieza por el más crítico:**
```typescript
// create-patient.handler.spec.ts
it('debería generar NHC secuencial si no se proporciona uno externo')
it('debería generar NHC correlativo cuando ya existen pacientes en la org')
it('debería lanzar DuplicatePatientError si coinciden apellido + fechaNacimiento')
it('debería crear el paciente si confirmDuplicate es true aunque haya duplicados')
it('no debería crear el paciente si confirmDuplicate es false y hay duplicados')
// soft-delete-patient.handler.spec.ts
it('debería lanzar error si el paciente tiene cirugías SCHEDULED')
it('debería aplicar softDelete si no hay cirugías SCHEDULED')
```

**Done:**
- Cobertura de handlers ≥ 90%
- `InMemoryPatientRepository` implementa exactamente la misma interfaz que `PrismaPatientRepository` — un test que pasa con uno debe pasar con el otro

---

### WU-02-05 — Application: queries GetPatient, ListPatients, SearchPatients

**Construye:**
- `GetPatientQuery` + `GetPatientHandler` — con lógica de omisión de datos de contacto para VIEWER (BR-RBAC-002)
- `ListPatientsQuery` + `ListPatientsHandler` — con paginación y ordenación
- `SearchPatientsQuery` + `SearchPatientsHandler` — búsqueda sobre `lastName`, `firstName`, `nhc`, `idDocument`

**Test TDD de inicio:**
```typescript
// get-patient.handler.spec.ts
it('debería omitir teléfono, email, dirección y documento para rol VIEWER')
it('debería incluir teléfono, email, dirección y documento para rol PHYSICIAN')
it('debería incluir la lista de alergias activas en la respuesta')
// list-patients.handler.spec.ts
it('debería devolver solo los pacientes de la organización del solicitante')
it('debería paginar correctamente con page y pageSize')
```

**Done:**
- Un VIEWER que llama a `GetPatientHandler` nunca recibe datos de contacto — verificado en test
- La paginación funciona correctamente incluyendo `totalPages` en el meta

---

### WU-02-06 — Infraestructura: PrismaPatientRepository

**Construye:**
- `apps/api/src/infrastructure/database/repositories/prisma-patient.repository.ts`
- Implementa `IPatientRepository` completamente
- Tests de integración contra la DB de test

**Test TDD de inicio:**
```typescript
// prisma-patient.repository.integration.spec.ts
it('findById con organizationId incorrecto debería devolver null — tenant isolation')
it('findAll no debería devolver pacientes con deletedAt — soft delete')
it('findDuplicates debería encontrar pacientes con mismo apellido y fecha de nacimiento')
it('getNextNhcSequence debería devolver el siguiente número secuencial para la organización')
```

**Done:**
- Los tests de integración pasan contra la DB de test
- Ningún método del repositorio acepta `organizationId` como parámetro opcional — siempre es requerido
- Los tests del tenant isolation de `06-testing-strategy.md` sección 9 pasan para el módulo de pacientes

**⚠ Aprende antes:** Prisma no tiene un mecanismo de secuencia nativo como `SERIAL` de PostgreSQL para campos custom. La generación del NHC secuencial requiere una query con `SELECT MAX(nhc)` dentro de una transacción para evitar condiciones de carrera. Si hay concurrencia alta (no en el MVP, pero hazlo bien desde ya): usa `SELECT ... FOR UPDATE` o una tabla de secuencias separada.

---

### WU-02-07 — API: PatientsController + AllergyController

**Construye:**
- `apps/api/src/api/patients/patients.controller.ts` — todos los endpoints de `05-api-spec.md` sección 9
- `apps/api/src/api/patients/allergies.controller.ts`
- `apps/api/src/api/patients/patients.module.ts`
- Tests de integración del controller

**Test TDD de inicio:**
```typescript
// patients.controller.integration.spec.ts
it('POST /patients debería devolver 409 con candidatos si hay duplicados')
it('POST /patients con X-Confirm-Duplicate debería crear a pesar de duplicados')
it('GET /patients/:id para VIEWER no debe incluir datos de contacto')
it('GET /patients debe devolver solo pacientes de la organización del JWT')
it('DELETE /patients/:id con cirugías SCHEDULED debe devolver 409')
it('POST /patients sin JWT debe devolver 401')
it('POST /patients con rol VIEWER debe devolver 403')
```

**Done:**
- Todos los endpoints de la sección 9 del `05-api-spec.md` responden según especificación
- Los tests de seguridad pasan para este módulo
- Postman/Insomnia o equivalente verificado manualmente con un token real

---

### WU-02-08 — Frontend: lista de pacientes, ficha y formulario de alta

**Construye:**
- `apps/web/app/(dashboard)/patients/page.tsx` — lista paginada con `PatientSearchBar`
- `apps/web/app/(dashboard)/patients/new/page.tsx` — formulario de alta con React Hook Form + Zod
- `apps/web/app/(dashboard)/patients/[id]/page.tsx` — ficha con `PatientHeader` y tabs vacíos
- `apps/web/components/clinical/PatientCard/`
- `apps/web/components/clinical/PatientHeader/`
- `apps/web/components/clinical/ClinicalBanner/` — alerta de alergia (BR-PAT-006)
- Modal de confirmación de duplicados

**Done:**
- El flujo E2E de `06-testing-strategy.md` sección 7 (`patient-creation.e2e.ts`) pasa
- El banner de alergia ANAPHYLAXIS aparece y no tiene botón de cierre
- La búsqueda de pacientes funciona con debounce de 200ms
- El formulario valida con el mismo schema Zod que el backend (`@medicore/contracts`)

---

## Fase 3 — Módulo Consultas

**Objetivo:** el médico puede registrar consultas completas con exploración física (formulario dinámico), diagnósticos CIE-10/SNOMED y plan.

---

### WU-03-01 — Package `@medicore/clinical-codes`: catálogo CIE-10 ORL

**Construye:**
- `packages/clinical-codes/src/cie10/orl-chapters.ts` — capítulos H60-H95, J00-J06, J30-J39, C00-C32 (ver `02-data-schema.md` sección 6)
- `packages/clinical-codes/src/search.ts` — búsqueda full-text client-side con índice preconstruido
- Tests: verificar que los códigos más frecuentes en ORL están presentes

**Done:**
- La búsqueda de "rinitis" devuelve J30.x en < 10ms
- El bundle size del catálogo cargado en cliente es < 200KB gzipped

---

### WU-03-02 — Contracts + Dominio: Consultation

**Construye:**
- `packages/contracts/src/consultation.schema.ts` con validaciones de BR-CON-006 y BR-CON-007
- `apps/api/src/domain/consultation/consultation.entity.ts`
- `apps/api/src/domain/consultation/consultation.repository.interface.ts`
- `apps/api/src/domain/consultation/errors/`

**Test TDD de inicio:**
```typescript
// consultation.schema.contract.spec.ts
it('debería rechazar más de un diagnóstico primary')
it('debería rechazar más de 10 códigos diagnósticos en total')
it('debería requerir al menos un primary si hay códigos secundarios')
// consultation.entity.spec.ts
it('debería rechazar fecha más de 24h en el futuro — BR-CON-002')
```

**Done:**
- Schema Zod rechaza todas las combinaciones inválidas de `diagnosisCodes`
- Cobertura de contratos al 100%

---

### WU-03-03 — Motor de formularios dinámicos

**Construye:**
- `packages/contracts/src/form-schema.ts` — `FormFieldSchema`, `FormTemplateSchema` (ver `04-design-spec.md` sección 7)
- `apps/web/components/clinical/DynamicForm/` — el motor de renderizado de formularios
- La plantilla ORL inicial como JSON en `Organization.settings` (se aplica al seed)

**Test TDD de inicio:**
```typescript
// DynamicForm.spec.tsx
it('debería renderizar un campo de tipo select con sus opciones')
it('debería renderizar una sección colapsable')
it('debería emitir los valores del formulario en el formato JSONB esperado')
it('debería rechazar un FormTemplate con campos sin id único')
```

**Done:**
- El formulario de exploración ORL renderiza desde el JSON de plantilla — sin campos hardcodeados
- Añadir un nuevo campo al JSON de plantilla se refleja en el formulario sin tocar código React

**⚠ Aprende antes:** Este es el componente técnicamente más arriesgado del frontend. React Hook Form con campos dinámicos requiere `useFieldArray` y gestión de nombres de campo basados en el ID del template. Experimenta primero con un prototipo pequeño antes de integrarlo con el formulario de consulta completo.

---

### WU-03-04 — Application + Infraestructura + API: Consultations

Sigue el mismo patrón de las WUs de Pacientes (Commands → Queries → Repositorio → Controller).

**Casos de uso a implementar:**
- `CreateConsultationHandler` — incluye lógica de `generateReport: true` que encola el job
- `UpdateConsultationHandler` — con audit log de cambios (BR-CON-004)
- `GetConsultationHandler`
- `ListConsultationsHandler`
- `PrismaConsultationRepository`
- `ConsultationsController`

**Tests críticos a escribir primero:**
```typescript
it('debería encolar job generate-report si generateReport es true')
it('debería registrar en audit log los campos modificados en un UPDATE')
it('debería advertir pero no bloquear si es la segunda consulta FIRST_VISIT — BR-CON-003')
```

**Done:**
- El flujo E2E de `06-testing-strategy.md` (`consultation-creation.e2e.ts`) pasa
- La timeline del paciente muestra las consultas ordenadas cronológicamente

---

### WU-03-05 — Frontend: formulario de consulta y timeline

**Construye:**
- `apps/web/app/(dashboard)/patients/[id]/consultations/new/page.tsx`
- `apps/web/components/clinical/ConsultationForm/` — integra `DynamicForm` para exploración física
- `apps/web/components/clinical/DiagnosisCodePicker/` — buscador CIE-10/SNOMED
- `apps/web/components/clinical/ClinicalTimeline/`

**Done:**
- El médico puede crear una consulta completa con diagnósticos CIE-10 en < 3 minutos
- La timeline muestra todos los eventos clínicos del paciente
- El `DiagnosisCodePicker` busca en < 100ms sin llamada al servidor

---

## Fase 4 — Módulo Cirugías

Mismo patrón que Consultas. Los puntos que difieren:

**WU-04-01:** Schema Prisma modelo `Surgery` + migración
**WU-04-02:** Contracts con validaciones de estado (BR-SUR-003) y ASA obligatorio en COMPLETED (BR-SUR-002)
**WU-04-03:** Dominio con la máquina de estados de cirugía — la tabla `ALLOWED_TRANSITIONS` vive en la entidad
**WU-04-04:** Casos de uso — `ScheduleSurgeryHandler`, `CompleteSurgeryHandler`, `ChangeSurgeryStatusHandler`
**WU-04-05:** Infraestructura + API
**WU-04-06:** Frontend — timeline quirúrgico, checklist preoperatorio, formulario de técnica (dinámico)

**Tests críticos a escribir primero:**
```typescript
it('debería rechazar la transición COMPLETED → CANCELLED — BR-SUR-003')
it('debería requerir ASA para marcar como COMPLETED — BR-SUR-002')
it('debería requerir editReason para modificar una cirugía COMPLETED — BR-SUR-005')
it('debería verificar consentimiento quirúrgico y advertir si falta — BR-SUR-001')
```

---

## Fase 5 — Módulo Imágenes Diagnósticas

**WU-05-01:** Schema Prisma `ImagingStudy` + configuración Cloudflare R2 (credenciales en env, cliente R2 en `infrastructure/storage/`)
**WU-05-02:** Contracts con validaciones de tipo MIME y tamaño (BR-IMG-001, BR-IMG-002)
**WU-05-03:** `R2StorageService` — upload, getPresignedUrl, delete (con tests usando mock de R2)
**WU-05-04:** Casos de uso y controller de imágenes
**WU-05-05:** Frontend — uploader de archivos con progress, visor Cornerstone.js para DICOM, modo oscuro del visor (ver `04-design-spec.md` sección 10)

**Tests críticos:**
```typescript
it('getPresignedUrl debería generar URL con TTL de 15 minutos — BR-IMG-004')
it('debería rechazar archivos con tipo MIME no permitido — BR-IMG-001')
it('el soft delete no debería borrar el archivo en R2 inmediatamente — BR-IMG-005')
```

**⚠ Aprende antes:** Cornerstone.js tiene su propio sistema de carga de imágenes (`imageLoader`). La integración con React requiere un `useEffect` cuidadoso para inicializar y destruir el visor. Busca ejemplos de `cornerstone-react` o `@cornerstonejs/react` antes de empezar.

---

## Fase 6 — Medicación y Escalas Clínicas

### Medicación

**WU-06-01:** Schema + Contracts + Dominio con lógica de alertas de alergia (BR-MED-001)
**WU-06-02:** `CreatePrescriptionHandler` — el más crítico: lógica de bloqueo/advertencia por alergia, override con audit log
**WU-06-03:** `DiscontinueMedicationHandler` — con `discontinuationReason` obligatorio (BR-MED-003)
**WU-06-04:** Infraestructura + API + Frontend

**Tests críticos — estos son los más importantes del módulo:**
```typescript
it('debería bloquear prescripción con alergia ANAPHYLAXIS activa — BR-MED-001')
it('debería permitir override con X-Override-Critical-Allergy y registrar en audit log')
it('debería advertir pero no bloquear con alergia MODERATE')
it('no debería alertar si la alergia está INACTIVE')
it('debería rechazar discontinuación sin motivo — BR-MED-003')
```

### Escalas Clínicas

**WU-06-05:** Schema + Contracts con `FormFieldSchema` reutilizado del motor de formularios
**WU-06-06:** `CreateClinicalScaleHandler` — con cálculo de total en servidor para escalas predefinidas (BR-SCA-002)
**WU-06-07:** Infraestructura + API + Frontend — `ScoreEvolutionChart` con Recharts

---

## Fase 7 — Informes Clínicos con IA

Esta es la fase más compleja técnicamente. No la empieces hasta que las fases 3-6 estén completas — el valor del informe depende de la riqueza del contexto clínico.

**WU-07-01:** `AnthropicService` en infraestructura — cliente de la API con manejo de errores, timeout de 60s y retry (ver `08-ai-clinical-spec.md` para los prompts)

**WU-07-02:** BullMQ setup — `generate-report` job, `generate-report-pdf` job, worker con concurrencia limitada

**WU-07-03:** Dominio `Report` — la máquina de estados `DRAFT → REVIEWED → SIGNED` vive en la entidad, con `ReportImmutableError` para intentos de modificar un `SIGNED`

**WU-07-04:** `GenerateReportHandler` — construye el contexto del prompt a partir del `sourceId`, encola el job, crea el `Report` en DRAFT

**WU-07-05:** `SignReportHandler` — valida que el informe está en REVIEWED, aplica firma, encola generación de PDF

**WU-07-06:** `ReactPDFService` — genera el PDF del informe con el layout de `04-design-spec.md`, lo sube a R2

**WU-07-07:** Controller + Frontend — editor de informe con vista previa PDF en tiempo real, flujo de firma con modal de disclaimer (BR-REP-005)

**Tests críticos:**
```typescript
it('no debería permitir firmar un informe en DRAFT — solo REVIEWED')
it('no debería permitir modificar un informe SIGNED — BR-REP-004')
it('debería almacenar el hash del prompt IA — BR-REP-007')
it('debería crear el informe con content vacío si el job de IA falla — BR-REP-008')
it('debería rechazar generación si se supera el límite del plan — BR-REP-009')
// E2E
it('debería completar el flujo completo: generar → revisar → firmar → descargar PDF')
```

**⚠ Aprende antes:** BullMQ requiere Redis. En tests de integración, usa el mock de `06-testing-strategy.md` sección 11 — no levantes Redis real en CI para tests unitarios. Para los tests del job worker, úsalos en la suite de integración con un Redis de test en Docker.

---

## Fase 8 — Analytics

**WU-08-01:** Queries de analytics en `PrismaAnalyticsRepository` — las queries con GIN index sobre `diagnosisCodes` JSONB son las más complejas; vérificalas con `EXPLAIN ANALYZE` en la DB de dev

**WU-08-02:** Casos de uso: `GetOverviewQuery`, `GetDiagnosisDistributionQuery`, `GetScaleEvolutionQuery`

**WU-08-03:** API — endpoints de `05-api-spec.md` sección 16 con caché Redis (TTL 5 minutos para dashboards)

**WU-08-04:** Frontend — dashboard con Recharts: distribución de diagnósticos, evolución de escalas, KPIs. Referencia: wireframe F03 de `04-design-spec.md`

**Tests críticos:**
```typescript
it('debería incluir advertencia de muestra insuficiente si N < 20 — BR-ANA-003')
it('la exportación de analytics debe anonimizar patientId — BR-ANA-002')
it('las visualizaciones no deben exponer datos identificativos individuales — BR-ANA-001')
```

---

## Fase 9 — Exportación y RGPD

**WU-09-01:** `ExportPatientHandler` — genera el JSON FHIR-compatible completo del paciente

**WU-09-02:** `ExportPatientPDFJob` — worker BullMQ que genera el PDF de historia clínica completa

**WU-09-03:** `AnonymizePatientHandler` — implementa la anonimización irreversible de `07-security-compliance.md` sección 3

**WU-09-04:** Frontend — botón de exportación en la ficha del paciente, descarga del PDF/JSON, flujo de anonimización con confirmación

**Tests críticos:**
```typescript
it('la exportación debe registrarse en el audit log — BR-EXP-001')
it('la exportación no debe incluir registros con deletedAt — BR-EXP-004')
it('la anonimización debe ser irreversible — no debe haber forma de recuperar el nombre')
it('el JSON exportado debe tener estructura compatible con FHIR R4')
```

---

## Fase 10 — Deploy MVP

**WU-10-01 — Configurar Neon producción:**
- Crear proyecto Neon en región Frankfurt
- Crear branches: `main` (producción), `staging`, `dev`
- Aplicar migraciones en producción: `pnpm prisma migrate deploy`
- Verificar backups PITR activos

**WU-10-02 — Configurar Railway producción:**
- Proyecto Railway con servicio para `apps/api`
- Variables de entorno de producción (nunca en Git)
- Health check en `/v1/health`
- Deploy desde rama `main`

**WU-10-03 — Configurar Vercel producción:**
- Proyecto Vercel para `apps/web`
- Variables de entorno: `NEXTAUTH_URL`, credenciales OAuth de producción
- Deploy desde rama `main`

**WU-10-04 — Configurar Cloudflare R2 producción:**
- Bucket con configuración de región EU
- Bucket secundario para backups (replicación)
- Credenciales de acceso separadas para producción

**WU-10-05 — Verificar checklist de seguridad:**
- Ejecutar el checklist completo de `07-security-compliance.md` sección 11
- Verificar que los headers de seguridad son correctos con [https://securityheaders.com](https://securityheaders.com)
- Verificar TLS con [https://ssllabs.com](https://ssllabs.com)

**WU-10-06 — Tests de humo post-deploy:**
```
☐ Login OAuth funciona en producción
☐ Crear paciente → consulta → informe → firma → descarga PDF
☐ Subir imagen DICOM y visualizarla
☐ El audit log registra todas las acciones
☐ Un usuario de otra org no puede ver pacientes de la primera
☐ Rate limiting activo (verificar headers X-RateLimit-*)
```

**Done:**
- Primer usuario real crea su organización y registra su primer paciente
- Sentry recibe eventos de producción
- El pipeline CI/CD despliega automáticamente desde `main`

---

## Referencia rápida: orden de implementación de cualquier módulo nuevo

Cuando en el futuro añadas un módulo nuevo (nueva especialidad, nuevo tipo de formulario, etc.), el orden es siempre:

```
1. Actualizar el documento de especificación correspondiente
2. Migración Prisma (si hay nuevo modelo)
3. Schema Zod en @medicore/contracts + tests de contrato
4. Entidad de dominio + tests unitarios
5. InMemoryRepository (para tests de use cases)
6. Use cases (Commands + Queries) + tests unitarios
7. PrismaRepository + tests de integración
8. Controller NestJS + tests de integración
9. Tests de seguridad (tenant isolation para el nuevo modelo)
10. Componentes frontend + tests de componente
11. Tests E2E del flujo completo
```

Este orden no es negociable. Saltarse pasos produce deuda técnica que cuesta más de deshacer que de hacer bien desde el principio.

---

## Señales de que algo va mal

Si te encuentras en alguna de estas situaciones, para y corrige antes de continuar:

```
Situación                                        Qué revisar
──────────────────────────────────────────────────────────────────────────────────
Un use case importa PrismaService directamente   El dominio está acoplado a infra
Un test de dominio necesita la DB para pasar     El diseño de la entidad está mal
Un controller tiene lógica de negocio            Esa lógica pertenece al use case
Un schema Zod está duplicado en front y back     Debe estar en @medicore/contracts
Un test tarda más de 200ms                       Probablemente hace una llamada real
Un PR tiene más de 400 líneas                    Dividir en dos PRs más pequeños
Cobertura baja de un módulo clínico              No continuar hasta resolver
```

---