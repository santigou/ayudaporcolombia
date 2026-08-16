import { BadRequestException } from '@nestjs/common';
import { InboundService } from './inbound.service';
import { MapperRegistry } from './mapper-registry.service';
import { GenericMapper } from '../infrastructure/mappers/generic.mapper';
import { DomainEventBus } from '../../../shared/application/event-bus';

const config: any = { get: (key: string) => (key === 'CLIENT_ORIGIN' ? 'http://localhost:5173' : undefined) };

const untrusted = { id: 'partner-1', slug: 'app-b', name: 'App B', trusted: false };
const trusted = { id: 'partner-2', slug: 'app-c', name: 'App C', trusted: true };

const payload = {
  externalId: 'ext-1',
  point: {
    type: 'offer_help',
    title: 'Centro de acopio',
    description: 'Recibimos donaciones de comida y agua.',
    helpTypeName: 'Donaciones',
    locations: [{ type: 'location', lat: 4.711, lng: -74.072, city: 'Bogotá', neighborhood: 'La Candelaria' }],
    contacts: [{ type: 'phone', value: '3001234567' }],
  },
};

// Punto almacenado equivalente al payload (misma firma canónica).
const storedPoint = {
  id: 'point-1',
  code: 'ABC123XY',
  type: 'offer_help',
  status: 'active',
  verificationStatus: 'approved',
  title: 'Centro de acopio',
  description: 'Recibimos donaciones de comida y agua.',
  expiresAt: null,
  helpType: { name: 'Donaciones' },
  locations: [
    {
      locationId: 'loc-1',
      locationType: 'location',
      location: { latitude: 4.711, longitude: -74.072, address: null, city: 'Bogotá', neighborhood: 'La Candelaria' },
    },
  ],
  contacts: [{ type: 'phone', value: '3001234567' }],
  supplies: [],
};

function createService() {
  const prisma: any = {
    partnerPointLink: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
    // MapperRegistry consulta si hay mapeo declarativo activo → null = fallback
    // al genérico (comportamiento que prueban estos tests).
    partnerMapping: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    helpType: { upsert: jest.fn().mockResolvedValue({ id: 'ht-1' }) },
    supply: { upsert: jest.fn() },
    point: {
      create: jest.fn(),
      findFirst: jest.fn(),
      // Lo usa generateUniqueCode para evitar colisiones de código.
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    // Métodos usados dentro de la transacción de update (tx = prisma en tests).
    pointLocation: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({}) },
    location: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    contact: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    pointSupply: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(),
  };
  const bus = new DomainEventBus();
  const publishSpy = jest.spyOn(bus, 'publish');
  // Registry real con prisma mockeado (sin mapeos activos → GenericMapper).
  const registry = new MapperRegistry([new GenericMapper(config)], prisma, undefined as any, config);
  const service = new InboundService(prisma, registry, bus);
  return { service, prisma, publishSpy };
}

describe('InboundService.ingestPoint', () => {
  it('partner NO trusted: offer_help entra pending para moderación', async () => {
    const { service, prisma, publishSpy } = createService();
    prisma.partnerPointLink.findUnique.mockResolvedValue(null);
    prisma.point.create.mockResolvedValue({ id: 'point-9', code: 'ZZZ999ZZ', status: 'pending', verificationStatus: 'pending' });

    const res = await service.ingestPoint(untrusted, payload);

    expect(res.created).toBe(true);
    expect(res.status).toBe('pending');
    const data = prisma.point.create.mock.calls[0][0].data;
    expect(data.status).toBe('pending');
    // Crea el vínculo partner↔punto con el externalId del partner
    expect(prisma.partnerPointLink.create).toHaveBeenCalledWith({
      data: { partnerId: 'partner-1', pointId: 'point-9', externalId: 'ext-1' },
    });
    // Publica fan-out con origen = partner que envió
    expect(publishSpy).toHaveBeenCalledWith({ type: 'point.created', pointId: 'point-9', originPartnerId: 'partner-1' });
  });

  it('partner trusted: entra directo a active/approved', async () => {
    const { service, prisma } = createService();
    prisma.partnerPointLink.findUnique.mockResolvedValue(null);
    prisma.point.create.mockResolvedValue({ id: 'point-10', code: 'AAA111AA', status: 'active', verificationStatus: 'approved' });

    const res = await service.ingestPoint(trusted, { ...payload, point: { ...payload.point, type: 'need_help' } });

    const data = prisma.point.create.mock.calls[0][0].data;
    expect(data.status).toBe('active');
    expect(data.verificationStatus).toBe('approved');
    expect(res.verificationStatus).toBe('approved');
  });

  it('offer_help sin contactos → BadRequest (paridad con regla local)', async () => {
    const { service } = createService();
    const noContacts = { ...payload, point: { ...payload.point, contacts: [] } };
    await expect(service.ingestPoint(trusted, noContacts)).rejects.toThrow(BadRequestException);
  });

  it('payload idéntico al almacenado → deduplicated, sin writes ni fan-out', async () => {
    const { service, prisma, publishSpy } = createService();
    prisma.partnerPointLink.findUnique.mockResolvedValue({ point: storedPoint });

    const res = await service.ingestPoint(trusted, payload);

    expect(res.deduplicated).toBe(true);
    expect(res.updated).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('payload con cambios → actualiza en transacción y publica point.updated', async () => {
    const { service, prisma, publishSpy } = createService();
    prisma.partnerPointLink.findUnique.mockResolvedValue({ point: storedPoint });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    const res = await service.ingestPoint(trusted, {
      ...payload,
      point: { ...payload.point, title: 'Centro de acopio AMPLIADO' },
    });

    expect(res.updated).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith({ type: 'point.updated', pointId: 'point-1', originPartnerId: 'partner-2' });
  });

  it('eco (source.app=ayudaporcolombia): no crea punto, asegura link y devuelve deduplicated', async () => {
    const { service, prisma, publishSpy } = createService();
    prisma.point.findFirst.mockResolvedValue({ id: 'point-1', code: 'ABC123XY', status: 'active', verificationStatus: 'approved' });
    prisma.partnerPointLink.create.mockRejectedValueOnce({ code: 'P2002' }); // link ya existía

    const res = await service.ingestPoint(untrusted, {
      ...payload,
      source: { app: 'AyudaPorColombia', id: 'point-1' },
    });

    expect(res.deduplicated).toBe(true);
    expect(prisma.point.create).not.toHaveBeenCalled();
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('eco sin id ni código referenciado → BadRequest', async () => {
    const { service } = createService();
    await expect(
      service.ingestPoint(untrusted, { ...payload, source: { app: 'ayudaporcolombia' } }),
    ).rejects.toThrow(BadRequestException);
  });
});