// apps/api/src/application/research/commands/table-one.handler.ts
// Command handler: GenerateTableOne (M2). Delegates to TableOneService.

import { Injectable } from '@nestjs/common';
import { TableOneService, type TableOneResult, type GenerateTableOneCommand } from '../services/table-one.service';

export type TableOneCommand = GenerateTableOneCommand;

@Injectable()
export class TableOneHandler {
  constructor(private readonly tableOneService: TableOneService) {}

  async execute(cmd: TableOneCommand): Promise<TableOneResult> {
    return this.tableOneService.generate(cmd);
  }
}

// Two-group comparison is the same service with groupBy set — a thin alias so
// the controller can wire a distinct handler without duplicating logic.
@Injectable()
export class TableOneCompareHandler {
  constructor(private readonly tableOneService: TableOneService) {}

  async execute(cmd: TableOneCommand): Promise<TableOneResult> {
    if (!cmd.groupBy) throw new Error('groupBy field is required for comparison');
    return this.tableOneService.generate(cmd);
  }
}