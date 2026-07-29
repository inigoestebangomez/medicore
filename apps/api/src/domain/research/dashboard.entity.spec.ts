// apps/api/src/domain/research/dashboard.entity.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Dashboard } from './dashboard.entity';
import { DashboardWidgetVO } from './value-objects/dashboard-widget.vo';

const ORG = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000002';
const QUERY = '00000000-0000-0000-0000-000000000003';

function widget(id: string, queryId = QUERY) {
  return DashboardWidgetVO.create({
    id,
    queryId,
    chartType: 'bar_chart',
    position: { x: 0, y: 0, w: 4, h: 3 },
    displayConfig: { displayFields: [], statsMode: 'descriptive' },
  });
}

describe('Dashboard entity', () => {
  it('createPrivate() seeds an empty private dashboard (BR-RES-001)', () => {
    const d = Dashboard.createPrivate({ organizationId: ORG, createdBy: USER, name: 'Knee OA' });
    expect(d.widgets).toEqual([]);
    expect(d.isOwnedBy(USER)).toBe(true);
    expect(d.isOwnedBy('other')).toBe(false);
    expect(d.deletedAt).toBeNull();
  });

  it('addWidget() appends a widget immutably and is idempotent by id', () => {
    const d = Dashboard.createPrivate({ organizationId: ORG, createdBy: USER, name: 'D' });
    const w = widget('w1');
    const d1 = d.addWidget(w);
    expect(d1.widgets.length).toBe(1);
    // original unchanged (immutability)
    expect(d.widgets.length).toBe(0);
    // idempotent
    const d2 = d1.addWidget(widget('w1'));
    expect(d2.widgets.length).toBe(1);
  });

  it('removeWidget() returns a new instance without the widget', () => {
    const d = Dashboard.createPrivate({ organizationId: ORG, createdBy: USER, name: 'D' })
      .addWidget(widget('w1'))
      .addWidget(widget('w2'));
    const removed = d.removeWidget('w1');
    expect(removed.widgets.map((w) => w.id)).toEqual(['w2']);
    expect(d.widgets.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('updateLayout() moves widgets to new positions', () => {
    const d = Dashboard.createPrivate({ organizationId: ORG, createdBy: USER, name: 'D' })
      .addWidget(widget('w1'))
      .addWidget(widget('w2'));
    const moved = d.updateLayout({ w1: { x: 6, y: 2, w: 4, h: 3 } });
    const w1 = moved.getWidget('w1')!;
    expect(w1.position).toEqual({ x: 6, y: 2, w: 4, h: 3 });
    // untouched widget keeps its position
    expect(moved.getWidget('w2')!.position).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  it('delete() marks soft-delete', () => {
    const d = Dashboard.createPrivate({ organizationId: ORG, createdBy: USER, name: 'D' });
    expect(d.delete().isDeleted).toBe(true);
  });
});

describe('DashboardWidgetVO', () => {
  it('rejects out-of-bounds position', () => {
    expect(() =>
      DashboardWidgetVO.create({
        id: 'w',
        queryId: QUERY,
        chartType: 'bar_chart',
        position: { x: -1, y: 0, w: 4, h: 3 },
        displayConfig: { displayFields: [], statsMode: 'descriptive' },
      }),
    ).toThrow();
    expect(() =>
      DashboardWidgetVO.create({
        id: 'w',
        queryId: QUERY,
        chartType: 'bar_chart',
        position: { x: 0, y: 0, w: 13, h: 3 },
        displayConfig: { displayFields: [], statsMode: 'descriptive' },
      }),
    ).toThrow();
  });

  it('moveTo() returns a new VO at the new position', () => {
    const w = widget('w1');
    const moved = w.moveTo({ x: 2, y: 2, w: 6, h: 4 });
    expect(moved.position).toEqual({ x: 2, y: 2, w: 6, h: 4 });
    expect(w.position).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });
});