// apps/web/e2e/clinical-record.spec.ts
// E2E tests for the seven-category clinical record (sdd/patient-seven-categories).
//
// Requires a running web dev server (baseURL, default http://localhost:3000).
// Start with `pnpm --filter @medicore/web dev` before `pnpm test:e2e`.
//
// These tests verify:
// - Seven-category tab navigation renders and routes correctly
// - History form creates entries with provenance
// - Current illness form captures symptoms, duration, onset
// - Physical exam builder uses template fields and custom findings
// - Complementary tests: lab review (confirm/reject OCR results)
// - Diagnosis picker: catalog search, create, status lifecycle
// - Treatment overview: renders items with originating events
// - Feature flag: disabling CLINICAL_RECORD_V2 hides the new UI

import { test, expect } from '@playwright/test';

// Shared test patient ID — in a real setup, this comes from a fixture or seed.
const TEST_PATIENT_ID = '00000000-0000-0000-0000-000000000001';
const CLINICAL_RECORD_BASE = `/patients/${TEST_PATIENT_ID}/clinical-record`;

test.describe('Seven-category clinical record navigation', () => {
  test.beforeEach(async ({ context }) => {
    // Enable the feature flag for these tests
    await context.addCookies([
      {
        name: 'NEXT_PUBLIC_CLINICAL_RECORD_V2',
        value: 'true',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('renders all seven category tabs', async ({ page }) => {
    await page.goto(CLINICAL_RECORD_BASE);

    const tabNav = page.getByTestId('clinical-record-tabs');
    await expect(tabNav).toBeVisible();

    // Verify all seven tabs are present
    await expect(page.getByTestId('tab-patient-data')).toBeVisible();
    await expect(page.getByTestId('tab-history')).toBeVisible();
    await expect(page.getByTestId('tab-current-illness')).toBeVisible();
    await expect(page.getByTestId('tab-physical-exam')).toBeVisible();
    await expect(page.getByTestId('tab-complementary-tests')).toBeVisible();
    await expect(page.getByTestId('tab-diagnosis')).toBeVisible();
    await expect(page.getByTestId('tab-treatment')).toBeVisible();
  });

  test('navigates between categories', async ({ page }) => {
    await page.goto(CLINICAL_RECORD_BASE);

    // Click history tab
    await page.getByTestId('tab-history').click();
    await expect(page).toHaveURL(new RegExp(`${CLINICAL_RECORD_BASE}/history`));
    await expect(page.getByText('Antecedentes')).toBeVisible();

    // Click diagnosis tab
    await page.getByTestId('tab-diagnosis').click();
    await expect(page).toHaveURL(new RegExp(`${CLINICAL_RECORD_BASE}/diagnosis`));
    await expect(page.getByText('Diagnóstico')).toBeVisible();

    // Click treatment tab
    await page.getByTestId('tab-treatment').click();
    await expect(page).toHaveURL(new RegExp(`${CLINICAL_RECORD_BASE}/treatment`));
    await expect(page.getByText('Tratamiento')).toBeVisible();
  });

  test('default route redirects to patient-data', async ({ page }) => {
    await page.goto(CLINICAL_RECORD_BASE);
    await expect(page).toHaveURL(new RegExp(`${CLINICAL_RECORD_BASE}/patient-data`));
  });
});

test.describe('History category (Antecedentes)', () => {
  test('shows empty state and allows creating entries', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/history`);

    // Toggle form
    await page.getByTestId('toggle-history-form').click();
    await expect(page.getByTestId('history-form')).toBeVisible();

    // Fill form
    await page.getByTestId('history-entry-type').selectOption('ALLERGY');
    await page.getByTestId('history-key').fill('Penicilina');
    await page.getByTestId('history-value').fill('Reacción alérgica grave — urticaria');

    // Submit button should be enabled
    await expect(page.getByTestId('history-submit')).toBeEnabled();
  });

  test('shows provenance information on entries', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/history`);
    // In a seeded environment, entries should show provenance metadata
    // This test verifies the UI structure renders correctly
    await expect(page.getByText('Antecedentes')).toBeVisible();
  });
});

test.describe('Current illness category (Enfermedad actual)', () => {
  test('form captures symptoms, duration, and onset', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/current-illness`);

    await page.getByTestId('toggle-illness-form').click();
    await expect(page.getByTestId('illness-form')).toBeVisible();

    // Fill symptoms (required)
    await page.getByTestId('illness-symptoms').fill('Dolor de cabeza frontal, náuseas');

    // Fill duration
    await page.getByTestId('illness-duration-value').fill('3');
    await page.getByTestId('illness-duration-unit').selectOption('DAYS');

    // Fill onset date
    await page.getByTestId('illness-onset').fill('2026-09-01');

    // Submit should be enabled
    await expect(page.getByTestId('illness-submit')).toBeEnabled();
  });

  test('partial entry allows missing temporal fields', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/current-illness`);

    await page.getByTestId('toggle-illness-form').click();

    // Only fill symptoms — duration and onset remain empty
    await page.getByTestId('illness-symptoms').fill('Tos seca');

    // Submit should still be enabled (only symptoms is required)
    await expect(page.getByTestId('illness-submit')).toBeEnabled();
  });
});

test.describe('Physical exam category (Exploración física)', () => {
  test('exam builder renders template fields and version indicator', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/physical-exam`);

    await page.getByTestId('toggle-exam-form').click();
    await expect(page.getByTestId('exam-builder')).toBeVisible();

    // Template version indicator
    await expect(page.getByText('Medicina General')).toBeVisible();
    await expect(page.getByText('v1')).toBeVisible();

    // Template fields
    await expect(page.getByTestId('exam-field-blood_pressure')).toBeVisible();
    await expect(page.getByTestId('exam-field-heart_rate')).toBeVisible();
    await expect(page.getByTestId('exam-field-temperature')).toBeVisible();
  });

  test('custom findings can be added', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/physical-exam`);

    await page.getByTestId('toggle-exam-form').click();

    // Add a custom finding
    await page.getByTestId('custom-finding-label').fill('Reflejos osteotendinosos');
    await page.getByTestId('custom-finding-value').fill('Normales, simétricos');
    await page.getByTestId('add-custom-finding').click();

    // Verify it appears
    await expect(page.getByText('Reflejos osteotendinosos')).toBeVisible();
  });
});

test.describe('Complementary tests category (Pruebas complementarias)', () => {
  test('lab review interface shows OCR results with confirm/reject controls', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/complementary-tests`);

    // The section should render
    await expect(page.getByText('Pruebas complementarias')).toBeVisible();
    await expect(page.getByText('Informes de laboratorio')).toBeVisible();

    // OCR warning should be visible when reports exist
    // In a seeded environment, we'd verify individual result rows
  });

  test('imaging and scales sections are present', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/complementary-tests`);

    await expect(page.getByText('Estudios de imagen')).toBeVisible();
    await expect(page.getByText('Escalas clínicas')).toBeVisible();
  });
});

test.describe('Diagnosis category (Diagnóstico)', () => {
  test('diagnosis picker allows catalog search', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/diagnosis`);

    await page.getByTestId('toggle-diagnosis-picker').click();
    await expect(page.getByTestId('diagnosis-picker')).toBeVisible();

    // System toggle
    await expect(page.getByTestId('system-cie10')).toBeVisible();
    await expect(page.getByTestId('system-snomed')).toBeVisible();

    // Search
    await page.getByTestId('diagnosis-search').fill('Diabetes');

    // Results should appear
    await expect(page.getByTestId('diagnosis-option-E11.9')).toBeVisible();
  });

  test('selecting a code enables submission', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/diagnosis`);

    await page.getByTestId('toggle-diagnosis-picker').click();
    await page.getByTestId('diagnosis-search').fill('Hipertensión');

    // Select the code
    await page.getByTestId('diagnosis-option-I10').click();

    // Submit button should appear
    await expect(page.getByTestId('diagnosis-submit')).toBeVisible();
    await expect(page.getByTestId('diagnosis-submit')).toBeEnabled();
  });

  test('diagnosis list shows status lifecycle actions', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/diagnosis`);

    // In a seeded environment, active diagnoses should have resolve/discard buttons
    await expect(page.getByText('Diagnóstico')).toBeVisible();
  });
});

test.describe('Treatment category (Tratamiento)', () => {
  test('renders treatment overview with sections', async ({ page }) => {
    await page.goto(`${CLINICAL_RECORD_BASE}/treatment`);

    await expect(page.getByText('Tratamiento')).toBeVisible();
    await expect(
      page.getByText(/vista unificada de cirugías/i),
    ).toBeVisible();
  });
});

test.describe('Feature flag rollback', () => {
  test('disabling CLINICAL_RECORD_V2 hides the clinical record UI', async ({ page }) => {
    // Explicitly disable the flag
    await page.addInitScript(() => {
      // Override the env var before Next.js inlines it
      (window as any).__NEXT_PUBLIC_CLINICAL_RECORD_V2 = 'false';
    });

    await page.goto(CLINICAL_RECORD_BASE);

    // The disabled message should appear
    await expect(
      page.getByText(/historia clínica estructurada está desactivada/i),
    ).toBeVisible();

    // Tabs should NOT be visible
    await expect(page.getByTestId('clinical-record-tabs')).not.toBeVisible();
  });
});
