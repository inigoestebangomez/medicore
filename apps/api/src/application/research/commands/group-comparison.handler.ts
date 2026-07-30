// apps/api/src/application/research/commands/group-comparison.handler.ts
// Command handler: GroupComparison (M6). Delegates to GroupComparisonService.

import { Injectable } from '@nestjs/common';
import {
  GroupComparisonService,
  type GroupComparisonCommand,
  type GroupComparisonResult,
} from '../services/group-comparison.service';

export type { GroupComparisonCommand, GroupComparisonResult } from '../services/group-comparison.service';

@Injectable()
export class GroupComparisonHandler {
  constructor(private readonly groupComparison: GroupComparisonService) {}

  async execute(cmd: GroupComparisonCommand): Promise<GroupComparisonResult> {
    if (!cmd.groupBy) throw new Error('groupBy field is required');
    if (!cmd.variableFields || cmd.variableFields.length === 0) throw new Error('variableFields is required');
    return this.groupComparison.compare(cmd);
  }
}