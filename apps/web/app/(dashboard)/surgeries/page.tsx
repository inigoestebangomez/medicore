import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OrgSurgeriesList } from './org-surgeries-list';

export default async function SurgeriesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-on-surface">Cirugías</h1>
      <OrgSurgeriesList />
    </div>
  );
}