import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { PointService } from '../../application/point.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { RequireAuth } from '../../../../shared/application/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/middleware/auth.middleware';

const updateSchema = z.object({ message: z.string().min(1).max(500) });

// Estados objetivo válidos para el cambio de estado del ciclo de vida de un Punto.
const statusChangeSchema = z.object({
  status: z.enum(['resolved', 'cancelled', 'active']),
  reason: z.string().max(500).optional(),
});

// Multipart envía todos los campos como strings. Parsea los que llegan como
// JSON-string (locations, contacts, supplies) y los que ya vienen parseados.
function parseJsonArray<T>(raw: unknown): T[] {
  if (typeof raw === 'string') {
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

const MAX_PHOTOS = 5;

@Controller('api/points')
export class PointsController {
  private readonly allowedPhotoPrefixes: string[];

  constructor(
    private readonly pointService: PointService,
    private readonly config: ConfigService,
  ) {
    // Prefijos de URL permitidos para las fotos: anti-abuso (no se pueden colar
    // URLs arbitrarias). En prod = endpoint público S3 + bucket; en dev = /uploads/.
    const driver = (this.config.get<string>('STORAGE_DRIVER') || 'local').toLowerCase();
    if (driver === 'seaweedfs') {
      const pub = (this.config.get<string>('S3_PUBLIC_URL') || '').replace(/\/+$/, '');
      const bucket = this.config.get<string>('S3_BUCKET') || '';
      // Path-style S3: <publicUrl>/<bucket>/
      this.allowedPhotoPrefixes = pub && bucket ? [`${pub}/${bucket}/`] : [];
    } else {
      this.allowedPhotoPrefixes = ['/uploads/'];
    }
  }

  @Get()
  async list(@Query() q: Record<string, string>) {
    const type = q.type === 'need_help' || q.type === 'offer_help' ? q.type : undefined;
    return this.pointService.getPublicPoints({
      type,
      minLat: Number(q.minLat), maxLat: Number(q.maxLat),
      minLng: Number(q.minLng), maxLng: Number(q.maxLng),
    });
  }

  @Get('code/:code')
  async getByCode(@Param('code') code: string, @Req() req: AuthenticatedRequest) {
    return this.pointService.getByCode(code, req.user?.userId);
  }

  @Post(':id/validate')
  @UseGuards(AuthGuard)
  @RequireAuth()
  async validate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.pointService.validate(id, req.user!.userId);
  }

  @Get(':id/updates')
  async getUpdates(@Param('id') id: string) {
    return this.pointService.getUpdates(id);
  }

  // Historial de cambios de estado (ciclo de vida) del punto. Público (si el punto
  // es accesible). Es la fuente del tab "Estado" del detalle.
  @Get(':id/status-history')
  async getStatusHistory(@Param('id') id: string) {
    return this.pointService.getStatusHistory(id);
  }

  // Cambio de estado del ciclo de vida (resolved/cancelled/reactivar). Lo usa el
  // creador del punto o un moderador (la autorización fina la resuelve el servicio).
  @Post(':id/status')
  @UseGuards(AuthGuard)
  @RequireAuth()
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(statusChangeSchema)) body: { status: string; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pointService.changeStatus(id, body.status, req.user!, body.reason);
  }

  // Solicitud de cambio de estado: la hace un usuario que NO es creador ni
  // moderador. Queda pendiente hasta que un moderador la apruebe.
  @Post(':id/status-requests')
  @UseGuards(AuthGuard)
  @RequireAuth()
  async requestStatusChange(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(statusChangeSchema)) body: { status: string; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pointService.requestStatusChange(id, req.user!.userId, body.status, body.reason);
  }

  @Post(':id/updates')
  @UseGuards(AuthGuard)
  @RequireAuth()
  async postUpdate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: { message: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pointService.createUpdate(id, req.user!.userId, body.message);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.pointService.getById(id, req.user?.userId);
  }

  @Post()
  async create(
    @Body() body: Record<string, any>,
    @Req() req: AuthenticatedRequest,
  ) {
    // JSON: las fotos ya se subieron directamente al almacenamiento (SeaweedFS
    // en prod / disco en dev) y aquí llegan como un array de URLs públicas.
    const type = body.type as 'need_help' | 'offer_help';
    if (type !== 'need_help' && type !== 'offer_help') {
      throw new BadRequestException('type debe ser need_help u offer_help');
    }
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    if (title.length < 3) throw new BadRequestException('title: mínimo 3 caracteres');
    if (description.length < 10) throw new BadRequestException('description: mínimo 10 caracteres');

    const contacts = parseJsonArray(body.contacts) as any[];
    const locations = parseJsonArray(body.locations) as any[];
    const supplies = parseJsonArray(body.supplies) as any[];
    const photoUrls = this.validatePhotoUrls(body.photoUrls);

    return this.pointService.create(
      {
        type, title, description,
        helpTypeName: body.helpTypeName ? String(body.helpTypeName) : undefined,
        contacts, locations, supplies,
        lat: body.lat != null ? Number(body.lat) : undefined,
        lng: body.lng != null ? Number(body.lng) : undefined,
        addressText: body.addressText ? String(body.addressText) : undefined,
        city: body.city ? String(body.city) : undefined,
        neighborhood: body.neighborhood ? String(body.neighborhood) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        photoUrls,
      },
      req.user?.userId,
    );
  }

  // Valida que las URLs de fotos pertenezcan al almacenamiento configurado y que
  // no excedan el máximo. Anti-abuso: evita que se cuelen URLs arbitrarias.
  private validatePhotoUrls(raw: unknown): string[] {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [];
    const urls = arr.map((u) => String(u)).filter(Boolean).slice(0, MAX_PHOTOS);
    for (const url of urls) {
      const allowed = this.allowedPhotoPrefixes.some((p) => url.startsWith(p));
      if (!allowed) throw new BadRequestException('Las URLs de fotos no son válidas');
    }
    return urls;
  }
}
