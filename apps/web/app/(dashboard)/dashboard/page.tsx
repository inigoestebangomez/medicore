// apps/web/app/(dashboard)/dashboard/page.tsx
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();
  const organizationId = (session as any)?.organizationId;
  const role = (session as any)?.role;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome back, {session?.user?.name ?? session?.user?.email}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Organization</h3>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {organizationId ? 'Active' : 'Not set'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Role</h3>
          <p className="mt-1 text-lg font-semibold text-gray-900">{role ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Patients</h3>
          <p className="mt-1 text-lg font-semibold text-gray-900">0</p>
        </div>
      </div>
    </div>
  );
}