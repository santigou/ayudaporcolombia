import {
  Controller, Post, Put, Body, Param, Req,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { ZodValidationPipe } from '../../shared/application/validators/validation.pipe';
import { AuthGuard } from '../../shared/infrastructure/guards/auth.guard';
import { RequireAuth } from '../../shared/application/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../shared/infrastructure/middleware/auth.middleware';
import { UploadsService } from './uploads.service';
import * as fs from 'fs';
import * as path from 'path';

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().min(1),
});

@Controller('api/uploads')
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
  @Post('presign')
  @UseGuards(AuthGuard)
  @RequireAuth()
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
