// apps/web/src/features/guided-analysis/components/VariablePicker.tsx
// Category-based variable picker with collapsible sections and chip selection.
// Uses the clinical-sections registry for grouping.

'use client';

import { useState, useMemo } from 'react';
import {
  CLINICAL_SECTIONS,
  CLINICAL_SECTION_LABELS,
  FIELD_TO_SECTION,
  type ClinicalSection,
} from '@/components/research/clinical-sections.registry';

interface VariablePickerProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  onAddCustom?: (variableName: string) => void;
}

// Extended field catalog with labels (Spanish)
const FIELD_LABELS: Record<string, string> = {
  // Demographics
  nhc: 'NHC',
  firstName: 'Nombre',
  lastName: 'Apellido',
  birthDate: 'Fecha de nacimiento',
  sex: 'Sexo',
  bloodType: 'Grupo sanguíneo',
  importSource: 'Fuente de importación',
  createdAt: 'Fecha de creación',
  // Calculated
  age: 'Edad',
  // Diagnoses
  assessment: 'Impresión diagnóstica',
  diagnosisCodes: 'Códigos diagnósticos',
  // Surgery
  procedureType: 'Tipo de procedimiento',
  surgeryDate: 'Fecha de cirugía',
  asa: 'Clasificación ASA',
  anesthesiaType: 'Tipo de anestesia',
  outcome: 'Resultado',
  complications: 'Complicaciones',
  // Consultations
  chiefComplaint: 'Motivo de consulta',
  currentIllness: 'Enfermedad actual',
  physicalExam: 'Exploración física',
  plan: 'Plan',
  followUpDate: 'Fecha de seguimiento',
  // Medication
  drugName: 'Medicamento',
  dosage: 'Dosis',
  frequency: 'Frecuencia',
  // Scales
  SNOT_22: 'SNOT-22 (Rinosinusitis)',
  VAS_TINNITUS: 'EVA Acúfenos',
  DHI: 'DHI (Vértigo)',
  VHI: 'VHI (Disfonía)',
  RSI: 'RSI (Reflujo)',
  OSA_EPWORTH: 'Epworth (SAOS)',
  STOPBANG: 'STOP-BANG',
  NOSE: 'NOSE (Obstrucción nasal)',
  total: 'Puntuación total',
  // Imaging
  ImagingStudyType: 'Tipo de estudio',
  findings: 'Hallazgos',
  // New clinical record fields
  entryType: 'Tipo de antecedente',
  symptoms: 'Síntomas',
  durationValue: 'Duración',
  durationUnit: 'Unidad de duración',
  onset: 'Fecha de inicio',
  evolution: 'Evolución',
  templateVersion: 'Versión de plantilla',
  customFindings: 'Hallazgos personalizados',
  s3Key: 'Clave de almacenamiento',
  fileName: 'Nombre de archivo',
  overallReviewState: 'Estado de revisión',
  catalogVersion: 'Versión de catálogo',
  status: 'Estado',
  resolvedAt: 'Fecha de resolución',
  discardedAt: 'Fecha de descarte',
  // Additional
  hospitalStayDays: 'Días de hospitalización',
  surgeryDurationMinutes: 'Duración de cirugía (min)',
  consultationType: 'Tipo de consulta',
  followUpNotes: 'Notas de seguimiento',
  technique: 'Técnica quirúrgica',
  postOpNotes: 'Notas postoperatorias',
  preOpNotes: 'Notas preoperatorias',
  duration: 'Duración',
  reason: 'Motivo',
  instructions: 'Instrucciones',
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function VariablePicker({
  value,
  onChange,
  multi = false,
  placeholder = 'Seleccione una variable',
  searchPlaceholder = 'Buscar variable…',
  onAddCustom,
}: VariablePickerProps) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<ClinicalSection>>(
    new Set(['Demographics', 'Diagnoses', 'Surgery', 'Medication']),
  );

  const selectedValues = useMemo(() => {
    if (multi) return Array.isArray(value) ? value : [];
    return Array.isArray(value) ? [] : value ? [value] : [];
  }, [value, multi]);

  // Group all known fields by section
  const groupedFields = useMemo(() => {
    const allFields = Object.keys(FIELD_TO_SECTION);
    const buckets = new Map<ClinicalSection, string[]>();

    for (const field of allFields) {
      const section = FIELD_TO_SECTION[field];
      const arr = buckets.get(section) ?? [];
      arr.push(field);
      buckets.set(section, arr);
    }

    // Filter by search
    const searchLower = search.toLowerCase();
    const filtered = new Map<ClinicalSection, string[]>();

    for (const [section, fields] of buckets) {
      const matching = fields.filter((f) => {
        const label = getFieldLabel(f).toLowerCase();
        return label.includes(searchLower) || f.toLowerCase().includes(searchLower);
      });
      if (matching.length > 0) {
        filtered.set(section, matching);
      }
    }

    return filtered;
  }, [search]);

  const toggleSection = (section: ClinicalSection) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const toggleField = (field: string) => {
    if (multi) {
      const current = selectedValues;
      const next = current.includes(field)
        ? current.filter((v) => v !== field)
        : [...current, field];
      onChange(next);
    } else {
      onChange(selectedValues.includes(field) ? '' : field);
    }
  };

  const isSelected = (field: string) => selectedValues.includes(field);

  const handleAddCustomVariable = () => {
    if (newVarName.trim() && onAddCustom) {
      onAddCustom(newVarName.trim());
      setNewVarName('');
      setShowAddModal(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Search + Add button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {onAddCustom && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
            title="Añadir variable personalizada"
          >
            + Nueva
          </button>
        )}
      </div>

      {/* Selected chips */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {getFieldLabel(v)}
              <button
                type="button"
                onClick={() => toggleField(v)}
                className="text-primary/60 hover:text-primary"
                aria-label={`Eliminar ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Categories */}
      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        {CLINICAL_SECTIONS.map((section) => {
          const fields = groupedFields.get(section);
          if (!fields || fields.length === 0) return null;

          const isExpanded = expandedSections.has(section);

          return (
            <div key={section} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => toggleSection(section)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-secondary/50"
              >
                <span>
                  {CLINICAL_SECTION_LABELS[section]}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({fields.length})
                  </span>
                </span>
                <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-2">
                  {fields.map((field) => {
                    const selected = isSelected(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleField(field)}
                        className={`block w-full rounded px-2 py-1 text-left text-xs transition ${
                          selected
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        <span className="font-medium">{getFieldLabel(field)}</span>
                        <span className="ml-2 text-muted-foreground font-mono text-[10px]">
                          {field}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {groupedFields.size === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No se encontraron variables
          </div>
        )}
      </div>

      {/* Add Custom Variable Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Añadir variable personalizada</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Introduzca el nombre de la variable. La aplicación le guiará para mapearla a un dato existente en la base de datos.
            </p>
            <input
              type="text"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              placeholder="Nombre de la variable (ej: presión arterial sistólica)"
              className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustomVariable();
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setNewVarName('');
                }}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomVariable}
                disabled={!newVarName.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
