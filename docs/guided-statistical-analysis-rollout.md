# Guided Statistical Analysis — Rollout & Rollback

## Feature Flag

| Flag | Default | Scope | Purpose |
|------|---------|-------|---------|
| `RESEARCH_GUIDED_ANALYSIS` | **OFF** (opt-in) | API + Web | Two-path guided wizard (descriptive + inferential) |

## Enabling

### API (server-side)
```bash
# .env or environment
RESEARCH_GUIDED_ANALYSIS=true
```

### Web (client-side)
```bash
# .env.local or environment
NEXT_PUBLIC_RESEARCH_GUIDED_ANALYSIS=true
```

Both must be enabled for the wizard to be accessible. The API flag gates the
endpoint; the client flag gates the UI route.

## Rollout Strategy

1. **Development**: Enable both flags. Test locally with `pnpm dev`.
2. **Staging**: Enable both flags. Run E2E tests with `E2E_GUIDED_ANALYSIS=1`.
3. **Production**: Enable API flag first, then client flag. Monitor error rates.

## Rollback

Disable the flags independently:

- **Client-only rollback**: Set `NEXT_PUBLIC_RESEARCH_GUIDED_ANALYSIS=false`
  (or unset). Users see "Feature not available" message. API remains available.
- **Full rollback**: Set `RESEARCH_GUIDED_ANALYSIS=false` on the API. The
  endpoint returns 403. Existing `GuidedAnalysisRun` records remain in the DB.

No data migration is required for rollback — the `guided_analysis_runs` table
is additive and does not affect existing research queries or analyses.

## Database Migration

The `GuidedAnalysisRun` model adds one table: `guided_analysis_runs`.

```
Migration: 20260914100000_add_guided_analysis_runs
Table:     guided_analysis_runs
Columns:   id, organization_id, created_by, query_id, path, request (JSONB),
           cohort_context (JSONB), result (JSONB), createdAt, updatedAt
Indexes:   (organization_id, createdAt), (organization_id, created_by), (query_id)
```

**No patient identifiers are stored.** The `cohort_context` contains only
`queryId`, `n`, and `filters`. The `result` contains summaries, test results,
rationale, corrections, and warnings — no NHC, patientId, or raw rows.

## Open Questions (resolved at rollout)

| Question | Resolution |
|----------|-----------|
| Canonical source fields for diagnosis/treatment/surgery/procedure | `diagnoses`, `treatments`, `surgeries`, `procedures` in patient JSONB |
| Run retention policy | Follows existing research retention (no separate policy needed) |

## Monitoring

- **Error rate**: `/research/guided/analyses` 4xx/5xx rate
- **Python service**: Circuit breaker trips on `relative-risk` and `p-adjust`
- **Export**: PDF generation failures logged via `GuidedPdfGenerator`

## Affected Files

| Area | Files |
|------|-------|
| Contracts | `packages/contracts/src/research.schema.ts`, `src/index.ts` |
| Python | `apps/stats-service/app/services/stats.py`, `app/schemas.py`, `app/routers/guided.py` |
| API | `apps/api/src/application/research/services/guided-analysis.service.ts`, `test-selection.policy.ts`, `exposure-domain.resolver.ts` |
| API Controller | `apps/api/src/api/research/guided-analysis.controller.ts` |
| API Module | `apps/api/src/api/research/research.module.ts` |
| API Feature Flag | `apps/api/src/infrastructure/config/feature-flags.service.ts` |
| Prisma | `apps/api/prisma/schema.prisma` + migration |
| Exports | `apps/api/src/application/research/export/guided-text.generator.ts`, `guided-pdf.generator.ts`, `export-v3.handler.ts` |
| Web Feature | `apps/web/src/features/guided-analysis/*` |
| Web Page | `apps/web/app/(dashboard)/research/[queryId]/guided/page.tsx` |
| Web Feature Flag | `apps/web/src/config/client-feature-flags.ts` |
| E2E | `apps/web/e2e/guided-analysis.spec.ts` |
