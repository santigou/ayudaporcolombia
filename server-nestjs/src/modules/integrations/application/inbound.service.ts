import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { DomainEventBus } from '../../../shared/application/event-bus';
import { generateUniqueCode } from '../../../shared/infrastructure/utils/code.util';
import { CanonicalPointInput } from '../domain/partner-mapper.port';
import { MapperRegistry } from './mapper-registry.service';

export interface IntegrationPartnerContext {
  id: string;
  slug: string;
  name: string;
  trusted: boolean;
}

export interface IngestResult {
  pointId: string;
  code: string;
  status: string;
  verificationStatus: string;
  created: boolean;
  updated: boolean;
  deduplicated: boolean;
}

// Redondea coordenadas para comparar floats de forma estable (6 decimales ≈ 11cm).
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const norm = (s: string | null | undefined) => (s ?? '').trim();

// Ingesta de puntos desde partners (INBOUND): valida el payload con el mapper
// del partner, hace upsert idempotente por (partner, externalId) y publica el
// evento de dominio para el fan-out hacia los DEMÁS partners.
//
// Política de moderación: si el partner es `trusted`, el punto entra directo a
// activo/aprobado; si no, sigue la misma regla que un punto local anónimo
// (offer_help pendiente de revisión; need_help activo).
@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: MapperRegistry,
    private readonly bus: DomainEventBus,
  ) {}

  async ingestPoint(partner: IntegrationPartnerContext, raw: unknown): Promise<IngestResult> {
    // Mapper para ESTE partner: mapeo declarativo activo (JSONata) o fallback
    // al contrato genérico. Async porque el declarativo evalúa en un worker.
    const mapper = await this.registry.forInbound(partner.id, partner.slug);
    const canonical = await mapper.parseInbound(raw);

    // Paridad con la regla local: un offer_help siempre necesita contacto.
    if (canonical.type === 'offer_help' && canonical.contacts.length === 0) {
      throw new BadRequestException('Los puntos offer_help requieren al menos un contacto');
    }

    // Eco: es un punto NUESTRO que un partner nos devuelve (p. ej. recibió
    // nuestro webhook y su sistema lo re-envía). No se crea ni se re-difunde.
    if (canonical.source?.app && canonical.source.app.toLowerCase() === 'ayudaporcolombia') {
      return this.handleEcho(partner, canonical);
    }

    const link = await this.prisma.partnerPointLink.findUnique({
      where: { partnerId_externalId: { partnerId: partner.id, externalId: canonical.externalId } },
      include: {
        point: {
          include: {
            locations: { include: { location: true } },
            helpType: true,
            contacts: true,
            supplies: { include: { supply: true } },
          },
        },
      },
    });

    if (!link) return this.createPoint(partner, canonical);
    return this.updatePoint(partner, canonical, link.point);
  }

  // Estado de un punto previamente enviado por el partner (para que consulte
  // cómo quedó: pendiente de moderación, activo, etc.).
  async getInboundStatus(partner: IntegrationPartnerContext, externalId: string) {
    const link = await this.prisma.partnerPointLink.findUnique({
      where: { partnerId_externalId: { partnerId: partner.id, externalId } },
      include: { point: true },
    });
    if (!link || !link.point) throw new NotFoundException('Punto no encontrado para este externalId');
    return {
      externalId,
      pointId: link.point.id,
      code: link.point.code,
      type: link.point.type,
      status: link.point.status,
      verificationStatus: link.point.verificationStatus,
      createdAt: link.point.createdAt,
      updatedAt: link.point.updatedAt,
    };
  }

  private async handleEcho(partner: IntegrationPartnerContext, c: CanonicalPointInput): Promise<IngestResult> {
    const conditions: Array<Record<string, string>> = [];
    if (c.source?.id) conditions.push({ id: c.source.id });
    if (c.source?.code) conditions.push({ code: c.source.code.toUpperCase() });
    if (conditions.length === 0) {
      throw new BadRequestException('Eco detectado (source.app=ayudaporcolombia) pero sin source.id ni source.code');
    }
    const point = await this.prisma.point.findFirst({ where: { OR: conditions } });
    if (!point) {
      throw new BadRequestException('Eco detectado pero el punto referenciado no existe en nuestro sistema');
    }
    this.logger.log(`Eco de ${partner.slug}: externalId=${c.externalId} → punto ${point.code} (ignorado, sin cambios)`);
    // Asegura el vínculo (idempotente) para que el fan-out no le devuelva
    // su propio punto a este partner.
    try {
      await this.prisma.partnerPointLink.create({
        data: { partnerId: partner.id, pointId: point.id, externalId: c.externalId },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
    }
    return {
      pointId: point.id,
      code: point.code,
      status: point.status,
      verificationStatus: point.verificationStatus,
      created: false,
      updated: false,
      deduplicated: true,
    };
  }

  private async createPoint(partner: IntegrationPartnerContext, c: CanonicalPointInput): Promise<IngestResult> {
    const isOffer = c.type === 'offer_help';

    const helpType = await this.prisma.helpType.upsert({
      where: { name: c.helpTypeName },
      update: {},
      create: { name: c.helpTypeName, description: `Importado del partner "${partner.slug}"` },
    });
    const supplyRows: Array<{ supplyId: string; targetQuantity: number | null; unit: string | null }> = [];
    for (const s of c.supplies) {
      const supply = await this.prisma.supply.upsert({ where: { name: s.name }, update: {}, create: { name: s.name } });
      supplyRows.push({ supplyId: supply.id, targetQuantity: s.targetQuantity ?? null, unit: s.unit ?? null });
    }

    // Política de moderación (decisión de diseño con el equipo):
    //  - trusted → entra activo y verificado (publicación inmediata).
    //  - no trusted → igual que un punto local anónimo: offer_help pendiente
    //    de revisión por moderación; need_help activo (flujo SOS).
    const status = partner.trusted ? 'active' : isOffer ? 'pending' : 'active';
    const verificationStatus = partner.trusted ? 'approved' : 'pending';

    const point = await this.prisma.point.create({
      data: {
        code: await generateUniqueCode(this.prisma),
        type: c.type as any,
        title: c.title,
        description: c.description,
        helpTypeId: helpType.id,
        status: status as any,
        verificationStatus: verificationStatus as any,
        expiresAt: c.expiresAt ?? null,
        locations: {
          create: c.locations.map((l) => ({
            locationType: l.type,
            location: {
              create: {
                city: l.city ?? '',
                neighborhood: l.neighborhood ?? '',
                address: l.address ?? null,
                latitude: l.lat,
                longitude: l.lng,
              },
            },
          })) as any,
        },
        contacts: { create: c.contacts.map((ct) => ({ type: ct.type as any, value: ct.value, isPublic: true })) },
        ...(supplyRows.length ? { supplies: { create: supplyRows } } : {}),
      },
    });

    await this.prisma.partnerPointLink.create({
      data: { partnerId: partner.id, pointId: point.id, externalId: c.externalId },
    });

    this.logger.log(`Inbound ${partner.slug}: creado punto ${point.code} (${c.type}, status=${status})`);
    // Fan-out hacia los DEMÁS partners (el dispatcher excluye al origin).
    this.bus.publish({ type: 'point.created', pointId: point.id, originPartnerId: partner.id });

    return {
      pointId: point.id,
      code: point.code,
      status: point.status as string,
      verificationStatus: point.verificationStatus as string,
      created: true,
      updated: false,
      deduplicated: false,
    };
  }

  private async updatePoint(
    partner: IntegrationPartnerContext,
    c: CanonicalPointInput,
    current: any, // Point con locations/helpType/contacts/supplies incluidos
  ): Promise<IngestResult> {
    // Idempotencia: si el payload no cambia nada material, no toca BD ni
    // re-difunde (rompe los bucles de re-envío entre sistemas).
    if (this.signature(c) === this.signatureOfStored(current)) {
      return {
        pointId: current.id,
        code: current.code,
        status: current.status,
        verificationStatus: current.verificationStatus,
        created: false,
        updated: false,
        deduplicated: true,
      };
    }

    const helpType = await this.prisma.helpType.upsert({
      where: { name: c.helpTypeName },
      update: {},
      create: { name: c.helpTypeName, description: `Importado del partner "${partner.slug}"` },
    });
    const supplyRows: Array<{ supplyId: string; targetQuantity: number | null; unit: string | null }> = [];
    for (const s of c.supplies) {
      const supply = await this.prisma.supply.upsert({ where: { name: s.name }, update: {}, create: { name: s.name } });
      supplyRows.push({ supplyId: supply.id, targetQuantity: s.targetQuantity ?? null, unit: s.unit ?? null });
    }

    const oldLocationIds: string[] = (current.locations ?? []).map((l: any) => l.locationId);

    // Reemplazo total de colecciones (MVP): locations/contacts/supplies pasan
    // a reflejar exactamente lo que envía el partner. Todo atómico.
    await this.prisma.$transaction(async (tx) => {
      await tx.point.update({
        where: { id: current.id },
        data: {
          type: c.type as any,
          title: c.title,
          description: c.description,
          helpTypeId: helpType.id,
          expiresAt: c.expiresAt ?? null,
        },
      });

      await tx.pointLocation.deleteMany({ where: { pointId: current.id } });
      for (const l of c.locations) {
        await tx.pointLocation.create({
          data: {
            pointId: current.id,
            locationType: l.type,
            location: {
              create: {
                city: l.city ?? '',
                neighborhood: l.neighborhood ?? '',
                address: l.address ?? null,
                latitude: l.lat,
                longitude: l.lng,
              },
            },
          } as any,
        });
      }
      // Limpia las Location huérfanas que quedaron sin PointLocation.
      if (oldLocationIds.length > 0) {
        await tx.location.deleteMany({ where: { id: { in: oldLocationIds }, points: { none: {} } } });
      }

      await tx.contact.deleteMany({ where: { pointId: current.id } });
      if (c.contacts.length > 0) {
        await tx.contact.createMany({
          data: c.contacts.map((ct) => ({ pointId: current.id, type: ct.type as any, value: ct.value, isPublic: true })),
        });
      }

      await tx.pointSupply.deleteMany({ where: { pointId: current.id } });
      if (supplyRows.length > 0) {
        await tx.pointSupply.createMany({
          data: supplyRows.map((s) => ({
            pointId: current.id,
            supplyId: s.supplyId,
            targetQuantity: s.targetQuantity,
            unit: s.unit,
          })),
        });
      }
    });

    this.logger.log(`Inbound ${partner.slug}: actualizado punto ${current.code} (externalId=${c.externalId})`);
    this.bus.publish({ type: 'point.updated', pointId: current.id, originPartnerId: partner.id });

    return {
      pointId: current.id,
      code: current.code,
      status: current.status,
      verificationStatus: current.verificationStatus,
      created: false,
      updated: true,
      deduplicated: false,
    };
  }

  // Firma canónica del payload inbound (para comparar con lo almacenado).
  private signature(c: CanonicalPointInput): string {
    return JSON.stringify([
      c.type,
      norm(c.title),
      norm(c.description),
      norm(c.helpTypeName),
      c.expiresAt ? new Date(c.expiresAt).getTime() : null,
      c.locations
        .map((l) => [l.type, round6(l.lat), round6(l.lng), norm(l.address), norm(l.city), norm(l.neighborhood)])
        .sort(),
      c.contacts.map((ct) => [ct.type, norm(ct.value)]).sort(),
      c.supplies.map((s) => [norm(s.name), s.targetQuantity ?? null, norm(s.unit)]).sort(),
    ]);
  }

  // Misma firma, calculada sobre el punto tal como está en BD.
  private signatureOfStored(p: any): string {
    return JSON.stringify([
      p.type,
      norm(p.title),
      norm(p.description),
      norm(p.helpType?.name),
      p.expiresAt ? new Date(p.expiresAt).getTime() : null,
      (p.locations ?? [])
        .map((l: any) => [
          l.locationType,
          round6(l.location.latitude),
          round6(l.location.longitude),
          norm(l.location.address),
          norm(l.location.city),
          norm(l.location.neighborhood),
        ])
        .sort(),
      (p.contacts ?? []).map((c: any) => [c.type, norm(c.value)]).sort(),
      (p.supplies ?? [])
        .map((s: any) => [
          norm(s.supply?.name),
          s.targetQuantity != null ? Number(s.targetQuantity) : null,
          norm(s.unit),
        ])
        .sort(),
    ]);
  }
}