// Puerto del motor de mapeos declarativos (JSONata). Las plantillas viven en
// BD (PartnerMapping.definition) y este motor las evalúa de forma aislada.

export type MappingDirection = 'inbound' | 'outbound';

// Errore de evaluación con la ruta exacta de la hoja que falló, para mensajes
// accionables ("location.origin: expression expected...").
export class TemplateEvalError extends Error {
  constructor(public readonly path: string, public readonly detail: string) {
    super(`${path}: ${detail}`);
  }
}