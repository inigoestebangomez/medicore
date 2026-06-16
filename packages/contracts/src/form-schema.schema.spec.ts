import { describe, it, expect } from 'vitest';
import {
  FormFieldSchema,
  FormTemplateSchema,
  FormValueSchema,
  FormInstanceSchema,
} from './form-schema.schema';

describe('form-schema.schema', () => {
  describe('FormFieldSchema', () => {
    it('should parse a valid text field', () => {
      const result = FormFieldSchema.parse({
        type: 'text',
        id: 'chief-complaint',
        label: 'Chief Complaint',
      });
      expect(result).toMatchObject({
        type: 'text',
        id: 'chief-complaint',
        label: 'Chief Complaint',
        required: false,
        multiline: false,
      });
    });

    it('should parse a text field with multiline=true', () => {
      const result = FormFieldSchema.parse({
        type: 'text',
        id: 'notes',
        label: 'Notes',
        multiline: true,
      });
      expect(result).toMatchObject({ type: 'text', multiline: true });
    });

    it('should parse a valid select field with options', () => {
      const result = FormFieldSchema.parse({
        type: 'select',
        id: 'pain-location',
        label: 'Pain Location',
        options: [
          { value: 'head', label: 'Head' },
          { value: 'chest', label: 'Chest' },
        ],
      });
      expect(result).toMatchObject({ type: 'select', required: false });
    });

    it('should parse a valid scale field with min/max', () => {
      const result = FormFieldSchema.parse({
        type: 'scale',
        id: 'pain-level',
        label: 'Pain Level',
        min: 0,
        max: 10,
      });
      expect(result).toMatchObject({
        type: 'scale',
        min: 0,
        max: 10,
        step: 1,
        showLabels: false,
        required: false,
      });
    });

    it('should parse a valid checkbox field', () => {
      const result = FormFieldSchema.parse({
        type: 'checkbox',
        id: 'symptoms',
        label: 'Symptoms',
        options: [
          { value: 'fever', label: 'Fever' },
          { value: 'cough', label: 'Cough' },
        ],
      });
      expect(result).toMatchObject({ type: 'checkbox', required: false });
    });

    it('should parse a valid section field', () => {
      const result = FormFieldSchema.parse({
        type: 'section',
        id: 'vitals-section',
        title: 'Vitals',
      });
      expect(result).toMatchObject({
        type: 'section',
        collapsible: true,
      });
    });

    it('should reject an unknown type like radio', () => {
      expect(() =>
        FormFieldSchema.parse({
          type: 'radio',
          id: 'test',
          label: 'test',
        }),
      ).toThrow();
    });

    it('should reject a scale field without min/max', () => {
      expect(() =>
        FormFieldSchema.parse({
          type: 'scale',
          id: 'pain',
          label: 'Pain',
        }),
      ).toThrow();
    });

    it('should reject a select field with empty options array', () => {
      expect(() =>
        FormFieldSchema.parse({
          type: 'select',
          id: 'test',
          label: 'Test',
          options: [],
        }),
      ).toThrow();
    });

    it('should reject a checkbox field with empty options array', () => {
      expect(() =>
        FormFieldSchema.parse({
          type: 'checkbox',
          id: 'test',
          label: 'Test',
          options: [],
        }),
      ).toThrow();
    });

    it('should parse a valid number field with min/max', () => {
      const result = FormFieldSchema.parse({
        type: 'number',
        id: 'heart-rate',
        label: 'Heart Rate',
        min: 40,
        max: 200,
        step: 1,
      });
      expect(result).toMatchObject({
        type: 'number',
        id: 'heart-rate',
        label: 'Heart Rate',
        min: 40,
        max: 200,
        step: 1,
        required: false,
      });
    });

    it('should parse a number field with only required fields', () => {
      const result = FormFieldSchema.parse({
        type: 'number',
        id: 'weight',
        label: 'Weight (kg)',
      });
      expect(result).toMatchObject({
        type: 'number',
        step: 1,
        required: false,
      });
    });

    it('should reject a number field without required id', () => {
      expect(() =>
        FormFieldSchema.parse({
          type: 'number',
          label: 'No ID',
        }),
      ).toThrow();
    });
  });

  describe('FormTemplateSchema', () => {
    const validFields = [
      { type: 'text' as const, id: 'complaint', label: 'Chief Complaint' },
      { type: 'scale' as const, id: 'pain', label: 'Pain Level', min: 0, max: 10 },
      {
        type: 'select' as const,
        id: 'location',
        label: 'Location',
        options: [{ value: 'head', label: 'Head' }],
      },
    ];

    it('should accept a valid template with 3 unique fields', () => {
      const result = FormTemplateSchema.parse({
        id: 'cardio-template',
        name: 'Cardiology Consultation',
        specialty: 'cardiology',
        version: '1.0.0',
        fields: validFields,
      });
      expect(result.id).toBe('cardio-template');
      expect(result.fields).toHaveLength(3);
    });

    it('should reject a template with duplicate field IDs', () => {
      const dupFields = [
        { type: 'text' as const, id: 'complaint', label: 'Chief Complaint' },
        { type: 'text' as const, id: 'complaint', label: 'Another Complaint' },
      ];
      const result = FormTemplateSchema.safeParse({
        id: 'dup-template',
        name: 'Dup Test',
        specialty: 'test',
        version: '1.0.0',
        fields: dupFields,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('Duplicate field IDs'))).toBe(true);
      }
    });

    it('should reject a template with empty fields array', () => {
      expect(() =>
        FormTemplateSchema.parse({
          id: 'empty',
          name: 'Empty',
          specialty: 'test',
          version: '1.0.0',
          fields: [],
        }),
      ).toThrow();
    });

    it('should reject a template with invalid version string', () => {
      expect(() =>
        FormTemplateSchema.parse({
          id: 'bad-ver',
          name: 'Bad Version',
          specialty: 'test',
          version: 'v1',
          fields: validFields,
        }),
      ).toThrow();
    });

    it('should accept a template with valid semver "1.0.0"', () => {
      const result = FormTemplateSchema.parse({
        id: 'ok-ver',
        name: 'OK Version',
        specialty: 'test',
        version: '1.0.0',
        fields: validFields,
      });
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('FormValueSchema', () => {
    it('should accept a record with string values', () => {
      const result = FormValueSchema.parse({ chiefComplaint: 'headache', painLevel: 7 });
      expect(result.chiefComplaint).toBe('headache');
      expect(result.painLevel).toBe(7);
    });

    it('should accept an empty object', () => {
      const result = FormValueSchema.parse({});
      expect(result).toEqual({});
    });

    it('should reject a non-object (string)', () => {
      expect(() => FormValueSchema.parse('not an object')).toThrow();
    });
  });

  describe('FormInstanceSchema', () => {
    it('should accept a valid form instance', () => {
      const result = FormInstanceSchema.parse({
        templateId: 'cardio-template',
        version: '1.0.0',
        values: { complaint: 'headache', painLevel: 7 },
      });
      expect(result.templateId).toBe('cardio-template');
      expect(result.version).toBe('1.0.0');
      expect(result.values.complaint).toBe('headache');
      expect(result.completedAt).toBeUndefined();
    });

    it('should accept a form instance with completedAt', () => {
      const result = FormInstanceSchema.parse({
        templateId: 'cardio-template',
        version: '1.0.0',
        values: {},
        completedAt: '2024-06-15T10:30:00.000Z',
      });
      expect(result.completedAt).toBe('2024-06-15T10:30:00.000Z');
    });

    it('should reject instance without templateId', () => {
      expect(() =>
        FormInstanceSchema.parse({
          version: '1.0.0',
          values: {},
        }),
      ).toThrow();
    });

    it('should reject instance with empty templateId', () => {
      expect(() =>
        FormInstanceSchema.parse({
          templateId: '',
          version: '1.0.0',
          values: {},
        }),
      ).toThrow();
    });

    it('should reject instance without version', () => {
      expect(() =>
        FormInstanceSchema.parse({
          templateId: 'template-1',
          values: {},
        }),
      ).toThrow();
    });

    it('should accept instance with empty values', () => {
      const result = FormInstanceSchema.parse({
        templateId: 'template-1',
        version: '1.0.0',
        values: {},
      });
      expect(result.values).toEqual({});
    });

    it('should reject instance with invalid completedAt', () => {
      expect(() =>
        FormInstanceSchema.parse({
          templateId: 'template-1',
          version: '1.0.0',
          values: {},
          completedAt: 'not-a-date',
        }),
      ).toThrow();
    });
  });
});