// Puerto de la cola de sincronización hacia partners. La implementación
// actual es Postgres (tabla PartnerSyncLog como job queue persistente con
// reintentos y backoff). Migrar después a BullMQ (ya hay Redis) o RabbitMQ
// = escribir otra implementación de este puerto, sin tocar dominio ni servicios.

export interface EnqueueJobInput {
  partnerId: string;
  pointId?: string | null;
  externalId?: string | null;
  direction: 'inbound' | 'outbound';
  event: 'point_created' | 'point_updated';
}

export interface QueuedJob {
  id: string;
  partnerId: string;
  pointId: string | null;
  externalId: string | null;
  direction: string;
  event: string;
  attempts: number;
}

export abstract class SyncQueuePort {
  abstract enqueue(jobs: EnqueueJobInput[]): Promise<void>;
  // Reclama jobs vencidos y los marca processing ATÓMICAMENTE (seguro con
  // varias instancias del backend, p. ej. PM2 cluster).
  abstract claimDue(limit: number): Promise<QueuedJob[]>;
  abstract markDelivered(id: string, httpStatus: number | null, externalId?: string | null): Promise<void>;
  // Falla un intento: reintenta en retryAt (status vuelve a pending) o lo deja
  // failed definitivamente (retryAt = null).
  abstract markFailed(id: string, error: string, opts: { retryAt: Date | null }): Promise<void>;
  abstract markSkipped(id: string, reason: string): Promise<void>;
  // Recupera jobs atascados en processing (p. ej. tras un crash del proceso).
  abstract requeueStale(olderThanMs: number): Promise<number>;
}