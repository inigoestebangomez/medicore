import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OrgImagingGrid } from './org-imaging-grid';

export default async function ImagingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-on-surface">Imágenes</h1>
      <OrgImagingGrid />
    </div>
  );
}