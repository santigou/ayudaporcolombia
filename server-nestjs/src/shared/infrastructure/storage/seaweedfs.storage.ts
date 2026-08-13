import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';
import { Storage, PresignResult } from '../../domain/storage.port';
import { isImageMime, extFromMime } from '../multer/upload.config';

// Adaptador de almacenamiento para SeaweedFS vía API S3 (modo producción).
//
// El backend NO recibe ni sube los bytes de las imágenes: genera una URL
// pre-firmada (presigned PUT) con el SDK de AWS que el navegador usa para
// subir directo al bucket "ayudaporcolombia" de SeaweedFS. La firma vence en
// 5 min. La lectura (<img>) usa una URL pública (bucket anónimo de Read).
// Los datos viven en el volumen del contenedor j4f-storage (sin nube externa).
@Injectable()
export class SeaweedfsStorage implements Storage {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    const endpoint = (config.get<string>('S3_ENDPOINT') || '').replace(/\/+$/, '');
    const accessKey = config.get<string>('S3_ACCESS_KEY') || '';
    const secretKey = config.get<string>('S3_SECRET_KEY') || '';
    const bucket = config.get<string>('S3_BUCKET') || '';
    const publicUrl = (config.get<string>('S3_PUBLIC_URL') || '').replace(/\/+$/, '');

    if (!endpoint || !accessKey || !secretKey || !bucket || !publicUrl) {
      throw new Error(
        'Configuración S3 incompleta. Requiere S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET y S3_PUBLIC_URL',
      );
    }
    this.bucket = bucket;
    this.publicUrl = publicUrl;
    this.s3 = new S3Client({
      endpoint,
      region: config.get<string>('S3_REGION') || 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      // SeaweedFS usa URLs path-style: https://host/<bucket>/<key>
      forcePathStyle: true,
      // Desactiva los checksums CRC32 que el SDK v3 inyecta por defecto desde
      // 2024: SeaweedFS (y otros S3-compatibles) NO los soportan y devuelven
      // 403 al ver parámetros como x-amz-checksum-crc32 en la presigned URL.
      // WHEN_REQUIRED = solo añade checksum cuando la operación lo exige.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async presign(filename: string, mimetype: string): Promise<PresignResult> {
    if (!isImageMime(mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes (jpeg, png, webp, gif)');
    }
    const ext = path.extname(filename).toLowerCase() || extFromMime(mimetype);
    // Key = UUID + extensión. La "carpeta" es el bucket; sin subrutas extra.
    const key = `${crypto.randomUUID()}${ext}`;
    // Se firma INCLUYENDO el Content-Type: así el objeto queda con su MIME real
    // (el <img> lo sirve correctamente) y S3 no rechaza el PUT del navegador.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimetype,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 }); // 5 min
    const publicUrl = `${this.publicUrl}/${this.bucket}/${key}`;
    return {
      uploadUrl,
      publicUrl,
      method: 'PUT',
      headers: { 'Content-Type': mimetype },
    };
  }
}

