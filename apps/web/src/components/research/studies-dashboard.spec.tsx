// apps/web/src/components/research/studies-dashboard.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/query-test-utils';
import type { StudyDTO } from '@/hooks/useStudiesWithBadges';

const study: StudyDTO = {
  id: 's1',
  organizationId: 'o',
  createdBy: 'u',
  queryId: 'q',
  studyType: 'QUERY',
  name: 'Septoplastia 2024',
  description: 'Cohorte retrospectiva',
  status: 'ACTIVE',
  cachedPatientIds: ['p1', 'p2'],
  cachedAt: '2026-02-01T00:00:00.000Z',
  patientCount: 2,
  analyses: [],
  publicationRef: null,
  frozenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  isLive: true,
};

import { StudyCard } from './StudyCard';
import { StudyNotificationBadge } from './StudyNotificationBadge';
import { StudySuggestionPanel } from './StudySuggestionPanel';

describe('StudyCard', () => {
  it('renders name, status badge, patient count, and a live indicator for active studies', () => {
    renderWithProviders(<StudyCard study={study} unreadCount={3} />);
    expect(screen.getByText('Septoplastia 2024')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(screen.getByText((c) => c.includes('pacientes')).textContent?.includes('2')).toBe(true);
    expect(screen.getByText('3 nuevas')).toBeTruthy();
  });

  it('renders freeze + archive actions for active studies and fires callbacks', () => {
    const onFreeze = vi.fn();
    const onArchive = vi.fn();
    // confirm() auto-returns false (jsdom) so click only calls the handler
    const { container } = renderWithProviders(
      <StudyCard study={study} onFreeze={onFreeze} onArchive={onArchive} />,
    );
    expect(screen.getByText('Congelar')).toBeTruthy();
    expect(screen.getByText('Archivar')).toBeTruthy();
    expect(container).toBeTruthy();
  });

  it('hides lifecycle actions for a frozen study', () => {
    const frozen = { ...study, status: 'FROZEN' as const, frozenAt: '2026-03-01T00:00:00.000Z' };
    renderWithProviders(<StudyCard study={frozen} />);
    expect(screen.getByText('Congelado')).toBeTruthy();
    expect(() => screen.getByText('Congelar')).toThrow();
  });
});

describe('StudyNotificationBadge', () => {
  it('renders nothing when there are no unread notifications', () => {
    const { container } = renderWithProviders(<StudyNotificationBadge unreadCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the count and a tooltip on hover', () => {
    renderWithProviders(<StudyNotificationBadge unreadCount={5} latestNew={2} />);
    expect(screen.getByText('5')).toBeTruthy();
  });
});

describe('StudySuggestionPanel', () => {
  it('renders dismissible suggestion cards', () => {
    renderWithProviders(
      <StudySuggestionPanel
        suggestions={[
          { id: 's1', type: 'table_one_recommended', rationale: 'New study' },
          { id: 's2', type: 'pre_post_available', rationale: 'Has pre/post', recommendedEndpoint: 'POST /research/analysis/pre-post' },
        ]}
      />,
    );
    expect(screen.getByText('Tabla 1 recomendada')).toBeTruthy();
    expect(screen.getByText('Análisis pre/post')).toBeTruthy();
  });

  it('renders nothing when suggestions list is empty', () => {
    const { container } = renderWithProviders(<StudySuggestionPanel suggestions={[]} />);
    expect(container.firstChild).toBeNull();
  });
});