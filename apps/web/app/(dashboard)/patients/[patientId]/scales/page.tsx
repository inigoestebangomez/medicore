// apps/web/app/(dashboard)/patients/[patientId]/scales/page.tsx
import { ScaleInputForm } from '@/features/scales/components/scale-input-form';
import { ScoreEvolutionChart } from '@/features/scales/components/score-evolution-chart';
import { useState } from 'react';
import type { ClinicalScaleType } from '@medicore/contracts';

const SCALE_TYPES: ClinicalScaleType[] = [
  'SNOT_22', 'VAS_TINNITUS', 'DHI', 'VHI', 'RSI', 'OSA_EPWORTH', 'STOPBANG', 'NOSE', 'CUSTOM',
];

interface PageProps {
  params: { patientId: string };
}

export default function ScalesPage({ params }: PageProps) {
  const [selectedType, setSelectedType] = useState<ClinicalScaleType>('SNOT_22');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Clinical Scales</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? 'Cancel' : 'New Scale'}
        </button>
      </div>

      {showForm && (
        <ScaleInputForm
          patientId={params.patientId}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div>
        <label className="text-sm font-medium">Filter by type:</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as ClinicalScaleType)}
          className="ml-2 rounded-md border px-2 py-1 text-sm"
        >
          {SCALE_TYPES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      <ScoreEvolutionChart patientId={params.patientId} scaleType={selectedType} />
    </div>
  );
}