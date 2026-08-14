// apps/api/src/api/shared/pipes/zod-validation.pipe.ts
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      const mappingConflicts = result.error.errors.flatMap((error) => {
        if (!('params' in error) || !Array.isArray(error.params?.mappingConflicts)) return [];
        return error.params.mappingConflicts;
      });
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
        ...(mappingConflicts.length > 0 ? { mappingConflicts } : {}),
      });
    }
    return result.data;
  }
}
