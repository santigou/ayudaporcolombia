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
    description: 'Contrato genérico (sin mapeo JSONata configurado)',
    schema: {
      type: 'object',
      required: ['externalId', 'point'],
      properties: {
        externalId: { type: 'string', example: 'punto-123-en-tu-sistema' },
        source: {
          type: 'object',
          description: 'Opcional. Provenance (anti-eco). Si app=ayudaporcolombia se ignora el envío.',
          properties: {
            app: { type: 'string', example: 'mi-app' },
            id: { type: 'string', example: 'punto-123-en-tu-sistema' },
            url: { type: 'string', example: 'https://mi-app.com/p/123' },
          },
        },
        point: {
          type: 'object',
          required: ['type', 'title', 'description', 'helpTypeName', 'locations'],
          properties: {
            type: { type: 'string', enum: ['need_help', 'offer_help'] },
            title: { type: 'string', example: 'Centro de acopio norte' },
            description: { type: 'string', example: 'Recibimos comida no perecedera y agua.' },
            helpTypeName: { type: 'string', example: 'Donaciones' },
            locations: {
              type: 'array',
              minItems: 1,
              maxItems: 5,
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['location', 'origin', 'destination'], default: 'location' },
                  lat: { type: 'number', example: 4.711 },
                  lng: { type: 'number', example: -74.0721 },
                  address: { type: 'string', example: 'Calle 100 #15-30' },
                  city: { type: 'string', example: 'Bogotá' },
                  neighborhood: { type: 'string', example: 'Chapinero' },
                },
              },
            },
            contacts: {
              type: 'array',
              description: 'offer_help exige ≥1',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['phone', 'whatsapp', 'instagram', 'email', 'other'] },
                  value: { type: 'string', example: '3001234567' },
                },
              },
            },
            supplies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Agua' },
                  targetQuantity: { type: 'integer', example: 100 },
                  unit: { type: 'string', example: 'litros' },
                },
              },
            },
            expiresAt: { type: 'string', format: 'date-time', example: '2026-12-31T00:00:00.000Z' },
          },
        },
      },
    },
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