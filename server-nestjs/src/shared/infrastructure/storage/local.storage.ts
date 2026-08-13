import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { Storage, PresignResult } from '../../domain/storage.port';
import { isImageMime, extFromMime } from '../multer/upload.config';

// Adaptador de almacenamiento local (modo desarrollo).
//
// El navegador sube vía PUT a /api/uploads/raw/<uuid>.ext (ruta del backend que
// escribe a disco) y se sirve desde /uploads/<uuid>.ext (estático de NestJS).
// Mismo contrato que SeaweedfsStorage: el frontend no distingue dev de prod.
@Injectable()
export class LocalStorage implements Storage {
  readonly uploadDir: string;

  constructor(_config: ConfigService) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async presign(filename: string, mimetype: string): Promise<PresignResult> {
    if (!isImageMime(mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes (jpeg, png, webp, gif)');
    }
    const ext = path.extname(filename).toLowerCase() || extFromMime(mimetype);
    const key = `${crypto.randomUUID()}${ext}`;
    return {
      uploadUrl: `/api/uploads/raw/${key}`,
      publicUrl: `/uploads/${key}`,
      method: 'PUT',
    };
  }
}
