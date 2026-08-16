import { evaluateTemplate } from './template-evaluator';
import { TemplateEvalError } from '../../domain/mapping.port';

describe('evaluateTemplate (motor JSONata)', () => {
  // El caso real de App B: une las direcciones de nuestras locations por tipo.
  const appBTemplate = {
    location: {
      origin: "$join($map(point.locations[type='origin'], function($l){ $l.address }), ',')",
      destination: "$join($map(point.locations[type='destination'], function($l){ $l.address }), ',')",
    },
    description: 'point.description',
  };

  const envelope = {
    event: 'point_created',
    point: {
      description: 'Punto de acopio en el norte',
      locations: [
        { type: 'origin', address: 'Calle 1' },
        { type: 'destination', address: 'Calle 2' },
        { type: 'destination', address: 'Calle 3' },
        { type: 'location', address: 'Ignorado' },
      ],
    },
  };

  it('evalua el ejemplo de App B: $map + filtro + $join', async () => {
    const out: any = await evaluateTemplate(appBTemplate, envelope);
    expect(out.location.origin).toBe('Calle 1');
    expect(out.location.destination).toBe('Calle 2,Calle 3');
    expect(out.description).toBe('Punto de acopio en el norte');
    // La location de tipo 'location' no se cuela en origin/destination.
    expect(out.location.origin).not.toContain('Ignorado');
  });

  it('expresiones simples acceden a campos y constantes usan $literal', async () => {
    const out: any = await evaluateTemplate(
      {
        externalId: 'id',
        tipo: { $literal: 'offer_help' },
        ciudad: "'Bogota'", // string JSONata constante
        numero: 42,
        flag: true,
        nulo: null,
      },
      { id: 'ext-9' },
    );
    expect(out.externalId).toBe('ext-9');
    expect(out.tipo).toBe('offer_help');
    expect(out.ciudad).toBe('Bogota');
    expect(out.numero).toBe(42);
    expect(out.flag).toBe(true);
    expect(out.nulo).toBeNull();
  });

  it('recursion en objetos anidados y arrays', async () => {
    const out: any = await evaluateTemplate(
      { lista: ['x.y', "'constante'"], obj: { interno: 'x.y', sub: { profundo: "'const'" } } },
      { x: { y: 'valor' } },
    );
    // Los strings dentro de arrays TAMBIÉN son expresiones (hojas del árbol).
    expect(out.lista).toEqual(['valor', 'constante']);
    expect(out.obj.interno).toBe('valor');
    expect(out.obj.sub.profundo).toBe('const');
  });

  it('campo inexistente → undefined (JSONata tolerante), sin throw', async () => {
    const out: any = await evaluateTemplate({ a: 'no.existe' }, {});
    expect(out.a).toBeUndefined();
  });

  it('error de sintaxis → TemplateEvalError con la ruta de la hoja', async () => {
    await expect(evaluateTemplate({ location: { origin: '$$esto((no es valido' } }, {})).rejects.toThrow(
      TemplateEvalError,
    );
    try {
      await evaluateTemplate({ location: { origin: '$$esto((no es valido' } }, {});
      fail('debia lanzar');
    } catch (e: any) {
      expect(e.path).toBe('$.location.origin');
      expect(e.message).toContain('$.location.origin');
    }
  });

  it('error de ejecucion → TemplateEvalError con la ruta', async () => {
    await expect(evaluateTemplate({ x: '$sum("no-numero")' }, {})).rejects.toThrow(TemplateEvalError);
    try {
      await evaluateTemplate({ x: '$sum("no-numero")' }, {});
      fail('debia lanzar');
    } catch (e: any) {
      expect(e.path).toBe('$.x');
    }
  });

  it('$literal de objeto/array completo (no se evalua recursivamente)', async () => {
    const out: any = await evaluateTemplate({ fijo: { $literal: { a: '$x', b: [1, 2] } } }, { x: 1 });
    expect(out.fijo).toEqual({ a: '$x', b: [1, 2] });
  });
});