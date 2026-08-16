import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as z from 'zod';
import {
  CanonicalPointInput,
  PartnerMapper,
  SerializablePoint,
  SyncEventName,
} from '../../domain/partner-mapper.port';
import { buildOutboundEnvelope, inboundPointSchema, zodFirstError } from '../../domain/canonical.schema';
import { MappingEngine } from '../mapping-engine/engine';

// Mapper declarativo: la conversión vive en un JSON (PartnerMapping.definition,
// gestionado por el partner vía API key) cuyas hojas son expresiones JSONata.
// Se instancia por partner+dirección cuando existe una versión ACTIVA; si no,
// MapperRegistry cae al genérico (contrato estándar documentado).
//
// Seguridad: el resultado inbound SIEMPRE pasa la misma validación Zod canónica
// — un mapeo mal escrito produce un 400 claro, jamás datos corruptos en BD.
@Injectable()
export class ConfigurableMapper implements PartnerMapper {
  constructor(
    public readonly slug: string,
    private readonly direction: 'inbound' | 'outbound',
    private readonly definition: unknown,
    private readonly engine: MappingEngine,
    private readonly config: ConfigService,
  ) {}

  // Su payload → evaluar plantilla → sobre canónico → validar Zod.
  async parseInbound(raw: unknown): Promise<CanonicalPointInput> {
    if (this.direction !== 'inbound') {
      throw new Error(`Partner ${this.slug}: mapeo configurado solo para ${this.direction}`);
    }
    let mapped: unknown;
    try {
      mapped = await this.engine.evaluate(this.definition, raw);
    } catch (err: any) {
      throw new BadRequestException(`El mapeo inbound falló: ${err?.message ?? err}`);
    }
    const parsed = inboundPointSchema.safeParse(mapped);
    if (!parsed.success) {
      throw new BadRequestException(
        `El mapeo produjo un payload canónico inválido: ${zodFirstError(parsed.error)}`,
      );
    }
    return this.toCanonical(parsed.data);
  }

  // Sobre canónico → evaluar plantilla → el JSON que espera el partner.
  async toOutbound(point: SerializablePoint, event: SyncEventName): Promise<unknown> {
    if (this.direction !== 'outbound') {
      throw new Error(`Partner ${this.slug}: mapeo configurado solo para ${this.direction}`);
    }
    const envelope = buildOutboundEnvelope(
      point,
      event,
      this.config.get<string>('CLIENT_ORIGIN') || '',
    );
    try {
      return await this.engine.evaluate(this.definition, envelope);
    } catch (err: any) {
      throw new BadRequestException(`El mapeo outbound falló: ${err?.message ?? err}`);
    }
  }

  // Mismos defaults/normalizados que aplica GenericMapper sobre el Zod output.
  private toCanonical(data: z.infer<typeof inboundPointSchema>): CanonicalPointInput {
    const { externalId, source, point } = data;
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
}