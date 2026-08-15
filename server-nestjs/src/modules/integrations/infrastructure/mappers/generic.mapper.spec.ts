import { BadRequestException } from '@nestjs/common';
import { GenericMapper } from './generic.mapper';

const config: any = { get: (key: string) => (key === 'CLIENT_ORIGIN' ? 'https://ayuda.example.com/' : undefined) };
const mapper = new GenericMapper(config);

const validPayload = {
  externalId: ' ext-1 ',
  point: {
    type: 'offer_help',
    title: '  Centro de acopio  ',
    description: 'Recibimos donaciones de comida y agua.',
    helpTypeName: 'Donaciones',
    locations: [{ lat: 4.711, lng: -74.072, city: 'Bogotá', neighborhood: 'La Candelaria' }],
    contacts: [{ type: 'phone', value: ' 3001234567 ' }],
  },
};

describe('GenericMapper.parseInbound', () => {
  it('normaliza el payload válido al modelo canónico', () => {
    const c = mapper.parseInbound(validPayload);
    expect(c.externalId).toBe('ext-1'); // trim
    expect(c.title).toBe('Centro de acopio');
    expect(c.type).toBe('offer_help');
    expect(c.locations).toHaveLength(1);
    expect(c.locations[0].type).toBe('location'); // default
    expect(c.contacts[0].value).toBe('3001234567');
    expect(c.supplies).toEqual([]);
    expect(c.expiresAt).toBeNull();
  });

  it('aplica el default de expiresAt/city vacíos y acepta varios', () => {
    const c = mapper.parseInbound({
      ...validPayload,
      point: {
        ...validPayload.point,
        expiresAt: '2026-01-01T00:00:00.000Z',
        locations: [
          { type: 'origin', lat: 1, lng: 2, city: 'A', neighborhood: 'B' },
          { type: 'destination', lat: 3, lng: 4, city: 'C', neighborhood: 'D' },
        ],
      },
    });
    expect(c.expiresAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(c.locations.map((l) => l.type)).toEqual(['origin', 'destination']);
  });

  it('rechaza title corto con detalle del campo', () => {
    expect(() =>
      mapper.parseInbound({ ...validPayload, point: { ...validPayload.point, title: 'ab' } }),
    ).toThrow(BadRequestException);
    try {
      mapper.parseInbound({ ...validPayload, point: { ...validPayload.point, title: 'ab' } });
    } catch (e: any) {
      expect(e.message).toContain('point.title');
    }
  });

  it('rechaza lat/lng fuera de rango y locations vacías', () => {
    expect(() =>
      mapper.parseInbound({ ...validPayload, point: { ...validPayload.point, locations: [] } }),
    ).toThrow(BadRequestException);
    expect(() =>
      mapper.parseInbound({
        ...validPayload,
        point: { ...validPayload.point, locations: [{ lat: 999, lng: 0, city: 'x', neighborhood: 'y' }] },
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza tipos de contacto desconocidos', () => {
    expect(() =>
      mapper.parseInbound({
        ...validPayload,
        point: { ...validPayload.point, contacts: [{ type: 'fax', value: '123' }] },
      }),
    ).toThrow(BadRequestException);
  });
});

describe('GenericMapper.toOutbound', () => {
  const point: any = {
    id: 'point-uuid',
    code: 'ABC123XY',
    type: 'offer_help',
    title: 'T',
    description: 'D',
    status: 'active',
    verificationStatus: 'approved',
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    helpType: { name: 'Donaciones' },
    locations: [
      { locationType: 'location', location: { latitude: 4.1, longitude: -74.1, address: null, city: 'Bogotá', neighborhood: 'C' } },
    ],
    contacts: [{ type: 'phone', value: '300' }],
    supplies: [{ supply: { name: 'Agua' }, targetQuantity: 10 as any, unit: 'litros' }],
    attachments: [
      { url: 'https://cdn/x.jpg', type: 'image' },
      { url: 'https://cdn/doc.pdf', type: 'document' },
    ],
  };

  it('serializa el punto con provenance de ayudaporcolombia', () => {
    const out: any = mapper.toOutbound(point, 'point_created');
    expect(out.event).toBe('point_created');
    expect(out.source.app).toBe('ayudaporcolombia');
    expect(out.source.id).toBe('point-uuid');
    expect(out.source.code).toBe('ABC123XY');
    expect(out.source.url).toBe('https://ayuda.example.com/p/ABC123XY'); // sin doble slash
    expect(out.point.helpTypeName).toBe('Donaciones');
    expect(out.point.contacts).toEqual([{ type: 'phone', value: '300' }]);
    // targetQuantity Decimal → number
    expect(out.point.supplies[0].targetQuantity).toBe(10);
    // Solo imágenes como fotos
    expect(out.point.photos).toEqual(['https://cdn/x.jpg']);
    // Nunca expone email del creador ni contactos privados
    expect(JSON.stringify(out)).not.toContain('createdBy');
  });
});