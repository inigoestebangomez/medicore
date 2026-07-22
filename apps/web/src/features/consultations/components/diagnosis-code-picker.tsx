'use client';

import { useState, useRef, useEffect } from 'react';
import { searchCodes } from '@medicore/clinical-codes';
import type { DiagnosisCode } from '@medicore/contracts';
import type { CodeEntry } from '@medicore/clinical-codes';

type DiagnosisType = DiagnosisCode['type'];

const DIAGNOSIS_TYPE_LABEL: Record<DiagnosisType, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  differential: 'Differential',
};

interface DiagnosisCodePickerProps {
  selected: DiagnosisCode[];
  onChange: (codes: DiagnosisCode[]) => void;
}

export function DiagnosisCodePicker({ selected, onChange }: DiagnosisCodePickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CodeEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [typeMenuFor, setTypeMenuFor] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setTypeMenuFor(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const matches = searchCodes(value);
    setResults(matches);
    setShowDropdown(matches.length > 0);
  };

  const addCode = (entry: CodeEntry) => {
    const hasPrimary = selected.some((c) => c.type === 'primary');
    const newCode: DiagnosisCode = {
      system: entry.system,
      code: entry.code,
      description: entry.description,
      type: hasPrimary ? 'secondary' : 'primary',
    };
    onChange([...selected, newCode]);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeCode = (index: number) => {
    const updated = selected.filter((_, i) => i !== index);
    onChange(updated);
  };

  const setType = (index: number, type: DiagnosisType) => {
    const updated = selected.map((code, i) =>
      i === index ? { ...code, type } : code,
    );
    onChange(updated);
    setTypeMenuFor(null);
  };

  const primaryCount = selected.filter((c) => c.type === 'primary').length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Diagnosis Codes</label>
        <span className="text-xs text-on-surface-variant/60">
          {selected.length}/10
        </span>
      </div>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((code, i) => (
            <div
              key={`${code.system}:${code.code}`}
              className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-low px-2.5 py-1 text-xs"
            >
              <span className="font-mono text-on-surface-variant">{code.code}</span>
              <span className="text-on-surface-variant">{code.description}</span>

              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTypeMenuFor(typeMenuFor === i ? null : i);
                  }}
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    code.type === 'primary'
                      ? 'bg-blue-100 text-blue-700'
                      : code.type === 'secondary'
                        ? 'bg-surface-high text-on-surface-variant'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {DIAGNOSIS_TYPE_LABEL[code.type]}
                </button>
                {typeMenuFor === i && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-28 rounded-md border bg-surface-lowest py-1 shadow-lg">
                    {(['primary', 'secondary', 'differential'] as DiagnosisType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(i, t)}
                        className={`block w-full px-3 py-1 text-left text-xs hover:bg-surface-container ${
                          code.type === t ? 'font-semibold' : ''
                        }`}
                      >
                        {DIAGNOSIS_TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeCode(i)}
                className="ml-1 text-on-surface-variant/60 hover:text-red-500"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {primaryCount > 1 && (
        <p className="mt-1 text-xs text-amber-600">
          Only one primary diagnosis allowed. Review your selections.
        </p>
      )}

      {selected.length < 10 && (
        <div className="relative mt-3" ref={containerRef}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Search diagnosis codes (ICD-10)..."
          />

          {showDropdown && (
            <div className="absolute left-0 top-full z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-surface-lowest shadow-lg">
              {results.map((entry) => (
                <button
                  key={`${entry.system}:${entry.code}`}
                  type="button"
                  onClick={() => addCode(entry)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-container"
                >
                  <span className="shrink-0 font-mono text-xs text-on-surface-variant">
                    [{entry.code}]
                  </span>
                  <span className="text-on-surface-variant truncate">{entry.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
