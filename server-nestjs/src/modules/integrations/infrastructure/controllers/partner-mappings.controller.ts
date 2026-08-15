import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { MappingService } from '../../application/mapping.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { ApiKeyGuard, IntegrationRequest } from '../guards/api-key.guard';

// Plantilla de mapeo: objeto JSON cuyas hojas string son expresiones JSONata.
// Se permite cualquier objeto; el engine valida sintaxis/tamaño al evaluar.
const definitionSchema = z.record(z.unknown()).refine((d) => Object.keys(d).length > 0, {
  message: 'definition no puede estar vacío',
});

const createMappingSchema = z.object({
  direction: z.enum(['inbound', 'outbound']),
  definition: definitionSchema,
  notes: z.string().max(500).nullable().optional(),
  activate: z.boolean().optional(),
});

const dryRunSchema = z
  .object({
    direction: z.enum(['inbound', 'outbound']),
    definition: definitionSchema.optional(),
    mappingId: z.string().uuid().optional(),
    sampleInput: z.unknown(),
  })
  .refine((d) => d.definition != null || d.mappingId != null, {
    message: 'definition o mappingId es requerido',
  });

// Self-service de mapeos declarativos para partners (auth: SU API key).
// Flujo recomendado: dry-run con un payload real → create({activate:true}) →
// si algo se rompe: activate() de la versión anterior (rollback) o el moderador
// fuerza deactivate. Documentación: docs/obsidian/Mapeos por expresiones (JSONata).md
@ApiTags('Partners · Mapeos')
@ApiSecurity('ApiKeyAuth')
@Controller('api/integrations/v1/mappings')
@UseGuards(ApiKeyGuard)
export class PartnerMappingsController {
  constructor(private readonly mappings: MappingService) {}

  @Post()
  async create(
    @Req() req: IntegrationRequest,
    @Body(new ZodValidationPipe(createMappingSchema)) body: z.infer<typeof createMappingSchema>,
  ) {
    return this.mappings.create(req.integrationPartner!.id, body);
  }

  @Get()
  async list(@Req() req: IntegrationRequest, @Query('direction') direction?: string) {
    const dir = direction === 'inbound' || direction === 'outbound' ? direction : undefined;
    return this.mappings.list(req.integrationPartner!.id, dir);
  }

  @Get(':id')
  async get(@Req() req: IntegrationRequest, @Param('id') id: string) {
    return this.mappings.getOne(req.integrationPartner!.id, id);
  }

  // Prueba un mapeo SIN guardarlo: devuelve el resultado evaluado y, en
  // inbound, si pasaría la validación canónica.
  @Post('dry-run')
  async dryRun(
    @Req() req: IntegrationRequest,
    @Body(new ZodValidationPipe(dryRunSchema)) body: z.infer<typeof dryRunSchema>,
  ) {
    return this.mappings.dryRun(req.integrationPartner!.id, body as any);
  }

  @Post(':id/activate')
  async activate(@Req() req: IntegrationRequest, @Param('id') id: string) {
    return this.mappings.activate(req.integrationPartner!.id, id);
  }

  @Delete(':id')
  async remove(@Req() req: IntegrationRequest, @Param('id') id: string) {
    return this.mappings.remove(req.integrationPartner!.id, id);
  }
}