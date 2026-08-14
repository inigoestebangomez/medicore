'use client';

import { useMemo, useRef, useState } from 'react';
import { useFieldCatalog } from '@/hooks/useResearchV2';
import type { FieldCatalogEntry } from '@medicore/contracts';
import { FieldDiscoveryPopover } from './FieldDiscoveryPopover';
import {
  CLINICAL_SECTION_LABELS,
  groupBySection,
  type ClinicalSection,
} from './clinical-sections.registry';
import {
  FIELD_SOURCE_LABELS,
  formatFieldMetadata,
  formatFieldOrigin,
  getFieldLabel,
} from './field-presentation';

export interface ResearchFieldPickerProps {
  /** Selected field names. The names are also the values sent to the API. */
  value: string[];
  onChange: (fields: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Enables percentage completeness when the caller already knows the cohort size. */
  totalPatients?: number;
}

const STANDARD_PRESETS: Array<{
  id: 'profile' | 'identity';
  title: string;
  description: string;
  fields: string[];
}> = [
  {
    id: 'profile',
    title: 'Perfil del paciente',
    description: 'Variables básicas para conocer a la persona.',
    fields: ['age', 'sex', 'birthDate', 'bloodType'],
  },
  {
    id: 'identity',
    title: 'Identificación y procedencia',
    description: 'Identificación clínica y origen del registro.',
    fields: ['nhc', 'importSource', 'createdAt'],
  },
];

const QUICK_INTENTS: Array<{
  id: 'profile' | 'clinical' | 'surgery' | 'custom';
  label: string;
}> = [
  { id: 'profile', label: 'Perfil del paciente' },
  { id: 'clinical', label: 'Resultado clínico' },
  { id: 'surgery', label: 'Datos de cirugía' },
  { id: 'custom', label: 'Personalizado' },
];

const SUGGESTION_LIMIT = 5;

function pluralizeFields(count: number): string {
  return `${count} ${count === 1 ? 'campo' : 'campos'}`;
}

function fieldDetails(entry: FieldCatalogEntry, totalPatients?: number): string {
  const origin = formatFieldOrigin(entry);
  return `${FIELD_SOURCE_LABELS[entry.source]} · ${formatFieldMetadata(entry, totalPatients)}${origin ? ` · ${origin}` : ''}`;
}

export function ResearchFieldPicker({
  value,
  onChange,
  placeholder = 'Buscar un campo para añadirlo…',
  disabled,
  ariaLabel = 'Añadir campo',
  totalPatients,
}: ResearchFieldPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIntent, setActiveIntent] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useFieldCatalog('', undefined, open);
  const entries = data?.entries ?? [];
  const cohortTotal = totalPatients ?? data?.totalPatients;
  const selected = useMemo(() => new Set(value), [value]);

  const entriesByField = useMemo(
    () => new Map(entries.map((entry) => [entry.field, entry])),
    [entries],
  );

  const availableForFields = (fields: string[]) =>
    fields
      .map((field) => entriesByField.get(field))
      .filter((entry): entry is FieldCatalogEntry => !!entry && !selected.has(entry.field));

  const suggestions = useMemo(() => {
    const presetSuggestions = STANDARD_PRESETS.map((preset) => ({
      id: preset.id,
      title: preset.title,
      description: preset.description,
      entries: availableForFields(preset.fields),
    })).filter((suggestion) => suggestion.entries.length > 0);

    const mostComplete = entries
      .filter((entry) => !selected.has(entry.field))
      .sort((a, b) => b.nonNullCount - a.nonNullCount || a.field.localeCompare(b.field))
      .slice(0, SUGGESTION_LIMIT);

    const categorySuggestions = groupBySection(entries)
      .map(({ section, entries: sectionEntries }) => ({
        id: `section-${section}`,
        title: CLINICAL_SECTION_LABELS[section],
        description: 'Campos detectados en tu catálogo.',
        entries: sectionEntries.filter((entry) => !selected.has(entry.field)).slice(0, SUGGESTION_LIMIT),
      }))
      .filter((suggestion) => suggestion.entries.length > 0);

    return {
      presets: presetSuggestions,
      mostComplete,
      categories: categorySuggestions,
    };
  }, [entries, selected]);

  function addEntries(entriesToAdd: FieldCatalogEntry[], intent: string) {
    const fieldsToAdd = Array.from(new Set(entriesToAdd
      .filter((entry) => !selected.has(entry.field))
      .map((entry) => entry.field)));
    if (fieldsToAdd.length === 0) return;
    onChange([...value, ...fieldsToAdd]);
    setActiveIntent(intent);
    setOpen(false);
  }

  function entriesForSection(section: ClinicalSection): FieldCatalogEntry[] {
    return groupBySection(entries)
      .find((group) => group.section === section)
      ?.entries.filter((entry) => !selected.has(entry.field))
      .slice(0, SUGGESTION_LIMIT) ?? [];
  }

  function chooseIntent(intent: (typeof QUICK_INTENTS)[number]['id']) {
    if (intent === 'custom') {
      setActiveIntent(intent);
      setOpen(true);
      inputRef.current?.focus();
      return;
    }

    const intentEntries = intent === 'profile'
      ? availableForFields(STANDARD_PRESETS[0].fields)
      : intent === 'clinical'
        ? [
            ...entriesForSection('Diagnoses'),
            ...entriesForSection('Scales'),
          ].slice(0, SUGGESTION_LIMIT)
        : entriesForSection('Surgery');
    addEntries(intentEntries, intent);
  }

  function removeField(field: string) {
    onChange(value.filter((selectedField) => selectedField !== field));
  }

  const suggestionCard = (suggestion: {
    id: string;
    title: string;
    description: string;
    entries: FieldCatalogEntry[];
  }) => {
    const visibleEntries = suggestion.entries.slice(0, SUGGESTION_LIMIT);
    const countLabel = pluralizeFields(visibleEntries.length);
    return (
      <button
        key={suggestion.id}
        type="button"
        disabled={disabled}
        onClick={() => addEntries(visibleEntries, suggestion.id)}
        aria-label={`Añadir ${suggestion.title} (${countLabel})`}
        className="rounded-md border border-outline-variant bg-surface-lowest p-2.5 text-left hover:border-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="block text-sm font-medium text-on-surface">{suggestion.title}</span>
        <span className="mt-0.5 block text-xs text-on-surface-variant">{suggestion.description}</span>
        <span className="mt-2 block text-xs font-medium text-primary">Añadir {countLabel}</span>
        <span className="mt-1 block text-xs text-on-surface-variant">
          {visibleEntries.map((entry) => getFieldLabel(entry.field, entry)).join(' · ')}
        </span>
        <span className="mt-1 block truncate text-[11px] text-on-surface-variant">
          {visibleEntries.map((entry) => fieldDetails(entry, cohortTotal)).join(' · ')}
        </span>
      </button>
    );
  };

  const topContent = (
    <div className="border-b border-outline-variant p-3" aria-label="Sugerencias para empezar">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Sugerencias para empezar</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Elige un bloque clínico o busca una variable concreta.
          </p>
        </div>
        {isLoading && <span className="text-xs text-on-surface-variant">Cargando…</span>}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Selección rápida por intención">
        {QUICK_INTENTS.map((intent) => {
          const intentEntries = intent.id === 'profile'
            ? availableForFields(STANDARD_PRESETS[0].fields)
            : intent.id === 'clinical'
              ? [...entriesForSection('Diagnoses'), ...entriesForSection('Scales')].slice(0, SUGGESTION_LIMIT)
              : intent.id === 'surgery'
                ? entriesForSection('Surgery')
                : entries;
          return (
            <button
              key={intent.id}
              type="button"
              disabled={disabled || (!intentEntries.length && intent.id !== 'custom')}
              aria-pressed={activeIntent === intent.id}
              aria-label={`Usar intención ${intent.label}`}
              onClick={() => chooseIntent(intent.id)}
              className="rounded-full border border-outline-variant px-2.5 py-1 text-xs text-on-surface hover:border-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {intent.label}
            </button>
          );
        })}
      </div>

      {!isLoading && entries.length === 0 ? (
        <p className="mt-3 text-xs text-on-surface-variant">No hay campos disponibles para sugerir.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Bloques sugeridos">
          {suggestions.presets.map(suggestionCard)}
          {suggestions.mostComplete.length > 0 && suggestionCard({
            id: 'most-complete',
            title: 'Campos más completos',
            description: 'Las variables con más datos disponibles.',
            entries: suggestions.mostComplete,
          })}
          {suggestions.categories.map(suggestionCard)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <FieldDiscoveryPopover
        value=""
        onSelect={(entry) => addEntries([entry], 'custom')}
        placeholder={placeholder}
        disabled={disabled}
        ariaLabel={ariaLabel}
        catalogEntries={entries}
        catalogLoading={isLoading}
        topContent={topContent}
        open={open}
        onOpenChange={setOpen}
        inputRef={inputRef}
        totalPatients={cohortTotal}
      />
      <p className="text-xs text-on-surface-variant">
        Las sugerencias usan solo campos disponibles en el catálogo. Las claves técnicas se conservan para la API.
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Campos seleccionados">
          {value.map((field) => {
            const entry = entriesByField.get(field);
            const label = getFieldLabel(field, entry);
            const origin = entry ? formatFieldOrigin(entry) : '';
            return (
              <span
                key={field}
                className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-low px-2.5 py-1 text-xs text-on-surface"
                title={`Clave técnica: ${field}${origin ? ` · ${origin}` : ''}`}
              >
                <span>{label}</span>
                <span className="text-[11px] text-on-surface-variant">{field}</span>
                {entry && (
                  <span className="text-[10px] text-on-surface-variant">
                    {formatFieldMetadata(entry, cohortTotal)}
                  </span>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeField(field)}
                  aria-label={`Quitar campo ${label}`}
                  className="rounded-full px-1 text-on-surface-variant hover:bg-surface-lowest hover:text-on-surface disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ResearchFieldPicker;
