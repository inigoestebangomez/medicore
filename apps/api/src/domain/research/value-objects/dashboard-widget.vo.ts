// apps/api/src/domain/research/value-objects/dashboard-widget.vo.ts
// Value object: DashboardWidget — a single widget reference inside a Dashboard.
// Design AD-2: widget references a ResearchQuery by ID plus a display config
// (live-reference, not a snapshot). Position is grid coordinates.

import type {
  WidgetChartType,
  WidgetPosition,
  WidgetDisplayConfig,
  DashboardWidget as WidgetDTO,
} from '@medicore/contracts';

export { WidgetChartType, WidgetPosition, WidgetDisplayConfig };

export class DashboardWidgetVO {
  readonly id: string;
  readonly queryId: string;
  readonly chartType: WidgetChartType;
  readonly position: WidgetPosition;
  readonly displayConfig: WidgetDisplayConfig;
  readonly title?: string;

  private constructor(props: WidgetDTO) {
    this.id = props.id;
    this.queryId = props.queryId;
    this.chartType = props.chartType;
    this.position = props.position;
    this.displayConfig = props.displayConfig;
    this.title = props.title;
  }

  static create(props: WidgetDTO): DashboardWidgetVO {
    if (!props.id) throw new Error('DashboardWidget requires an id');
    if (!props.queryId) throw new Error('DashboardWidget requires a queryId');
    if (!props.chartType) throw new Error('DashboardWidget requires a chartType');
    if (
      props.position.w < 1 ||
      props.position.w > 12 ||
      props.position.h < 1 ||
      props.position.x < 0 ||
      props.position.y < 0
    ) {
      throw new Error('DashboardWidget position out of bounds (x>=0, y>=0, 1<=w<=12, h>=1)');
    }
    return new DashboardWidgetVO({
      id: props.id,
      queryId: props.queryId,
      chartType: props.chartType,
      position: props.position,
      displayConfig: props.displayConfig ?? { displayFields: [], statsMode: 'descriptive' },
      title: props.title,
    });
  }

  /** Move/resize the widget (new position) — returns a new VO (immutable). */
  moveTo(position: WidgetPosition): DashboardWidgetVO {
    return DashboardWidgetVO.create({
      id: this.id,
      queryId: this.queryId,
      chartType: this.chartType,
      position,
      displayConfig: this.displayConfig,
      title: this.title,
    });
  }

  toDTO(): WidgetDTO {
    return {
      id: this.id,
      queryId: this.queryId,
      chartType: this.chartType,
      position: this.position,
      displayConfig: this.displayConfig,
      title: this.title,
    };
  }
}