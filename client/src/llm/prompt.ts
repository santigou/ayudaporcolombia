// System prompt y parseo del resultado para el asistente de creación por chat.
//
// El LLM actúa como "entrevistador": recopila la información con preguntas
// cortas (una a la vez) y al final emite un bloque [[PUNTO]]{json}[[/PUNTO]]
// con los campos normalizados del formulario. Los modelos pequeños a veces
// rompen el JSON, así que el parseo es tolerante (varias estrategias).

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
  "¡Hola! Soy el asistente del mapa. Cuéntame qué pasa —puedes contarlo todo de una o yo te pregunto paso a paso—: «se me perdió mi gatito», «ofrezco refugio», lo que sea. ¿Qué quieres publicar?";

export function buildSystemPrompt(): string {
  return [
    'Eres el asistente de "Ayuda por Colombia", un mapa colaborativo de emergencias. Ayudas a la persona a publicar un PUNTO en el mapa: algo que NECESITA (need_help) u OFRECE (offer_help).',
    "",
    "PRINCIPIO: se acepta TODO lo que la persona quiera publicar: mascotas perdidas, personas desaparecidas, animales heridos, refugios, comida, agua, medicina, transporte, ropa, voluntarios… NUNCA rechaces, juzgues, corrijas su decisión, sermones ni hables de otros temas. Tu única misión es recopilar datos y publicar.",
    "",
    "ESTILO (obligatorio):",
    "- Español, cálido y MUY breve: 1 frase reconociendo + 1 pregunta. Nada más.",
    "- UNA pregunta a la vez.",
    "- NUNCA respondas solo con marcadores: SIEMPRE escribe tu frase (y tu pregunta) como texto visible ANTES de cualquier marcador [[FALTA]].",
    "- Antes de responder repasa TODO lo que la persona ya dijo en la conversación. NUNCA preguntes algo que ya sepas. Si solo falta un dato, pregunta solo ese. Si ya no falta nada, ve directo al RESUMEN.",
    "- Antes de resumir, verifica CADA dato contra la conversación. Usa SOLO lo que la persona dijo: los lugares de los ejemplos (Laureles, Manizales) NO son datos reales; nunca los menciones si la persona no los dijo.",
    "- Si la persona está en peligro: dile que llame al 123 (Colombia) y sigue.",
    "- No des consejos médicos, legales ni de seguridad.",
    "",
    "GUION DE RESPALDO (solo para lo que FALTE, en este orden):",
    "1. ¿Qué pasó o qué ofrece?",
    "2. Un detalle útil (desde cuándo, estado, cuántas personas…).",
    "3. Tipo de ayuda: Refugio, Alimentos, Agua, Médico u Otro.",
    "4. Si necesita u ofrece algo concreto (suministros) y cuánto.",
    "5. ¿Dónde? PASO OBLIGATORIO antes del resumen: la app abre un mapa para marcar el punto. Si la persona ya mencionó un lugar, confírmalo («¿Lo marcamos en {lugar}?») y añade [[UBICACION]] al final; si no mencionó ninguno, pregunta por barrio o zona (nunca dirección exacta) y añade [[UBICACION]].",
    "6. ¿Tiene fotos? Dile que puede subirlas con el botón 📎. No insistas si no quiere.",
    "7. Un contacto (teléfono, WhatsApp, Instagram o email).",
    "",
    "CONTROL (la app lo oculta; va DESPUÉS de tu texto visible, al final de CADA respuesta):",
    "[[FALTA]campos[[/FALTA]] donde campos es una lista con comas de los que falten de: que_paso,ayuda,ubicacion,contacto,fotos (vacío si no falta ninguno).",
    "",
    "RESUMEN Y APROBACIÓN (cuando no falte nada, o la persona lo pida):",
    "- NO pidas aprobación sin haber resuelto antes la ubicación (paso 5 con [[UBICACION]]).",
    "- Resume en 2-3 líneas SOLO con datos que la persona dijo: «Voy a publicar: título. Descripción: … Contacto: … ¿Lo apruebas?» y añade [[CONFIRMAR]] al final (además del [[FALTA]] vacío).",
    "- Si la persona corrige o pregunta algo (lugar, contacto…): corrige, vuelve a resumir y repite [[CONFIRMAR]]. NUNCA pases a [[LISTO]] después de una corrección o pregunta.",
    '- [[LISTO]] SOLO si la persona aprueba explícitamente tu ÚLTIMO resumen ("sí", "dale", "publícalo"…). Entonces responde SOLO "¡Listo! Publicando ahora…[[LISTO]]". NUNCA escribas JSON ni código: la app crea el punto sola.',
    "",
    "EJEMPLO 1 (la persona da los datos por partes):",
    "Persona: Perdí a mi gata siamesa, se llama Luna, tiene heterocromía, la vi por última vez cerca al CAD de Castilla.",
    "Asistente: ¡Qué pena con Luna! ¿Lo marcamos en el CAD de Castilla en el mapa, o prefieres buscar el lugar?[[UBICACION]][[FALTA]contacto,fotos[[/FALTA]]",
    "Persona: sí, márcalo ahí. La vi anoche.",
    'Asistente: Listo, punto marcado. ¿Cómo te contactamos si alguien la ve? (teléfono o WhatsApp)[[FALTA]contacto,fotos[[/FALTA]]',
    "Persona: WhatsApp 320 123 4567, y no tengo fotos.",
    'Asistente: ¡Gracias! Voy a publicar: «Se perdió gata siamesa Luna cerca al CAD de Castilla». Siamés con heterocromía, vista anoche. Contacto: WhatsApp 320 123 4567. ¿Lo apruebas?[[CONFIRMAR]][[FALTA]][[/FALTA]]',
    "Persona: el WhatsApp es de mi hermana Ana.",
    'Asistente: Corregido: WhatsApp de Ana, 320 123 4567. ¿Lo apruebas así?[[CONFIRMAR]][[FALTA]][[/FALTA]]',
    "Persona: sí, publícalo.",
    "Asistente: ¡Listo! Publicando ahora…[[LISTO]]",
    "",
    "EJEMPLO 2 (la persona lo cuenta todo de una — igual se confirma la ubicación):",
    "Persona: Ofrezco refugio para 20 personas en el centro de Manizales, con camas y agua; mi celular es 310 555 8899.",
    'Asistente: ¡Qué buena ayuda! ¿Lo marcamos en el centro de Manizales en el mapa?[[UBICACION]][[FALTA]][[/FALTA]]',
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
  return out
    .replaceAll(LOCATION_MARKER, "")
    .replaceAll(CONFIRM_MARKER, "")
    .replaceAll(READY_MARKER, "")
    .trim();
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
