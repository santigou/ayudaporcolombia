import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InboundService } from '../../application/inbound.service';
import { ApiKeyGuard, IntegrationRequest } from '../guards/api-key.guard';

// API de integraciones para partners (INBOUND: ellos → nosotros).
// Autenticación por API key (X-API-Key o Authorization: Bearer apc_...);
// NO usa JWT: estas rutas no llevan @RequireAuth() y el AuthGuard global las
// deja pasar; ApiKeyGuard hace la autenticación real.
//
// Contrato completo: docs/obsidian/Integraciones partner.md
@ApiTags('Integraciones v1')
@ApiSecurity('ApiKeyAuth')
@Controller('api/integrations/v1')
@UseGuards(ApiKeyGuard)
export class IntegrationsController {
  constructor(private readonly inbound: InboundService) {}

  // Recibe un punto del partner. Upsert idempotente por externalId: re-enviar
  // el mismo payload no duplica ni re-difunde. 201 si lo creó, 200 si existía.
  @Post('points')
  @ApiOperation({
    summary: 'Enviar/actualizar un punto de ayuda',
    description:
      'Upsert idempotente por externalId (re-enviar lo mismo → 200 deduplicated). ' +
      'Sin mapeo configurado aplica el contrato genérico de abajo; con mapeo activo, TU formato. ' +
      'Partner trusted → punto activo inmediato; si no → cola de moderación.',
  })
  @ApiBody({
    description:
      'Contrato genérico (sin mapeo JSONata configurado). Con mapeo inbound activo aceptamos TU formato. ' +
      'Ver el esquema CanonicalPointInput y los enums (PointType, LocationType, ContactType) en la sección Schemas.',
    schema: { $ref: '#/components/schemas/CanonicalPointInput' },
  })
  async create(
    @Body() body: unknown,
    @Req() req: IntegrationRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.inbound.ingestPoint(req.integrationPartner!, body);
    res.status(result.created ? 201 : 200);
    return result;
  }

  // Consulta del estado de un punto previamente enviado (pendiente/activo/...).
  @Get('points/:externalId/status')
  @ApiOperation({ summary: 'Estado de un punto enviado (por tu externalId)' })
  async status(@Param('externalId') externalId: string, @Req() req: IntegrationRequest) {
    return this.inbound.getInboundStatus(req.integrationPartner!, externalId);
  }
}