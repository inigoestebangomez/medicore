// apps/api/src/application/research/research-form-handlers.spec.ts
// Integration tests for the V4 command handlers (6.2): create/update/delete
// variable, decompose composite, template instantiation, enroll subject,
// and a Kappa agreement run-analysis end-to-end against in-memory repo
// doubles + a stubbed PythonStatsService (REQ-FB-001..012).

import { describe, it, expect } from '@jest/globals';
import { StudyVariable } from '@/domain/research/study-variable.entity';
import { StudySubject } from '@/domain/research/study-subject.entity';
import { VariableTemplate } from '@/domain/research/variable-template.entity';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';
import type { IStudySubjectRepository } from '@/domain/research/ports/study-subject.repository.interface';
import type { IVariableTemplateRepository } from '@/domain/research/ports/variable-template.repository.interface';
import type { IStatisticalAnalysisRepository } from '@/domain/research/ports/statistical-analysis.repository.interface';
import type { IResearchStudyRepository, Paginated } from '@/domain/research/ports/research-study.repository.interface';
import type { ResearchStudy } from '@/domain/research/research-study.entity';

import { CreateVariableHandler, DecomposeVariableHandler, AddVariableFromTemplateHandler } from './commands/variable-builder.handlers';
import { EnrollSubjectHandler, UpdateSubjectHandler } from './commands/subject.handlers';
import { RunAnalysisHandler } from './commands/analysis.handler';

// ─────────────────────────────────────────────
// In-memory doubles
// ─────────────────────────────────────────────

class InMemoryVarRepo implements IStudyVariableRepository {
  store = new Map<string, StudyVariable>();
  create(v: StudyVariable) { this.store.set(v.id, v); return Promise.resolve(v); }
  async createMany(vs: StudyVariable[]) { vs.forEach((v) => this.store.set(v.id, v)); return Promise.resolve(vs); }
  async findById(id: string, orgId: string) { const v = this.store.get(id); return v && v.organizationId === orgId ? v : null; }
  async findByStudy(studyId: string, orgId: string) {
    return Array.from(this.store.values()).filter((v) => v.studyId === studyId && v.organizationId === orgId);
  }
  update(v: StudyVariable) { this.store.set(v.id, v); return Promise.resolve(v); }
  async delete(id: string, _orgId: string) { this.store.delete(id); }
  async reorder() {}
}

class InMemorySubjectRepo implements IStudySubjectRepository {
  store = new Map<string, StudySubject>();
  create(s: StudySubject) { this.store.set(s.id, s); return Promise.resolve(s); }
  async findById(id: string, orgId: string) { const s = this.store.get(id); return s && s.organizationId === orgId ? s : null; }
  async findByStudy(studyId: string, orgId: string, opts?: { page?: number; pageSize?: number }): Promise<Paginated<StudySubject>> {
    const items = Array.from(this.store.values()).filter((s) => s.studyId === studyId && s.organizationId === orgId);
    const page = opts?.page ?? 1; const pageSize = opts?.pageSize ?? 50;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }
  update(s: StudySubject) { this.store.set(s.id, s); return Promise.resolve(s); }
  async delete() {}
}

class InMemoryTemplateRepo implements IVariableTemplateRepository {
  store = new Map<string, VariableTemplate>();
  links: Array<{ templateId: string; studyId: string; studyVarId: string }> = [];
  create(t: VariableTemplate) { this.store.set(t.id, t); return Promise.resolve(t); }
  async findById(id: string, orgId: string) { const t = this.store.get(id); return t && t.organizationId === orgId ? t : null; }
  async findByOrganization(orgId: string, opts?: { page?: number; pageSize?: number }) {
    const items = Array.from(this.store.values()).filter((t) => t.organizationId === orgId);
    const page = opts?.page ?? 1; const pageSize = opts?.pageSize ?? 50;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }
  update(t: VariableTemplate) { this.store.set(t.id, t); return Promise.resolve(t); }
  async delete() {}
  async createLink(link: { templateId: string; studyId: string; studyVarId: string }) { this.links.push(link); }
}

class InMemoryAnalysisRepo implements IStatisticalAnalysisRepository {
  store = new Map<string, import('@/domain/research/statistical-analysis.entity').StatisticalAnalysis>();
  create(a: any) { this.store.set(a.id, a); return Promise.resolve(a); }
  async findByStudy() { return []; }
  async findById() { return null; }
}

const studyStub = (id: string, org = 'org-1') =>
  ({ id, organizationId: org, studyType: 'FORM', queryId: null } as unknown as ResearchStudy);

const studyRepoOf = (studies: ResearchStudy[] = [studyStub('s-1')]): IResearchStudyRepository => ({
  async findById(id: string, orgId: string) {
    const s = studies.find((x) => x.id === id && (x as any).organizationId === orgId);
    return s ?? null;
  },
  // The following methods are unused by the handlers under test but required by the interface.
  create: async () => { throw new Error('not implemented'); },
  findByOrganization: async () => ({ items: [], total: 0, page: 1, pageSize: 50 }),
  update: async (s: ResearchStudy) => s,
  findActiveWithStaleCache: async () => [],
  softDelete: async () => {},
});

// Stubbed PythonStatsService — only runKappa needed for the analysis test.
const stubStats = (overrides: { runKappa?: (...a: any[]) => any } = {}) =>
  ({ runKappa: async () => ({ statistic: 0.8, pValue: 0.01, n: 10, warnings: [] }), ...overrides } as any);

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('CreateVariableHandler (REQ-FB-001)', () => {
  it('creates a variable when the study belongs to the org', async () => {
    const varRepo = new InMemoryVarRepo();
    const h = new CreateVariableHandler(varRepo, studyRepoOf());
    const v = await h.execute({
      organizationId: 'org-1', studyId: 's-1', createdBy: 'u',
      input: { name: 'edad', label: 'Edad', type: 'CONTINUOUS' } as any,
    });
    expect(v.name).toBe('edad');
    expect(varRepo.store.size).toBe(1);
  });

  it('throws StudyNotFoundError when the study does not exist', async () => {
    const h = new CreateVariableHandler(new InMemoryVarRepo(), studyRepoOf([]));
    await expect(h.execute({
      organizationId: 'org-1', studyId: 'no-such', createdBy: 'u',
      input: { name: 'edad', label: 'Edad', type: 'CONTINUOUS' } as any,
    })).rejects.toBeInstanceOf(StudyNotFoundError);
  });
});

describe('DecomposeVariableHandler (REQ-FB-005)', () => {
  it('decomposes a composite variable into N DICHOTOMOUS children', async () => {
    const varRepo = new InMemoryVarRepo();
    const parent = StudyVariable.create({
      id: 'p', organizationId: 'org-1', studyId: 's-1', name: 'complicaciones', label: 'Complicaciones', type: 'NOMINAL',
      options: [{ value: 'h', label: 'Hemorragia' }],
    });
    varRepo.store.set('p', parent);
    const h = new DecomposeVariableHandler(varRepo);
    const children = await h.execute({
      organizationId: 'org-1', studyId: 's-1', parentVariableId: 'p',
      children: [{ name: 'hemorragia', label: 'Hemorragia' }, { name: 'infeccion', label: 'Infección' }],
    });
    expect(children).toHaveLength(2);
    expect(children.every((c) => c.type.value === 'DICHOTOMOUS')).toBe(true);
    expect(children.every((c) => c.parentId === 'p')).toBe(true);
  });
});

describe('AddVariableFromTemplateHandler (REQ-FB-002)', () => {
  it('instantiates a snapshot variable and persists the immutable link', async () => {
    const varRepo = new InMemoryVarRepo();
    const templateRepo = new InMemoryTemplateRepo();
    const tpl = VariableTemplate.create({
      id: 'tpl', organizationId: 'org-1', createdBy: 'u',
      name: 'Complicaciones ORL', type: 'NOMINAL', options: [{ value: 'h', label: 'H' }],
    });
    templateRepo.store.set('tpl', tpl);
    const h = new AddVariableFromTemplateHandler(templateRepo, varRepo, studyRepoOf());
    const v = await h.execute({ organizationId: 'org-1', studyId: 's-1', templateId: 'tpl' });
    expect(v.studyId).toBe('s-1');
    expect(templateRepo.links).toHaveLength(1);
    expect(templateRepo.links[0].templateId).toBe('tpl');
    expect(templateRepo.links[0].studyVarId).toBe(v.id);
  });
});

describe('EnrollSubjectHandler (REQ-FB-006)', () => {
  it('persists a subject with valid values', async () => {
    const varRepo = new InMemoryVarRepo();
    const edad = StudyVariable.create({
      id: 'v1', organizationId: 'org-1', studyId: 's-1', name: 'edad', label: 'Edad', type: 'CONTINUOUS',
      range: { min: 0, max: 120, step: 1 },
    });
    varRepo.store.set('v1', edad);
    const subjectRepo = new InMemorySubjectRepo();
    const h = new EnrollSubjectHandler(subjectRepo, varRepo, studyRepoOf());
    const s = await h.execute({
      organizationId: 'org-1', studyId: 's-1', enrolledBy: 'u',
      input: { patientNhc: '1234', values: { v1: 65 }, autoFillMap: {} } as any,
    });
    expect(s.patientNhc).toBe('1234');
    expect(s.getValue('v1')).toBe(65);
  });

  it('rejects an out-of-range value without persisting', async () => {
    const varRepo = new InMemoryVarRepo();
    const edad = StudyVariable.create({
      id: 'v1', organizationId: 'org-1', studyId: 's-1', name: 'edad', label: 'Edad', type: 'CONTINUOUS',
      range: { min: 0, max: 120, step: 1 },
    });
    varRepo.store.set('v1', edad);
    const subjectRepo = new InMemorySubjectRepo();
    const h = new EnrollSubjectHandler(subjectRepo, varRepo, studyRepoOf());
    await expect(h.execute({
      organizationId: 'org-1', studyId: 's-1', enrolledBy: 'u',
      input: { patientNhc: '1234', values: { v1: 500 }, autoFillMap: {} } as any,
    })).rejects.toThrow(/invalid_value_v1/);
    expect(subjectRepo.store.size).toBe(0);
  });
});

describe('UpdateSubjectHandler (REQ-FB-006)', () => {
  it('merges valid incoming values onto an existing subject', async () => {
    const varRepo = new InMemoryVarRepo();
    const edad = StudyVariable.create({
      id: 'v1', organizationId: 'org-1', studyId: 's-1', name: 'edad', label: 'Edad', type: 'CONTINUOUS', range: { min: 0, max: 120, step: 1 },
    });
    varRepo.store.set('v1', edad);
    const subjectRepo = new InMemorySubjectRepo();
    const existing = new StudySubject({ id: 'sub-1', organizationId: 'org-1', studyId: 's-1', patientNhc: '1', enrolledBy: 'u', values: { v1: 50 }, enrolledAt: new Date() });
    subjectRepo.store.set('sub-1', existing);
    const h = new UpdateSubjectHandler(subjectRepo, varRepo);
    const updated = await h.execute({
      organizationId: 'org-1', studyId: 's-1', subjectId: 'sub-1',
      input: { values: { v1: 70 } } as any,
    });
    expect(updated.getValue('v1')).toBe(70);
  });
});

describe('RunAnalysisHandler — Kappa agreement (REQ-FB-010, REQ-FB-012)', () => {
  it('dispatches to stats.runKappa, persists the trace, and labels neutral (no OR/HR)', async () => {
    const varRepo = new InMemoryVarRepo();
    const raterA = StudyVariable.create({
      id: 'ra', organizationId: 'org-1', studyId: 's-1', name: 'raterA', label: 'Observador A', type: 'DICHOTOMOUS',
    });
    const raterB = StudyVariable.create({
      id: 'rb', organizationId: 'org-1', studyId: 's-1', name: 'raterB', label: 'Observador B', type: 'DICHOTOMOUS',
    });
    varRepo.store.set('ra', raterA); varRepo.store.set('rb', raterB);
    const subjectRepo = new InMemorySubjectRepo();
    for (let i = 0; i < 4; i++) {
      const s = new StudySubject({
        id: `sub-${i}`, organizationId: 'org-1', studyId: 's-1', patientNhc: String(i), enrolledBy: 'u',
        values: { ra: true, rb: i % 2 === 0 }, enrolledAt: new Date(),
      });
      subjectRepo.store.set(s.id, s);
    }
    const analysisRepo = new InMemoryAnalysisRepo();
    const h = new RunAnalysisHandler(analysisRepo, subjectRepo, varRepo, studyRepoOf(), stubStats());
    const a = await h.execute({
      organizationId: 'org-1', studyId: 's-1',
      input: { test: 'KAPPA', variableIds: ['ra', 'rb'], params: {} } as any,
    });
    expect(a.test).toBe('KAPPA');
    expect(a.statistic).toBeCloseTo(0.8, 2);
    expect(a.pValue).toBeCloseTo(0.01, 2);
    expect(a.n).toBe(4);
    // Kappa produces no OR/HR → label stays null (NEUTRAL not applicable).
    expect(a.riskLabel).toBeNull();
    expect(analysisRepo.store.size).toBe(1);
  });

  it('throws when the test is not compatible with the variable type', async () => {
    const varRepo = new InMemoryVarRepo();
    const edad = StudyVariable.create({
      id: 'v1', organizationId: 'org-1', studyId: 's-1', name: 'edad', label: 'Edad', type: 'CONTINUOUS', range: { min: 0, max: 120, step: 1 },
    });
    varRepo.store.set('v1', edad);
    const h = new RunAnalysisHandler(new InMemoryAnalysisRepo(), new InMemorySubjectRepo(), varRepo, studyRepoOf(), stubStats());
    await expect(h.execute({
      organizationId: 'org-1', studyId: 's-1',
      input: { test: 'KAPPA', variableIds: ['v1'], params: {} } as any,
    })).rejects.toThrow(/test_not_compatible/);
  });
});