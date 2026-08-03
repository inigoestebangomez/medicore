// apps/web/src/features/research-form/api/useResearchForm.ts
// React Query hooks for the Research V4 form builder endpoints
// (REQ-FB-001..013). Covers the 18 routes wired in research.module.ts.
//
// The API wraps every response in `{ data: ... }` via
// ResponseWrapperInterceptor — these hooks unwrap to the inner DTO so
// consumers work with the typed payload directly.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import type {
  StudyVariableInput,
  StudyVariableUpdate,
  StudyVariableResponse,
  ReorderVariablesInput,
  DecomposeInput,
  AddFromTemplateInput,
  VariableTemplateInput,
  VariableTemplateResponse,
  StudySubjectInput,
  StudySubjectResponse,
  StudySubjectUpdate,
  AutoFillPreviewInput,
  UpdateAutoFillMapInput,
  RunAnalysisInput,
  StatisticalAnalysisResponse,
  FormTemplate,
} from '@medicore/contracts';

const STUDY = '/v1/research/studies';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function get<T>(url: string): Promise<T> {
  const res = await apiFetch<{ data: T }>(url);
  return res.data;
}

 async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch<{ data: T }>(url, { method: 'POST', body: JSON.stringify(body) });
  return res.data;
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch<{ data: T }>(url, { method: 'PATCH', body: JSON.stringify(body) });
  return res.data;
}

async function del<T>(url: string): Promise<T> {
  const res = await apiFetch<{ data: T }>(url, { method: 'DELETE' });
  return res.data;
}

// ─────────────────────────────────────────────
// VariableBuilder (REQ-FB-001..005)
// ─────────────────────────────────────────────

export function useStudyVariables(studyId: string | null | undefined) {
  return useQuery<StudyVariableResponse[]>({
    queryKey: ['research-form', 'variables', studyId],
    queryFn: () => get<StudyVariableResponse[]>(`${STUDY}/${studyId}/variables`),
    enabled: Boolean(studyId),
  });
}

export function useCreateVariable(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudyVariableInput) =>
      post<StudyVariableResponse>(`${STUDY}/${studyId}/variables`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'variables', studyId] }),
  });
}

export function useUpdateVariable(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variableId, input }: { variableId: string; input: StudyVariableUpdate }) =>
      patch<StudyVariableResponse>(`${STUDY}/${studyId}/variables/${variableId}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'variables', studyId] }),
  });
}

export function useDeleteVariable(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variableId: string) => del<{ deleted: boolean }>(`${STUDY}/${studyId}/variables/${variableId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'variables', studyId] }),
  });
}

export function useReorderVariables(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderVariablesInput) =>
      post<{ reordered: boolean }>(`${STUDY}/${studyId}/variables/reorder`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'variables', studyId] }),
  });
}

export function useDecomposeVariable(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DecomposeInput) =>
      post<StudyVariableResponse[]>(`${STUDY}/${studyId}/variables/decompose`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'variables', studyId] }),
  });
}

export function useAddVariableFromTemplate(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddFromTemplateInput) =>
      post<StudyVariableResponse>(`${STUDY}/${studyId}/variables/from-template`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'variables', studyId] }),
  });
}

// ─────────────────────────────────────────────
// Variable library (REQ-FB-002)
// ─────────────────────────────────────────────

export function useVariableTemplates(page = 1, pageSize = 50) {
  return useQuery<{ items: VariableTemplateResponse[]; total: number; page: number; pageSize: number }>({
    queryKey: ['research-form', 'templates', page, pageSize],
    queryFn: () =>
      get<{ items: VariableTemplateResponse[]; total: number; page: number; pageSize: number }>(
        `/v1/research/variables/templates?page=${page}&pageSize=${pageSize}`,
      ),
  });
}

export function useCreateVariableTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VariableTemplateInput) =>
      post<VariableTemplateResponse>(`/v1/research/variables/templates`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'templates'] }),
  });
}

export function useUpdateVariableTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: Partial<VariableTemplateInput> }) =>
      patch<VariableTemplateResponse>(`/v1/research/variables/templates/${templateId}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'templates'] }),
  });
}

// ─────────────────────────────────────────────
// StudySubject enrollment + EHR auto-fill (REQ-FB-006, REQ-FB-009)
// ─────────────────────────────────────────────

export interface SubjectsPage {
  items: StudySubjectResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export function useStudySubjects(studyId: string | null | undefined, page = 1, pageSize = 50) {
  return useQuery<SubjectsPage>({
    queryKey: ['research-form', 'subjects', studyId, page, pageSize],
    queryFn: () => get<SubjectsPage>(`${STUDY}/${studyId}/subjects?page=${page}&pageSize=${pageSize}`),
    enabled: Boolean(studyId),
  });
}

export function useEnrollSubject(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudySubjectInput) =>
      post<StudySubjectResponse>(`${STUDY}/${studyId}/subjects`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'subjects', studyId] }),
  });
}

export function useUpdateSubject(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, input }: { subjectId: string; input: StudySubjectUpdate }) =>
      patch<StudySubjectResponse>(`${STUDY}/${studyId}/subjects/${subjectId}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'subjects', studyId] }),
  });
}

export function usePreviewAutoFill(studyId: string) {
  return useMutation({
    mutationFn: (input: AutoFillPreviewInput) =>
      post<{ overrides: Record<string, unknown> }>(`${STUDY}/${studyId}/subjects/preview`, input),
  });
}

export function useUpdateAutoFillMap(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, input }: { subjectId: string; input: UpdateAutoFillMapInput }) =>
      patch<{ autoFillMap: Record<string, string> }>(`${STUDY}/${studyId}/auto-fill`, { subjectId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'subjects', studyId] }),
  });
}

// ─────────────────────────────────────────────
// Registration form (REQ-FB-007)
// ─────────────────────────────────────────────

export function useRegistrationForm(studyId: string | null | undefined) {
  return useQuery<FormTemplate>({
    queryKey: ['research-form', 'registration-form', studyId],
    queryFn: () => get<FormTemplate>(`${STUDY}/${studyId}/registration-form`),
    enabled: Boolean(studyId),
  });
}

// ─────────────────────────────────────────────
// Statistical analyses (REQ-FB-010..012)
// ─────────────────────────────────────────────

export function useListAnalyses(studyId: string | null | undefined) {
  return useQuery<StatisticalAnalysisResponse[]>({
    queryKey: ['research-form', 'analyses', studyId],
    queryFn: () => get<StatisticalAnalysisResponse[]>(`${STUDY}/${studyId}/analyses`),
    enabled: Boolean(studyId),
  });
}

export function useRunAnalysis(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RunAnalysisInput) =>
      post<StatisticalAnalysisResponse>(`${STUDY}/${studyId}/analyses`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-form', 'analyses', studyId] }),
  });
}