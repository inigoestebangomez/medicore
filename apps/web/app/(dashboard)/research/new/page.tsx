'use client';

// apps/web/app/(dashboard)/research/new/page.tsx
// Visual filter builder for a new research query. The physician configures
// data source, display fields, visualizations, and filters, then "Guardar y
// ejecutar" saves the query (BR-RES-001: private by default) and navigates to
// the results page.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FilterBuilder } from '@/components/research/filter-builder';
import { useSaveQuery } from '@/hooks/useResearch';
import type { Filter, FilterLogic, DataSource, VisualizationType } from '@medicore/contracts';

const SUGGESTED_DISPLAY = ['nhc', 'age', 'sex', 'birthDate'];
const DEFAULT_VIZ: VisualizationType[] = ['table', 'stats'];

export default function NewResearchQueryPage() {
  const router = useRouter();
  const save = useSaveQuery();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<DataSource>('all_patients');
  const [importBatchIds, setImportBatchIds] = useState('');
  const [displayFields, setDisplayFields] = useState('age, sex');
  const [visualizations, setVisualizations] = useState<VisualizationType[]>(DEFAULT_VIZ);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [logic, setLogic] = useState<FilterLogic>('AND');

  const toggleViz = (v: VisualizationType) =>
    setVisualizations((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );

  const onSaveAndRun = async () => {
    if (!name.trim()) return;
    const saved = await save.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      dataSource,
      importBatchIds: importBatchIds.trim()
        ? importBatchIds.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      filters,
      filterLogic: logic,
      displayFields: displayFields.split(',').map((s) => s.trim()).filter(Boolean),
      visualizations,
    });
    router.push(`/research/${saved.id}`);
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-on-surface">Nueva consulta de investigación</h1>
        <p className="text-sm text-on-surface-variant">
          La consulta se guarda como privada (BR-RES-001). Para compartirla, exporta la cohorte a una colección bloqueada.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-md border border-outline-variant p-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-on-surface-variant">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1.5"
            placeholder="p.ej. Pacientes > 50 con IMC > 30"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-on-surface-variant">Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-on-surface-variant">Origen de datos</span>
          <select
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value as DataSource)}
            className="mt-1 w-full rounded border border-outline px-2 py-1.5"
          >
            <option value="all_patients">Todos los pacientes</option>
            <option value="manual_only">Solo cargados manualmente</option>
            <option value="imported_only">Solo importados</option>
            <option value="import_batch">Lote(s) de importación concreto</option>
          </select>
        </label>

        {dataSource === 'import_batch' && (
          <label className="text-sm">
            <span className="font-medium text-on-surface-variant">IDs de lote (coma-separados)</span>
            <input
              value={importBatchIds}
              onChange={(e) => setImportBatchIds(e.target.value)}
              className="mt-1 w-full rounded border border-outline px-2 py-1.5"
              placeholder="uuid, uuid…"
            />
          </label>
        )}

        <label className="text-sm md:col-span-2">
          <span className="font-medium text-on-surface-variant">Campos a mostrar (coma-separados)</span>
          <input
            value={displayFields}
            onChange={(e) => setDisplayFields(e.target.value)}
            className="mt-1 w-full rounded border border-outline px-2 py-1.5"
            placeholder={SUGGESTED_DISPLAY.join(', ')}
          />
          <span className="mt-1 block text-xs text-on-surface-variant">
            Campos estándar (age, sex, nhc…) o importados (customField…).
          </span>
        </label>

        <fieldset className="text-sm md:col-span-2">
          <span className="font-medium text-on-surface-variant">Visualizaciones</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {(['table', 'bar_chart', 'line_chart', 'scatter', 'stats'] as VisualizationType[]).map((v) => (
              <label key={v} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={visualizations.includes(v)}
                  onChange={() => toggleViz(v)}
                  className="rounded border-outline"
                />
                <span className="text-on-surface-variant">{v}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="rounded-md border border-outline-variant p-4">
        <h2 className="mb-2 text-sm font-semibold text-on-surface-variant">Filtros</h2>
        <FilterBuilder filters={filters} logic={logic} onChange={(f, l) => { setFilters(f); setLogic(l); }} />
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => void onSaveAndRun()}
          disabled={save.isPending || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {save.isPending ? 'Guardando…' : 'Guardar y ejecutar'}
        </Button>
        {save.isError && (
          <span className="text-sm text-red-600">Error: {(save.error as Error).message}</span>
        )}
      </div>
    </div>
  );
}