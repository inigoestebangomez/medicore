'use client';

// apps/web/src/components/research/StudyNotificationBadge.tsx
// Unread-notification badge with tooltip.

import { useState } from 'react';

export interface StudyNotificationBadgeProps {
  unreadCount: number;
  latestNew?: number;
}

export function StudyNotificationBadge({ unreadCount, latestNew }: StudyNotificationBadgeProps) {
  const [showTip, setShowTip] = useState(false);
  if (!unreadCount || unreadCount <= 0) return null;
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-on-error">
        {unreadCount}
      </span>
      {showTip && (
        <span className="absolute left-1/2 top-6 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-surface-lowest px-2 py-1 text-xs text-on-surface shadow">
          {latestNew ? `${latestNew} pacientes nuevos desde el último recálculo` : `${unreadCount} notificaciones sin leer`}
        </span>
      )}
    </span>
  );
}

export default StudyNotificationBadge;