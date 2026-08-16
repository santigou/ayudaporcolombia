import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PartnerAdminService, PartnerWriteInput } from '../../application/partner-admin.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { Roles, RequireAuth } from '../../../../shared/application/decorators/roles.decorator';

// Campos opcionales/limpiables de un partner. Los secretos en claro solo
// ENTRAN por estas rutas (se cifran); las respuestas los devuelven enmascarados.
const partnerFields = {
  contactEmail: z.string().email().nullable().optional(),
  trusted: z.boolean().optional(),
  inboundEnabled: z.boolean().optional(),
  outboundEnabled: z.boolean().optional(),
  sendOnCreated: z.boolean().optional(),
  sendOnUpdated: z.boolean().optional(),
  outboundUrl: z.string().url().nullable().optional(),
  authType: z.enum(['api_key', 'login']).optional(),
  outboundHeaderName: z.string().min(1).max(60).nullable().optional(),
  outboundApiKeyValue: z.string().min(8).max(300).nullable().optional(),
  loginUrl: z.string().url().nullable().optional(),
  loginEmail: z.string().email().nullable().optional(),
  loginPassword: z.string().min(4).max(300).nullable().optional(),
  tokenJsonPath: z.string().min(1).max(120).nullable().optional(),
  tokenHeader: z.string().min(1).max(60).nullable().optional(),
};

const createPartnerSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'solo minúsculas, números y guiones'),
  name: z.string().min(2).max(120),
  ...partnerFields,
});

// PATCH sin slug (inmutable) y sin defaults: lo que no se envía no se toca.
const patchPartnerSchema = createPartnerSchema.omit({ slug: true }).partial();

const createApiKeySchema = z.object({ name: z.string().min(1).max(120) });

// Administración de partners y API keys. Solo moderadores (mismos guards que
// el resto de endpoints de moderación).
@ApiTags('Admin · Partners')
@ApiBearerAuth('bearerJWT')
@Controller('api/admin/partners')
@UseGuards(AuthGuard)
@RequireAuth()
@Roles('moderator')
export class PartnersAdminController {
  constructor(private readonly admin: PartnerAdminService) {}

  @Post()
  @ApiOperation({ summary: 'Crear partner (con credenciales outbound opcionales)' })
  async create(@Body(new ZodValidationPipe(createPartnerSchema)) body: PartnerWriteInput) {
    return this.admin.createPartner(body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar partners (?pending=true: solo pendientes de aprobación)' })
  async list(@Query('pending') pending?: string) {
    return this.admin.listPartners({ pending: pending === 'true' || pending === '1' });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver un partner (secrets enmascarados)' })
  async get(@Param('id') id: string) {
    return this.admin.getPartner(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Aprobar partner auto-registrado (activa su API key para enviar puntos)',
  })
  async approve(@Param('id') id: string) {
    return this.admin.approvePartner(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchPartnerSchema)) body: PartnerWriteInput,
  ) {
    return this.admin.updatePartner(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.admin.removePartner(id);
  }

  // Emite una API key: se muestra UNA sola vez en la respuesta.
  @Post(':id/api-keys')
  async createApiKey(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: z.infer<typeof createApiKeySchema>,
  ) {
    return this.admin.createApiKey(id, body.name);
  }

  @Get(':id/api-keys')
  async listApiKeys(@Param('id') id: string) {
    return this.admin.listApiKeys(id);
  }

  @Delete(':id/api-keys/:keyId')
  async revokeApiKey(@Param('id') id: string, @Param('keyId') keyId: string) {
    return this.admin.revokeApiKey(id, keyId);
  }
}