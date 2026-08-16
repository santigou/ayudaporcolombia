import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  EnqueueJobInput,
  QueuedJob,
  SyncQueuePort,
} from '../domain/sync-queue.port';

// Implementación de la cola de sincronización sobre Postgres: cada fila de
// PartnerSyncLog es un job (append-only, con reintentos/backoff). Sobrevive a
// reinicios y funciona con varias instancias del backend (claim atómico).
// Si el volumen crece, se sustituye por BullMQ/RabbitMQ implementando el
// mismo puerto SyncQueuePort.
@Injectable()
export class DbSyncQueue extends SyncQueuePort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async enqueue(jobs: EnqueueJobInput[]): Promise<void> {
    if (jobs.length === 0) return;
    await this.prisma.partnerSyncLog.createMany({
      data: jobs.map((j) => ({
        partnerId: j.partnerId,
        pointId: j.pointId ?? null,
        externalId: j.externalId ?? null,
        direction: j.direction,
        event: j.event,
        status: 'pending' as const,
      })),
    });
  }

  async claimDue(limit: number): Promise<QueuedJob[]> {
    const now = new Date();
    const candidates = await this.prisma.partnerSyncLog.findMany({
      where: {
        status: 'pending',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const claimed: QueuedJob[] = [];
    for (const candidate of candidates) {
      // Claim atómico: solo pasa a processing si seguía pending (protege
      // contra doble-proceso con PM2 cluster u otra instancia).
      const result = await this.prisma.partnerSyncLog.updateMany({
        where: { id: candidate.id, status: 'pending' },
        data: { status: 'processing' },
      });
      if (result.count === 1) {
        claimed.push({
          id: candidate.id,
          partnerId: candidate.partnerId,
          pointId: candidate.pointId,
          externalId: candidate.externalId,
          direction: candidate.direction,
          event: candidate.event,
          attempts: candidate.attempts,
        });
      }
    }
    return claimed;
  }

  async markDelivered(id: string, httpStatus: number | null, externalId?: string | null): Promise<void> {
    await this.prisma.partnerSyncLog.update({
      where: { id },
      data: {
        status: 'delivered',
        httpStatus: httpStatus ?? null,
        deliveredAt: new Date(),
        lastError: null,
        ...(externalId ? { externalId } : {}),
      },
    });
  }

  async markFailed(id: string, error: string, opts: { retryAt: Date | null }): Promise<void> {
    await this.prisma.partnerSyncLog.update({
      where: { id },
      data: {
        status: opts.retryAt ? 'pending' : 'failed',
        nextAttemptAt: opts.retryAt,
        lastError: error.slice(0, 500),
        attempts: { increment: 1 },
      },
    });
  }

  async markSkipped(id: string, reason: string): Promise<void> {
    await this.prisma.partnerSyncLog.update({
      where: { id },
      data: { status: 'skipped', lastError: reason.slice(0, 500) },
    });
  }

  async requeueStale(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.prisma.partnerSyncLog.updateMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      data: { status: 'pending' },
    });
    return result.count;
  }
}