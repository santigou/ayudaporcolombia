import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { DomainEventBus } from '../../../shared/application/event-bus';
import { SyncQueuePort } from '../domain/sync-queue.port';

// Traduce eventos de dominio (point.created / point.updated) en jobs de
// sincronización outbound (broadcast):
//
//  - point.created → a TODOS los partners con outboundEnabled+sendOnCreated,
//    menos al partner del que originates el punto y menos los que ya tienen
//    el punto (link) → evita devolverle su propio punto a nadie (anti-eco).
//  - point.updated → SOLO a los partners que ya tienen el punto (link), menos
//    el origen del cambio.
//
// Los jobs quedan pending en la cola (PartnerSyncLog); los procesa SyncWorker.
@Injectable()
export class SyncDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(SyncDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: SyncQueuePort,
    private readonly bus: DomainEventBus,
  ) {}

  onModuleInit() {
    this.bus.subscribe('point.created', (e) => this.dispatchCreated(e.pointId, e.originPartnerId));
    this.bus.subscribe('point.updated', (e) => this.dispatchUpdated(e.pointId, e.originPartnerId));
  }

  private async dispatchCreated(pointId: string, originPartnerId?: string): Promise<void> {
    try {
      const links = await this.prisma.partnerPointLink.findMany({
        where: { pointId },
        select: { partnerId: true },
      });
      const linked = new Set(links.map((l) => l.partnerId));

      const partners = await this.prisma.partner.findMany({
        where: { outboundEnabled: true, sendOnCreated: true },
        select: { id: true, slug: true },
      });

      const jobs = partners
        .filter((p) => p.id !== originPartnerId && !linked.has(p.id))
        .map((p) => ({
          partnerId: p.id,
          pointId,
          direction: 'outbound' as const,
          event: 'point_created' as const,
        }));
      if (jobs.length > 0) {
        await this.queue.enqueue(jobs);
        this.logger.log(`point.created ${pointId}: ${jobs.length} job(s) encolados (broadcast)`);
      }
    } catch (err: any) {
      this.logger.error(`dispatchCreated(${pointId}): ${err?.message ?? err}`);
    }
  }

  private async dispatchUpdated(pointId: string, originPartnerId?: string): Promise<void> {
    try {
      const links = await this.prisma.partnerPointLink.findMany({
        where: { pointId },
        select: { partnerId: true, externalId: true },
      });
      if (links.length === 0) return;

      const byPartner = new Map(links.map((l) => [l.partnerId, l]));
      const candidates = links.map((l) => l.partnerId).filter((id) => id !== originPartnerId);
      if (candidates.length === 0) return;

      const partners = await this.prisma.partner.findMany({
        where: { id: { in: candidates }, outboundEnabled: true, sendOnUpdated: true },
        select: { id: true },
      });

      const jobs = partners.map((p) => ({
        partnerId: p.id,
        pointId,
        externalId: byPartner.get(p.id)?.externalId ?? null,
        direction: 'outbound' as const,
        event: 'point_updated' as const,
      }));
      if (jobs.length > 0) {
        await this.queue.enqueue(jobs);
        this.logger.log(`point.updated ${pointId}: ${jobs.length} job(s) encolados`);
      }
    } catch (err: any) {
      this.logger.error(`dispatchUpdated(${pointId}): ${err?.message ?? err}`);
    }
  }
}