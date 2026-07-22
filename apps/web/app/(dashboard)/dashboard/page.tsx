// apps/web/app/(dashboard)/dashboard/page.tsx
import { auth } from '@/lib/auth';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  await auth();
  return <DashboardClient />;
}