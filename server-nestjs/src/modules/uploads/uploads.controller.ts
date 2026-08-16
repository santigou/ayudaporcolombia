import {
  Controller, Post, Put, Body, Param, Req,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { ZodValidationPipe } from '../../shared/application/validators/validation.pipe';
import { AuthenticatedRequest } from '../../shared/infrastructure/middleware/auth.middleware';
import { UploadsService } from './uploads.service';
import * as fs from 'fs';
import * as path from 'path';

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().min(1),
});

@Controller('api/uploads')
@ApiExcludeController() // API interna del SPA: fuera del Swagger público (docs de partners)
export class UploadsController {
  private readonly uploadDir: string;
  private readonly isLocal: boolean;

  constructor(
    private readonly uploadsService: UploadsService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.isLocal = (this.config.get<string>('STORAGE_DRIVER') || 'local').toLowerCase() !== 'seaweedfs';
  }

  // Pide una URL pre-firmada para subir una foto directamente al almacenamiento.
  // El navegador hace luego un PUT a `uploadUrl` y guarda `publicUrl` en el punto.
  //
  // SIN @RequireAuth() a propósito: un `need_help` (SOS) se publica de forma
  // anónima (ver PointsController.create), y sus fotos se suben ANTES de crear
  // el punto → exigir sesión aquí rompería el flujo anónimo con un 401.
  // El anti-abuso se mantiene por otras vías: solo imágenes (mime validado),
  // filename saneado (UUID + extensión), la URL pre-firmada vence en 5 min,
  // tope de 10 MB en el PUT local y MAX_PHOTOS/allowedPhotoPrefixes al crear
  // el punto.
  @Post('presign')
  async presign(
    @Body(new ZodValidationPipe(presignSchema)) body: { filename: string; mime: string },
  ) {
    return this.uploadsService.presign(body.filename, body.mime);
  }

  // Solo modo LOCAL: recibe el PUT crudo del navegador y lo guarda a disco.
  // En modo seaweedfs el navegador sube directo al Filer; esta ruta nunca se usa.
  @Put('raw/:filename')
  async uploadRaw(@Param('filename') filename: string, @Req() req: AuthenticatedRequest) {
    if (!this.isLocal) throw new NotFoundException();
    // El nombre viene de presign(): UUID + extensión. Validamos para evitar path traversal.
    if (!/^[a-f0-9-]+\.(jpe?g|png|webp|gif)$/i.test(filename)) {
      throw new BadRequestException('Nombre de fichero inválido');
    }
    const buffer = await readRawBody(req);
    if (buffer.length === 0) throw new BadRequestException('Cuerpo vacío');
    if (buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Fichero demasiado grande');
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
    await fs.promises.writeFile(path.join(this.uploadDir, filename), buffer);
    return { ok: true };
  }
}

// Lee el cuerpo crudo de una petición PUT (Content-Type image/* no lo parsea el
// json middleware). Si algún middleware ya lo dejó como Buffer/string, lo usa.
function readRawBody(req: AuthenticatedRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
