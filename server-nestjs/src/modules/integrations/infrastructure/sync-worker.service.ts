import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { intConfig } from '../../../shared/infrastructure/utils/config.util';
import { SyncQueuePort } from '../domain/sync-queue.port';
import { NonRetryableSyncError, OutboundService } from '../application/outbound.service';

// Worker de la cola de sincronización outbound: corre en background dentro del
// proceso del backend (cada instancia con PM2 cluster procesa su rebanada — el
// claim es atómico en BD). Polling de jobs vencidos → entrega → delivered /
// failed con backoff exponencial (30s, 1m, 2m, 4m... máx 1h) o skipped si el
// error no es reintentable.
@Injectable()
export class SyncWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SyncQueuePort) private readonly queue: SyncQueuePort,
    private readonly outbound: OutboundService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs = intConfig(this.config, 'INTEGRATION_WORKER_INTERVAL_MS', 3000);
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.logger.error(`tick: ${err?.message ?? err}`));
    }, intervalMs);
    // Primer tick inmediato para no esperar el interval en arranques.
    this.tick().catch(() => {});
    this.logger.log(`Worker de sincronización iniciado (intervalo ${intervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return; // no solapa ticks
    this.running = true;
    try {
      // Recupera jobs atascados en processing > 5 min (crash de una instancia).
      await this.queue.requeueStale(5 * 60 * 1000);
      const jobs = await this.queue.claimDue(20);
      if (jobs.length === 0) return;
      await Promise.all(jobs.map((job) => this.process(job)));
    } finally {
      this.running = false;
    }
  }

  private async process(job: { id: string; partnerId: string; attempts: number; event: string }): Promise<void> {
    const maxAttempts = intConfig(this.config, 'INTEGRATION_MAX_ATTEMPTS', 6);
    try {
      const partner = await this.prisma.partner.findUnique({ where: { id: job.partnerId } });
      if (!partner || !partner.outboundEnabled) {
        await this.queue.markSkipped(job.id, 'Partner eliminado o con outbound deshabilitado');
        return;
      }
      const result = await this.outbound.deliver(partner, job as any);
      await this.queue.markDelivered(job.id, result.httpStatus, result.externalId);
      this.logger.log(`→ ${partner.slug} ${job.event}: entregado (HTTP ${result.httpStatus})`);
    } catch (err: any) {
      if (err instanceof NonRetryableSyncError) {
        await this.queue.markSkipped(job.id, err.message);
        this.logger.warn(`→ job ${job.id} omitido: ${err.message}`);
        return;
      }
      const attempts = job.attempts + 1;
      const willRetry = attempts < maxAttempts;
      const delayMs = Math.min(30_000 * 2 ** (attempts - 1), 3_600_000);
      const retryAt = willRetry ? new Date(Date.now() + delayMs) : null;
      await this.queue.markFailed(job.id, err?.message ?? String(err), { retryAt });
      this.logger.warn(
        `→ job ${job.id} falló (intento ${attempts}/${maxAttempts}): ${err?.message ?? err}` +
          (willRetry ? `; reintento en ${Math.round(delayMs / 1000)}s` : '; sin más reintentos'),
      );
    }
  }
}