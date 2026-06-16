// packages/contracts/src/form-schema.schema.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// Form field option
// ─────────────────────────────────────────────

const FieldOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

// ─────────────────────────────────────────────
// FormField — discriminated union by type
// ─────────────────────────────────────────────

const TextFieldSchema = z.object({
  type: z.literal('text'),
  id: z.string().min(1),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  multiline: z.boolean().default(false),
});

const SelectFieldSchema = z.object({
  type: z.literal('select'),
  id: z.string().min(1),
  label: z.string().min(1),
  options: z.array(FieldOptionSchema).min(1),
  required: z.boolean().default(false),
});

const ScaleFieldSchema = z.object({
  type: z.literal('scale'),
  id: z.string().min(1),
  label: z.string().min(1),
  min: z.number().int(),
  max: z.number().int(),
  step: z.number().default(1),
  showLabels: z.boolean().default(false),
  required: z.boolean().default(false),
});

const CheckboxFieldSchema = z.object({
  type: z.literal('checkbox'),
  id: z.string().min(1),
  label: z.string().min(1),
  options: z.array(FieldOptionSchema).min(1),
  required: z.boolean().default(false),
});

const NumberFieldSchema = z.object({
  type: z.literal('number'),
  id: z.string().min(1),
  label: z.string().min(1),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().default(1),
  required: z.boolean().default(false),
});

const SectionFieldSchema = z.object({
  type: z.literal('section'),
  id: z.string().min(1),
  title: z.string().min(1),
  collapsible: z.boolean().default(true),
});

export const FormFieldSchema = z.discriminatedUnion('type', [
  TextFieldSchema,
  SelectFieldSchema,
  ScaleFieldSchema,
  CheckboxFieldSchema,
  NumberFieldSchema,
  SectionFieldSchema,
]);
export type FormField = z.infer<typeof FormFieldSchema>;

// ─────────────────────────────────────────────
// FormTemplate
// ─────────────────────────────────────────────

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const FormTemplateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    specialty: z.string().min(1),
    version: z.string().regex(SEMVER_REGEX, 'Version must follow semver (e.g. 1.0.0)'),
    fields: z.array(FormFieldSchema).min(1),
  })
  .refine(
    (template) => {
      const ids = template.fields.map((f) => f.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Duplicate field IDs are not allowed' },
  );
export type FormTemplate = z.infer<typeof FormTemplateSchema>;

// ─────────────────────────────────────────────
// FormValue — intentionally loose for backend
// ─────────────────────────────────────────────

export const FormValueSchema = z.record(z.string(), z.unknown());
export type FormValue = z.infer<typeof FormValueSchema>;

// ─────────────────────────────────────────────
// FormInstance — filled form data
// ─────────────────────────────────────────────

export const FormInstanceSchema = z.object({
  templateId: z.string().min(1),
  version: z.string(),
  values: FormValueSchema,
  completedAt: z.string().datetime().optional(),
});
export type FormInstance = z.infer<typeof FormInstanceSchema>;