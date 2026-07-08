// apps/web/app/(dashboard)/analytics/page.tsx
import { auth } from '@/lib/auth';
import { AnalyticsDashboard } from './analytics-dashboard';

export default async function AnalyticsPage() {
  await auth();
  return <AnalyticsDashboard />;
}
