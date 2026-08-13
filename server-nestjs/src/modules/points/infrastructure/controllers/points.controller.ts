import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { PointService } from '../../application/point.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { photosStorage, photosFileFilter } from '../../../../shared/infrastructure/multer/upload.config';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { RequireAuth } from '../../../../shared/application/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/middleware/auth.middleware';

const updateSchema = z.object({ message: z.string().min(1).max(500) });

// Multipart envía todos los campos como strings. Parsea los que llegan como
// JSON-string (locations, contacts, supplies) y los que ya vienen parseados.
function parseJsonArray<T>(raw: unknown): T[] {
  if (typeof raw === 'string') {
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

@Controller('api/points')
export class PointsController {
  constructor(private readonly pointService: PointService) {}

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
  @UseInterceptors(FilesInterceptor('photos', 5, {
    storage: photosStorage,
    fileFilter: photosFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async create(
    @Body() body: Record<string, any>,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthenticatedRequest,
  ) {
    // multipart/form-data: los campos de texto llegan como strings. Coercemos y
    // validamos manualmente (no podemos usar ZodValidationPipe sobre @Body
    // porque multer aún no ha parseado el body cuando el pipe global corre).
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
    // multer ya guardó las fotos a disco con nombres UUID; mapeamos a sus URLs.
    const photoUrls = (files ?? []).map((f) => `/uploads/${f.filename}`);

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
}
