// apps/api/src/api/health/health.controller.spec.ts
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return { status: "ok" }', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});