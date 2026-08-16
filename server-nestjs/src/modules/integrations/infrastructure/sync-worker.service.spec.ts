import { SyncWorkerService } from './sync-worker.service';
import { NonRetryableSyncError, OutboundService } from '../application/outbound.service';

const config: any = { get: () => undefined }; // defaults: maxAttempts=6

const partnerFixture = { id: 'partner-1', slug: 'app-b', outboundEnabled: true };

function createWorker() {
  const prisma: any = {
    partner: { findUnique: jest.fn().mockResolvedValue(partnerFixture) },
  };
  const queue: any = {
    requeueStale: jest.fn().mockResolvedValue(0),
    claimDue: jest.fn().mockResolvedValue([]),
    markDelivered: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    markSkipped: jest.fn().mockResolvedValue(undefined),
  };
  const outbound: any = { deliver: jest.fn() };
  const worker = new SyncWorkerService(prisma, queue, outbound as OutboundService, config);
  return { worker, prisma, queue, outbound };
}

function jobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    partnerId: 'partner-1',
    pointId: 'point-1',
    externalId: null,
    direction: 'outbound',
    event: 'point_created',
    attempts: 0,
    ...overrides,
  };
}

describe('SyncWorkerService', () => {
  it('entrega exitosa → markDelivered con httpStatus y externalId', async () => {
    const { worker, queue, outbound } = createWorker();
    queue.claimDue.mockResolvedValue([jobFixture()]);
    outbound.deliver.mockResolvedValue({ httpStatus: 200, externalId: 'their-id-1' });

    await (worker as any).tick();

    expect(outbound.deliver).toHaveBeenCalled();
    expect(queue.markDelivered).toHaveBeenCalledWith('job-1', 200, 'their-id-1');
    expect(queue.markFailed).not.toHaveBeenCalled();
  });

  it('error transitorio → reintento con backoff (retryAt futuro)', async () => {
    const { worker, queue, outbound } = createWorker();
    queue.claimDue.mockResolvedValue([jobFixture({ attempts: 0 })]);
    outbound.deliver.mockRejectedValue(new Error('Partner app-b: HTTP 503'));

    await (worker as any).tick();

    expect(queue.markFailed).toHaveBeenCalledWith(
      'job-1',
      'Partner app-b: HTTP 503',
      expect.objectContaining({ retryAt: expect.any(Date) }),
    );
    const retryAt = queue.markFailed.mock.calls[0][2].retryAt;
    expect(retryAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('agotados los intentos → failed definitivo (retryAt null)', async () => {
    const { worker, queue, outbound } = createWorker();
    // attempts ya en 5 → este fallo es el 6º (máx) → sin reintento
    queue.claimDue.mockResolvedValue([jobFixture({ attempts: 5 })]);
    outbound.deliver.mockRejectedValue(new Error('Partner app-b: timeout'));

    await (worker as any).tick();

    expect(queue.markFailed.mock.calls[0][2].retryAt).toBeNull();
  });

  it('NonRetryableSyncError → skipped (sin reintentos)', async () => {
    const { worker, queue, outbound } = createWorker();
    queue.claimDue.mockResolvedValue([jobFixture()]);
    outbound.deliver.mockRejectedValue(new NonRetryableSyncError('Punto aún no visible'));

    await (worker as any).tick();

    expect(queue.markSkipped).toHaveBeenCalledWith('job-1', 'Punto aún no visible');
    expect(queue.markFailed).not.toHaveBeenCalled();
  });

  it('partner deshabilitado/eliminado → skipped', async () => {
    const { worker, prisma, queue } = createWorker();
    prisma.partner.findUnique.mockResolvedValue(null);
    queue.claimDue.mockResolvedValue([jobFixture()]);

    await (worker as any).tick();

    expect(queue.markSkipped).toHaveBeenCalledWith('job-1', 'Partner eliminado o con outbound deshabilitado');
  });

  it('cola vacía → no hace nada', async () => {
    const { worker, queue, outbound } = createWorker();
    queue.claimDue.mockResolvedValue([]);
    await (worker as any).tick();
    expect(outbound.deliver).not.toHaveBeenCalled();
    // Recupera stale jobs en cada tick
    expect(queue.requeueStale).toHaveBeenCalledWith(5 * 60 * 1000);
  });
});