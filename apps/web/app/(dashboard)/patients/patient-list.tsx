'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { usePatients } from '@/hooks/usePatients';

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const SEX_LABEL: Record<string, string> = {
  MALE: 'M',
  FEMALE: 'F',
  OTHER: 'Other',
  UNKNOWN: '—',
};

export function PatientList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = usePatients({
    query: debouncedSearch || undefined,
    page,
    pageSize: 20,
    sortBy: 'lastName',
    sortOrder: 'asc',
  });

  const handlePrevious = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (data && page < data.totalPages) {
      setPage((p) => p + 1);
    }
  }, [data, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Patients</h2>
        <Button
          size="sm"
          onClick={() => router.push('/patients/new')}
        >
          New Patient
        </Button>
      </div>

      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, NHC, or document..."
          className="w-full rounded-md border border-outline px-3 py-2 text-sm placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Error loading patients: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {data && data.items.length === 0 ? (
            <div className="rounded-lg border border-outline-variant bg-surface-lowest p-8 text-center">
              <p className="text-sm text-on-surface-variant">No patients found</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/patients/new')}
              >
                Create your first patient
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest">
                <table className="min-w-full divide-y divide-outline-variant">
                  <thead className="bg-surface-low">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        NHC
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Sex
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Age
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                        Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {data?.items.map((patient) => (
                      <tr
                        key={patient.id}
                        onClick={() => router.push(`/patients/${patient.id}`)}
                        className="cursor-pointer hover:bg-surface-low transition-colors"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-on-surface">
                          {patient.nhc}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-on-surface">
                          {patient.lastName}, {patient.firstName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-on-surface-variant">
                          {SEX_LABEL[patient.sex] ?? patient.sex}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-on-surface-variant">
                          {patient.age ?? calculateAge(patient.birthDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-on-surface-variant">
                          {patient.phone ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">
                    Page {data.page} of {data.totalPages} ({data.total} patients)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      disabled={!data || page >= data.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
