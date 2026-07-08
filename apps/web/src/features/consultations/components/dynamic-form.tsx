'use client';

import { useState } from 'react';
import type { FormTemplate, FormField } from '@medicore/contracts';

interface DynamicFormProps {
  template: FormTemplate;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
}

const SECTION_OPEN_STATE: Record<string, boolean> = {};

export function DynamicForm({ template, values, onChange, readOnly }: DynamicFormProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(SECTION_OPEN_STATE);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleChange = (fieldId: string, value: unknown) => {
    onChange({ ...values, [fieldId]: value });
  };

  const handleCheckboxChange = (fieldId: string, optionValue: string, checked: boolean) => {
    const current = (values[fieldId] as string[]) ?? [];
    const next = checked
      ? [...current, optionValue]
      : current.filter((v) => v !== optionValue);
    onChange({ ...values, [fieldId]: next });
  };

  return (
    <div className="space-y-3">
      {template.fields.map((field) => (
        <DynamicField
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(val) => handleChange(field.id, val)}
          onCheckboxChange={(optVal, checked) => handleCheckboxChange(field.id, optVal, checked)}
          readOnly={readOnly}
          isOpen={openSections[field.id] ?? false}
          onToggleSection={() => toggleSection(field.id)}
        />
      ))}
    </div>
  );
}

interface DynamicFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  onCheckboxChange: (optionValue: string, checked: boolean) => void;
  readOnly?: boolean;
  isOpen?: boolean;
  onToggleSection?: () => void;
}

function DynamicField({
  field,
  value,
  onChange,
  onCheckboxChange,
  readOnly,
  isOpen,
  onToggleSection,
}: DynamicFieldProps) {
  switch (field.type) {
    case 'section':
      return (
        <SectionHeader
          field={field}
          isOpen={isOpen ?? false}
          onToggle={onToggleSection ?? (() => {})}
        />
      );

    case 'text':
      return <TextField field={field} value={asString(value)} onChange={onChange} readOnly={readOnly} />;

    case 'select':
      return <SelectField field={field} value={asString(value)} onChange={onChange} readOnly={readOnly} />;

    case 'scale':
      return <ScaleField field={field} value={asNumber(value, field.min)} onChange={onChange} readOnly={readOnly} />;

    case 'checkbox':
      return (
        <CheckboxField
          field={field}
          value={(value as string[]) ?? []}
          onChange={onCheckboxChange}
          readOnly={readOnly}
        />
      );

    case 'number':
      return <NumberField field={field} value={asNumber(value, undefined)} onChange={onChange} readOnly={readOnly} />;

    default:
      return null;
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback: number | undefined): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return isNaN(n) ? fallback : n;
}

function fieldInputClass(extra?: string): string {
  return `mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ${extra ?? ''}`;
}

function SectionHeader({
  field,
  isOpen,
  onToggle,
}: {
  field: Extract<FormField, { type: 'section' }>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const collapsible = field.collapsible !== false;

  return (
    <button
      type="button"
      onClick={collapsible ? onToggle : undefined}
      className="flex w-full items-center gap-2 rounded-md bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700"
    >
      {collapsible &&
        (isOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        ))}
      <span>{field.title}</span>
    </button>
  );
}

function TextField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Extract<FormField, { type: 'text' }>;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder: field.placeholder,
    required: field.required,
    readOnly,
    disabled: readOnly,
    className: fieldInputClass(),
  };

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {field.multiline ? (
        <textarea {...shared} rows={3} />
      ) : (
        <input type="text" {...shared} />
      )}
    </div>
  );
}

function SelectField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Extract<FormField, { type: 'select' }>;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        disabled={readOnly}
        className={fieldInputClass()}
      >
        <option value="">--</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ScaleField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Extract<FormField, { type: 'scale' }>;
  value: number | undefined;
  onChange: (value: number) => void;
  readOnly?: boolean;
}) {
  const current = value ?? field.min;

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {field.label}: <span className="font-semibold">{current}</span>
      </label>
      <div className="mt-1 flex items-center gap-3">
        {field.showLabels !== false && (
          <span className="text-xs text-gray-500 w-8 text-right">{field.min}</span>
        )}
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={readOnly}
          className="flex-1"
        />
        {field.showLabels !== false && (
          <span className="text-xs text-gray-500 w-8">{field.max}</span>
        )}
      </div>
    </div>
  );
}

function CheckboxField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Extract<FormField, { type: 'checkbox' }>;
  value: string[];
  onChange: (optionValue: string, checked: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium text-gray-700">{field.label}</legend>
      {field.options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            value={opt.value}
            checked={value.includes(opt.value)}
            onChange={(e) => onChange(opt.value, e.target.checked)}
            disabled={readOnly}
            className="rounded border-gray-300"
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}

function NumberField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Extract<FormField, { type: 'number' }>;
  value: number | undefined;
  onChange: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        required={field.required}
        readOnly={readOnly}
        disabled={readOnly}
        className={fieldInputClass()}
      />
    </div>
  );
}
