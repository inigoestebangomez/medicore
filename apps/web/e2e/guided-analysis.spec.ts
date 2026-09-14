// apps/web/e2e/guided-analysis.spec.ts
// E2E (Playwright) for the Guided Statistical Analysis wizard (V5).
//
// Feature flag: run with `E2E_GUIDED_ANALYSIS=1` (or set
// NEXT_PUBLIC_RESEARCH_GUIDED_ANALYSIS=1). Skipped by default.
//
// Covers both paths end-to-end:
//   1. Path 1 (descriptive): select variables → run → see summaries
//   2. Path 2 (inferential): configure exposure/outcome → run → see results
//   3. Invalid cohort blocked scenario
//   4. Rationale visible in results
//   5. No raw patient identifiers in the output
//
// Deterministic: API responses are route-mocked — no live backend required.

import { test, expect } from '@playwright/test';

const FLAG_ENABLED = !!process.env.E2E_GUIDED_ANALYSIS || process.env.NEXT_PUBLIC_RESEARCH_GUIDED_ANALYSIS === '1';
const describeGuided = FLAG_ENABLED ? test.describe : test.describe.skip;

const QUERY_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockQuery = {
  id: QUERY_ID,
  name: 'Cohorte de prueba',
  description: 'Cohorte para análisis guiado',
  dataSource: 'all_patients',
  filters: [],
  filterLogic: 'AND',
  displayFields: ['age', 'sex', 'blood_pressure', 'diagnosis'],
  visualizations: ['table', 'stats'],
  lastRunCount: 100,
  sharedWith: [],
};

const mockDescriptiveResult = {
  runId: 'run-1',
  cohort: { queryId: QUERY_ID, n: 100, filters: [] },
  path: 'descriptive',
  summaries: [
    {
      variable: 'age',
      kind: 'quantitative',
      n: 98,
      missing: 2,
      mean: 45.3,
      sd: 12.1,
      median: 44,
      q1: 36,
      q3: 55,
      min: 18,
      max: 85,
      categories: [],
      suppressed: false,
    },
  ],
  results: [],
  rationale: ['Descriptive analysis: summarizes cohort characteristics.'],
  corrections: [],
  warnings: [],
};

const mockInferentialResult = {
  runId: 'run-2',
  cohort: { queryId: QUERY_ID, n: 100, filters: [] },
  path: 'inferential',
  summaries: [],
  results: [
    {
      test: 'ttest_independent',
      statistic: 2.5,
      pValue: 0.015,
      effectMeasures: [
        {
          name: 'relative_risk',
          value: 1.8,
          ci95Lower: 1.1,
          ci95Upper: 2.9,
          suppressed: false,
        },
      ],
      groups: [
        { key: 'Drug A', n: 50 },
        { key: 'Drug B', n: 50 },
      ],
      warnings: [],
    },
  ],
  rationale: [
    'Two independent groups with normally distributed data → Welch t-test.',
  ],
  corrections: [],
  warnings: [],
};

describeGuided('Guided Statistical Analysis E2E', () => {
  test('Path 1: descriptive analysis shows summaries', async ({ page }) => {
    // Mock the query fetch
    await page.route(`**/v1/research/queries/${QUERY_ID}`, (route) =>
      route.fulfill({ json: { data: mockQuery } }),
    );

    // Mock the guided analysis API
    await page.route('**/api/research/guided/analyses', (route) =>
      route.fulfill({ json: { data: mockDescriptiveResult } }),
    );

    await page.goto(`/research/${QUERY_ID}/guided`);

    // Should see the path selector
    await expect(page.locator('text=Ruta 1: Análisis descriptivo')).toBeVisible();
    await expect(page.locator('text=Ruta 2: Análisis inferencial')).toBeVisible();

    // Select Path 1
    await page.click('text=Ruta 1: Análisis descriptivo');

    // Should see variable selection
    await expect(page.locator('text=age')).toBeVisible();
    await expect(page.locator('text=sex')).toBeVisible();

    // Select a variable and run
    await page.click('text=age');
    await page.click('text=Ejecutar análisis');

    // Should see results
    await expect(page.locator('text=Resultados del análisis')).toBeVisible();
    await expect(page.locator('text=age')).toBeVisible();
    await expect(page.locator('text=Cuantitativa')).toBeVisible();
    await expect(page.locator('text=45.3')).toBeVisible();

    // Should see the rationale
    await expect(page.locator('text=Descriptive analysis')).toBeVisible();

    // Should see the p-value disclaimer
    await expect(page.locator('text=convención estadística')).toBeVisible();
  });

  test('Path 2: inferential analysis shows results with rationale', async ({ page }) => {
    await page.route(`**/v1/research/queries/${QUERY_ID}`, (route) =>
      route.fulfill({ json: { data: mockQuery } }),
    );

    await page.route('**/api/research/guided/analyses', (route) =>
      route.fulfill({ json: { data: mockInferentialResult } }),
    );

    await page.goto(`/research/${QUERY_ID}/guided`);

    // Select Path 2
    await page.click('text=Ruta 2: Análisis inferencial');

    // Fill in exposure config
    await page.selectOption('select', { label: 'Tratamiento' });
    await page.fill('input[placeholder*="drug_a"]', 'drug_a, drug_b');
    await page.selectOption('select >> nth=1', 'blood_pressure');

    // Run analysis
    await page.click('text=Ejecutar análisis');

    // Should see results
    await expect(page.locator('text=Resultados del análisis')).toBeVisible();
    await expect(page.locator('text=ttest_independent')).toBeVisible();
    await expect(page.locator('text=0.0150')).toBeVisible();

    // Should see effect measures
    await expect(page.locator('text=relative_risk')).toBeVisible();
    await expect(page.locator('text=1.800')).toBeVisible();

    // Should see rationale
    await expect(page.locator('text=Welch t-test')).toBeVisible();
  });

  test('Invalid cohort shows blocked state', async ({ page }) => {
    const emptyQuery = { ...mockQuery, lastRunCount: 0 };

    await page.route(`**/v1/research/queries/${QUERY_ID}`, (route) =>
      route.fulfill({ json: { data: emptyQuery } }),
    );

    await page.goto(`/research/${QUERY_ID}/guided`);

    // Should see the blocked state
    await expect(page.locator('text=Cohorte vacía')).toBeVisible();
    await expect(page.locator('text=No se puede realizar')).toBeVisible();
  });

  test('No raw patient identifiers in output', async ({ page }) => {
    await page.route(`**/v1/research/queries/${QUERY_ID}`, (route) =>
      route.fulfill({ json: { data: mockQuery } }),
    );

    await page.route('**/api/research/guided/analyses', (route) =>
      route.fulfill({ json: { data: mockDescriptiveResult } }),
    );

    await page.goto(`/research/${QUERY_ID}/guided`);
    await page.click('text=Ruta 1: Análisis descriptivo');
    await page.click('text=age');
    await page.click('text=Ejecutar análisis');

    // Wait for results
    await expect(page.locator('text=Resultados del análisis')).toBeVisible();

    // Check that no patient identifiers (NHC, patientId) are visible
    const content = await page.textContent('body');
    expect(content).not.toMatch(/nhc-/i);
    expect(content).not.toMatch(/patient-?\d+/i);
    expect(content).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN-like pattern
  });
});
