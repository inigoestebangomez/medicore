# initial.prompt.md

## Proyecto: MediCore — Sistema de Gestión Clínica para Otorrinolaringología

---

## 1. Visión del Producto

Aplicación web especializada para el **médico cirujano otorrinolaringólogo (ORL)**, diseñada como herramienta de trabajo diario integral. Permite gestionar pacientes, historia clínica, procedimientos quirúrgicos, imágenes diagnósticas, seguimiento postoperatorio, medicación y generación automática de informes clínicos. Incorpora analíticas avanzadas para análisis de casos a gran escala.

---

## 2. Usuarios Objetivo

- **Usuario primario:** Médico especialista en Otorrinolaringología (ORL) / Cirujano ORL
- **Usuarios secundarios (futuras iteraciones):** Personal administrativo de consulta, enfermería de planta/quirófano, médicos residentes bajo supervisión
- **Administrador del sistema:** Gestor de la cuenta clínica

---

## 3. Módulos Funcionales Principales

### 3.1 Gestión de Pacientes

- Ficha demográfica completa del paciente
- Historia clínica ORL (anamnesis, antecedentes personales y familiares específicos de ORL)
- Registro de alergias y contraindicaciones
- Adjuntar documentos de consentimiento informado
- Exportar paciente (PDF de historia clínica completa) para sesiones de control, interconsultas o derivaciones

### 3.2 Consultas y Seguimiento

- Registro estructurado de consultas (motivo, exploración física, diagnóstico, plan)
- Escala de síntomas ORL específicos (p.ej. VAS para acúfenos, escala SNOT-22 para rinosinusitis, DHI para vértigo)
- Formularios personalizables por patología
- Línea de tiempo clínica del paciente (timeline visual)
- Seguimiento postoperatorio con hitos y alertas

### 3.3 Gestión Quirúrgica

- Registro de procedimientos quirúrgicos (tipo, fecha, duración, equipo)
- Formularios específicos por intervención ORL (septoplastia, timpanoplastia, amigdalectomía, CPRE, etc.)
- Pre-operatorio: checklists de preparación y pruebas preoperatorias
- Intraoperatorio: notas de técnica quirúrgica
- Post-operatorio: evolución, complicaciones, revisiones programadas

### 3.4 Imágenes Diagnósticas y Pruebas

- Visualizador integrado de imágenes: radiografías, TC oído/senos paranasales/cuello, RMN, endoscopias
- Etiquetado y anotación de imágenes
- Audiometrías, impedanciometrías, potenciales evocados auditivos (PEA)
- Pruebas vestibulares (videonistagmografía, VHIT)
- Nasofibroscopia y laringoscopia (adjuntar vídeos/capturas)
- Resultados de anatomía patológica
- Integración con PACS (futura iteración)

### 3.5 Medicación

- Prescripción y registro de medicación activa
- Historial de tratamientos farmacológicos
- Alertas de alergias e interacciones
- Generación de recetas (PDF)

### 3.6 Generación de Informes Clínicos con IA

- Generación automática de informes a partir de:
  - Datos de consulta + historia clínica
  - Notas quirúrgicas
  - Resultados de pruebas
- Soporte de codificación diagnóstica: **CIE-10** (ICD-10) y **SNOMED CT**
- Soporte de codificación de procedimientos: **CIE-10-PCS**, **CPT** (opcional), **SNOMED CT**
- Plantillas de informes por tipo (informe de alta, informe quirúrgico, informe de derivación, certificado médico)
- Revisión y edición del informe antes de firmado
- Exportación en PDF con firma electrónica

### 3.7 Analytics y Business Intelligence

- Dashboard resumen con KPIs de consulta (nº pacientes, diagnósticos frecuentes, carga quirúrgica)
- Análisis epidemiológico de casos por diagnóstico CIE-10 / SNOMED
- Resultados clínicos (outcomes) a nivel de cohorte
- Evolución temporal de métricas clínicas
- Comparativa pre/post-operatoria de escalas validadas
- Exportación de datos anonimizados para investigación

---

## 4. Requerimientos No Funcionales

### 4.1 Seguridad y Privacidad

- Autenticación mediante **OAuth 2.0 / OpenID Connect** (p.ej. Google Workspace, Microsoft Entra ID, o proveedor propio)
- Soporte de **MFA (autenticación multifactor)** como capa adicional
- Control de acceso basado en roles (**RBAC**)
- **Cifrado en tránsito:** TLS 1.3
- **Cifrado en reposo:** AES-256 (datos de pacientes y documentos)
- Gestión de sesiones con expiración automática
- Audit log de todas las acciones sobre datos de pacientes

### 4.2 Cumplimiento Legal

- **LOPD / RGPD (Reglamento General de Protección de Datos - UE)**
  - Base jurídica del tratamiento: atención sanitaria (Art. 9.2.h RGPD)
  - Registro de Actividades de Tratamiento (RAT)
  - Política de retención y eliminación de datos
  - Derecho al olvido, portabilidad, acceso y rectificación
  - Notificación de brechas de seguridad en ≤72h
  - DPO (Delegado de Protección de Datos) si aplica por volumen
- **ENS (Esquema Nacional de Seguridad)** — nivel ALTO para datos sanitarios
- **Ley 41/2002** — Ley de Autonomía del Paciente (historia clínica, consentimiento informado)
- **Interoperabilidad HL7 FHIR R4** (futura iteración, para conexión con sistemas hospitalarios)

### 4.3 Rendimiento

- Tiempo de carga inicial < 2s (LCP)
- Tiempo de respuesta de API < 300ms (p95) para operaciones CRUD estándar
- Soporte de carga de imágenes médicas pesadas de forma asíncrona
- Disponibilidad objetivo: 99.9% (uptime mensual)

### 4.4 Usabilidad

- Interfaz **responsive** (desktop-first, adaptable a tablet para uso en consulta)
- Diseño limpio, clínico e intuitivo — mínima fricción en el flujo de trabajo del médico
- Modo oscuro para entornos de visualización de imágenes
- Accesibilidad **WCAG 2.1 AA**

---

## 5. Stack Tecnológico Propuesto

### Frontend

| Capa                   | Tecnología                                      | Justificación                                                  |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Framework              | **React 18+ (Next.js 14 App Router)**           | SSR/SSG para rendimiento, routing robusto, ecosistema maduro   |
| Lenguaje               | **TypeScript**                                  | Type-safety crítica en dominio médico                          |
| UI Library             | **shadcn/ui + Tailwind CSS**                    | Componentes accesibles, altamente personalizables, sin lock-in |
| Estado global          | **Zustand**                                     | Ligero y sin boilerplate innecesario                           |
| Data fetching          | **TanStack Query (React Query)**                | Caché, sincronización, loading/error states                    |
| Formularios            | **React Hook Form + Zod**                       | Validación robusta con tipado end-to-end                       |
| Visualización de datos | **Recharts + D3.js**                            | Analytics y gráficas clínicas                                  |
| Visor de imágenes      | **Cornerstone.js**                              | Visor DICOM/médico estándar de la industria                    |
| Testing                | **Vitest + React Testing Library + Playwright** | Unit, integración y E2E                                        |

### Backend

| Capa              | Tecnología                            | Justificación                                            |
| ----------------- | ------------------------------------- | -------------------------------------------------------- |
| Runtime           | **Node.js 20 LTS**                    | Ecosistema amplio, integración natural con Next.js       |
| Framework API     | **NestJS**                            | Arquitectura modular, DI nativa, ideal para SDD/TDD      |
| Lenguaje          | **TypeScript**                        | Consistencia full-stack                                  |
| ORM               | **Prisma**                            | Type-safe, migraciones, compatible con PostgreSQL        |
| Validación        | **Zod** (compartido con frontend)     | Schemas únicos para cliente y servidor                   |
| Generación IA     | **Anthropic Claude API / OpenAI API** | Generación de informes clínicos en lenguaje natural      |
| Tareas asíncronas | **BullMQ (Redis)**                    | Generación de PDFs, procesado de imágenes en background  |
| Testing           | **Jest + Supertest**                  | Unit e integración; compatible con NestJS testing module |

### Base de Datos y Almacenamiento

| Capa                       | Tecnología                                            | Justificación                                          |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Base de datos principal    | **PostgreSQL 16**                                     | ACID, full-text search, jsonb para datos flexibles ORL |
| Caché y colas              | **Redis 7**                                           | Sesiones, caché de consultas frecuentes, cola de jobs  |
| Almacenamiento de archivos | **MinIO (S3-compatible)**                             | Self-hosted, imágenes médicas y documentos cifrados    |
| Búsqueda clínica           | **PostgreSQL FTS** o **Elasticsearch** (si se escala) | Búsqueda por diagnóstico, SNOMED, CIE-10               |

### Autenticación y Seguridad

| Capa                | Tecnología                                           | Justificación                                    |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Auth                | **Auth.js (NextAuth v5)**                            | OAuth 2.0 / OIDC nativo, flexible, RGPD-friendly |
| Proveedores OAuth   | Google Workspace, Microsoft Entra, SAML (hospitales) | Integración con entornos sanitarios reales       |
| Gestión de sesiones | JWT + Refresh Tokens (HttpOnly cookies)              | Seguro contra XSS                                |
| Permisos            | **CASL** (frontend) + guards NestJS (backend)        | RBAC granular                                    |

### Infraestructura y DevOps

| Capa           | Tecnología                                          | Justificación                                   |
| -------------- | --------------------------------------------------- | ----------------------------------------------- |
| Contenedores   | **Docker + Docker Compose**                         | Reproducibilidad, portabilidad                  |
| Orquestación   | **Kubernetes (K8s)** o **Railway/Render** (MVP)     | Escalabilidad; Railway para early stage         |
| CI/CD          | **GitHub Actions**                                  | Pipelines de test, build y deploy automatizados |
| Secretos       | **HashiCorp Vault** o variables de entorno cifradas | Gestión segura de credenciales                  |
| Monitorización | **Prometheus + Grafana**                            | Métricas de rendimiento y disponibilidad        |
| Logging        | **Pino + Loki**                                     | Logs estructurados y búsqueda                   |
| Error tracking | **Sentry**                                          | Alertas de errores en producción                |

### Generación de Documentos

| Capa              | Tecnología                                                           |
| ----------------- | -------------------------------------------------------------------- |
| PDF de informes   | **React-PDF (@react-pdf/renderer)** o **Puppeteer**                  |
| Firma electrónica | **DocuSign API** o firma cualificada con certificado médico (eMedCI) |

---

## 6. Metodología y Calidad de Software

### 6.1 Desarrollo Guiado por Especificación (SDD)

- Toda funcionalidad parte de una especificación en los archivos de arquitectura antes de escribir código
- Los cambios de producto se reflejan primero en la documentación de especificación
- Los archivos `0x-*.md` son la fuente de verdad del sistema

### 6.2 Desarrollo Guiado por Tests (TDD)

- Ciclo Red → Green → Refactor en todas las features
- **Cobertura mínima:** 80% en lógica de negocio, 90% en generación de informes y codificación CIE-10/SNOMED
- Tests unitarios: lógica de dominio (casos de uso, entidades)
- Tests de integración: endpoints API, repositorios de base de datos
- Tests E2E: flujos críticos (alta de paciente, generación de informe, exportación)
- Tests de contrato: interfaces entre frontend y backend (OpenAPI / Zod schemas)

### 6.3 Convenciones

- **Conventional Commits** para mensajes de git
- **Husky + lint-staged** para pre-commit hooks (lint, type-check, tests unitarios)
- **ESLint + Prettier** con reglas estrictas TypeScript
- **SemVer** para versionado de la aplicación
- **OpenAPI 3.1** para documentación de la API (generada desde decoradores NestJS con `@nestjs/swagger`)

---

## 7. Archivos de Especificación a Generar

A partir de este `initial.prompt.md`, se generarán los siguientes documentos de arquitectura. Cada archivo es prerequisito del siguiente.

| Nº  | Archivo                  | Contenido                                                                                                                                    |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | `01-architecture.md`     | Arquitectura del sistema, diagrama C4, decisiones ADR, patrones (Clean Architecture / DDD), estructura de carpetas del monorepo              |
| 02  | `02-data-schema.md`      | Modelo de datos completo: entidades, relaciones, esquema Prisma, índices, políticas de retención RGPD, codificación CIE-10/SNOMED            |
| 03  | `03-business-rules.md`   | Reglas de negocio por módulo, casos de uso, flujos clínicos, validaciones, permisos RBAC por rol                                             |
| 04  | `04-design-spec.md`      | Sistema de diseño (tokens, paleta, tipografía), componentes UI por módulo, wireframes y flujos de pantalla, guía de accesibilidad            |
| 05  | `05-api-spec.md`         | Especificación OpenAPI 3.1 de todos los endpoints REST, esquemas de request/response, autenticación, manejo de errores, rate limiting        |
| 06  | `06-testing-strategy.md` | Estrategia TDD/SDD completa, pirámide de tests, herramientas, convenios de nombrado, plan de cobertura por módulo, mocks y fixtures clínicos |

### 7.1 Archivos Adicionales Sugeridos

| Nº  | Archivo                     | Justificación                                                                                                                                                                       |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 07  | `07-security-compliance.md` | Modelo de amenazas (STRIDE), controles RGPD/ENS, gestión de consentimientos, audit log, política de backups y recuperación ante desastres                                           |
| 08  | `08-ai-clinical-spec.md`    | Especificación del módulo de IA: prompts de generación de informes, integración CIE-10/SNOMED, validación clínica de outputs, disclaimers legales, fallback ante errores del modelo |
| 09  | `09-devops-infra.md`        | Definición de entornos (dev/staging/prod), pipelines CI/CD, configuración Docker/K8s, estrategia de migraciones de base de datos, SLOs y runbooks                                   |

---

## 8. Próximos Pasos

1. **Revisar y validar** este `initial.prompt.md` — confirmar módulos, stack y alcance del MVP
2. **Definir MVP vs Roadmap** — qué módulos van al MVP v1.0 y qué queda para iteraciones posteriores
3. **Generar** `01-architecture.md` — estructura del sistema y decisiones técnicas fundamentales
4. **Iterar** en orden sobre los archivos `02` al `09`
5. **Configurar monorepo** y scaffolding inicial del proyecto
6. **Escribir primeros tests** (TDD desde el módulo de pacientes como dominio central)

---

_Documento generado como punto de partida para el proyecto MediCore. Versión 0.1 — sujeto a revisión y validación antes de comenzar el desarrollo._
