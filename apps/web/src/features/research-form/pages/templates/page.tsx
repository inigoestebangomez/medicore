'use client';

// apps/web/src/features/research-form/pages/templates/page.tsx
// VariableLibraryPage (REQ-FB-002): org-level reusable variable library.
// Gated by RESEARCH_VARIABLE_LIBRARY.

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { TemplateForm } from '@/features/research-form/components/VariableLibrary/TemplateForm';
import { TemplateList } from '@/features/research-form/components/VariableLibrary/TemplateList';

export function VariableLibraryPage() {
  const enabled = useFeatureFlag('RESEARCH_VARIABLE_LIBRARY');
  if (!enabled) {
    return <p className="p-6 text-sm text-on-surface-variant">La biblioteca de variables está desactivada.</p>;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-lg font-semibold text-on-surface">Biblioteca de variables</h1>
      <TemplateForm />
      <TemplateList />
    </div>
  );
}

export default VariableLibraryPage;