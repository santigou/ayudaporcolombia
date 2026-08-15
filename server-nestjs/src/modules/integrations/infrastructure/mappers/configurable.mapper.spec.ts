import { BadRequestException } from '@nestjs/common';
import { ConfigurableMapper } from './configurable.mapper';
import { evaluateTemplate } from '../mapping-engine/template-evaluator';

const config: any = { get: (key: string) => (key === 'CLIENT_ORIGIN' ? 'http://localhost:5173' : undefined) };
// Engine "real" para tests: evalúa en el mismo hilo con la función pura.
const engine: any = { evaluate: (t: unknown, i: unknown) => Promise.resolve(evaluateTemplate(t, i)) };

// Formato raro de un partner hipotético (campos en español, plano).
const theirPayload = {
  externalId: 'odd-1',
  titulo: 'Punto raro de App B',
  desc: 'Descripcion bastante larga del punto de prueba',
  origen: { direccion: 'Calle 1', ciudad: 'Bogota' },
  tel: '3001112233',
};

const inboundTemplate = {
  externalId: 'externalId',
  point: {
    type: { $literal: 'offer_help' },
    title: 'titulo',
    description: 'desc',
    helpTypeName: { $literal: 'Donaciones' },
    locations: [
      {
        type: { $literal: 'origin' },
        lat: 4.711,
        lng: -74.072,
        city: 'origen.ciudad',
        neighborhood: "'Centro'",
        address: 'origen.direccion',
      },
    ],
    contacts: [{ type: { $literal: 'phone' }, value: 'tel' }],
  },
};

const point: any = {
  id: 'point-uuid',
  code: 'ABC123XY',
  type: 'offer_help',
  title: 'T',
  description: 'Descripcion del punto',
  status: 'active',
  verificationStatus: 'approved',
  expiresAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  helpType: { name: 'Donaciones' },
  locations: [
    { locationType: 'origin', location: { latitude: 4.1, longitude: -74.1, address: 'Calle 1', city: 'Bogotá', neighborhood: 'C' } },
    { locationType: 'destination', location: { latitude: 4.2, longitude: -74.2, address: 'Calle 2', city: 'Medellín', neighborhood: 'D' } },
  ],
  contacts: [{ type: 'phone', value: '300' }],
  supplies: [],
  attachments: [],
};

describe('ConfigurableMapper (mapeo declarativo JSONata)', () => {
  it('parseInbound: convierte el payload raro al canónico validado', async () => {
    const mapper = new ConfigurableMapper('app-b', 'inbound', inboundTemplate, engine, config);
    const c = await mapper.parseInbound(theirPayload);
    expect(c.externalId).toBe('odd-1');
    expect(c.type).toBe('offer_help');
    expect(c.title).toBe('Punto raro de App B');
    expect(c.helpTypeName).toBe('Donaciones'); // del $literal
    expect(c.locations[0]).toMatchObject({ type: 'origin', lat: 4.711, city: 'Bogota', address: 'Calle 1' });
    expect(c.contacts).toEqual([{ type: 'phone', value: '3001112233' }]);
  });

  it('parseInbound: resultado que NO pasa el Zod canónico → BadRequest con detalle', async () => {
    const badTemplate = { externalId: 'externalId', point: { type: "'need_help'", title: 'titulo' } };
    const mapper = new ConfigurableMapper('app-b', 'inbound', badTemplate, engine, config);
    await expect(mapper.parseInbound(theirPayload)).rejects.toThrow(BadRequestException);
    try {
      await mapper.parseInbound(theirPayload);
    } catch (e: any) {
      expect(e.message).toContain('canónico inválido');
    }
  });

  it('toOutbound: produce el formato App B desde el sobre canónico', async () => {
    const appBTemplate = {
      location: {
        origin: "$join($map(point.locations[type='origin'], function($l){ $l.address }), ',')",
        destination: "$join($map(point.locations[type='destination'], function($l){ $l.address }), ',')",
      },
      description: 'point.description',
    };
    const mapper = new ConfigurableMapper('app-b', 'outbound', appBTemplate, engine, config);
    const out: any = await mapper.toOutbound(point, 'point_created');
    expect(out).toEqual({
      location: { origin: 'Calle 1', destination: 'Calle 2' },
      description: 'Descripcion del punto',
    });
  });

  it('usar el mapper en la dirección equivocada → error claro', async () => {
    const mapper = new ConfigurableMapper('app-b', 'outbound', {}, engine, config);
    await expect(mapper.parseInbound({})).rejects.toThrow('solo para outbound');
  });
});