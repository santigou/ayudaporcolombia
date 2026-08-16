import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PartnerAdminService, PartnerWriteInput } from '../../application/partner-admin.service';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { ApiKeyGuard, AllowUnapprovedPartner, IntegrationRequest } from '../guards/api-key.guard';

const registerSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'solo minúsculas, números y guiones'),
  name: z.string().min(2).max(120),
  contactEmail: z.string().email(),
});

// Campos que el partner puede autogestionar de su config OUTBOUND vía el
// dashboard. Lo que NO está aquí sigue siendo solo del moderador:
// outboundEnabled (empezar a recibir puntos), trusted, inboundEnabled, slug.
const selfUpdateSchema = z.object({
  outboundUrl: z.string().url().nullable().optional(),
  authType: z.enum(['api_key', 'login']).optional(),
  outboundHeaderName: z.string().min(1).max(60).nullable().optional(),
  outboundApiKeyValue: z.string().min(8).max(300).nullable().optional(),
  loginUrl: z.string().url().nullable().optional(),
  loginEmail: z.string().email().nullable().optional(),
  loginPassword: z.string().min(4).max(300).nullable().optional(),
  tokenJsonPath: z.string().min(1).max(120).nullable().optional(),
  tokenHeader: z.string().min(1).max(60).nullable().optional(),
  sendOnCreated: z.boolean().optional(),
  sendOnUpdated: z.boolean().optional(),
});

// Rate limit en memoria por IP para el registro público: máx 5 registros/hora.
// Suficiente anti-spam básico sin infra extra (no aplica tras reinicio, pero
// el coste de un abuso es solo filas pendientes que un moderador ignora/borra).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// Portal público de partners (/partners en el cliente):
//   1. POST /api/partners/register — auto-registro. Crea el partner INERTE
//      (inboundEnabled=false, sin approvedAt) y emite su PRIMERA API key,
//      visible UNA sola vez en la respuesta. Un moderador lo aprueba después
//      (POST /api/admin/partners/:id/approve) y la key cobra vida.
//   2. GET /api/integrations/v1/whoami — el partner ve su propio estado.
//   3. GET /api/integrations/v1/deliveries — sus envíos (webhooks) recientes.
@ApiTags('Partners (portal)')
@Controller('api/partners')
export class PartnersPublicController {
  constructor(
    private readonly admin: PartnerAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Auto-registro de una app partner (público, rate-limitado)',
    description:
      'Crea el partnership en estado PENDIENTE y devuelve la primera API key (visible una sola vez). La key no puede enviar puntos hasta que un moderador apruebe el partner.',
  })
  async register(
    @Req() req: { ip?: string; ips?: string[]; headers: Record<string, string> },
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
  ) {
    const ip = req.ip ?? req.ips?.[0] ?? req.headers['x-forwarded-for'] ?? 'unknown';
    if (rateLimited(String(ip))) {
      throw new HttpException('Demasiados registros desde esta IP; inténtalo más tarde', HttpStatus.TOO_MANY_REQUESTS);
    }
    const partner = await this.admin.createPartner({
      slug: body.slug,
      name: body.name,
      contactEmail: body.contactEmail,
      inboundEnabled: false, // inerte hasta aprobación
      trusted: false,
    });
    const key = await this.admin.createApiKey(partner.id, 'inicial');
    return {
      partner,
      apiKey: key.key,
      message:
        'Guarda esta API key AHORA: no volverá a mostrarse. Tu partnership queda pendiente de aprobación por un moderador.',
    };
  }
}

@ApiTags('Partners (portal)')
@Controller('api/integrations/v1')
@UseGuards(ApiKeyGuard)
export class PartnerSelfController {
  constructor(
    private readonly admin: PartnerAdminService,
  ) {}

  @Get('whoami')
  @AllowUnapprovedPartner()
  @ApiOperation({ summary: 'Estado del partnership (auth: API key del partner)' })
  async whoami(@Req() req: IntegrationRequest) {
    return this.admin.getPartner(req.integrationPartner!.id);
  }

  // Self-service de la config OUTBOUND (webhook + credenciales + flags).
  // Reutiliza updatePartner del admin (cifra secretos, devuelve vista
  // enmascarada). El interruptor outboundEnabled NO va aquí: activar el envío
  // de nuestros puntos hacia el partner sigue siendo decisión del moderador.
  @Patch('me')
  @AllowUnapprovedPartner()
  @ApiOperation({
    summary: 'Actualizar mi config de webhook/credenciales outbound',
    description:
      'Editable por el partner: outboundUrl, authType y credenciales, tokenJsonPath/tokenHeader, sendOnCreated/sendOnUpdated. Los secretos se guardan cifrados y se devuelven enmascarados. Para EMPEZAR a recibir puntos (outboundEnabled) un moderador debe activarlo.',
  })
  async updateMe(
    @Req() req: IntegrationRequest,
    @Body(new ZodValidationPipe(selfUpdateSchema)) body: PartnerWriteInput,
  ) {
    return this.admin.updatePartner(req.integrationPartner!.id, body);
  }

  // --- Gestión SELF-SERVICE de sus propias API keys (crear/listar/revocar) ---

  @Get('keys')
  @AllowUnapprovedPartner()
  @ApiOperation({ summary: 'Listar mis API keys (nunca el valor, solo prefijo)' })
  async listKeys(@Req() req: IntegrationRequest) {
    return this.admin.listApiKeys(req.integrationPartner!.id);
  }

  @Post('keys')
  @AllowUnapprovedPartner()
  @ApiOperation({ summary: 'Emitir una nueva API key (el valor se muestra UNA sola vez)' })
  async createKey(@Req() req: IntegrationRequest) {
    // Requiere re-presentación de la key actual: el guard ya la validó.
    return this.admin.createApiKey(req.integrationPartner!.id, `emitida ${new Date().toISOString().slice(0, 10)}`);
  }

  @Delete('keys/:keyId')
  @AllowUnapprovedPartner()
  @ApiOperation({ summary: 'Revocar una de mis API keys' })
  async revokeKey(@Req() req: IntegrationRequest, @Param('keyId') keyId: string) {
    return this.admin.revokeApiKey(req.integrationPartner!.id, keyId);
  }
}

@ApiTags('Partners (portal)')
@Controller('api/integrations/v1')
@UseGuards(ApiKeyGuard)
export class PartnerDeliveriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('deliveries')
  @AllowUnapprovedPartner()
  @ApiOperation({ summary: 'Últimos envíos (webhooks) hacia este partner' })
  async deliveries(@Req() req: IntegrationRequest, @Query('limit') limit?: string) {
    const take = Math.min(Math.max(limit ? Number(limit) : 50, 1), 200);
    return this.prisma.partnerSyncLog.findMany({
      where: { partnerId: req.integrationPartner!.id },
      orderBy: { createdAt: 'desc' },
      take,
      include: { point: { select: { code: true, title: true } } },
    });
  }
}