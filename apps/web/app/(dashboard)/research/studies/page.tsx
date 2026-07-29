'use client';

// apps/web/app/(dashboard)/research/studies/page.tsx
// Studies dashboard landing (M8). Renders MyStudiesDashboard.

import { MyStudiesDashboard } from '@/components/research/MyStudiesDashboard';

export default function StudiesPage() {
  return (
    <div className="container mx-auto py-6">
      <MyStudiesDashboard />
    </div>
  );
}