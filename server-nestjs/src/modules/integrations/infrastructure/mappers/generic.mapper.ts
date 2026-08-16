import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CanonicalPointInput,
  PartnerMapper,
  SerializablePoint,
  SyncEventName,
} from '../../domain/partner-mapper.port';
import { buildOutboundEnvelope, inboundPointSchema, zodFirstError } from '../../domain/canonical.schema';

// Mapper por defecto ("contrato genÃ©rico"): el que usan los partners que
// hablan el JSON estÃ¡ndar documentado de Ayuda por Colombia. Un partner con
// modelo distinto implementa PartnerMapper con su slug y se registra en
// IntegrationsModule (PARTNER_MAPPERS), o define un mapeo declarativo JSONata
// (PartnerMapping) que resuelve el MapperRegistry â€” este sigue siendo el fallback.
@Injectable()
export class GenericMapper implements PartnerMapper {
  readonly slug = 'generic';

  constructor(private readonly config: ConfigService) {}

  parseInbound(raw: unknown): CanonicalPointInput {
    const parsed = inboundPointSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(`Payload invÃ¡lido: ${zodFirstError(parsed.error)}`);
    }
    const { externalId, source, point } = parsed.data;
    return {
      externalId: externalId.trim(),
      source,
      type: point.type,
      title: point.title.trim(),
      description: point.description.trim(),
      helpTypeName: point.helpTypeName.trim(),
      locations: point.locations.map((l) => ({
        type: l.type,
        lat: l.lat,
        lng: l.lng,
        address: l.address,
        city: l.city,
        neighborhood: l.neighborhood,
      })),
      contacts: point.contacts.map((c) => ({ type: c.type, value: c.value.trim() })),
      supplies: point.supplies.map((s) => ({
        name: s.name.trim(),
        targetQuantity: s.targetQuantity ?? null,
        unit: s.unit ?? null,
      })),
      expiresAt: point.expiresAt ? new Date(point.expiresAt) : null,
    };
  }

  toOutbound(point: SerializablePoint, event: SyncEventName) {
    return buildOutboundEnvelope(point, event, this.config.get<string>('CLIENT_ORIGIN') || '');
  }
}
