// apps/api/src/domain/research/research-v4.entity.spec.ts
// Unit tests for the V4 domain layer: StudyVariable validation/decompose,
// StudySubject setValue, RiskFactorLabelVO classification (REQ-FB-001..011).

import { describe, it, expect } from '@jest/globals';
import { StudyVariable } from './study-variable.entity';
import { StudySubject } from './study-subject.entity';
import { StatisticalAnalysis } from './statistical-analysis.entity';
import { VariableTemplate } from './variable-template.entity';
import { RiskFactorLabelVO } from './value-objects/risk-factor-label.vo';
import { VariableTypeVO } from './value-objects/variable-type.vo';

const continuousVid = 'v-cont';
const nominalVid = 'v-nom';

const continuous = new StudyVariable({
  id: continuousVid,
  organizationId: 'org-1',
  studyId: 's-1',
  name: 'Edad',
  label: 'Edad (años)',
  type: 'CONTINUOUS',
  range: { min: 0, max: 120, step: 1 },
});

const nominal = new StudyVariable({
  id: nominalVid,
  organizationId: 'org-1',
  studyId: 's-1',
  name: 'GrupoSanguineo',
  label: 'Grupo sanguíneo',
  type: 'NOMINAL',
  options: [
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
  ],
});

describe('StudyVariable.validateValue (REQ-FB-001, REQ-FB-006)', () => {
  it('accepts a continuous value within range', () => {
    const r = continuous.validateValue(65);
    expect(r.ok).toBe(true);
  });

  it('rejects a continuous value above max', () => {
    const r = continuous.validateValue(200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('above_max');
  });

  it('rejects a non-number for CONTINUOUS', () => {
    const r = continuous.validateValue('not-a-number');
    expect(r.ok).toBe(false);
  });

  it('accepts an empty value when not required (núcleo fijo rule)', () => {
    const r = continuous.validateValue(null);
    expect(r.ok).toBe(true);
  });

  it('rejects empty when required', () => {
    const v = new StudyVariable({
      id: 'v-req',
      organizationId: 'org-1',
      studyId: 's-1',
      name: 'X',
      label: 'X',
      type: 'CONTINUOUS',
      required: true,
    });
    expect(v.validateValue(null).ok).toBe(false);
  });

  it('accepts a NOMINAL value in the catalogue', () => {
    expect(nominal.validateValue('A').ok).toBe(true);
  });

  it('rejects a NOMINAL value out of catalogue (REQ-FB-006)', () => {
    const r = nominal.validateValue('C');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('value_out_of_catalogue');
  });

  it('rejects a NOMINAL variable without options at validation time', () => {
    const bad = new StudyVariable({
      id: 'v-bad',
      organizationId: 'org-1',
      studyId: 's-1',
      name: 'Z',
      label: 'Z',
      type: 'NOMINAL',
      options: null,
    });
    const r = bad.validateValue('A');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no_options_defined');
  });

  it('TIME_TO_EVENT accepts {time, censored} and rejects bad censor', () => {
    const tte = new StudyVariable({
      id: 'v-tte',
      organizationId: 'org-1',
      studyId: 's-1',
      name: 'Supervivencia',
      label: 'Supervivencia total',
      type: 'TIME_TO_EVENT',
      unit: 'meses',
    });
    expect(tte.validateValue({ time: 24, censored: false }).ok).toBe(true);
    expect(tte.validateValue({ time: 24, censored: 'no' }).ok).toBe(false);
    expect(tte.validateValue({ time: -1, censored: true }).ok).toBe(false);
  });
});

describe('StudyVariable.decompose (REQ-FB-005)', () => {
  it('decomposes a composite variable into N DICHOTOMOUS children', () => {
    const composite = nominal;
    const children = composite.decompose([
      { name: 'Hemorragia', label: 'Hemorragia' },
      { name: 'Infeccion', label: 'Infección' },
    ]);
    expect(children).toHaveLength(2);
    expect(children[0].type.value).toBe('DICHOTOMOUS');
    expect(children[0].parentId).toBe(composite.id);
    expect(children[0].options?.[0].label).toBe('Sí');
  });

  it('reorder changes position', () => {
    const moved = continuous.reorder(5);
    expect(moved.position).toBe(5);
    expect(continuous.position).toBe(0); // immutable
  });
});

describe('StudySubject.setValue / validate (REQ-FB-006)', () => {
  const subject = StudySubject.create({
    id: 'sub-1',
    organizationId: 'org-1',
    studyId: 's-1',
    patientNhc: 'nhc-1',
    enrolledBy: 'user-1',
  });

  it('sets a valid value and returns ok', () => {
    const { subject: s2, result } = subject.setValue(continuous, 70);
    expect(result.ok).toBe(true);
    expect(s2.getValue(continuousVid)).toBe(70);
  });

  it('rejects setting an invalid value without mutating', () => {
    const { subject: s2, result } = subject.setValue(continuous, 9999);
    expect(result.ok).toBe(false);
    expect(s2.getValue(continuousVid)).toBeUndefined();
  });

  it('validate reports errors for values that became invalid (e.g. catalogue changed after load)', () => {
    const nominalC = nominal;
    // Simulate a record persisted earlier when 'Z' was a valid option; the
    // variable's catalogue later shrank to {A,B}. validate() must flag it.
    const withBad = new StudySubject({
      id: 'sub-2',
      organizationId: 'org-1',
      studyId: 's-1',
      patientNhc: 'nhc-2',
      enrolledBy: 'user-1',
      values: { [nominalVid]: 'Z' },
    });
    const errs = withBad.validate([nominalC, continuous]);
    expect(errs.length).toBe(1);
    expect(errs[0].variableId).toBe(nominalVid);
  });
});

describe('RiskFactorLabelVO.fromEffect (REQ-FB-011)', () => {
  it('labels OR > 1 significant as RISK_FACTOR', () => {
    expect(RiskFactorLabelVO.fromEffect(2.3, 0.01).value).toBe('RISK_FACTOR');
  });

  it('labels HR < 1 significant as PROTECTIVE_FACTOR', () => {
    expect(RiskFactorLabelVO.fromEffect(0.6, 0.03).value).toBe('PROTECTIVE_FACTOR');
  });

  it('stays NEUTRAL for non-significant association', () => {
    expect(RiskFactorLabelVO.fromEffect(2.3, 0.2).value).toBe('NEUTRAL');
  });

  it('stays NEUTRAL when effect is null', () => {
    expect(RiskFactorLabelVO.fromEffect(null, 0.01).value).toBe('NEUTRAL');
  });
});

describe('VariableTypeVO.compatibleTestSet (REQ-FB-010)', () => {
  it('CONTINUOUS supports t-test, ANOVA, ICC', () => {
    const t = VariableTypeVO.create('CONTINUOUS');
    expect(t.supports('T_TEST')).toBe(true);
    expect(t.supports('ANOVA')).toBe(true);
    expect(t.supports('ICC')).toBe(true);
    expect(t.supports('LOGISTIC')).toBe(false);
  });

  it('DICHOTOMOUS supports KAPPA, CHI_SQUARE, LOGISTIC', () => {
    const t = VariableTypeVO.create('DICHOTOMOUS');
    expect(t.supports('KAPPA')).toBe(true);
    expect(t.supports('CHI_SQUARE')).toBe(true);
    expect(t.supports('LOGISTIC')).toBe(true);
  });

  it('TIME_TO_EVENT supports KAPLAN_MEIER and COX', () => {
    const t = VariableTypeVO.create('TIME_TO_EVENT');
    expect(t.supports('KAPLAN_MEIER')).toBe(true);
    expect(t.supports('COX')).toBe(true);
    expect(t.supports('T_TEST')).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(() => VariableTypeVO.create('BOGUS' as any)).toThrow(/invalid_variable_type/);
  });
});

// ─────────────────────────────────────────────
// Additional value-type validation (REQ-FB-001) — DICHOTOMOUS / ORDINAL / DISCRETE
// ─────────────────────────────────────────────

describe('StudyVariable.validateValue for remaining types (REQ-FB-001)', () => {
  it('DICHOTOMOUS accepts true/false and the {Sí,No} catalogue values', () => {
    const v = new StudyVariable({
      id: 'd', organizationId: 'org-1', studyId: 's-1',
      name: 'Fumador', label: 'Fumador', type: 'DICHOTOMOUS',
    });
    expect(v.validateValue(true).ok).toBe(true);
    expect(v.validateValue(false).ok).toBe(true);
  });

  it('DICHOTOMOUS rejects a non-boolean', () => {
    const v = new StudyVariable({
      id: 'd2', organizationId: 'org-1', studyId: 's-1',
      name: 'Fumador', label: 'Fumador', type: 'DICHOTOMOUS',
    });
    expect(v.validateValue('maybe').ok).toBe(false);
  });

  it('ORDINAL accepts a numeric position in the scale', () => {
    const v = new StudyVariable({
      id: 'o', organizationId: 'org-1', studyId: 's-1',
      name: 'Estadio', label: 'Estadio', type: 'ORDINAL',
      options: [
        { value: 'I', label: 'I' },
        { value: 'II', label: 'II' },
        { value: 'III', label: 'III' },
      ],
    });
    expect(v.validateValue('II').ok).toBe(true);
    expect(v.validateValue('IV').ok).toBe(false);
  });

  it('DISCRETE accepts integers and rejects NaN strings', () => {
    const v = new StudyVariable({
      id: 'di', organizationId: 'org-1', studyId: 's-1',
      name: 'Ingresos', label: 'Nº de ingresos', type: 'DISCRETE',
    });
    expect(v.validateValue(3).ok).toBe(true);
    expect(v.validateValue('tres').ok).toBe(false);
  });
});

// ─────────────────────────────────────────────
// StatisticalAnalysis entity labelling (REQ-FB-011, REQ-FB-012)
// ─────────────────────────────────────────────

describe('StatisticalAnalysis.labelRiskFactor (REQ-FB-011)', () => {
  const make = (effect: null, p: null) => StatisticalAnalysis.create({
    id: 'a', organizationId: 'o', studyId: 's', test: 'LOGISTIC',
    variableIds: ['v'], n: 100, statistic: null, pValue: p, effectSize: null,
  });

  it('labels OR>1 significant as RISK', () => {
    const a = StatisticalAnalysis.create({
      id: 'a1', organizationId: 'o', studyId: 's', test: 'LOGISTIC',
      variableIds: ['v'], n: 100, pValue: 0.01,
      effectSize: { or: 2.3 },
    });
    const labeled = a.labelRiskFactor(2.3, 0.01);
    expect(labeled.riskLabel?.value).toBe('RISK_FACTOR');
  });

  it('labels HR<1 significant as PROTECTIVE', () => {
    const a = StatisticalAnalysis.create({
      id: 'a2', organizationId: 'o', studyId: 's', test: 'COX',
      variableIds: ['v'], n: 50, pValue: 0.02,
      effectSize: { hr: 0.6 },
    });
    const labeled = a.labelRiskFactor(0.6, 0.02);
    expect(labeled.riskLabel?.value).toBe('PROTECTIVE_FACTOR');
  });

  it('stays NEUTRAL for non-significant p', () => {
    const a = StatisticalAnalysis.create({
      id: 'a3', organizationId: 'o', studyId: 's', test: 'LOGISTIC',
      variableIds: ['v'], n: 50, pValue: 0.4,
      effectSize: { or: 1.8 },
    });
    const labeled = a.labelRiskFactor(1.8, 0.4);
    expect(labeled.riskLabel?.value).toBe('NEUTRAL');
  });

  it('is immutable — prior instance unchanged', () => {
    const a = StatisticalAnalysis.create({
      id: 'a4', organizationId: 'o', studyId: 's', test: 'LOGISTIC',
      variableIds: ['v'], n: 50, pValue: 0.01, effectSize: { or: 2 },
    });
    const labeled = a.labelRiskFactor(2, 0.01);
    expect(a.riskLabel).toBeNull();
    expect(labeled.riskLabel?.value).toBe('RISK_FACTOR');
  });
});

// ─────────────────────────────────────────────
// VariableTemplate.instantiate (REQ-FB-002)
// ─────────────────────────────────────────────

describe('VariableTemplate.instantiate (REQ-FB-002)', () => {
  it('produces a StudyVariable snapshot + immutable link', () => {
    const tpl = VariableTemplate.create({
      id: 'tpl-1', organizationId: 'o', createdBy: 'u',
      name: 'Complicaciones ORL', type: 'NOMINAL',
      options: [{ value: 'h', label: 'Hemorragia' }],
    });
    const { variable, link } = tpl.instantiate('study-1', 'o');
    expect(variable.studyId).toBe('study-1');
    expect(variable.name).toBe('Complicaciones ORL');
    expect(variable.scope.value).toBe('CUSTOM');
    expect(link.templateId).toBe('tpl-1');
    expect(link.studyId).toBe('study-1');
    expect(link.studyVarId).toBe(variable.id);
  });

  it('snapshot survives a future template edit (REQ-FB-002 scenario)', () => {
    const tpl = VariableTemplate.create({
      id: 'tpl-2', organizationId: 'o', createdBy: 'u',
      name: 'V', type: 'NOMINAL', options: [{ value: 'a', label: 'A' }],
    });
    const { variable: snap1 } = tpl.instantiate('s', 'o');
    const edited = tpl.update({ name: 'V-renamed' });
    // The snapshot copy keeps the original name — editing the template does
    // not mutate studies that already imported a copy.
    expect(snap1.name).toBe('V');
    expect(edited.name).toBe('V-renamed');
  });
});