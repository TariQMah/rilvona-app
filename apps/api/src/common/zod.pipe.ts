import { PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppError } from './errors';

export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Check the submitted fields',
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    return parsed.data;
  }
}
