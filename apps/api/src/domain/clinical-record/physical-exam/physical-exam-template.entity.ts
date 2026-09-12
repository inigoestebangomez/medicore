// apps/api/src/domain/clinical-record/physical-exam/physical-exam-template.entity.ts
// Domain entity: PhysicalExamTemplate — versioned specialty templates.
// Spec §4: records pin template version; historical exams render with pinned snapshot.

export interface ExamTemplateField {
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN';
  required: boolean;
  options?: string[];
}

export interface PhysicalExamTemplateProps {
  id: string;
  organizationId: string;
  specialty: string;
  version: number;
  fields: ExamTemplateField[];
  publishedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PhysicalExamTemplate {
  readonly id: string;
  readonly organizationId: string;
  readonly specialty: string;
  readonly version: number;
  readonly fields: ExamTemplateField[];
  readonly publishedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: PhysicalExamTemplateProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.specialty = props.specialty;
    this.version = props.version;
    this.fields = props.fields;
    this.publishedAt = props.publishedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Returns the field definition for a given key, or undefined if not found.
   */
  getField(key: string): ExamTemplateField | undefined {
    return this.fields.find((f) => f.key === key);
  }

  /**
   * Returns all required fields in this template.
   */
  get requiredFields(): ExamTemplateField[] {
    return this.fields.filter((f) => f.required);
  }
}
