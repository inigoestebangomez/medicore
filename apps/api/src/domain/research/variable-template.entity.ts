// apps/api/src/domain/research/variable-template.entity.ts
// Domain entity: VariableTemplate — reusable org-level variable definition
// (REQ-FB-002). Editing a template does NOT break existing studies: the
// StudyVariableLink snapshot stays immutable once a study takes a copy.

import { VariableTypeVO } from './value-objects/variable-type.vo';
import type { VariableOptionDef, VariableRangeDef } from './value-objects/variable-value.vo';
import type { StudyVariable } from './study-variable.entity';
import { randomUUID } from 'node:crypto';

export interface VariableTemplateProps {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  type: string;
  unit?: string | null;
  options?: VariableOptionDef[] | null;
  range?: VariableRangeDef | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class VariableTemplate {
  readonly id: string;
  readonly organizationId: string;
  readonly createdBy: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: VariableTypeVO;
  readonly unit: string | null;
  readonly options: VariableOptionDef[] | null;
  readonly range: VariableRangeDef | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: VariableTemplateProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.createdBy = props.createdBy;
    this.name = props.name;
    this.description = props.description ?? null;
    this.type = VariableTypeVO.create(props.type);
    this.unit = props.unit ?? null;
    this.options = props.options ?? null;
    this.range = props.range ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: {
    id: string;
    organizationId: string;
    createdBy: string;
    name: string;
    description?: string;
    type: string;
    unit?: string | null;
    options?: VariableOptionDef[] | null;
    range?: VariableRangeDef | null;
  }): VariableTemplate {
    return new VariableTemplate(props);
  }

  update(props: Partial<VariableTemplateProps>): VariableTemplate {
    return new VariableTemplate({ ...toProps(this), ...props, updatedAt: new Date() });
  }

  /**
   * Instantiate a StudyVariable from this template — a snapshot copy owned by
   * the study. The caller also creates the StudyVariableLink snapshot row
   * (REQ-FB-002) so future template edits don't mutate the per-study variable.
   */
  instantiate(studyId: string, organizationId: string): {
    variable: StudyVariable;
    link: { templateId: string; studyId: string; studyVarId: string };
  } {
    const { StudyVariable: SV } = require('./study-variable.entity');
    const variable = SV.create({
      id: randomUUID(),
      organizationId,
      studyId,
      name: this.name,
      label: this.name,
      type: this.type.value,
      scope: 'CUSTOM',
      unit: this.unit,
      options: this.options,
      range: this.range,
    });
    return {
      variable,
      link: { templateId: this.id, studyId, studyVarId: variable.id },
    };
  }
}

function toProps(t: VariableTemplate): VariableTemplateProps {
  return {
    id: t.id,
    organizationId: t.organizationId,
    createdBy: t.createdBy,
    name: t.name,
    description: t.description,
    type: t.type.value,
    unit: t.unit,
    options: t.options,
    range: t.range,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}