'use client';

// apps/web/app/(dashboard)/research/new/page.tsx
// Visual filter builder for a new research query. The physician configures
// data source, display fields, visualizations, and filters, then "Guardar y
// ejecutar" saves the query (BR-RES-001: private by default) and navigates to
// the results page.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FilterBuilderV2 } from '@/components/research/FilterBuilderV2';
import { ResearchFieldPicker } from '@/components/research/ResearchFieldPicker';
import { useSaveQuery } from '@/hooks/useResearch';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { Filter, FilterLogic, DataSource, VisualizationType } from '@medicore/contracts';

const DEFAULT_VIZ: VisualizationType[] = ['table', 'stats'];

const VISUALIZATION_OPTIONS: Array<{ value: VisualizationType; label: string; description: string }> = [
  { value: 'table', label: 'Tabla de pacientes', description: 'Filas anonimizadas con los campos seleccionados' },
  { value: 'stats', label: 'Resumen estadístico', description: 'Conteo, medias y distribución de los datos' },
  { value: 'bar_chart', label: 'Barras', description: 'Compara categorías de un campo' },
  { value: 'line_chart', label: 'Evolución temporal', description: 'Observa cambios a lo largo del tiempo' },
  { value: 'scatter', label: 'Dispersión', description: 'Explora la relación entre dos variables' },
];

export default function NewResearchQueryPage() {
  const router = useRouter();
  const save = useSaveQuery();
  const fieldDiscoveryEnabled = useFeatureFlag('RESEARCH_V2_FIELD_DISCOVERY');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<DataSource>('all_patients');
  const [importBatchIds, setImportBatchIds] = useState('');
  const [displayFields, setDisplayFields] = useState<string[]>(['age', 'sex']);
  const [visualizations, setVisualizations] = useState<VisualizationType[]>(DEFAULT_VIZ);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [logic, setLogic] = useState<FilterLogic>('AND');

  // Parse the raw batch input while keeping display fields as API-facing names.
  const importBatchIdsArr = useMemo(
    () =>
      importBatchIds.trim()
        ? importBatchIds.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    [importBatchIds],
  );
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
      importBatchIds: importBatchIdsArr,
      filters,
      filterLogic: logic,
      displayFields,
      visualizations,
    });
    router.push(`/research/${saved.id}`);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <div>
        <p className="label-clinical mb-2">Investigación clínica</p>
        <h1 className="page-title">Nueva consulta de investigación</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          La consulta se guarda como privada (BR-RES-001). Para compartirla, exporta la cohorte a una colección bloqueada.
        </p>
      </div>

      <div className="card-primary grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <label className="text-sm">
          <span className="label-clinical">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-clinical mt-1"
            placeholder="p.ej. Pacientes > 50 con IMC > 30"
          />
        </label>

        <label className="text-sm">
          <span className="label-clinical">Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-clinical mt-1"
          />
        </label>

        <label className="text-sm">
          <span className="label-clinical">Origen de datos</span>
          <select
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value as DataSource)}
            className="input-clinical mt-1"
          >
            <option value="all_patients">Todos los pacientes</option>
            <option value="manual_only">Solo cargados manualmente</option>
            <option value="imported_only">Solo importados</option>
            <option value="import_batch">Lote(s) de importación concreto</option>
          </select>
        </label>

        {dataSource === 'import_batch' && (
          <label className="text-sm">
            <span className="label-clinical">IDs de lote (coma-separados)</span>
            <input
              value={importBatchIds}
              onChange={(e) => setImportBatchIds(e.target.value)}
              className="input-clinical mt-1"
              placeholder="uuid, uuid…"
            />
          </label>
        )}

        <div className="text-sm md:col-span-2">
          <span className="label-clinical">Campos a mostrar</span>
          <div className="mt-1">
            <ResearchFieldPicker
              value={displayFields}
              onChange={setDisplayFields}
              disabled={!fieldDiscoveryEnabled}
            />
          </div>
        </div>

        <fieldset className="card-secondary p-4 text-sm md:col-span-2">
          <legend className="label-clinical">Qué quieres analizar</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {VISUALIZATION_OPTIONS.map(({ value, label, description }) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-md border border-outline-variant bg-surface-lowest p-2.5 hover:border-secondary">
                <input
                  type="checkbox"
                  checked={visualizations.includes(value)}
                  onChange={() => toggleViz(value)}
                  className="mt-0.5 rounded border-outline"
                />
                <span>
                  <span className="block font-medium text-on-surface">{label}</span>
                  <span className="block text-xs text-on-surface-variant">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="card-primary p-5">
        <p className="label-clinical mb-2">Define la cohorte</p>
        <h2 className="mb-1 text-lg font-semibold text-on-surface">Filtros</h2>
        <p className="mb-3 text-sm text-on-surface-variant">Acota los pacientes que quieres estudiar. Puedes empezar sin filtros y añadirlos después.</p>
        <FilterBuilderV2
          filters={filters}
          logic={logic}
          onChange={(f, l) => { setFilters(f); setLogic(l); }}
          dataSource={dataSource}
          importBatchIds={importBatchIdsArr}
          previewFields={displayFields}
          disabled={!fieldDiscoveryEnabled}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => void onSaveAndRun()}
          disabled={save.isPending || !name.trim()}
          className="btn-primary"
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
