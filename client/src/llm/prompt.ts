// System prompt y parseo del resultado para el asistente de creación por chat.
//
// AGENTE CON TOOLS: el modelo solo entrevista (texto corto) y clasifica; cada
// turno cierra con UNA o DOS tool calls JSON (una por línea). La APP ejecuta
// las tools: acumular datos, geocodificar el lugar (Nominatim), armar el
// resumen y publicar. El modelo NUNCA publica ni dice "publicando" — eso
// elimina de raíz las publicaciones prematuras y el texto inventado.
// Fallback: si el modelo no emite tool calls, se interpretan los marcadores
// legacy [[…]] y el JSON {"a",...} de versiones previas del contrato.

import {
  CONTACT_TYPES,
  DEFAULT_SUPPLIES,
  HELP_TYPES,
  SUPPLY_UNITS,
  type ContactInfo,
  type ContactType,
  type HelpTypeOption,
  type PointType,
  type SupplyDraft,
} from "../types";

export const POINT_BLOCK_OPEN = "[[PUNTO]]";
export const POINT_BLOCK_CLOSE = "[[/PUNTO]]";
// Marcadores de control que el modelo emite y la app oculta/muestra UI:
export const LOCATION_MARKER = "[[UBICACION]]"; // está pidiendo la ubicación
export const CONFIRM_MARKER = "[[CONFIRMAR]]"; // está pidiendo aprobación del resumen
export const READY_MARKER = "[[LISTO]]"; // aprobado: la app extrae el punto (2ª llamada)
export const MISSING_OPEN = "[[FALTA]]"; // lista de campos pendientes
export const MISSING_CLOSE = "[[/FALTA]]";

// Campos que puede reportar [[FALTA]] (para los chips de progreso).
export const MISSING_FIELDS = ["que_paso", "ayuda", "ubicacion", "contacto", "fotos"] as const;
export type MissingField = (typeof MISSING_FIELDS)[number];

// Etiqueta legible de cada campo para los chips de progreso del chat.
export const MISSING_LABELS: Record<MissingField, string> = {
  que_paso: "qué pasó",
  ayuda: "tipo de ayuda",
  ubicacion: "ubicación",
  contacto: "contacto",
  fotos: "fotos",
};

// Datos que el chat le pasa al asistente para prellenar el formulario.
// La ubicación se recopila aparte (tarjeta de ubicación/mapa) y las fotos
// quedan en la UI; aquí solo viaja el texto del lugar para geocodificar.
export interface AiPointDraft {
  type: PointType;
  title: string;
  description: string;
  helpType: HelpTypeOption;
  supplies: SupplyDraft[];
  contacts: ContactInfo[];
  // Lugar que mencionó la persona (ej. "Parque de Laureles, Medellín").
  // Vacío si no dio ninguno.
  locationQuery: string;
}

// Saludo inicial (texto local, sin pasar por el modelo) al arrancar el chat.
export const AI_GREETING =
  "¡Hola! Soy el asistente del mapa de emergencias por el sismo. Cuéntame qué pasa —puedes contarlo todo de una o yo te pregunto paso a paso—: «hay personas atrapadas», «ofrezco refugio», «busco a mi hermana», «se perdió mi gato»… Yo lo estructuro y lo publico en el mapa. ¿Qué quieres reportar u ofrecer?";

export function buildSystemPrompt(): string {
  return [
    'Eres el asistente del mapa de emergencias por sismo "Ayuda por Colombia". Entrevistas a una persona para publicar su PUNTO en el mapa: algo que NECESITA (need_help) u OFRECE (offer_help): atrapados, heridos, personas perdidas o encontradas, refugios, acopio, agua, comida, medicina, transporte, mascotas…',
    "",
    "REGLAS:",
    "1. Tutea a la persona. Máximo 2 líneas cortas por respuesta. UNA sola pregunta.",
    "2. Texto plano: nunca markdown, nunca listas, nunca encabezados, nunca repitas texto del sistema.",
    "3. NUNCA digas «publicando» ni prometas publicar: publicar lo hace la app, no tú.",
    "4. Si la persona está en peligro: dile que llame al 123 (Colombia) y sigue.",
    "5. Acepta todo lo que quiera publicar; no juzgues ni des consejos. Usa SOLO datos que la persona dijo.",
    "6. Repasa la conversación antes de preguntar: NUNCA preguntes lo que ya te dijeron.",
    "7. Cierra CADA respuesta con UNA o DOS llamadas a herramienta, cada una en su propia línea, al final. Sin ellas la app no entiende tu turno.",
    "8. No repitas textualmente una respuesta anterior: avanza el guion.",
    "",
    "HERRAMIENTAS:",
    '{"tool":"datos","p":{…}} — guarda lo NUEVO que dijo la persona. Campos de p: "type" ("need_help"/"offer_help"), "helpType" ("Refugio"/"Alimentos"/"Agua"/"Médico"/"Otro"), "title" (anuncio corto), "description" (detalles), "supplies":[{"name":"Agua","targetQuantity":10,"unit":"Unidades"}], "contacts":[{"type":"whatsapp","value":"…"}] (tipos: phone/whatsapp/instagram/email/other). Envía SOLO los campos nuevos; no repitas todo.',
    '{"tool":"buscar_lugar","q":"lugar"} — ubica el punto en el mapa. Úsala en cuanto sepas el lugar, aunque sea vago (ej. "Castilla, Medellín").',
    '{"tool":"pedir","falta":"campo"} — pide un dato que falte: que_paso, ayuda, ubicacion, contacto o fotos.',
    '{"tool":"resumen"} — cuando ya no falte nada. La app arma el resumen y el botón de publicar.',
    '{"tool":"listo"} — SOLO cuando la persona apruebe el resumen («sí», «dale», «publícalo»).',
    "",
    "GUION: qué pasó → detalle útil → tipo de ayuda → suministros → lugar → fotos (opcional, no insistas) → contacto → resumen → listo.",
    "",
    "EJEMPLO:",
    "Persona: Perdí a mi perro Toby, un beagle, cerca al CAD de Castilla en Medellín.",
    "Asistente: ¡Qué pena con Toby! Vamos a publicarlo para que más gente te ayude a buscarlo. ¿Tienes un contacto (teléfono o WhatsApp)?",
    '{"tool":"datos","p":{"type":"need_help","title":"Se perdió Toby, beagle, en Castilla","description":"Beagle llamado Toby perdido cerca al CAD de Castilla, Medellín, tras el sismo."}}',
    '{"tool":"buscar_lugar","q":"CAD de Castilla, Medellín"}',
  ].join("\n");
}


// SEGUNDA ETAPA — extracción del punto. Cuando el usuario aprueba el resumen
// (el asistente responde [[LISTO]]), la app hace una llamada DEDICADA con este
// prompt: solo extraer el JSON de la conversación. Separar "conversar" de
// "extraer" es mucho más fiable en modelos de 1B que pedir ambas cosas a la vez
// (con el prompt mixto tendían a empezar a escribir JSON en plena charla).
export function buildExtractionPrompt(transcript: string): string {
  return [
    "Eres un extractor de datos. Lee la conversación y devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni explicaciones, con esta forma:",
    '{"type":"need_help","helpType":"Otro","title":"…","description":"…","supplies":[{"name":"Agua","targetQuantity":10,"unit":"Unidades"}],"contacts":[{"type":"whatsapp","value":"…"}],"locationQuery":"…"}',
    'Reglas: "type" es "offer_help" SOLO si la persona ofrece ayuda; si no, "need_help". "helpType": exactamente uno de "Refugio","Alimentos","Agua","Médico","Otro". "title": máximo 100 caracteres, anuncio autónomo. "description": todos los detalles útiles de la conversación. "supplies" y "contacts": [] si no hay. "locationQuery": el lugar mencionado o "". Usa SOLO datos de la conversación; no inventes nada.',
    "",
    "CONVERSACIÓN:",
    transcript,
    "",
    "Responde solo con el JSON:",
  ].join("\n");
}

// ── Agente: tool calls por turno ─────────────────────────────────────────────
// Contrato: cada turno del modelo = texto visible corto + UNA o DOS tool calls
// JSON (una por línea, al final). La app las ejecuta en orden. Si el modelo no
// emite ninguna, se interpretan los formatos legacy (marcadores [[…]] o JSON
// {"a",...}) para no romper conversaciones iniciadas con contratos previos.

export type AgentCall =
  | { tool: "datos"; p: AiPointDraft }
  | { tool: "buscar_lugar"; q: string }
  | { tool: "pedir"; falta: MissingField }
  | { tool: "resumen" }
  | { tool: "listo" };

// Interpreta un turno completo: tool calls del agente (primario) o formatos
// legacy mapeados a calls equivalentes. [] = el turno no pidió nada.
export function interpretTurn(text: string): AgentCall[] {
  const calls = extractToolCalls(text);
  if (calls.length > 0) return calls;
  const ts = parseTurnState(text);
  if (ts) {
    const out: AgentCall[] = [];
    // Solo guarda datos si el "p" trae algo (un delta vacío no aporta y evita
    // calls fantasma cuando el modelo usa un nombre de tool inválido).
    if (ts.draft && draftHasContent(ts.draft)) out.push({ tool: "datos", p: ts.draft });
    if (ts.action === "ubicacion") out.push({ tool: "pedir", falta: "ubicacion" });
    if (ts.action === "confirmar") out.push({ tool: "resumen" });
    if (ts.action === "listo") out.push({ tool: "listo" });
    if (out.length > 0) return out;
    return [];
  }
  if (asksLocation(text)) return [{ tool: "pedir", falta: "ubicacion" }];
  if (asksConfirmation(text)) return [{ tool: "resumen" }];
  if (asksDone(text)) return [{ tool: "listo" }];
  const miss = parseMissing(text);
  if (miss && miss.length > 0) return [{ tool: "pedir", falta: miss[0] }];
  return [];
}

// ¿El delta/borrador trae algún dato aprovechable?
function draftHasContent(d: AiPointDraft): boolean {
  return (
    d.title.length > 0 ||
    d.description.length > 0 ||
    d.locationQuery.length > 0 ||
    d.supplies.length > 0 ||
    d.contacts.length > 0
  );
}

// ── Agente determinista: el modelo SOLO emite JSON ──────────────────────────
// Lecciones de las pruebas con Qwen 2.5 1.5B: pedirle a la vez empatía +
// brevedad + JSON en el mismo turno no funciona (párrafos, listas, repeticiones,
// cero tools, y el reintento correctivo tampoco corregía). Nuevo reparto:
//   - El MODELO solo entiende y estructura: responde EXCLUSIVAMENTE un objeto
//     JSON plano de una línea (esto sí lo cumplen los modelos chicos).
//   - La APP escribe las preguntas (guion fijo, cálido, una a la vez), decide
//     el siguiente paso, geocodifica, arma el resumen y publica.
// El chat no puede salirse del guion porque el modelo nunca escribe prosa.

export interface AgentObject {
  // Delta de campos nuevos (ya saneado; solo claves que trajo contenido).
  datos?: AiPointDraft;
  // El JSON de "datos" no traía "type"/"helpType" → al fusionar se conserva el
  // valor anterior (evita flips offer→need por defaults del saneado).
  sinType?: boolean;
  sinHelpType?: boolean;
  // Consulta para geocodificar (sitio que mencionó la persona).
  lugar?: string;
  // (informativo) dato que el modelo cree que falta; la app igualmente deduce
  // el siguiente paso con su guion determinista.
  pedir?: MissingField;
  // El modelo cree que ya se puede publicar.
  resumen?: boolean;
}

export function buildAgentSystemPrompt(): string {
  return [
    'Eres el motor de datos del mapa de emergencias por sismo "Ayuda por Colombia". Lees la conversación entre una persona y la app y respondes SOLO con UN objeto JSON de una sola línea. Nada de texto fuera del JSON, sin markdown.',
    "",
    "Forma (todas las claves opcionales):",
    '{"datos":{"type":"need_help|offer_help","helpType":"Refugio|Alimentos|Agua|Médico|Otro","title":"anuncio corto","description":"detalles","supplies":[{"name":"Agua","targetQuantity":10,"unit":"Unidades"}],"contacts":[{"type":"phone|whatsapp|instagram|email|other","value":"…"}]},"lugar":"sitio que mencionó","pedir":"que_paso|ayuda|ubicacion|contacto|fotos","resumen":true}',
    "",
    "Reglas:",
    '- "datos": SOLO campos con información que la persona haya dado (su último mensaje o algo aún no anotado). "title": anuncio autónomo, máximo 100 caracteres. "description": todos los detalles útiles. Nunca inventes: usa únicamente lo que la persona dijo.',
    '- "lugar": si la persona mencionó dónde (aunque sea vago: barrio, comuna, ciudad), ponlo tal cual lo dijo.',
    '- "type": "offer_help" SOLO si la persona OFRECE ayuda; si busca o necesita, "need_help".',
    '- "resumen": true cuando con lo anotado ya se puede publicar (hay título, descripción y contacto).',
    "- Si la persona aprueba o corrige el resumen, actualiza \"datos\" con los cambios.",
    "",
    "Responde solo con el JSON:",
  ].join("\n");
}

// Parsea el objeto del agente: primer objeto balanceado con alguna clave
// conocida. Tolerante a basura alrededor. null = no hubo JSON válido.
export function parseAgentObject(text: string): AgentObject | null {
  for (const s of balancedObjects(text)) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(s) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!["datos", "lugar", "pedir", "resumen"].some((k) => k in raw)) continue;
    const out: AgentObject = {};
    const datosRaw = raw.datos;
    if (datosRaw && typeof datosRaw === "object") {
      const d = sanitizePartialDraft(datosRaw);
      if (d && draftHasContent(d)) {
        out.datos = d;
        const o = datosRaw as Record<string, unknown>;
        out.sinType = !("type" in o);
        out.sinHelpType = !("helpType" in o);
      }
    }
    if (typeof raw.lugar === "string" && raw.lugar.trim()) {
      out.lugar = raw.lugar.replace(/\s+/g, " ").trim().slice(0, 200);
    }
    if (
      typeof raw.pedir === "string" &&
      (MISSING_FIELDS as readonly string[]).includes(raw.pedir)
    ) {
      out.pedir = raw.pedir as MissingField;
    }
    if (raw.resumen === true) out.resumen = true;
    return out;
  }
  return null;
}

// ── Guion determinista de la app ────────────────────────────────────────────
// Orden de la entrevista y preguntas escritas por la app (no por el modelo).

export type ScriptField = Exclude<MissingField, "fotos">;

// Siguiente dato que falta según el guion: qué pasó → ubicación → contacto →
// tipo de ayuda. null = ya se puede resumir.
export function nextMissingField(
  d: AiPointDraft | null,
  hasLocation: boolean,
): ScriptField | null {
  if (!d || d.title.trim().length < 3 || d.description.trim().length < 10) return "que_paso";
  if (!hasLocation) return "ubicacion";
  if (d.contacts.length === 0) return "contacto";
  if (d.helpType === "Otro" && d.supplies.length === 0) return "ayuda";
  return null;
}

// Pregunta visible (la escribe la app: cálida, breve, UNA sola).
export function nextQuestion(field: ScriptField, d: AiPointDraft | null): string {
  switch (field) {
    case "que_paso":
      return d && d.title.trim().length >= 3
        ? "Anoté lo principal. ¿Algún detalle importante que falte en la descripción?"
        : "Cuéntame con tus palabras qué pasó o qué ofreces: yo lo convierto en el anuncio del mapa.";
    case "ubicacion":
      return "¿Dónde? Escribe el barrio o el lugar y lo ubico en el mapa.";
    case "contacto":
      return "¿Cómo te contactamos si alguien ve tu punto? Teléfono o WhatsApp, por ejemplo.";
    case "ayuda":
      return "¿Qué tipo de ayuda es: refugio, alimentos, agua, médico u otra?";
  }
}

export function summaryQuestion(): string {
  return "¡Ya tengo todo! Revisa el resumen: si está bien, pulsa «Publicar ahora».";
}

export function placeNotFoundQuestion(q: string): string {
  return `No encontré «${q}» en el mapa. ¿En qué barrio, comuna o ciudad está?`;
}

// Todos los objetos JSON balanceados del texto (en orden) que sean tool calls
// válidas del contrato. Tolerante a basura alrededor; ignora los que no parsean.
function extractToolCalls(text: string): AgentCall[] {
  const calls: AgentCall[] = [];
  for (const s of balancedObjects(text)) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(s) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof raw.tool !== "string") continue;
    switch (raw.tool) {
      case "datos": {
        const d = sanitizePartialDraft(raw.p);
        if (d) calls.push({ tool: "datos", p: d });
        break;
      }
      case "buscar_lugar": {
        const q = typeof raw.q === "string" ? raw.q.replace(/\s+/g, " ").trim().slice(0, 200) : "";
        if (q) calls.push({ tool: "buscar_lugar", q });
        break;
      }
      case "pedir": {
        const f = raw.falta;
        if (typeof f === "string" && (MISSING_FIELDS as readonly string[]).includes(f)) {
          calls.push({ tool: "pedir", falta: f as MissingField });
        }
        break;
      }
      case "resumen":
        calls.push({ tool: "resumen" });
        break;
      case "listo":
        calls.push({ tool: "listo" });
        break;
    }
  }
  return calls;
}

// ── Estado por turno (legacy) ───────────────────────────────────────────────
// El asistente cierra CADA respuesta con {"a":…,"f":[…],"p":{…}}. La app lo
// parsea para saber qué hacer (pedir la ubicación, mostrar el botón de
// publicar…) y para acumular el borrador en vivo. Si el modelo rompe el JSON,
// parseTurnState devuelve null y el turno se trata como "chat" (degradación
// elegante: el texto sigue visible y se conserva el estado del turno previo).

export type TurnAction = "chat" | "ubicacion" | "confirmar" | "listo";

export interface TurnState {
  action: TurnAction;
  // null = el modelo no incluyó "f" → se conserva el estado anterior.
  missing: MissingField[] | null;
  // Borrador parcial de ESTE turno (ya saneado; puede estar incompleto).
  draft: AiPointDraft | null;
}

export function parseTurnState(text: string): TurnState | null {
  const jsonText = extractLastStateObject(text);
  if (!jsonText) return null;
  try {
    const raw = JSON.parse(jsonText) as Record<string, unknown>;
    if (!("a" in raw) && !("f" in raw) && !("p" in raw)) return null;
    const a = typeof raw.a === "string" ? raw.a : "";
    const action: TurnAction =
      a === "ubicacion" || a === "confirmar" || a === "listo" ? a : "chat";
    const missing = Array.isArray(raw.f)
      ? raw.f.filter(
          (s): s is MissingField =>
            typeof s === "string" && (MISSING_FIELDS as readonly string[]).includes(s),
        )
      : null;
    const draft = raw.p ? sanitizePartialDraft(raw.p) : null;
    return { action, missing, draft };
  } catch {
    return null;
  }
}

// Fusiona el borrador de un turno con el acumulado: cada campo del turno nuevo
// solo pisa si el JSON lo trajo explícitamente (los flags sinType/sinHelpType
// evitan flips por los defaults del saneado cuando el modelo los omite).
export function mergeDrafts(
  prev: AiPointDraft,
  next: AiPointDraft,
  flags?: { keepPrevType?: boolean; keepPrevHelpType?: boolean },
): AiPointDraft {
  return {
    type: flags?.keepPrevType ? prev.type : next.type,
    helpType: flags?.keepPrevHelpType ? prev.helpType : next.helpType,
    title: next.title || prev.title,
    description: next.description || prev.description,
    locationQuery: next.locationQuery || prev.locationQuery,
    supplies: next.supplies.length > 0 ? next.supplies : prev.supplies,
    contacts: next.contacts.length > 0 ? next.contacts : prev.contacts,
  };
}

// ¿El borrador acumulado ya sirve para publicar sin la 2ª llamada de
// extracción? (La ubicación la aporta la UI, no el modelo.)
export function isDraftComplete(d: AiPointDraft | null): boolean {
  return (
    !!d &&
    d.title.trim().length >= 3 &&
    d.description.trim().length >= 10 &&
    d.contacts.length > 0
  );
}

// Último objeto {…} balanceado (consciencia de strings) que parezca estado de
// turno legacy (claves "a"/"f"/"p"). Devolver el último evita confundir el JSON
// de un ejemplo con el estado real.
function extractLastStateObject(text: string): string | null {
  const candidates = balancedObjects(text);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const s = candidates[i];
    if (s.includes('"a"') || s.includes('"f"') || s.includes('"p"')) return s;
  }
  return null;
}

// Todos los objetos {…} balanceados del texto, en orden de aparición. Escaneo
// con consciencia de strings y escapes: no se confunde con llaves en textos.
function balancedObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") {
      if (depth === 0) start = k;
      depth++;
    } else if (c === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        out.push(text.slice(start, k + 1));
        start = -1;
      }
    }
  }
  return out;
}

// Igual que sanitizePointDraft pero para el borrador PARCIAL de un turno: no
// exige título/descripción mínimos (se van llenando en vivo) y reusa los
// saneadores de catálogos (suministros, contactos, tipos).
function sanitizePartialDraft(raw: unknown): AiPointDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  // Ante la duda, need_help: puede publicarse sin sesión (anónimo) y en
  // emergencia es el default seguro.
  const type: PointType = r.type === "offer_help" ? "offer_help" : "need_help";
  const helpRaw = typeof r.helpType === "string" ? r.helpType : "";
  const helpType = (HELP_TYPES as readonly string[]).includes(helpRaw)
    ? (helpRaw as HelpTypeOption)
    : "Otro";
  return {
    type,
    title: clampText(r.title, 150),
    description: clampText(r.description, 2000),
    helpType,
    locationQuery: clampText(r.locationQuery, 200),
    supplies: sanitizeSupplies(r.supplies),
    contacts: sanitizeContacts(r.contacts),
  };
}

// Quita de un texto TODO el marcado de control (bloque [[PUNTO]], [[UBICACION]],
// [[CONFIRMAR]], [[LISTO]], [[FALTA]]…[[/FALTA]]) para no mostrarlo en burbujas.
export function stripMarkers(text: string): string {
  let out = text;
  const pi = out.indexOf(POINT_BLOCK_OPEN);
  if (pi !== -1) {
    const pj = out.indexOf(POINT_BLOCK_CLOSE, pi);
    out = out.slice(0, pi) + (pj === -1 ? "" : out.slice(pj + POINT_BLOCK_CLOSE.length));
  }
  const fi = out.indexOf(MISSING_OPEN);
  if (fi !== -1) {
    const fj = out.indexOf(MISSING_CLOSE, fi);
    out = out.slice(0, fi) + (fj === -1 ? "" : out.slice(fj + MISSING_CLOSE.length));
  }
  // Bloque JSON de estado por turno: la app lo consume, la persona no lo ve.
  out = stripStateJson(out);
  return out
    .replaceAll(LOCATION_MARKER, "")
    .replaceAll(CONFIRM_MARKER, "")
    .replaceAll(READY_MARKER, "")
    // Vallas de markdown que a veces envuelven el JSON.
    .replaceAll("```json", "")
    .replaceAll("```JSON", "")
    .replaceAll("```", "")
    .trim();
}

// Elimina del texto los objetos JSON de control (tool calls del agente y
// estados legacy). Máximo 6 pasadas: el modelo debería emitir 1-2, pero por si
// se excede.
function stripStateJson(text: string): string {
  let out = text;
  for (let n = 0; n < 6; n++) {
    const objs = balancedObjects(out);
    const target = [...objs].reverse().find((s) => looksLikeControl(s));
    if (!target) break;
    out = out.replace(target, "");
  }
  return out;
}

function looksLikeControl(s: string): boolean {
  return (
    s.includes('"tool"') ||
    s.includes('"a"') ||
    s.includes('"f"') ||
    s.includes('"p"')
  );
}

// ¿La respuesta no tiene texto útil? Vacía o solo símbolos residuales de
// modelos pequeños (comillas, llaves, asteriscos sueltos…). Umbral: menos de
// 3 caracteres útiles (letras/números) tras limpiar marcado y puntuación.
export function isLowQuality(text: string): boolean {
  const visible = stripMarkers(text);
  const useful = visible.replace(/[\s\p{P}\p{S}]/gu, "");
  return useful.length < 3;
}

// ¿El modelo está pidiendo la ubicación / la aprobación / ya aprobó?
export function asksLocation(text: string): boolean {
  return text.includes(LOCATION_MARKER);
}
export function asksConfirmation(text: string): boolean {
  return text.includes(CONFIRM_MARKER);
}
export function asksDone(text: string): boolean {
  return text.includes(READY_MARKER);
}

// Lista de campos pendientes según [[FALTA]]…[[/FALTA]]. null si el modelo no
// emitió el marcador en esta respuesta (se conserva el estado anterior).
export function parseMissing(text: string): MissingField[] | null {
  const i = text.indexOf(MISSING_OPEN);
  if (i === -1) return null;
  const j = text.indexOf(MISSING_CLOSE, i);
  const raw = text.slice(i + MISSING_OPEN.length, j === -1 ? undefined : j);
  const valid = new Set<string>(MISSING_FIELDS);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is MissingField => valid.has(s));
}

// Extrae el JSON del bloque; si el modelo no usó los marcadores, intenta con
// el primer objeto balanceado {…} que parezca un punto.
export function parsePointDraft(text: string): AiPointDraft | null {
  const raw = extractJson(text);
  if (!raw) return null;
  try {
    return sanitizePointDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

function extractJson(text: string): string | null {
  const i = text.indexOf(POINT_BLOCK_OPEN);
  if (i !== -1) {
    const j = text.indexOf(POINT_BLOCK_CLOSE, i);
    return text.slice(i + POINT_BLOCK_OPEN.length, j === -1 ? undefined : j).trim();
  }
  // Fallback: primer objeto balanceado que contenga "title".
  let depth = 0;
  let start = -1;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (c === "{") {
      if (depth === 0) start = k;
      depth++;
    } else if (c === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, k + 1);
        if (candidate.includes('"title"')) return candidate;
        start = -1;
      }
    }
  }
  return null;
}

// Normaliza y valida el JSON del modelo contra las reglas del formulario
// (catálogos, longitudes, tipos). Devuelve null si no hay nada aprovechable.
function sanitizePointDraft(raw: unknown): AiPointDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  // Ante la duda, need_help: puede publicarse sin sesión (anónimo).
  const type: PointType = r.type === "offer_help" ? "offer_help" : "need_help";

  const helpRaw = typeof r.helpType === "string" ? r.helpType : "";
  const helpType = (HELP_TYPES as readonly string[]).includes(helpRaw)
    ? (helpRaw as HelpTypeOption)
    : "Otro";

  const title = clampText(r.title, 150);
  if (title.length < 3) return null;
  // Si el modelo no dio descripción, usamos el título como base editable.
  const description = clampText(r.description, 2000) || title;
  const locationQuery = clampText(r.locationQuery, 200);

  return {
    type,
    title,
    description,
    helpType,
    locationQuery,
    supplies: sanitizeSupplies(r.supplies),
    contacts: sanitizeContacts(r.contacts),
  };
}

function clampText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function sanitizeSupplies(v: unknown): SupplyDraft[] {
  if (!Array.isArray(v)) return [];
  const out: SupplyDraft[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const name = clampText(o.name, 80);
    if (name.length < 2) continue;
    // Ajusta al catálogo conocido (ej. "aguas" → "Agua") para que el picker
    // muestre el ítem marcado en lugar de crear duplicados.
    const known = DEFAULT_SUPPLIES.find((d) => normalizeName(d) === normalizeName(name));
    const finalName = known ?? name;
    const key = normalizeName(finalName);
    if (seen.has(key)) continue;
    seen.add(key);
    const qtyRaw = o.targetQuantity;
    const targetQuantity =
      typeof qtyRaw === "number" && Number.isFinite(qtyRaw) && qtyRaw >= 0
        ? Math.round(qtyRaw)
        : null;
    const unitRaw = typeof o.unit === "string" ? o.unit : "";
    const unit = (SUPPLY_UNITS as readonly string[]).includes(unitRaw) ? unitRaw : null;
    out.push({ name: finalName, targetQuantity, unit });
    if (out.length >= 8) break;
  }
  return out;
}

function sanitizeContacts(v: unknown): ContactInfo[] {
  if (!Array.isArray(v)) return [];
  const out: ContactInfo[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const value = clampText(o.value, 200);
    if (!value) continue;
    const typeRaw = typeof o.type === "string" ? o.type : "other";
    const type = ((CONTACT_TYPES as readonly string[]).includes(typeRaw)
      ? typeRaw
      : "other") as ContactType;
    const key = `${type}:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type, value });
    if (out.length >= 3) break;
  }
  return out;
}
