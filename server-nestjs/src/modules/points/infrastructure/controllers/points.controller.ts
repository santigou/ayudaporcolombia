import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { PointService } from '../../application/point.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { RequireAuth } from '../../../../shared/application/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/middleware/auth.middleware';

const updateSchema = z.object({ message: z.string().min(1).max(500) });

// Schema de creaciÃ³n flexible: acepta contacts/locations/supplies como strings
// JSON (FormData) o ya parseados. Las fotos vienen como { name, dataUrl }[].
const createSchema = z.object({
  type: z.enum(['need_help', 'offer_help']),
  title: z.string().min(3).max(150),
  description: z.string().min(10).max(2000),
  helpTypeName: z.string().min(2).max(80).optional(),
  contacts: z.union([z.string(), z.array(z.any())]).optional(),
  locations: z.union([z.string(), z.array(z.any())]).optional(),
  supplies: z.union([z.string(), z.array(z.any())]).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  addressText: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  expiresAt: z.coerce.date().optional(),
  photos: z.array(z.object({ name: z.string(), dataUrl: z.string() })).optional(),
});

function parseJsonArray<T>(raw: unknown): T[] {
  if (typeof raw === 'string') {
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

function savePhoto(dataUrl: string, name: string): { name: string; dataUrl: string } {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  // dataUrl: "data:image/png;base64,...."
  const match = dataUrl.match(/^data:([\w/]+);base64,(.+)$/);
  if (!match) return { name, dataUrl };
  const ext = match[1].split('/')[1]?.split('+')[0] || 'png';
  const filename = `${name.replace(/\.[^.]+$/, '')}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(match[2], 'base64'));
  return { name: filename, dataUrl };
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
  async create(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>, @Req() req: AuthenticatedRequest) {
    const contacts = parseJsonArray(body.contacts) as any[];
    const locations = parseJsonArray(body.locations) as any[];
    const supplies = parseJsonArray(body.supplies) as any[];
    const photos = (body.photos ?? []).map((p) => savePhoto(p.dataUrl, p.name));
    const point = await this.pointService.create(
      {
        type: body.type, title: body.title, description: body.description,
        helpTypeName: body.helpTypeName, contacts, locations, supplies,
        lat: body.lat, lng: body.lng, addressText: body.addressText,
        city: body.city, neighborhood: body.neighborhood, expiresAt: body.expiresAt,
        photos,
      },
      req.user?.userId,
    );
    return point;
  }
}
