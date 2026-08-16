import * as jsonata from 'jsonata';
import { TemplateEvalError } from '../../domain/mapping.port';

// ============================================================================
// Evaluador puro de plantillas de mapeo (sin side-effects, unit-testeable):
//
//   - hoja string  → expresión JSONata evaluada contra el input.
//   - objeto       → recursión clave por clave.
//   - array        → recursión elemento por elemento.
//   - { "$literal": X } → X tal cual (para constantes que no son expresiones).
//   - número/bool/null  → constante.
//
// Es async porque jsonata.evaluate() devuelve una Promise (su API es async,
// aunque sin funciones asíncronas registradas resuelve en una microtask).
// El input es: el payload crudo del partner (inbound) o el sobre canónico
// {event, point, source} (outbound). Ejemplo de plantilla outbound:
//
//   { "location": { "origin": "$join($map(point.locations[type='origin'],
//        function($l){ $l.address }), ',')" }, "description": "point.description" }
// ============================================================================

export async function evaluateTemplate(template: unknown, input: unknown): Promise<unknown> {
  return evalNode(template, input, '$');
}

async function evalNode(node: unknown, input: unknown, path: string): Promise<unknown> {
  if (typeof node === 'string') {
    let expr: any;
    try {
      expr = jsonata(node);
    } catch (err: any) {
      // Error de SINTAXIS al compilar la expresión.
      throw new TemplateEvalError(path, `expresión inválida (${err?.message ?? err})`);
    }
    try {
      return await expr.evaluate(input);
    } catch (err: any) {
      // Error en EJECUCIÓN (p. ej. argumentos con tipo incorrecto).
      throw new TemplateEvalError(path, err?.message ?? String(err));
    }
  }
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (let i = 0; i < node.length; i++) out.push(await evalNode(node[i], input, `${path}[${i}]`));
    return out;
  }
  if (node !== null && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // Escape de literal: { "$literal": <valor> } → valor tal cual.
    if (Object.keys(obj).length === 1 && '$literal' in obj) return obj.$literal;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = await evalNode(value, input, `${path}.${key}`);
    }
    return out;
  }
  return node; // número / boolean / null → constante
}