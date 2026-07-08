'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrganization } from './actions';

const ORG_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'SOLO_PRACTICE', label: 'Solo Practice' },
  { value: 'CLINIC', label: 'Clinic' },
  { value: 'HOSPITAL_DEPT', label: 'Hospital Department' },
];

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('SOLO_PRACTICE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim() || name.trim().length < 3) {
      setError('Organization name must be at least 3 characters');
      setLoading(false);
      return;
    }

    try {
      await createOrganization(name.trim(), type);
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-white px-6 py-8 shadow-lg ring-1 ring-gray-900/5">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Organization Name
          </label>
          <input
            id="name"
            type="text"
            required
            minLength={3}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dr. Smith ENT Clinic"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Organization Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ORG_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Creating workspace...' : 'Create Workspace'}
        </button>
      </form>
    </div>
  );
}
