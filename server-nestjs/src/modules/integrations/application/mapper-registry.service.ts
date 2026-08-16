import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartnerMapper } from '../domain/partner-mapper.port';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { MappingEngine } from '../infrastructure/mapping-engine/engine';
import { ConfigurableMapper } from '../infrastructure/mappers/configurable.mapper';

// Token de inyección para registrar los mappers de CÓDIGO disponibles
// (multi-provider). Para añadir el mapper de un partner con formato propio:
// créalo como @Injectable() implementando PartnerMapper (slug = slug del
// partner) y añádelo al useFactory de PARTNER_MAPPERS en integrations.module.ts.
export const PARTNER_MAPPERS = 'PARTNER_MAPPERS';

// Resolución de mappers con prioridad:
//   1. Mapeo DECLARATIVO activo en BD (PartnerMapping JSONata, autogestionado
//      por el partner vía API key) → ConfigurableMapper.
//   2. Mapper de CÓDIGO registrado con el slug del partner.
//   3. Genérico (contrato JSON estándar documentado).
//
// La resolución es async porque consulta BD; se pide por (partner, dirección)
// porque un partner puede tener mapeos distintos para inbound y outbound.
@Injectable()
export class MapperRegistry {
  private readonly bySlug = new Map<string, PartnerMapper>();

  constructor(
    @Inject(PARTNER_MAPPERS) mappers: PartnerMapper[],
    private readonly prisma: PrismaService,
    private readonly engine: MappingEngine,
    private readonly config: ConfigService,
  ) {
    for (const mapper of mappers) {
      this.bySlug.set(mapper.slug, mapper);
    }
  }

  async forInbound(partnerId: string, partnerSlug: string): Promise<PartnerMapper> {
    return this.resolve(partnerId, partnerSlug, 'inbound');
  }

  async forOutbound(partnerId: string, partnerSlug: string): Promise<PartnerMapper> {
    return this.resolve(partnerId, partnerSlug, 'outbound');
  }

  private async resolve(partnerId: string, partnerSlug: string, direction: 'inbound' | 'outbound') {
    const mapping = await this.prisma.partnerMapping.findFirst({
      where: { partnerId, direction, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (mapping) {
      return new ConfigurableMapper(partnerSlug, direction, mapping.definition, this.engine, this.config);
    }
    return this.bySlug.get(partnerSlug) ?? this.bySlug.get('generic')!;
  }
}