// apps/api/src/api/shared/pipes/zod-validation.pipe.spec.ts
import { ZodValidationPipe } from './zod-validation.pipe';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

describe('ZodValidationPipe', () => {
  it('should pass through valid data', () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().int() });
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: 'John', age: 30 });
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should throw BadRequestException for invalid data', () => {
    const schema = z.object({ email: z.string().email() });
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ email: 'not-an-email' })).toThrow(BadRequestException);
  });

  it('should include field-level error details in BadRequestException', () => {
    const schema = z.object({
      name: z.string().min(2),
      age: z.number().int().positive(),
    });
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: 'A', age: -1 });
      fail('Expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse();
      expect(response).toHaveProperty('errors');
      expect((response as any).errors.length).toBeGreaterThan(0);
    }
  });

  it('should validate primitives', () => {
    const schema = z.string().min(3);
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform('hello')).toBe('hello');
    expect(() => pipe.transform('hi')).toThrow(BadRequestException);
  });
});