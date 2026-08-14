'use client';

import { useState } from 'react';

interface DiagnosisCode {
  code: string;
  description: string;
  type?: 'principal' | 'secondary';
}

interface DiagnosisCodePickerProps {
  onSelect: (code: DiagnosisCode) => void;
  results: DiagnosisCode[];
  searching?: boolean;
}

export function DiagnosisCodePicker({
  onSelect,
  results,
  searching = false,
}: DiagnosisCodePickerProps) {
  const [activeTab, setActiveTab] = useState<'CIE-10' | 'SNOMED'>('CIE-10');

  return (
    <div className="relative bg-surface-lowest backdrop-blur-xl border border-outline-variant rounded-xl shadow-modal overflow-hidden">
      {/* Search input */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant">
        <svg className="w-4 h-4 text-on-surface-variant flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
          placeholder="Buscar diagnóstico CIE-10..."
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('CIE-10')}
            className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
              activeTab === 'CIE-10'
                ? 'bg-secondary-container/20 text-secondary'
                : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
            }`}
          >
            CIE-10
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SNOMED')}
            className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
              activeTab === 'SNOMED'
                ? 'bg-secondary-container/20 text-secondary'
                : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
            }`}
          >
            SNOMED
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="max-h-64 overflow-y-auto">
        {searching ? (
          <div className="px-4 py-8 text-center text-sm text-on-surface-variant/60">
            Buscando...
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-on-surface-variant/60">
            Escribe para buscar diagnósticos
          </div>
        ) : (
          results.map((code) => (
            <button
              key={code.code}
              type="button"
              onClick={() => onSelect(code)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-low transition-colors duration-75 group"
            >
              <span className="flex-shrink-0 font-mono text-sm font-medium text-secondary w-14 text-left">
                {code.code}
              </span>
              <span className="text-sm text-on-surface group-hover:text-on-surface text-left">
                {code.description}
              </span>
              {code.type && (
                <span className="ml-auto text-xs text-on-surface-variant/60 group-hover:text-on-surface-variant">
                  {code.type === 'principal' ? 'Principal' : 'Secundario'}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
