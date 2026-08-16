import { BadRequestException } from '@nestjs/common';
import { MappingService } from './mapping.service';
import { evaluateTemplate } from '../infrastructure/mapping-engine/template-evaluator';

const engine: any = { evaluate: (t: unknown, i: unknown) => Promise.resolve(evaluateTemplate(t, i)) };

function createService() {
  const prisma: any = {
    partnerMapping: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new MappingService(prisma, engine);
  return { service, prisma };
}

const validTemplate = { description: 'point.description' };

describe('MappingService', () => {
  it('create: versión = max+1, desactiva hermanas si activate, guarda definition', async () => {
    const { service, prisma } = createService();
    prisma.partnerMapping.findFirst.mockResolvedValue({ version: 3 });
    prisma.partnerMapping.create.mockResolvedValue({ id: 'm-4', version: 4, isActive: true });

    const out = await service.create('p-1', { direction: 'outbound', definition: validTemplate, activate: true });

    expect(out.version).toBe(4);
    expect(prisma.partnerMapping.updateMany).toHaveBeenCalledWith({
      where: { partnerId: 'p-1', direction: 'outbound', isActive: true },
      data: { isActive: false },
    });
    expect(prisma.partnerMapping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ partnerId: 'p-1', direction: 'outbound', version: 4, isActive: true }),
    });
  });

  it('create: definition que no es objeto → BadRequest', async () => {
    const { service } = createService();
    await expect(service.create('p-1', { direction: 'inbound', definition: 'no-objeto' as any })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('create: expression con sintaxis inválida → BadRequest (chequeo al guardar)', async () => {
    const { service } = createService();
    await expect(
      service.create('p-1', { direction: 'inbound', definition: { x: '$$((' } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('activate: desactiva hermanas y activa la elegida (rollback)', async () => {
    const { service, prisma } = createService();
    prisma.partnerMapping.findFirst.mockResolvedValue({ id: 'm-2', direction: 'inbound' });
    prisma.partnerMapping.update.mockResolvedValue({ id: 'm-2', isActive: true });

    const out = await service.activate('p-1', 'm-2');

    expect(out.isActive).toBe(true);
    expect(prisma.partnerMapping.updateMany).toHaveBeenCalled();
    expect(prisma.partnerMapping.update).toHaveBeenCalledWith({ where: { id: 'm-2' }, data: { isActive: true } });
  });

  it('remove: rechaza borrar la versión activa', async () => {
    const { service, prisma } = createService();
    prisma.partnerMapping.findFirst.mockResolvedValue({ id: 'm-1', isActive: true });
    await expect(service.remove('p-1', 'm-1')).rejects.toThrow(BadRequestException);
  });

  it('dry-run inbound: valida el resultado contra el esquema canónico', async () => {
    const { service } = createService();
    // Produce un canónico VÁLIDO desde un payload raro.
    const res = await service.dryRun('p-1', {
      direction: 'inbound',
      definition: {
        externalId: { $literal: 'dry-1' },
        point: {
          type: { $literal: 'need_help' },
          title: { $literal: 'Titulo de prueba' },
          description: { $literal: 'Descripcion suficientemente larga' },
          helpTypeName: { $literal: 'Alimentos' },
          locations: [{ lat: 4.7, lng: -74.07 }],
        },
      },
      sampleInput: {},
    });
    expect(res.ok).toBe(true);
    expect(res.canonicalCheck).toEqual({ valid: true });
  });

  it('dry-run inbound: reporta error canónico sin guardar nada', async () => {
    const { service } = createService();
    const res = await service.dryRun('p-1', {
      direction: 'inbound',
      definition: { externalId: { $literal: 'x' } }, // falta todo el bloque point
      sampleInput: {},
    });
    expect(res.ok).toBe(true);
    expect(res.canonicalCheck!.valid).toBe(false);
    expect(res.canonicalCheck!.error).toContain('point');
  });

  it('dry-run outbound: devuelve el resultado evaluado sin validación canónica', async () => {
    const { service } = createService();
    const res = await service.dryRun('p-1', {
      direction: 'outbound',
      definition: { description: 'point.description' },
      sampleInput: { point: { description: 'hola' } },
    });
    expect(res).toEqual({ ok: true, result: { description: 'hola' }, canonicalCheck: null });
  });
});