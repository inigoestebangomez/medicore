// apps/api/src/application/research/research-form.clinical-cases.spec.ts
// E2E scenario tests (6.3) for the three doc-07 §2.4 clinical cases. The
// full HTTP/DB/Python stack has no supertest harness in this repo, so these
// exercise the same slice at the domain+application boundary using in-memory
// repo doubles + a stubbed PythonStatsService. They prove the builder is
// genuinely flexible (not a closed per-pathology form): different variable
// combinations per case, composite decomposition, multi-type enrollment,
// a valid registration-form FormTemplate per case, plus a representative
// traced analysis per case.
//
//   Case 1 — Cirugía robótica ORL     (Chi² on a complication child)
//   Case 2 — Tumores de orofaringe    (Kaplan-Meier on supervivencia)
//   Case 3 — Vértigo ORL              (descriptivo form + Spearman correlation)

import { describe, it, expect } from '@jest/globals';
import { StudyVariable } from '@/domain/research/study-variable.entity';
import { StudySubject } from '@/domain/research/study-subject.entity';
import { StatisticalAnalysis } from '@/domain/research/statistical-analysis.entity';
import { FormTemplateSchema } from '@medicore/contracts';
import { variableFormMapper as apiMapper } from './services/variable-form-mapper';
import { RunAnalysisHandler } from './commands/analysis.handler';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';
import type { IStudySubjectRepository } from '@/domain/research/ports/study-subject.repository.interface';
import type { IStatisticalAnalysisRepository } from '@/domain/research/ports/statistical-analysis.repository.interface';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import type { ResearchStudy } from '@/domain/research/research-study.entity';
import type { Paginated } from '@/domain/research/ports/research-study.repository.interface';

// ── in-memory doubles (shared) ──────────────────────────────────────────
class MemVars implements IStudyVariableRepository {
  store = new Map<string, StudyVariable>();
  create(v: StudyVariable) { this.store.set(v.id, v); return Promise.resolve(v); }
  createMany(vs: StudyVariable[]) { vs.forEach((v) => this.store.set(v.id, v)); return Promise.resolve(vs); }
  async findById(id: string, o: string) { const v = this.store.get(id); return v && v.organizationId === o ? v : null; }
  async findByStudy(s: string, o: string) { return Array.from(this.store.values()).filter((v) => v.studyId === s && v.organizationId === o); }
  update(v: StudyVariable) { this.store.set(v.id, v); return Promise.resolve(v); }
  async delete() {} async reorder() {}
}
class MemSubjects implements IStudySubjectRepository {
  store = new Map<string, StudySubject>();
  create(s: StudySubject) { this.store.set(s.id, s); return Promise.resolve(s); }
  async findById(i: string, o: string) { const s = this.store.get(i); return s && s.organizationId === o ? s : null; }
  async findByStudy(s: string, o: string, opts?: { page?: number; pageSize?: number }): Promise<Paginated<StudySubject>> {
    const items = Array.from(this.store.values()).filter((x) => x.studyId === s && x.organizationId === o);
    return { items, total: items.length, page: opts?.page ?? 1, pageSize: opts?.pageSize ?? 50 };
  }
  update(s: StudySubject) { this.store.set(s.id, s); return Promise.resolve(s); }
  async delete() {}
}
class MemAnalyses implements IStatisticalAnalysisRepository {
  store = new Map<string, StatisticalAnalysis>();
  create(a: StatisticalAnalysis) { this.store.set(a.id, a); return Promise.resolve(a); }
  async findByStudy() { return []; } async findById() { return null; }
}
const studyRepo = (): IResearchStudyRepository => ({
  async findById() { return { id: 's', organizationId: 'o', studyType: 'FORM' } as unknown as ResearchStudy; },
  create: async () => { throw new Error('noop'); },
  findByOrgPaged: async () => ({ items: [], total: 0, page: 1, pageSize: 50 }),
  update: async (s: ResearchStudy) => s,
  findActiveWithStaleCache: async () => [],
  softDelete: async () => {},
});

const stubInferential = (mapped: () => unknown) =>
  ({ runInferential: async () => mapped() } as any);

// ── helpers ─────────────────────────────────────────────────────────────
const mk = (id: string, name: string, label: string, type: any, extra: any = {}) =>
  StudyVariable.create({ id, organizationId: 'o', studyId: 's', name, label, type, ...extra });

const enroll = (id: string, values: Record<string, unknown>) =>
  StudySubject.create({ id, organizationId: 'o', studyId: 's', patientNhc: id, enrolledBy: 'u', values });

const assertRegistrationForm = (label: string, vars: StudyVariable[]) => {
  // The API mapper operates on StudyVariable entities (reads `v.type.value`).
  const t = apiMapper('s', label, vars);
  expect(FormTemplateSchema.safeParse(t).success).toBe(true);
  return t;
};

// ─────────────────────────────────────────────
// Doc-07 §2.4 cases
// ─────────────────────────────────────────────

describe('Doc-07 §2.4 clinical cases (6.3)', () => {
  it('Case 1 — Cirugía robótica ORL: define vars, decompose Complicaciones, run Chi²', async () => {
    const vars = new MemVars();
    const patologia = mk('v-pat', 'patologia', 'Patología actual', 'NOMINAL', { options: [{ value: 't1', label: 'T1' }, { value: 't2', label: 'T2' }] });
    const intervencion = mk('v-int', 'intervencion', 'Intervención', 'DICHOTOMOUS');
    const respuesta = mk('v-res', 'respuesta', 'Respuesta', 'ORDINAL', { options: [{ value: '0', label: 'Mala' }, { value: '1', label: 'Buena' }] });
    const complicaciones = mk('v-cmp', 'complicaciones', 'Complicaciones', 'NOMINAL', { options: [{ value: 'h', label: 'Hemorragia' }] });
    const dias = mk('v-dias', 'dias', 'Días de hospitalización', 'CONTINUOUS', { range: { min: 0, max: 60, step: 1 } });
    vars.store.set(patologia.id, patologia);
    vars.store.set(intervencion.id, intervencion);
    vars.store.set(respuesta.id, respuesta);
    vars.store.set(complicaciones.id, complicaciones);
    vars.store.set(dias.id, dias);
    // Decompose Complicaciones into two dichotomous children.
    const children = complicaciones.decompose([
      { name: 'hemorragia', label: 'Hemorragia' },
      { name: 'infeccion', label: 'Infección' },
    ]);
    expect(children.every((c) => c.type.value === 'DICHOTOMOUS' && c.parentId === 'v-cmp')).toBe(true);
    children.forEach((c) => vars.store.set(c.id, c));

    // Enroll a few subjects.
    const subjects = new MemSubjects();
    subjects.store.set('p1', enroll('p1', { 'v-int': true, 'v-dias': 4, [children[0].id]: false }));
    subjects.store.set('p2', enroll('p2', { 'v-int': false, 'v-dias': 7, [children[0].id]: true }));
    subjects.store.set('p3', enroll('p3', { 'v-int': true, 'v-dias': 3, [children[0].id]: true }));

    // Registration form validates for this case.
    const form = assertRegistrationForm('Cirugía robótica ORL', Array.from(vars.store.values()));
    expect(form.fields.length).toBeGreaterThanOrEqual(5);

    // Chi² comparing the hemorragia child (dichotomous) — DICHOTOMOUS supports CHI_SQUARE.
    const analyses = new MemAnalyses();
    const stats = stubInferential(() => ({
      test: 'chi_square', statistic: 3.2, pValue: 0.07, ci95Lower: null, ci95Upper: null,
      effectSize: null, degreesFreedom: 1, warnings: [],
    }));
    const h = new RunAnalysisHandler(analyses, subjects, vars, studyRepo(), stats as any);
    const a = await h.execute({
      organizationId: 'o', studyId: 's',
      input: { test: 'CHI_SQUARE', variableIds: [children[0].id, 'v-int'], params: {} } as any,
    });
    expect(a.test).toBe('CHI_SQUARE');
    expect(a.n).toBeGreaterThan(0);
    expect(analyses.store.size).toBe(1);
  });

  it('Case 2 — Tumores de orofaringe: TIME_TO_EVENT supervivencia + Kaplan-Meier trace', async () => {
    const vars = new MemVars();
    const tratamiento = mk('v-trat', 'tratamiento', 'Tratamiento', 'DICHOTOMOUS');
    const supervivencia = mk('v-sup', 'supervivencia', 'Supervivencia total', 'TIME_TO_EVENT', { unit: 'meses' });
    const supervLibre = mk('v-sup-libre', 'supervivencia_libre', 'Supervivencia libre enfermedad', 'TIME_TO_EVENT', { unit: 'meses' });
    vars.store.set(tratamiento.id, tratamiento);
    vars.store.set(supervivencia.id, supervivencia);
    vars.store.set(supervLibre.id, supervLibre);

    const subjects = new MemSubjects();
    subjects.store.set('p1', enroll('p1', { 'v-sup': { time: 24, censored: false } }));
    subjects.store.set('p2', enroll('p2', { 'v-sup': { time: 36, censored: true } }));
    subjects.store.set('p3', enroll('p3', { 'v-sup': { time: 18, censored: false } }));

    // Registration form renders the two-field TIME_TO_EVENT controls per variable.
    const form = assertRegistrationForm('Tumores de orofaringe', Array.from(vars.store.values()));
    expect(form.fields.filter((f) => f.type === 'number').length).toBeGreaterThanOrEqual(2); // time inputs

    const analyses = new MemAnalyses();
    const stats = stubInferential(() => ({
      test: 'kaplan_meier', statistic: 26, pValue: 0.04, ci95Lower: null, ci95Upper: null,
      effectSize: { name: 'median_survival', value: 24, ci95Lower: null, ci95Upper: null },
      degreesFreedom: null, warnings: [],
    }));
    const h = new RunAnalysisHandler(analyses, subjects, vars, studyRepo(), stats as any);
    // TIME_TO_EVENT supports KAPLAN_MEIER.
    const a = await h.execute({
      organizationId: 'o', studyId: 's',
      input: { test: 'KAPLAN_MEIER', variableIds: ['v-sup'], params: {} } as any,
    });
    expect(a.test).toBe('KAPLAN_MEIER');
    expect(a.pValue).toBeCloseTo(0.04, 2);
    // Kaplan-Meier effect is median_survival (not OR/HR) → no risk label.
    expect(a.riskLabel).toBeNull();
  });

  it('Case 3 — Vértigo ORL: flexible multi-type set + Spearman correlation', async () => {
    const vars = new MemVars();
    const patologia = mk('v-p', 'patologia', 'Patología actual', 'NOMINAL', { options: [{ value: 'bppv', label: 'BPPV' }] });
    const tratamiento = mk('v-t', 'tratamiento', 'Tratamiento', 'DICHOTOMOUS');
    const vhit = mk('v-vhit', 'vhit', 'VHIT', 'CONTINUOUS', { unit: 'ratio', range: { min: 0, max: 1.5, step: 0.01 } });
    const audiometria = mk('v-aud', 'audiometria', 'Audiometría tonal liminal', 'CONTINUOUS', { unit: 'dB' });
    const vemp = mk('v-vemp', 'vemp', 'VEMPs', 'ORDINAL', { options: [{ value: '0', label: 'Ausente' }, { value: '1', label: 'Presente' }] });
    const caloricas = mk('v-cal', 'caloricas', 'Pruebas calóricas', 'DISCRETE');
    const hospitalizaciones = mk('v-hosp', 'hospitalizaciones', 'Nº de hospitalizaciones', 'DISCRETE');
    const visitas = mk('v-vis', 'visitas', 'Nº de visitas a urgencias', 'DISCRETE');
    const respuesta = mk('v-resp', 'respuesta', 'Respuesta a tratamiento', 'DICHOTOMOUS');
    const clinica = mk('v-cli', 'clinica', 'Clínica del episodio', 'NOMINAL', { options: [{ value: 'x', label: 'x' }] });
    [patologia, tratamiento, vhit, audiometria, vemp, caloricas, hospitalizaciones, visitas, respuesta, clinica].forEach((v) => vars.store.set(v.id, v));
    // Clínica decomposes into dichotomous daughters (doc-07 §2.3.1 pattern).
    const clinicaChildren = clinica.decompose([
      { name: 'vertigo_posicional', label: 'Vértigo posicional' },
      { name: 'acufeno', label: 'Acúfeno' },
      { name: 'inestabilidad', label: 'Inestabilidad' },
    ]);
    expect(clinicaChildren).toHaveLength(3);
    expect(clinicaChildren.every((c) => c.type.value === 'DICHOTOMOUS')).toBe(true);

    // Registration form for the full flexible set validates.
    const form = assertRegistrationForm('Vértigo ORL', Array.from(vars.store.values()));
    expect(form.fields.length).toBeGreaterThanOrEqual(10); // proves not a closed form

    const subjects = new MemSubjects();
    subjects.store.set('p1', enroll('p1', { 'v-vhit': 0.9, 'v-aud': 25, 'v-hosp': 1, 'v-vis': 3 }));
    subjects.store.set('p2', enroll('p2', { 'v-vhit': 1.1, 'v-aud': 40, 'v-hosp': 2, 'v-vis': 5 }));
    subjects.store.set('p3', enroll('p3', { 'v-vhit': 0.7, 'v-aud': 15, 'v-hosp': 0, 'v-vis': 1 }));

    const analyses = new MemAnalyses();
    const stats = stubInferential(() => ({
      test: 'spearman', statistic: 0.7, pValue: 0.05, ci95Lower: null, ci95Upper: null,
      effectSize: { name: 'r', value: 0.7, ci95Lower: null, ci95Upper: null },
      degreesFreedom: 1, warnings: [],
    }));
    const h = new RunAnalysisHandler(analyses, subjects, vars, studyRepo(), stats as any);
    // CONTINUOUS supports PEARSON + SPEARMAN.
    const a = await h.execute({
      organizationId: 'o', studyId: 's',
      input: { test: 'SPEARMAN', variableIds: ['v-vhit', 'v-aud'], params: {} } as any,
    });
    expect(a.test).toBe('SPEARMAN');
    expect(a.statistic).toBeCloseTo(0.7, 2);
    expect(analyses.store.size).toBe(1);
  });
});