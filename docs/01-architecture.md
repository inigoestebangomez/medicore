# 01-architecture.md
## MediCore — Arquitectura del Sistema

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06

---

## Índice

1. [Visión Arquitectónica](#1-visión-arquitectónica)
2. [Diagrama C4 — Niveles 1, 2 y 3](#2-diagrama-c4)
3. [Decisiones de Arquitectura (ADR)](#3-decisiones-de-arquitectura-adr)
4. [Patrones y Principios](#4-patrones-y-principios)
5. [Estructura del Monorepo](#5-estructura-del-monorepo)
6. [Módulos del Dominio Clínico](#6-módulos-del-dominio-clínico)
7. [Flujo de una Petición](#7-flujo-de-una-petición)
8. [Infraestructura y Entornos](#8-infraestructura-y-entornos)
9. [Seguridad en Capas](#9-seguridad-en-capas)
10. [Estrategia Multi-tenant](#10-estrategia-multi-tenant)
11. [Decisiones Diferidas (Roadmap)](#11-decisiones-diferidas-roadmap)

---

## 1. Visión Arquitectónica

MediCore es una aplicación web **SaaS multi-tenant latente** orientada al médico especialista. La arquitectura prioriza:

- **Velocidad de desarrollo en el MVP** sin comprometer la estructura a largo plazo
- **Aislamiento de datos por organización** (workspace) desde el día uno, satisfaciendo RGPD sin re-arquitectura posterior
- **Coste operacional cero en MVP** con posibilidad de migración gradual a infraestructura propia
- **Testabilidad intrínseca** en cada capa — la arquitectura debe facilitar TDD, no dificultarlo
- **Dominio clínico en el centro** — la lógica de negocio no depende de frameworks ni de infraestructura

---

## 2. Diagrama C4

### Nivel 1 — Contexto del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        MediCore System                         │
│                                                                 │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │   Médico esp.│────▶│           MediCore Web App          │  │
│  │  (usuario    │     │    (Next.js + NestJS API)            │  │
│  │   primario)  │◀────│                                      │  │
│  └──────────────┘     └──────────┬───────────────────────────┘  │
│                                  │                               │
│  ┌──────────────┐                │ Datos clínicos               │
│  │   Admin de   │────────────────┘                              │
│  │  workspace   │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
         │                        │                    │
         ▼                        ▼                    ▼
┌─────────────────┐  ┌────────────────────┐  ┌─────────────────┐
│   OAuth Provider│  │  Anthropic Claude  │  │  Cloudflare R2  │
│ (Google / MS)   │  │  API (informes IA) │  │  (imágenes,     │
│                 │  │                    │  │   documentos)   │
└─────────────────┘  └────────────────────┘  └─────────────────┘
```

---

### Nivel 2 — Contenedores

```
┌───────────────────────────────────────────────────────────────────────┐
│                          MediCore System                             │
│                                                                       │
│  ┌─────────────────────────────────┐                                  │
│  │        Next.js Frontend         │  Vercel Edge Network             │
│  │                                 │                                  │
│  │  · App Router (React 18)        │                                  │
│  │  · shadcn/ui + Tailwind         │                                  │
│  │  · TanStack Query               │                                  │
│  │  · Zustand (estado global)      │                                  │
│  │  · Auth.js v5 (sesión)          │                                  │
│  │  · Cornerstone.js (DICOM)       │                                  │
│  └────────────┬────────────────────┘                                  │
│               │ HTTPS / REST + JSON                                   │
│               │ (Zod schemas compartidos)                             │
│  ┌────────────▼────────────────────┐                                  │
│  │        NestJS API               │  Railway                         │
│  │                                 │                                  │
│  │  · Módulos de dominio clínico   │                                  │
│  │  · Guards de autenticación      │                                  │
│  │  · Guards de autorización RBAC  │                                  │
│  │  · Interceptores (audit log)    │                                  │
│  │  · Pipes de validación Zod      │                                  │
│  │  · BullMQ workers               │                                  │
│  └────┬──────────┬─────────────────┘                                  │
│       │          │                                                    │
│  ┌────▼───┐  ┌───▼────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │Postgres│  │   Redis    │  │Cloudflare R2 │  │ Anthropic API    │  │
│  │(Neon)  │  │ (Upstash)  │  │  (storage)   │  │ (Claude Sonnet)  │  │
│  │        │  │            │  │              │  │                  │  │
│  │· Datos │  │· Caché     │  │· Imágenes    │  │· Generación de   │  │
│  │  clín. │  │· Sesiones  │  │· PDFs        │  │  informes        │  │
│  │· Audit │  │· Job queue │  │· DICOM files │  │· Codif. CIE-10   │  │
│  └────────┘  └────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

### Nivel 3 — Componentes (NestJS API)

```
┌──────────────────────────────────────────────────────────────────┐
│                         NestJS API                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    API Layer                             │    │
│  │  Controllers · Guards (Auth/RBAC) · Interceptors · Pipes │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐    │
│  │                  Application Layer                       │    │
│  │         Use Cases / Commands / Queries (CQRS lite)       │    │
│  │                                                          │    │
│  │  PatientUseCases  │  ConsultationUseCases  │  SurgeryUseCases │
│  │  ReportUseCases   │  AnalyticsUseCases     │  AuthUseCases    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐    │
│  │                   Domain Layer                           │    │
│  │     Entities · Value Objects · Domain Services           │    │
│  │     Domain Events · Repository Interfaces                │    │
│  │                                                          │    │
│  │  Patient  │  Consultation  │  Surgery  │  Medication     │    │
│  │  Report   │  Organization  │  User     │  DiagnosisCode  │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐    │
│  │               Infrastructure Layer                       │    │
│  │   Prisma Repositories · External Services · BullMQ       │    │
│  │                                                          │    │
│  │  PrismaPatientRepo  │  AnthropicService  │  R2StorageService │
│  │  PrismaAuditRepo    │  RedisCache        │  PDFService       │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Decisiones de Arquitectura (ADR)

Cada ADR documenta una decisión relevante con su contexto, alternativas consideradas y consecuencias. Son inmutables — si una decisión cambia, se crea un nuevo ADR que supersede al anterior.

---

### ADR-001: NestJS como framework backend

**Estado:** Aceptado

**Contexto:** El dominio clínico de MediCore tiene alta complejidad de reglas de negocio (permisos por rol, validaciones clínicas, flujos quirúrgicos, codificación CIE-10/SNOMED). Se necesita una estructura que escale con el equipo y con la complejidad sin acumular deuda técnica.

**Decisión:** Usar NestJS con TypeScript en el backend.

**Alternativas consideradas:**
- Fastify + estructura propia: más velocidad inicial, menos estructura garantizada
- Express: demasiado permisivo para un dominio complejo
- Hono: excelente rendimiento, pero ecosistema más joven y menos tooling para DI y testing

**Consecuencias:**
- (+) Arquitectura modular forzada por el framework
- (+) Inyección de dependencias nativa — facilita enormemente el testing (mocks)
- (+) Decoradores para guards, interceptores y pipes reducen boilerplate de seguridad
- (+) Módulo de testing propio de NestJS es el mejor del ecosistema Node.js
- (-) ~1 semana adicional de setup inicial vs Fastify
- (-) Requiere TypeScript en el backend (asumido en la decisión de stack)

---

### ADR-002: Clean Architecture con CQRS ligero

**Estado:** Aceptado

**Contexto:** La lógica de negocio clínica no debe acoplarse a Prisma, a NestJS, ni a ningún servicio externo. Esto es especialmente importante para el TDD (los use cases deben ser testeables sin base de datos) y para la longevidad del código.

**Decisión:** Implementar Clean Architecture en 4 capas (Domain → Application → Infrastructure → API) con CQRS simplificado en la capa de aplicación (Commands para escritura, Queries para lectura), sin event bus complejo en el MVP.

**Alternativas consideradas:**
- Arquitectura en capas tradicional (MVC): más simple, pero mezcla responsabilidades
- CQRS + Event Sourcing completo: excesivo para el MVP, añade complejidad operacional sin beneficio claro aún
- Arquitectura hexagonal pura: equivalente en concepto, terminología diferente

**Consecuencias:**
- (+) Use cases son clases JavaScript puras — testeables con Jest sin ningún mock de framework
- (+) Cambiar Prisma por otro ORM no afecta al dominio ni a la aplicación
- (+) Cambiar NestJS tampoco afecta al dominio
- (-) Más archivos por feature (Command/Query + Handler + Repository Interface + Entity)
- (-) Curva de aprendizaje para desarrolladores acostumbrados a MVC

---

### ADR-003: Multi-tenant latente con discriminador `organizationId`

**Estado:** Aceptado

**Contexto:** El MVP necesita soportar un único workspace pero la arquitectura debe permitir multi-tenancy sin re-escritura. El sistema debe servir tanto a clínicas con varios médicos como a médicos liberales autónomos.

**Decisión:** Todas las entidades de dominio clínico incluyen `organizationId` desde el día 1. En el MVP solo existe una organización por despliegue. El middleware de autorización filtra TODAS las queries por `organizationId` del usuario autenticado.

**Alternativas consideradas:**
- Schema separado por tenant (schema-per-tenant): mejor aislamiento, mucho más complejo de operar
- Base de datos separada por tenant: máximo aislamiento, inviable en MVP de coste 0
- Sin multi-tenancy (añadir después): genera deuda técnica de migración costosa

**Consecuencias:**
- (+) Zero re-arquitectura cuando se añadan nuevos tenants
- (+) Cumplimiento RGPD de aislamiento de datos desde el inicio
- (+) Un médico puede pertenecer a varias organizaciones (liberal + hospital)
- (-) Todas las queries deben incluir el filtro `organizationId` — riesgo de fuga de datos si se omite
- (→) Mitigación: middleware de NestJS que inyecta automáticamente el filtro en TODOS los repositorios

---

### ADR-004: Vercel + Railway + Neon para el MVP

**Estado:** Aceptado

**Contexto:** Coste operacional 0€ en MVP. La solución debe ser mantenible sin DevOps dedicado, con capacidad de migración cuando crezca.

**Decisión:**
- Frontend: Vercel (gratis, SSR nativo para Next.js)
- Backend API: Railway (free tier, $5/mes de créditos)
- Base de datos: Neon.tech (PostgreSQL serverless, Frankfurt, gratis hasta 0.5GB)
- Storage: Cloudflare R2 (10GB gratis)
- Cache/Queue: Upstash Redis (gratis hasta 10k req/día)

**Plan de migración cuando escale:**
- Fase 1 (primeros usuarios): mantener stack actual, solo escalar Neon y Railway
- Fase 2 (>100 organizaciones): migrar DB a Hetzner VPS con PostgreSQL gestionado
- Fase 3 (>1000 organizaciones): Kubernetes en Hetzner o equivalente europeo

**Consecuencias:**
- (+) 0€ hasta tener usuarios reales
- (+) Todo en Europa (Neon Frankfurt, Cloudflare EU) — RGPD compliant desde el inicio
- (-) Railway puede tener cold starts en el free tier
- (-) Límite de 0.5GB en Neon requiere monitorizar crecimiento de imágenes (van a R2, no a DB)

---

### ADR-005: Auth.js v5 con OAuth 2.0

**Estado:** Aceptado

**Contexto:** Los datos son altamente sensibles (categoría especial de datos sanitarios según RGPD Art. 9). La autenticación debe ser robusta, delegar la gestión de credenciales a proveedores confiables, y soportar MFA.

**Decisión:** Auth.js v5 (NextAuth) con proveedores OAuth 2.0 (Google Workspace, Microsoft Entra ID). El token de sesión se almacena en una cookie HttpOnly firmada. El backend valida el JWT en cada petición.

**Alternativas consideradas:**
- Clerk: excelente DX, pero SaaS externo con datos de identidad fuera de nuestro control
- Supabase Auth: buena opción, pero introduce acoplamiento a Supabase
- Auth0: costoso a escala, y los datos de identidad salen de la UE

**Consecuencias:**
- (+) Las credenciales nunca pasan por nuestro sistema
- (+) MFA delegado al proveedor OAuth (Google/Microsoft ya lo gestionan)
- (+) Open source — sin lock-in ni coste
- (-) Configuración más manual que Clerk o Supabase Auth
- (-) Requires gestionar el flujo de refresh tokens manualmente

---

### ADR-006: Zod como única fuente de verdad para contratos API

**Estado:** Aceptado

**Contexto:** Frontend y backend necesitan compartir validaciones y tipos sin duplicar lógica. En un dominio clínico, una discrepancia entre la validación del cliente y el servidor puede tener consecuencias en la integridad de los datos.

**Decisión:** Los schemas Zod viven en el paquete `@MediCore/contracts` del monorepo. El frontend los usa para validar formularios (React Hook Form + Zod). El backend los usa como pipes de validación de NestJS. Los tipos TypeScript se infieren de los schemas (`z.infer<typeof PatientSchema>`).

**Consecuencias:**
- (+) Una sola definición de la forma de los datos para cliente y servidor
- (+) Los tests de contrato son triviales — mismo schema en ambos lados
- (+) Errores de validación consistentes en cliente y servidor
- (-) Requiere que el paquete `contracts` sea el primero en compilarse en CI

---

## 4. Patrones y Principios

### 4.1 Clean Architecture — Regla de dependencia

Las dependencias apuntan SIEMPRE hacia el interior. El dominio no conoce nada externo.

```
[Infraestructura] → [Aplicación] → [Dominio]
[API/Controllers] → [Aplicación] → [Dominio]

Nunca:
[Dominio] → [Prisma]        ✗
[Dominio] → [NestJS]        ✗
[Aplicación] → [Fastify]    ✗
```

### 4.2 Repository Pattern

Cada entidad de dominio tiene una interfaz de repositorio en la capa de dominio y una implementación Prisma en la capa de infraestructura. Los tests de use cases usan implementaciones en memoria (InMemoryPatientRepository).

```typescript
// Domain layer — solo interfaz, sin Prisma
interface IPatientRepository {
  findById(id: string, organizationId: string): Promise<Patient | null>
  save(patient: Patient): Promise<void>
  delete(id: string, organizationId: string): Promise<void>
}

// Infrastructure layer — implementación Prisma
class PrismaPatientRepository implements IPatientRepository {
  // ...
}

// Test — implementación en memoria, sin DB
class InMemoryPatientRepository implements IPatientRepository {
  private patients: Map<string, Patient> = new Map()
  // ...
}
```

### 4.3 CQRS Ligero

Sin event bus complejo. Commands para operaciones de escritura con efectos secundarios. Queries para lecturas optimizadas (pueden ir directamente a Prisma sin pasar por entidades de dominio).

```
Commands (escritura):              Queries (lectura):
CreatePatientCommand               GetPatientQuery
UpdateConsultationCommand          ListPatientsQuery
ScheduleSurgeryCommand             GetAnalyticsDashboardQuery
GenerateClinicalReportCommand      SearchByDiagnosisCodeQuery
```

### 4.4 Tenant Middleware

Un interceptor de NestJS extrae el `organizationId` del JWT y lo inyecta en el contexto de la petición. Los repositorios reciben siempre el `organizationId` — nunca está hardcodeado ni es opcional.

### 4.5 Audit Log

Un interceptor global registra automáticamente en la tabla `audit_logs` cada operación de escritura (CREATE, UPDATE, DELETE) sobre datos clínicos. Incluye: usuario, organización, entidad afectada, timestamp, IP, cambios. Requerimiento RGPD y ENS.

---

## 5. Estructura del Monorepo

Se usa **pnpm workspaces** por su eficiencia con node_modules y su soporte nativo de workspaces. Turborepo para la gestión de pipelines de build y test.

```
MediCore/
│
├── apps/
│   ├── web/                          # Next.js 14 — Frontend
│   │   ├── app/                      # App Router
│   │   │   ├── (auth)/               # Rutas de autenticación
│   │   │   │   ├── login/
│   │   │   │   └── callback/
│   │   │   ├── (dashboard)/          # Rutas protegidas
│   │   │   │   ├── patients/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── consultations/
│   │   │   │   │   │   ├── surgery/
│   │   │   │   │   │   ├── imaging/
│   │   │   │   │   │   ├── medication/
│   │   │   │   │   │   └── reports/
│   │   │   │   │   └── new/
│   │   │   │   ├── analytics/
│   │   │   │   └── settings/
│   │   │   └── api/                  # API routes Next.js (solo auth)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui base components
│   │   │   ├── clinical/             # Componentes dominio clínico
│   │   │   │   ├── PatientCard/
│   │   │   │   ├── ConsultationForm/
│   │   │   │   ├── SurgeryTimeline/
│   │   │   │   ├── DicomViewer/
│   │   │   │   └── ClinicalReport/
│   │   │   └── layout/
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Cliente HTTP tipado (usa schemas Zod)
│   │   │   ├── auth.ts               # Config Auth.js
│   │   │   └── query-client.ts       # TanStack Query config
│   │   └── __tests__/
│   │
│   └── api/                          # NestJS — Backend
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   │
│       │   ├── domain/               # Capa de dominio — CERO dependencias externas
│       │   │   ├── patient/
│       │   │   │   ├── patient.entity.ts
│       │   │   │   ├── patient.repository.interface.ts
│       │   │   │   └── value-objects/
│       │   │   │       ├── patient-id.vo.ts
│       │   │   │       └── medical-history-number.vo.ts
│       │   │   ├── consultation/
│       │   │   ├── surgery/
│       │   │   ├── medication/
│       │   │   ├── report/
│       │   │   ├── organization/
│       │   │   └── shared/
│       │   │       ├── aggregate-root.ts
│       │   │       └── domain-event.ts
│       │   │
│       │   ├── application/          # Casos de uso — depende solo del dominio
│       │   │   ├── patient/
│       │   │   │   ├── commands/
│       │   │   │   │   ├── create-patient.command.ts
│       │   │   │   │   ├── create-patient.handler.ts
│       │   │   │   │   └── create-patient.handler.spec.ts
│       │   │   │   └── queries/
│       │   │   │       ├── get-patient.query.ts
│       │   │   │       └── get-patient.handler.ts
│       │   │   ├── consultation/
│       │   │   ├── surgery/
│       │   │   ├── report/
│       │   │   └── analytics/
│       │   │
│       │   ├── infrastructure/       # Prisma, Redis, S3, Anthropic
│       │   │   ├── database/
│       │   │   │   ├── prisma.service.ts
│       │   │   │   ├── repositories/
│       │   │   │   │   ├── prisma-patient.repository.ts
│       │   │   │   │   └── prisma-patient.repository.spec.ts
│       │   │   │   └── migrations/
│       │   │   ├── storage/
│       │   │   │   └── r2-storage.service.ts
│       │   │   ├── ai/
│       │   │   │   └── anthropic.service.ts
│       │   │   ├── queue/
│       │   │   │   └── bullmq.module.ts
│       │   │   └── audit/
│       │   │       └── audit-log.interceptor.ts
│       │   │
│       │   └── api/                  # Controllers NestJS — HTTP boundary
│       │       ├── patients/
│       │       │   ├── patients.controller.ts
│       │       │   ├── patients.controller.spec.ts
│       │       │   └── patients.module.ts
│       │       ├── consultations/
│       │       ├── surgeries/
│       │       ├── reports/
│       │       ├── analytics/
│       │       ├── auth/
│       │       └── shared/
│       │           ├── guards/
│       │           │   ├── auth.guard.ts
│       │           │   └── rbac.guard.ts
│       │           ├── interceptors/
│       │           │   ├── tenant.interceptor.ts
│       │           │   └── audit.interceptor.ts
│       │           └── pipes/
│       │               └── zod-validation.pipe.ts
│       │
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts
│
├── packages/
│   ├── contracts/                    # Schemas Zod compartidos (frontend + backend)
│   │   ├── src/
│   │   │   ├── patient.schema.ts
│   │   │   ├── consultation.schema.ts
│   │   │   ├── surgery.schema.ts
│   │   │   ├── report.schema.ts
│   │   │   ├── auth.schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── clinical-codes/               # Catálogos CIE-10 y SNOMED (solo lectura)
│   │   ├── src/
│   │   │   ├── cie10/
│   │   │   ├── snomed/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                           # Componentes compartidos si se añaden más apps
│       └── package.json
│
├── tooling/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── jest-config/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Test + lint en PR
│       └── deploy.yml                # Deploy a Vercel + Railway en main
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 6. Módulos del Dominio Clínico

Cada módulo NestJS encapsula una bounded context del dominio clínico ORL.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Módulos NestJS                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Auth       │  │Organization  │  │      Patient         │  │
│  │              │  │              │  │                      │  │
│  │ · Login      │  │ · Workspace  │  │ · Ficha demográfica  │  │
│  │ · OAuth      │  │ · Members    │  │ · Historia clínica   │  │
│  │ · Session    │  │ · Settings   │  │ · Alergias           │  │
│  │ · MFA check  │  │ · Roles      │  │ · Consentimientos    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Consultation │  │   Surgery    │  │      Imaging         │  │
│  │              │  │              │  │                      │  │
│  │ · Registro   │  │ · Pre-op     │  │ · Upload DICOM/img   │  │
│  │ · Escalas    │  │ · Intra-op   │  │ · Metadatos          │  │
│  │ · ORL forms  │  │ · Post-op    │  │ · Anotaciones        │  │
│  │ · Timeline   │  │ · Checklist  │  │ · Visor              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Medication  │  │   Reports    │  │     Analytics        │  │
│  │              │  │              │  │                      │  │
│  │ · Prescripc. │  │ · Generac.IA │  │ · Dashboard          │  │
│  │ · Historial  │  │ · CIE-10     │  │ · Outcomes           │  │
│  │ · Alertas    │  │ · SNOMED     │  │ · Cohortes           │  │
│  │ · Recetas    │  │ · Exportar   │  │ · Exportar datos     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Dependencias entre módulos

```
Patient ◀── Consultation (un paciente tiene consultas)
Patient ◀── Surgery      (un paciente tiene cirugías)
Patient ◀── Imaging      (un paciente tiene imágenes)
Patient ◀── Medication   (un paciente tiene medicación)

Consultation ──▶ Reports   (una consulta puede generar informe)
Surgery      ──▶ Reports   (una cirugía puede generar informe)

Patient      ──▶ Analytics (fuente de datos)
Consultation ──▶ Analytics
Surgery      ──▶ Analytics

Organization ◀── ALL       (todas las entidades pertenecen a una org)
Auth         ──▶ ALL       (todas las rutas requieren autenticación)
```

---

## 7. Flujo de una Petición

Ejemplo: médico crea una nueva consulta para un paciente.

```
Browser (Next.js)
│
├─ 1. Usuario rellena ConsultationForm
├─ 2. React Hook Form valida con Zod schema (packages/contracts)
├─ 3. TanStack Query ejecuta mutación → POST /api/consultations
│
HTTPS
│
NestJS API (Railway)
│
├─ 4. AuthGuard: valida JWT de la cookie HttpOnly
├─ 5. TenantInterceptor: extrae organizationId del JWT, lo inyecta en request context
├─ 6. RBACGuard: verifica que el rol del usuario tiene permiso CREATE_CONSULTATION
├─ 7. ZodValidationPipe: valida el body contra ConsultationSchema (packages/contracts)
├─ 8. ConsultationsController.create() → instancia CreateConsultationCommand
├─ 9. CreateConsultationHandler.execute():
│      a. Verifica que el paciente pertenece a la organización (via PatientRepository)
│      b. Crea entidad Consultation en el dominio
│      c. Persiste via PrismaConsultationRepository
│      d. Si hay datos suficientes → encola GenerateReportJob en BullMQ
├─ 10. AuditInterceptor: registra la operación en audit_logs
├─ 11. Respuesta 201 Created con ConsultationDTO
│
Browser
│
└─ 12. TanStack Query invalida cache de [patient, consultations]
   13. UI actualiza timeline del paciente
```

---

## 8. Infraestructura y Entornos

### Entornos

| Entorno | Frontend | Backend | Base de datos | Propósito |
|---|---|---|---|---|
| `development` | localhost:3000 | localhost:3001 | Neon (branch `dev`) | Desarrollo local |
| `preview` | Vercel preview | Railway PR env | Neon (branch dinámica) | Review de PRs |
| `staging` | Vercel staging | Railway staging | Neon (branch `staging`) | QA pre-producción |
| `production` | Vercel prod | Railway prod | Neon (branch `main`) | Usuarios reales |

### Variables de entorno por capa

```bash
# apps/api/.env
DATABASE_URL=postgresql://...@neon.tech/MediCore
REDIS_URL=redis://...@upstash.io
R2_BUCKET_NAME=MediCore-storage
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
ANTHROPIC_API_KEY=...
JWT_SECRET=...
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# apps/web/.env
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.MediCore.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=https://api.MediCore.com
```

### Pipeline CI/CD (GitHub Actions)

```
Pull Request:
  lint → type-check → unit tests → integration tests → build

Merge a main:
  [todo lo anterior] → deploy preview → E2E tests → deploy production
```

---

## 9. Seguridad en Capas

```
Capa 1 — Red:          TLS 1.3 en tránsito. HTTPS forzado.
Capa 2 — Autenticación: OAuth 2.0 via Google/Microsoft. JWT HttpOnly.
Capa 3 — Autorización:  RBAC por organización. Tenant isolation middleware.
Capa 4 — Validación:    Zod en entrada. Nunca confiar en datos del cliente.
Capa 5 — Datos:         Cifrado en reposo (Neon lo gestiona). organizationId en todas las queries.
Capa 6 — Auditoría:     Audit log inmutable de todas las operaciones sobre datos clínicos.
Capa 7 — Storage:       R2 con URLs firmadas (pre-signed, TTL corto). Sin acceso público.
```

### Roles iniciales (RBAC)

| Rol | Descripción | Permisos |
|---|---|---|
| `owner` | Propietario del workspace | Todo, incluida gestión de facturación y miembros |
| `physician` | Médico con acceso clínico completo | CRUD sobre todos los módulos clínicos |
| `viewer` | Solo lectura (p.ej. residente supervisado) | GET sobre módulos clínicos |
| `admin` | Gestión administrativa del workspace | Gestión de miembros y configuración, sin datos clínicos |

---

## 10. Estrategia Multi-tenant

### Modelo de datos raíz

```
Organization (workspace)
├── id: UUID
├── name: string
├── type: 'clinic' | 'solo_practice' | 'hospital_dept'
├── plan: 'free' | 'pro' | 'enterprise'
├── settings: JSONB
└── createdAt: DateTime

OrganizationMember
├── organizationId → Organization
├── userId → User
├── role: 'owner' | 'physician' | 'viewer' | 'admin'
└── joinedAt: DateTime

User
├── id: UUID
├── email: string
├── name: string
├── avatarUrl: string
└── oauthProvider: string
```

### Aislamiento de datos

Todas las tablas clínicas incluyen `organizationId NOT NULL`. El `TenantInterceptor` de NestJS extrae el `organizationId` del JWT y lo almacena en el `AsyncLocalStorage` de la petición. Todos los repositorios Prisma reciben el `organizationId` como parámetro obligatorio en su interfaz — no es opcional, no tiene valor por defecto.

### Caso de uso: médico liberal

Un médico autónomo crea su workspace de tipo `solo_practice`. Es el único miembro con rol `owner + physician`. Todos sus pacientes están bajo su `organizationId`. Si en el futuro se incorpora a una clínica, puede crear o unirse a un segundo workspace — sus pacientes personales y los de la clínica están completamente separados.

---

## 11. Decisiones Diferidas (Roadmap)

Estas decisiones NO se toman en el MVP para evitar sobreingeniería. Se documentan aquí para que sean explícitas y no se implementen por inercia.

| Decisión | Motivo del aplazamiento | Trigger para revisar |
|---|---|---|
| Event Sourcing | Complejidad operacional sin beneficio claro en MVP | >10k eventos/día o necesidad de replay de eventos |
| PACS / HL7 FHIR | Requiere acuerdos institucionales, meses de trabajo | Primer hospital interesado |
| GraphQL | REST es suficiente; GraphQL añade complejidad sin beneficio aún | >5 clients diferentes con necesidades divergentes |
| Schema-per-tenant | Máximo aislamiento RGPD pero inviable a coste 0 | Requisito contractual de aislamiento total |
| Microservicios | Monolito modular escala bien hasta millones de usuarios | >50 desarrolladores o equipos completamente independientes |
| CDN para imágenes médicas | Cloudflare R2 es suficiente para MVP | Latencia de carga de imágenes >3s en producción |
| Búsqueda full-text avanzada | PostgreSQL FTS es suficiente | >500k registros o necesidad de búsqueda semántica |

---

*Siguiente documento: `02-data-schema.md` — Modelo de datos completo, schema Prisma, índices, políticas de retención RGPD.*