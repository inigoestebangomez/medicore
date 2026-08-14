# 09-devops-infra.md
## MediCore — DevOps e Infraestructura

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisitos:** `01-architecture.md` aprobado

---

## Índice

1. [Visión General de la Infraestructura](#1-visión-general-de-la-infraestructura)
2. [Entornos](#2-entornos)
3. [Estructura de Ramas Git](#3-estructura-de-ramas-git)
4. [Pipeline CI/CD Completo](#4-pipeline-cicd-completo)
5. [Configuración de Servicios MVP](#5-configuración-de-servicios-mvp)
6. [Variables de Entorno por Servicio](#6-variables-de-entorno-por-servicio)
7. [Gestión de Migraciones de Base de Datos](#7-gestión-de-migraciones-de-base-de-datos)
8. [Monitorización y Alertas](#8-monitorización-y-alertas)
9. [SLOs — Objetivos de Nivel de Servicio](#9-slos--objetivos-de-nivel-de-servicio)
10. [Runbooks de Operaciones](#10-runbooks-de-operaciones)
11. [Plan de Migración a Infraestructura Propia](#11-plan-de-migración-a-infraestructura-propia)

---

## 1. Visión General de la Infraestructura

### MVP — Coste 0€ (hasta los primeros usuarios reales)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INFRAESTRUCTURA MVP                             │
│                                                                     │
│  ┌─────────────────┐         ┌──────────────────────────────────┐   │
│  │     VERCEL      │         │            RAILWAY               │   │
│  │  (frontend)     │────────▶│  (backend NestJS)                │   │
│  │                 │  HTTPS  │                                  │   │
│  │  Next.js 14     │         │  Node.js 20 LTS                  │   │
│  │  Edge Network   │         │  Puerto 3001                     │   │
│  │  Gratis         │         │  Free tier ($5 créditos/mes)     │   │
│  └─────────────────┘         └──────────┬───────────────────────┘   │
│                                         │                           │
│              ┌──────────────────────────┼──────────────────────┐    │
│              │                          │                      │    │
│   ┌──────────▼──────┐    ┌─────────────▼───┐    ┌─────────────▼─┐  │
│   │  NEON POSTGRES  │    │  UPSTASH REDIS  │    │ CLOUDFLARE R2 │  │
│   │  (Frankfurt EU) │    │  (EU region)    │    │ (EU bucket)   │  │
│   │  Free: 0.5GB    │    │  Free: 10k/día  │    │ Free: 10GB    │  │
│   └─────────────────┘    └─────────────────┘    └───────────────┘  │
│                                                                     │
│  Servicios externos:                                                │
│  ├── Anthropic API (Claude)    — pago por uso                       │
│  ├── Google OAuth              — gratuito                           │
│  ├── Microsoft Entra OAuth     — gratuito                           │
│  └── Sentry (error tracking)   — free tier                          │
└─────────────────────────────────────────────────────────────────────┘

Coste total MVP: ~0€/mes (sin contar uso de Anthropic API)
```

---

## 2. Entornos

MediCore tiene 4 entornos con propósitos distintos:

```
ENTORNO         URL                              Rama Git    Base de datos
──────────────────────────────────────────────────────────────────────────
development     localhost:3000 / localhost:3001  cualquiera  Neon branch: dev
preview         pr-NNN.medicore.vercel.app        PR branch   Neon branch: pr-NNN (efímero)
staging         staging.medicore.app             develop     Neon branch: staging
production      app.medicore.app                 main        Neon branch: main
```

### Entorno development (local)

```bash
# apps/api/.env.development
DATABASE_URL="postgresql://...@neon.tech/medicore?sslmode=require&branch=dev"
REDIS_URL="redis://localhost:6379"
R2_BUCKET_NAME="medicore-dev"
ANTHROPIC_API_KEY="sk-ant-..."
JWT_SECRET="dev-secret-no-usar-en-produccion-jamas"
NEXTAUTH_SECRET="dev-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
LOG_LEVEL="debug"

# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-nextauth-secret"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

Para levantar el entorno local completo:

```bash
# En la raíz del monorepo
pnpm install

# Terminal 1 — Backend
pnpm --filter api dev

# Terminal 2 — Frontend
pnpm --filter web dev

# Terminal 3 — Redis local (si no usas Upstash en dev)
docker run -p 6379:6379 redis:7-alpine

# Terminal 4 — Stripe CLI (para webhooks en local)
stripe listen --forward-to localhost:3001/v1/billing/webhook
```

### Entorno preview (por PR)

Cada Pull Request genera automáticamente:
- Un deploy de Vercel con URL única `pr-NNN.medicore.vercel.app`
- Un branch de Neon con las migraciones aplicadas
- Variables de entorno inyectadas por GitHub Actions

Los entornos preview se destruyen automáticamente cuando el PR se cierra o se mergea.

---

## 3. Estructura de Ramas Git

```
main                    Producción. Solo acepta merges desde develop via PR.
  ↑
develop                 Staging. Acepta merges desde feature branches via PR.
  ↑
feature/WU-XX-YY-desc   Work units del roadmap. Una rama por WU.
fix/descripcion         Hotfixes urgentes (pueden ir directo a main en emergencias).
```

### Convención de commits (Conventional Commits)

```
feat(patients):     añade detección de duplicados por apellido+fecha
fix(reports):       corrige placeholder {{PATIENT_NHC}} no sustituido en PDF
test(medication):   añade test de bloqueo por alergia ANAPHYLAXIS
docs(api):          actualiza spec de endpoint POST /patients
chore(deps):        actualiza prisma a 5.15.0
refactor(domain):   extrae NhcValueObject de PatientEntity
```

El formato es: `tipo(módulo): descripción en minúsculas, imperativo, sin punto final`

---

## 4. Pipeline CI/CD Completo

### En cada Pull Request

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  # ── JOB 1: Calidad de código ──────────────────────────────────────
  quality:
    name: Lint + Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint
      - run: pnpm turbo run type-check
      - name: Verificar secretos expuestos
        uses: trufflesecurity/trufflehog@main
        with: { path: ./, base: ${{ github.event.repository.default_branch }}, head: HEAD }

  # ── JOB 2: Tests unitarios ────────────────────────────────────────
  unit-tests:
    name: Unit Tests + Coverage
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run test:unit -- --coverage
      - name: Gate de cobertura
        run: |
          pnpm --filter api coverage:check \
            --threshold.domain=100 \
            --threshold.application=90 \
            --threshold.global=80
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: apps/api/coverage/

  # ── JOB 3: Tests de contrato ─────────────────────────────────────
  contract-tests:
    name: Contract Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @medicore/contracts test

  # ── JOB 4: Tests de integración ──────────────────────────────────
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: medicore_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/medicore_test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api prisma migrate deploy
      - run: pnpm turbo run test:integration

  # ── JOB 5: Tests de seguridad ─────────────────────────────────────
  security-tests:
    name: Tenant Isolation + Security Tests
    runs-on: ubuntu-latest
    needs: integration-tests
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_DB: medicore_test, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/medicore_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api prisma migrate deploy
      - run: pnpm turbo run test:security

  # ── JOB 6: Audit de dependencias ─────────────────────────────────
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
```

### En merge a `develop` → deploy staging

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  deploy-api-staging:
    name: Deploy API to Railway Staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Apply DB migrations (staging)
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
        run: pnpm --filter api prisma migrate deploy
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: medicore-api-staging

  deploy-web-staging:
    name: Deploy Web to Vercel Staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--target staging'
```

### En merge a `main` → deploy producción

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  # Tests E2E en staging antes de promover a producción
  e2e-staging:
    name: E2E Tests en Staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - run: pnpm turbo run test:e2e
        env:
          E2E_BASE_URL: https://staging.medicore.app

  deploy-production:
    name: Deploy to Production
    needs: e2e-staging
    runs-on: ubuntu-latest
    environment: production   # requiere aprobación manual en GitHub
    steps:
      - uses: actions/checkout@v4
      - name: Apply DB migrations (production)
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
        run: pnpm --filter api prisma migrate deploy
      - name: Deploy API to Railway Production
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: medicore-api-prod
      - name: Deploy Web to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
      - name: Notificar deploy en Sentry
        run: |
          curl -sS https://sentry.io/api/0/organizations/${{ secrets.SENTRY_ORG }}/releases/ \
            -H "Authorization: Bearer ${{ secrets.SENTRY_AUTH_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "{\"version\": \"${{ github.sha }}\", \"projects\": [\"medicore-api\", \"medicore-web\"]}"
```

---

## 5. Configuración de Servicios MVP

### Neon PostgreSQL

```
Proyecto:     medicore
Región:       eu-central-1 (Frankfurt)
Plan:         Free tier (0.5GB, branching ilimitado)
Branches:
  main     → producción
  staging  → staging
  dev      → development
  pr-*     → creados/destruidos por CI automáticamente

Connection pooling: PgBouncer activado (Neon lo incluye)
SSL: requerido (sslmode=require en DATABASE_URL)
```

**Crear branch de preview por PR (GitHub Actions):**

```yaml
- name: Create Neon branch for PR
  uses: neondatabase/create-branch-action@v5
  with:
    project_id: ${{ secrets.NEON_PROJECT_ID }}
    api_key:    ${{ secrets.NEON_API_KEY }}
    branch_name: pr-${{ github.event.number }}
```

### Railway (Backend NestJS)

```
Plan:        Hobby ($5 créditos gratuitos/mes)
Región:      Europe West
Servicios:
  medicore-api-prod     → rama main
  medicore-api-staging  → rama develop

Health check: GET /v1/health → { "status": "ok" }
Restart policy: on-failure, max 3 reintentos
Resources prod: 512MB RAM, 0.5 vCPU (suficiente para MVP)
```

### Cloudflare R2

```
Buckets:
  medicore-prod      → producción (imágenes, PDFs, exports)
  medicore-staging   → staging
  medicore-dev       → development

Configuración:
  Acceso público:    DESACTIVADO (solo URLs pre-firmadas)
  Región:            Europe (RGPD)
  Cifrado en reposo: AES-256 (incluido en R2)

CORS (para uploads directos desde el navegador en el futuro):
  AllowedOrigins: ["https://app.medicore.app"]
  AllowedMethods: ["GET", "PUT"]
  MaxAgeSeconds: 3600
```

### Upstash Redis

```
Base de datos:  medicore-prod (región EU-West)
Plan:           Free (10.000 comandos/día)
TLS:            activado
Uso:
  - Caché de dashboards de analytics (TTL 5min)
  - Cola de jobs BullMQ
  - Rate limiting counters
  - Sesiones de importación en curso
```

---

## 6. Variables de Entorno por Servicio

### GitHub Secrets requeridos

```
# Infraestructura
NEON_PROJECT_ID
NEON_API_KEY
RAILWAY_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Bases de datos por entorno
PROD_DATABASE_URL
STAGING_DATABASE_URL

# Aplicación producción
PROD_JWT_SECRET
PROD_NEXTAUTH_SECRET
PROD_ANTHROPIC_API_KEY
PROD_R2_ACCESS_KEY_ID
PROD_R2_SECRET_ACCESS_KEY
PROD_STRIPE_SECRET_KEY
PROD_STRIPE_WEBHOOK_SECRET
PROD_GOOGLE_CLIENT_ID
PROD_GOOGLE_CLIENT_SECRET

# Monitorización
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
```

Ninguno de estos valores aparece nunca en el repositorio Git. Se configuran exclusivamente en GitHub Settings → Secrets and variables → Actions.

---

## 7. Gestión de Migraciones de Base de Datos

### Reglas de oro

```
1. NUNCA ejecutar prisma migrate reset en staging o producción
2. NUNCA ejecutar prisma db push en staging o producción
3. SIEMPRE usar prisma migrate deploy en CI/CD (no dev)
4. SIEMPRE hacer backup manual antes de migraciones en producción
5. SIEMPRE testear la migración en staging antes de producción
6. Las migraciones van SIEMPRE en el mismo PR que el código que las necesita
```

### Flujo de una migración

```bash
# 1. En tu rama feature, modifica schema.prisma
# 2. Genera la migración
pnpm --filter api prisma migrate dev --name "add-import-batch"

# Esto crea: apps/api/prisma/migrations/20260609120000_add_import_batch/migration.sql

# 3. Revisa el SQL generado — asegúrate de que es correcto
cat apps/api/prisma/migrations/20260609120000_add_import_batch/migration.sql

# 4. Abre PR → CI aplica la migración en el branch de Neon del PR
# 5. Merge a develop → CI aplica en staging
# 6. Merge a main → CI aplica en producción (con aprobación manual)
```

### Migraciones peligrosas (requieren cuidado especial)

```
Operación                    Riesgo          Estrategia
──────────────────────────────────────────────────────────────────────
DROP COLUMN                  Pérdida datos   2 PRs: 1) deprecar col en código
                                             2) eliminar col en siguiente release
RENAME COLUMN                Rotura API      Igual: añadir col nueva + migrar datos
                                             + eliminar col antigua en siguiente PR
NOT NULL sin default          Falla en datos  Primero añadir con default, luego
  en tabla con datos          existentes      rellenar datos, luego quitar default
ADD INDEX en tabla grande    Lock prolongado  Usar CREATE INDEX CONCURRENTLY
                                             (Neon lo soporta)
```

### Rollback de una migración

Prisma no tiene rollback automático. El proceso manual:

```bash
# 1. Identificar la migración a revertir
ls apps/api/prisma/migrations/

# 2. Escribir el SQL inverso manualmente
# (si añadiste una columna, la quitas; si creaste una tabla, la eliminas)

# 3. Aplicar el SQL inverso directamente en Neon console o via psql
psql $DATABASE_URL -c "ALTER TABLE patients DROP COLUMN imported_data;"

# 4. Eliminar el archivo de migración del repositorio
rm -rf apps/api/prisma/migrations/20260609120000_add_import_batch/

# 5. Commit con el rollback
git commit -m "revert: rollback migración add-import-batch"
```

---

## 8. Monitorización y Alertas

### Sentry (error tracking)

```typescript
// apps/api/src/main.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn:         process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release:     process.env.GITHUB_SHA,

  // No capturar datos de pacientes en errores
  beforeSend(event) {
    // Redactar campos sensibles del request body
    if (event.request?.data) {
      const sensitiveFields = ['firstName', 'lastName', 'idDocument', 'phone', 'email', 'birthDate']
      for (const field of sensitiveFields) {
        if (event.request.data[field]) {
          event.request.data[field] = '[REDACTED]'
        }
      }
    }
    return event
  },

  // Ignorar errores esperados (validación, autenticación)
  ignoreErrors: [
    'ValidationError',
    'UnauthorizedException',
    'ForbiddenException',
  ],
})
```

### Logs estructurados con Pino

```typescript
// apps/api/src/infrastructure/logging/logger.service.ts

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    // Nunca loguear datos de identidad de pacientes
    paths: [
      'req.body.firstName',
      'req.body.lastName',
      'req.body.idDocument',
      'req.body.phone',
      'req.body.email',
      'req.body.birthDate',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }  // legible en local
    : undefined,                  // JSON en producción para Loki/DataDog
})
```

### Health check endpoint

```typescript
// GET /v1/health — usado por Railway para restart automático
@Get('health')
async health() {
  const dbOk    = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  const redisOk = await this.redis.ping().then(r => r === 'PONG').catch(() => false)

  const status = dbOk && redisOk ? 'ok' : 'degraded'

  return {
    status,
    timestamp: new Date().toISOString(),
    services: { database: dbOk, redis: redisOk },
    version: process.env.npm_package_version,
  }
}
```

### Alertas configuradas

```
Alerta                              Threshold         Canal
──────────────────────────────────────────────────────────────────────
Error 5xx en la API                 > 5 en 5 minutos  Email + Sentry
Health check falla                  2 checks seguidos Railway auto-restart
Uso de DB > 80% del plan            400MB / 500MB     Email (Neon alert)
Job BullMQ en dead letter queue     Cualquiera        Sentry
Tiempo de respuesta API p95 > 1s    Sostenido 5min    Email
Límite Anthropic API al 80%         16/20 informes    Notif. en app
```

---

## 9. SLOs — Objetivos de Nivel de Servicio

Para el MVP con un solo desarrollador, los SLOs son realistas y no aspiracionales.

```
Métrica                                SLO           Medición
──────────────────────────────────────────────────────────────────────
Disponibilidad mensual                 99.5%         Uptime Robot (gratis)
                                       (3.6h caída/mes máx)

Tiempo de respuesta API (p95)          < 800ms       Sentry Performance
  (operaciones CRUD estándar)

Tiempo de carga inicial frontend       < 3s LCP      Vercel Analytics
  (conexión de 4G)

Tiempo de generación informe IA        < 60s         BullMQ job duration
  (p90, sin contar cola de espera)

Tiempo de importación Excel            < 30s         BullMQ job duration
  (hasta 500 filas)

Pérdida de datos (RPO)                 < 7 días      Neon PITR

Tiempo de recuperación (RTO)           < 4 horas     Manual / Railway redeploy
```

Estos SLOs no tienen penalizaciones ni se reportan a clientes en el MVP. Son objetivos internos para priorizar qué monitorizar.

---

## 10. Runbooks de Operaciones

### RB-001 — La API no responde

```
1. Verificar Railway dashboard → ¿el servicio está activo?
   SÍ → ver logs del servicio en Railway
   NO → redeploy manual desde Railway dashboard

2. Verificar health check: curl https://api.medicore.app/v1/health
   { "status": "ok" } → API funciona, problema en frontend
   { "status": "degraded" } → ver qué servicio falla (DB o Redis)
   Timeout / Error → la API está caída

3. Si el problema es la DB:
   Verificar Neon dashboard → estado del proyecto
   Si Neon está caído: esperar (fuera de nuestro control)
   Si la conexión falla: verificar DATABASE_URL en Railway env vars

4. Si el problema es código (deploy roto):
   Railway dashboard → Deployments → hacer rollback al deploy anterior
   Tiempo estimado: 2-3 minutos
```

### RB-002 — Migración de base de datos fallida en producción

```
1. NO ejecutar más migraciones. Detener el pipeline inmediatamente.

2. Identificar en qué punto falló:
   pnpm --filter api prisma migrate status (contra prod DB)

3. Evaluar el impacto:
   ¿La aplicación sigue funcionando con el estado actual de la DB?
   SÍ → tiempo para planificar el fix
   NO → modo mantenimiento inmediato (ver RB-004)

4. Escribir el SQL de corrección manualmente
   Testear en staging primero
   Aplicar en producción

5. Post-mortem: ¿por qué la migración no fue testeada suficientemente en staging?
```

### RB-003 — Brecha de seguridad detectada

```
Ver 07-security-compliance.md sección 9 — proceso completo de respuesta.

Acciones inmediatas (primeras 2 horas):
1. Revocar todos los tokens comprometidos en Railway env vars (rotar JWT_SECRET)
   → Esto invalida TODAS las sesiones activas (los usuarios tendrán que volver a entrar)
2. Revocar credenciales OAuth en Google/Microsoft console si están comprometidas
3. Cambiar contraseñas de base de datos en Neon
4. Notificar a las organizaciones afectadas

No escalar antes de evaluar: muchas "brechas" son falsos positivos.
```

### RB-004 — Activar modo mantenimiento

```bash
# En Vercel: redirigir todo el tráfico a una página de mantenimiento
# Crear apps/web/app/maintenance.tsx y configurar middleware

# Opción rápida: Variable de entorno en Vercel
# MAINTENANCE_MODE=true → el middleware redirige todo a /maintenance

# En Railway: reducir el servicio API a 0 instancias si es necesario
# (el health check de Railway detectará el fallo y mostrará error 503)
```

### RB-005 — Límite del free tier de Neon alcanzado

```
Síntoma: Error "project size limit exceeded" en los logs

Acción inmediata:
1. Verificar uso en Neon dashboard
2. Si está al 100% (0.5GB): actualizar a plan Launch ($19/mes) inmediatamente
   → No intentar borrar datos para liberar espacio en producción

Acción preventiva (antes de llegar al límite):
La alerta de Sentry avisa al 80% (400MB)
Tiempo para planificar la actualización del plan
```

---

## 11. Plan de Migración a Infraestructura Propia

El stack MVP (Vercel + Railway + Neon) es correcto hasta los primeros cientos de usuarios. Cuando el negocio esté validado, la migración a infraestructura propia reduce costes y aumenta el control.

### Triggers para migrar

```
Condición                              Acción recomendada
──────────────────────────────────────────────────────────────────────
Neon > 10GB de datos                   Migrar a PostgreSQL en Hetzner
Railway > 100€/mes                     Migrar API a Hetzner VPS
> 100 organizaciones activas           Evaluar Kubernetes en Hetzner
Requisito contractual de data          Migrar a infraestructura 100%
  residency en España                  en España (OVHcloud ES)
```

### Stack objetivo (post-MVP validado)

```
Proveedor:    Hetzner Cloud (Frankfurt, Alemania — EU, RGPD)
Servidores:
  CX31:  4 vCPU, 8GB RAM, 160GB SSD → ~10€/mes (API + Redis)
  CX21:  2 vCPU, 4GB RAM, 80GB SSD  → ~5€/mes  (PostgreSQL)

Herramientas:
  Docker Compose (inicio) → Kubernetes (cuando escale a varios servidores)
  Nginx como reverse proxy
  Certbot para certificados TLS
  pg_basebackup para backups de PostgreSQL
  Restic para backups cifrados a Hetzner Object Storage

Estimación de costes con 500 organizaciones activas:
  Hetzner servidores:  ~30€/mes
  Cloudflare R2:       ~5€/mes (según uso)
  Anthropic API:       variable (~0.015€/informe)
  Total fijo:          ~35€/mes vs ~200€/mes en el stack MVP escalado
```

### La migración no requiere cambios de código

El stack MVP usa PostgreSQL estándar (Neon es PostgreSQL), Redis estándar (Upstash es Redis), y S3-compatible (Cloudflare R2 es S3-compatible). Migrar a Hetzner es cambiar las variables de entorno, no el código.

---

*Este documento es operacional. Se actualiza con cada cambio significativo de infraestructura.*