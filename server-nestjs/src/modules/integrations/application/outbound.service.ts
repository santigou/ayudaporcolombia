import { Injectable, Logger } from '@nestjs/common';
import { Partner } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { isPubliclyVisible } from '../../points/application/point.service';
import { QueuedJob } from '../domain/sync-queue.port';
import { MapperRegistry } from './mapper-registry.service';
import { PartnerClient } from '../infrastructure/partner-client';

// Error que NO debe reintentarse (configuración del partner, punto inexistente
// o no visible): el worker marca el job como skipped.
export class NonRetryableSyncError extends Error {}

// Entrega de puntos hacia partners (OUTBOUND, estilo webhook): carga el punto,
// lo convierte con el mapper del partner y lo envía por PartnerClient. Al
// entregar con éxito crea el PartnerPointLink (sabe que ya lo tiene).
@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: MapperRegistry,
    private readonly client: PartnerClient,
  ) {}

  async deliver(partner: Partner, job: QueuedJob): Promise<{ httpStatus: number | null; externalId?: string | null }> {
    if (!partner.outboundUrl) {
      throw new NonRetryableSyncError(`Partner ${partner.slug}: sin outboundUrl configurada`);
    }
    if (!job.pointId) {
      throw new NonRetryableSyncError('Job sin pointId');
    }

    const point = await this.prisma.point.findUnique({
      where: { id: job.pointId },
      include: {
        locations: { include: { location: true } },
        helpType: true,
        contacts: { where: { isPublic: true } }, // nunca datos privados
        supplies: { include: { supply: true } },
        attachments: true,
      },
    });
    if (!point) {
      throw new NonRetryableSyncError('El punto ya no existe en nuestro sistema');
    }
    // Solo se ENVÍA como created lo que ya es visible (los pending se marcan
    // skipped; al aprobarse la moderación se genera un nuevo evento/job).
    // Los point_updated sí se envían aunque el estado final sea no visible
    // (p. ej. cancelled): el partner debe enterarse de que dejó de ser válido.
    if (job.event === 'point_created' && !isPubliclyVisible(point)) {
      throw new NonRetryableSyncError('Punto aún no visible (pendiente de moderación o inactivo)');
    }

    const mapper = await this.registry.forOutbound(partner.id, partner.slug);
    const payload = await mapper.toOutbound(
      point as any,
      job.event === 'point_created' ? 'point_created' : 'point_updated',
    );
    const result = await this.client.deliver(partner, payload);

    // Link al entregar: evita re-enviarlo como created a ese partner y habilita
    // recibir/propagar updates. externalId = id en el sistema del partner (si
    // lo devolvió); si no, nuestro propio pointId como referencia.
    try {
      await this.prisma.partnerPointLink.create({
        data: { partnerId: partner.id, pointId: point.id, externalId: result.externalId ?? point.id },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err; // P2002 = ya existía el link
    }

    return result;
  }
}