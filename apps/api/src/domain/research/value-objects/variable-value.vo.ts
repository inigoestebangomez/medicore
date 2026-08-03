// apps/api/src/domain/research/value-objects/variable-value.vo.ts
// Value object: VariableValue — discriminated union by variable type.
// Encapsulates per-type validation and rejects out-of-catalogue / out-of-range
// values (REQ-FB-001 scenario "rechazo de variable nominal sin opciones",
// REQ-FB-006 scenario "valor fuera de catálogo").

export interface VariableOptionDef {
  value: string;
  label: string;
}

export interface VariableRangeDef {
  min?: number;
  max?: number;
  step?: number;
}

export type VariableValueVariant =
  | { kind: 'CONTINUOUS'; value: number }
  | { kind: 'DISCRETE'; value: number }
  | { kind: 'DICHOTOMOUS'; value: boolean }
  | { kind: 'NOMINAL'; value: string }
  | { kind: 'ORDINAL'; value: string }
  | { kind: 'TIME_TO_EVENT'; value: { time: number; censored: boolean } };

export type ValidationOk = { ok: true; value: VariableValueVariant };
export type ValidationErr = { ok: false; error: string };
export type ValidationResult = ValidationOk | ValidationErr;

/**
 * Validate a raw input against a variable type and its metadata.
 * Pure function — no side effects, safe to call from entities and handlers.
 */
export function validateVariableValue(input: {
  type: string;
  raw: unknown;
  options?: VariableOptionDef[] | null;
  range?: VariableRangeDef | null;
  required?: boolean;
}): ValidationResult {
  const { type, raw, options, range, required } = input;

  // Empty values: allowed when not required (doc 07 §2.2 — núcleo fijo never
  // blocks save; the variable is just excluded from analysis for that record).
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { ok: false, error: 'value_required' };
    return { ok: true, value: { kind: type as any, value: null as any } as VariableValueVariant };
  }

  switch (type) {
    case 'CONTINUOUS': {
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        // coerce numeric strings
        const n = typeof raw === 'string' ? Number(raw) : NaN;
        if (Number.isNaN(n)) return { ok: false, error: 'expected_number' };
        return rangeOk('CONTINUOUS', n, range);
      }
      return rangeOk('CONTINUOUS', raw, range);
    }
    case 'DISCRETE': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(n) || !Number.isInteger(n)) {
        return { ok: false, error: 'expected_integer' };
      }
      return rangeOk('DISCRETE', n, range);
    }
    case 'DICHOTOMOUS': {
      // Accept boolean, 0/1, "Sí"/"No", or option values.
      const v = normalizeBool(raw, options ?? undefined);
      if (v === null) return { ok: false, error: 'expected_boolean_or_option' };
      return { ok: true, value: { kind: 'DICHOTOMOUS', value: v } };
    }
    case 'NOMINAL':
    case 'ORDINAL': {
      if (typeof raw !== 'string') return { ok: false, error: 'expected_string' };
      // Catalogue check — REQ-FB-006 "valor fuera de catálogo".
      if (!options || options.length === 0) {
        return { ok: false, error: 'no_options_defined' };
      }
      const match = options.some((o) => o.value === raw);
      if (!match) return { ok: false, error: 'value_out_of_catalogue' };
      return { ok: true, value: { kind: type, value: raw } };
    }
    case 'TIME_TO_EVENT': {
      if (typeof raw !== 'object' || raw === null) {
        return { ok: false, error: 'expected_time_to_event_object' };
      }
      const t = (raw as any).time;
      const censored = (raw as any).censored;
      const time = typeof t === 'number' ? t : Number(t);
      if (Number.isNaN(time) || time < 0) {
        return { ok: false, error: 'expected_non_negative_time' };
      }
      if (typeof censored !== 'boolean') {
        return { ok: false, error: 'expected_censored_boolean' };
      }
      return { ok: true, value: { kind: 'TIME_TO_EVENT', value: { time, censored } } };
    }
    default:
      return { ok: false, error: `unknown_type: ${type}` };
  }
}

function rangeOk(kind: 'CONTINUOUS' | 'DISCRETE', n: number, range?: VariableRangeDef | null): ValidationResult {
  if (range) {
    if (range.min !== undefined && n < range.min) return { ok: false, error: 'below_min' };
    if (range.max !== undefined && n > range.max) return { ok: false, error: 'above_max' };
  }
  return { ok: true, value: { kind, value: n } };
}

function normalizeBool(raw: unknown, options?: VariableOptionDef[]): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (raw === 0 || raw === '0') return false;
  if (raw === 1 || raw === '1') return true;
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower === 'true' || lower === 'sí' || lower === 'si' || lower === 'yes')
      return options ? options.some((o) => o.value === raw) || true : true;
    if (lower === 'false' || lower === 'no') return false;
  }
  // Match against provided option values (first true, second false by convention).
  if (options && typeof raw === 'string') {
    if (options[0]?.value === raw) return true;
    if (options[1]?.value === raw) return false;
  }
  return null;
}

/**
 * AutoFillMap — Record<variableId, EhrFieldPath>. Whitelist of allowed EHR
 * field paths (REQ-FB-009). Unknown paths are rejected at the boundary.
 */
const ALLOWED_EHR_PATHS = new Set([
  'patient.firstName',
  'patient.lastName',
  'patient.birthDate',
  'patient.sex',
  'patient.nhc',
  'patient.allergies',
  'patient.notes',
  'patient.importedData',
  'patient.age',
  'allergies',
  'medications',
  'consultations',
  'surgeries',
  'imagingStudies',
]);

export function isValidEhrPath(path: string): boolean {
  if (ALLOWED_EHR_PATHS.has(path)) return true;
  // Allow indexed access like patient.allergies[0].substance
  const base = path.replace(/\[\d+\].*$/, '');
  return ALLOWED_EHR_PATHS.has(base);
}

export type AutoFillMap = Record<string, string>;

export function validateAutoFillMap(map: Record<string, string>): { ok: true } | { ok: false; invalid: string[] } {
  const invalid: string[] = [];
  for (const [varId, path] of Object.entries(map)) {
    if (!isValidEhrPath(path)) invalid.push(varId);
  }
  return invalid.length === 0 ? { ok: true } : { ok: false, invalid };
}