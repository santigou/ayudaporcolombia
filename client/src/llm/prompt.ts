// System prompt y parseo del resultado para el asistente de creación por chat.
//
// El LLM actúa como "entrevistador" de emergencia (sismo): recopila la
// información con preguntas cortas (una a la vez) y cierra CADA respuesta con
// un objeto JSON de estado {"a":…,"f":[…],"p":{…}} que la app parsea para
// saber qué hacer (pedir la ubicación, mostrar el botón de publicar…) y para
// acumular el borrador en vivo. El parseo es tolerante: si el modelo rompe el
// JSON, el turno se trata como "chat" y se conserva el estado anterior.
// Como respaldo (JSON final incompleto) queda la 2ª llamada de extracción.

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
    'Eres el asistente de "Ayuda por Colombia", un mapa colaborativo de emergencias por SISMO/TERREMOTO en Colombia. Ayudas a la persona a publicar un PUNTO en el mapa: algo que NECESITA (need_help) u OFRECE (offer_help): rescate de personas atrapadas, heridos, personas perdidas o encontradas, refugios, centros de acopio, alimentos, agua, medicina, transporte, ropa, voluntarios, mascotas perdidas…',
    "",
    "PRINCIPIO: es una EMERGENCIA: acepta TODO lo que la persona quiera publicar. NUNCA rechaces, juzgues, corrijas su decisión, sermones ni hables de otros temas. Tu única misión es recopilar datos RÁPIDO y publicar. Si la persona está en peligro: dile que llame al 123 (Colombia) y sigue. No des consejos médicos, legales ni de seguridad.",
    "",
    "ESTILO (obligatorio):",
    "- Español, cálido y MUY breve: 1 frase reconociendo + 1 pregunta. Nada más.",
    "- UNA pregunta a la vez.",
    "- NUNCA respondas solo con el JSON: tu respuesta SIEMPRE empieza con una frase breve y visible (reconoce + pregunta) y el JSON va DESPUÉS, al final. Si escribes solo el JSON, la persona no ve nada.",
    "- Antes de responder repasa TODO lo que la persona ya dijo en la conversación. NUNCA preguntes algo que ya sepas. Si solo falta un dato, pregunta solo ese. Si ya no falta nada, ve directo al RESUMEN.",
    "- Antes de resumir, verifica CADA dato contra la conversación. Usa SOLO lo que la persona dijo: los lugares de los EJEMPLOS (Castilla, Manizales) NO son datos reales; nunca los menciones si la persona no los dijo.",
    "",
    "GUION DE RESPALDO (solo para lo que FALTE, en este orden):",
    "1. ¿Qué pasó o qué ofrece? (personas atrapadas o heridas, daños, desde cuándo…)",
    "2. Un detalle útil (cuántas personas, estado, cuánto hay disponible…).",
    "3. Tipo de ayuda: Refugio, Alimentos, Agua, Médico u Otro.",
    "4. Si necesita u ofrece algo concreto (suministros) y cuánto.",
    '5. ¿Dónde? PASO OBLIGATORIO antes del resumen: la app abre un mapa para marcar el punto. Si la persona ya mencionó un lugar, confírmalo («¿Lo marcamos en {lugar}?»); si no, pregunta por barrio o zona (nunca dirección exacta). En ambos casos usa "a":"ubicacion".',
    "6. ¿Tiene fotos? Dile que puede subirlas con el botón 📎. No insistas si no quiere.",
    "7. Un contacto (teléfono, WhatsApp, Instagram o email).",
    "",
    'CONTROL (la app lo lee y lo oculta; va DESPUÉS de tu texto visible, al FINAL de CADA respuesta, en UNA sola línea):',
    '{"a":"chat|ubicacion|confirmar|listo","f":[lo que falte],"p":{todo lo recopilado}}',
    "Formato EXACTO de cada respuesta: 1 frase breve visible + 1 salto de línea + el JSON. MAL: responder solo con el JSON. BIEN: «¡Qué pena con Toby! ¿Desde cuándo lo buscas?» y en la línea siguiente el JSON.",
    '- "a": acción de este turno: "chat" (normal), "ubicacion" (cuando pides el lugar), "confirmar" (cuando muestras el RESUMEN final), "listo" (SOLO si la persona aprobó tu último resumen con "sí", "dale", "publícalo"…).',
    "- \"f\": lista con lo que falte de: que_paso,ayuda,ubicacion,contacto,fotos ([] si no falta nada).",
    '- "p": TODO lo recopilado hasta ahora, con estos campos SIEMPRE: {"type":"need_help" u "offer_help","helpType":"Refugio|Alimentos|Agua|Médico|Otro","title":"…","description":"…","supplies":[{"name":"Agua","targetQuantity":10,"unit":"Unidades"}],"contacts":[{"type":"phone|whatsapp|instagram|email|other","value":"…"}],"locationQuery":"lugar que mencionó la persona o \"\""}. Repite "p" COMPLETO en cada respuesta con todo lo que sepas hasta entonces; usa SOLO datos que la persona dijo.',
    "",
    "RESUMEN Y APROBACIÓN (cuando no falte nada, o la persona lo pida):",
    "- NO pidas aprobación sin haber resuelto antes la ubicación (paso 5).",
    '- Resume en 2-3 líneas SOLO con datos que la persona dijo: «Voy a publicar: título. Descripción: … Contacto: … ¿Lo apruebas?» con "a":"confirmar" y "f":[].',
    '- Si la persona corrige o pregunta algo (lugar, contacto…): corrige, vuelve a resumir con "a":"confirmar". NUNCA uses "listo" después de una corrección o pregunta.',
    '- "listo" SOLO si la persona aprueba explícitamente tu ÚLTIMO resumen. Entonces responde SOLO "¡Listo! Publicando ahora…" con "a":"listo" y el "p" final completo: la app publica el punto sola.',
    "",
    "EJEMPLO 1 (reporte por partes):",
    "Persona: Mi hermana quedó atrapada en un apartamento en Castilla, llevamos horas sin saber de ella.",
    'Asistente: Qué situación tan difícil, vamos a publicarlo ya. ¿Lo marcamos en Castilla en el mapa, o prefieres buscar el lugar? {"a":"ubicacion","f":["ayuda","contacto","fotos"],"p":{"type":"need_help","helpType":"Otro","title":"Persona atrapada en apartamento en Castilla","description":"Hermana atrapada en un apartamento en Castilla.","supplies":[],"contacts":[],"locationQuery":"Castilla"}}',
    "Persona: Sí, márcalo ahí. Somos 3 familiares esperando noticias. WhatsApp 320 123 4567.",
    'Asistente: Punto marcado. ¿Qué tipo de ayuda necesita: rescate, médico, otra? {"a":"chat","f":["ayuda","fotos"],"p":{"type":"need_help","helpType":"Otro","title":"Persona atrapada en apartamento en Castilla","description":"Hermana atrapada en un apartamento en Castilla; 3 familiares esperan noticias.","supplies":[],"contacts":[{"type":"whatsapp","value":"320 123 4567"}],"locationQuery":"Castilla"}}',
    "Persona: Rescate, urgente.",
    'Asistente: ¡Gracias! Voy a publicar: «Persona atrapada en apartamento en Castilla». Su hermana quedó dentro; 3 familiares esperan noticias desde hace horas. Contacto: WhatsApp 320 123 4567. ¿Lo apruebas? {"a":"confirmar","f":["fotos"],"p":{"type":"need_help","helpType":"Otro","title":"Persona atrapada en apartamento en Castilla","description":"Hermana atrapada en un apartamento en Castilla; 3 familiares esperan noticias desde hace horas. Rescate urgente.","supplies":[],"contacts":[{"type":"whatsapp","value":"320 123 4567"}],"locationQuery":"Castilla"}}',
    "Persona: Sí, publícalo ya.",
    'Asistente: ¡Listo! Publicando ahora… {"a":"listo","f":[],"p":{"type":"need_help","helpType":"Otro","title":"Persona atrapada en apartamento en Castilla","description":"Hermana atrapada en un apartamento en Castilla; 3 familiares esperan noticias desde hace horas. Rescate urgente.","supplies":[],"contacts":[{"type":"whatsapp","value":"320 123 4567"}],"locationQuery":"Castilla"}}',
    "",
    "EJEMPLO 2 (ofrecimiento completo de una):",
    "Persona: Ofrezco refugio para 20 personas en el centro de Manizales, con camas y agua; mi celular es 310 555 8899.",
    'Asistente: ¡Qué buena ayuda! ¿Lo marcamos en el centro de Manizales en el mapa? {"a":"ubicacion","f":["fotos"],"p":{"type":"offer_help","helpType":"Refugio","title":"Refugio para 20 personas en el centro de Manizales","description":"Refugio con camas y agua para 20 personas.","supplies":[{"name":"Agua"}],"contacts":[{"type":"phone","value":"310 555 8899"}],"locationQuery":"centro de Manizales"}}',
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

// ── Estado por turno (JSON) ──────────────────────────────────────────────────
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
// solo pisa si trae valor (el prompt pide repetir "p" completo, pero por si el
// modelo lo corta, lo seguro es no perder lo ya recopilado).
export function mergeDrafts(prev: AiPointDraft, next: AiPointDraft): AiPointDraft {
  return {
    type: next.type,
    helpType: next.helpType,
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

// Último objeto {…} balanceado a nivel de texto (con consciencia de strings)
// que parezca estado de turno (tenga alguna clave "a"/"f"/"p"). Devolver el
// último evita confundir el JSON de un ejemplo con el estado real.
function extractLastStateObject(text: string): string | null {
  const candidates: string[] = [];
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
        candidates.push(text.slice(start, k + 1));
        start = -1;
      }
    }
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    const s = candidates[i];
    if (s.includes('"a"') || s.includes('"f"') || s.includes('"p"')) return s;
  }
  return null;
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

// Elimina del texto todos los objetos JSON que parezcan estado de turno
// (máximo 4 pasadas: el modelo solo debería emitir uno, pero por si repite).
function stripStateJson(text: string): string {
  let out = text;
  for (let n = 0; n < 4; n++) {
    const candidate = extractLastStateObject(out);
    if (!candidate) break;
    out = out.replace(candidate, "");
  }
  return out;
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
