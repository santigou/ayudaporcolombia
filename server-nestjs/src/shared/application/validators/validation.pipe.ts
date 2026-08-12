import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      const result = this.schema.parse(value);
      return result;
    } catch (error: any) {
      const firstError = error.errors?.[0];
      const message = firstError 
        ? `${firstError.path.join('.')}: ${firstError.message}` 
        : 'Validation failed';
      
      throw new BadRequestException(message);
    }
  }
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly maxSize: number = 5 * 1024 * 1024, // 5MB
    private readonly allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/jpg'],
  ) {}

  transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!file) {
      return null;
    }

    if (file.size > this.maxSize) {
      throw new BadRequestException(`File size exceeds ${this.maxSize / (1024 * 1024)}MB limit`);
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    return file;
  }
}