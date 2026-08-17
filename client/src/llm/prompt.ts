// System prompts y parseo del resultado para el asistente de creación por chat.
//
// AGENTE DETERMINISTA: el modelo SOLO estructura en JSON lo que la persona
// dice (datos/lugar/pedir/resumen); la APP escribe las preguntas del guion,
// geocodifica (Nominatim), arma el resumen y publica. El modelo NUNCA publica
// ni escribe prosa visible. (Los contratos legacy —marcadores [[…]] y JSON
// {"a",...} de versiones previas— fueron retirados: aquí vive uno solo.)

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

// Límite duro del título en TODO el contrato (saneadores y prompts de
// extracción): un solo valor para que modelo, saneado y UI no discrepen.
export const TITLE_MAX_CHARS = 150;

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

// SEGUNDA ETAPA — extracción del punto. Cuando el usuario aprueba el resumen
// (el asistente responde [[LISTO]]), la app hace una llamada DEDICADA con este
// prompt: solo extraer el JSON de la conversación. Separar "conversar" de
// "extraer" es mucho más fiable en modelos de 1B que pedir ambas cosas a la vez
// (con el prompt mixto tendían a empezar a escribir JSON en plena charla).
export function buildExtractionPrompt(transcript: string): string {
  return [
    "Eres un extractor de datos. Lee la conversación y devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni explicaciones, con esta forma:",
    '{"type":"need_help","helpType":"Otro","title":"…","description":"…","supplies":[{"name":"Agua","targetQuantity":10,"unit":"Unidades"}],"contacts":[{"type":"whatsapp","value":"…"}],"locationQuery":"…"}',
    `Reglas: "type" es "offer_help" SOLO si la persona ofrece ayuda; si no, "need_help". "helpType": exactamente uno de "Refugio","Alimentos","Agua","Médico","Otro". "title": máximo ${TITLE_MAX_CHARS} caracteres, anuncio autónomo. "description": todos los detalles útiles de la conversación. "supplies" y "contacts": [] si no hay. "locationQuery": el lugar mencionado o "". Usa SOLO datos de la conversación; no inventes nada.`,
    "",
    "CONVERSACIÓN:",
    transcript,
    "",
    "Responde solo con el JSON:",
  ].join("\n");
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
    '- "datos": SOLO campos con información que la persona haya dado (su último mensaje o algo aún no anotado). "title": anuncio corto, una sola frase, sin repetir información. "description": todos los detalles útiles, sin frases repetidas. Copia nombres propios, instituciones y lugares EXACTAMENTE como los escribió la persona (ej. «CAD de Castilla», no «Casco de Castilla»). Nunca inventes: usa únicamente lo que la persona dijo.',
    "- NUNCA inventes contactos, teléfonos, emails ni URLs: si la persona no dio un contacto, deja \"contacts\" vacío. No conviertas un @handle en email.",
    '- "lugar": si la persona mencionó dónde (aunque sea vago: barrio, comuna, ciudad), ponlo tal cual lo dijo.',
    '- "type": "offer_help" SOLO si la persona OFRECE ayuda; si busca o necesita, "need_help".',
    '- "resumen": true cuando con lo anotado ya se puede publicar (hay título, descripción y contacto).',
    "- Si la persona aprueba o corrige el resumen, actualiza \"datos\" con los cambios.",
    "",
    "EJEMPLO — Persona: «Perdí a mi perro Toby, un beagle, por el CAD de Castilla en Medellín» →",
    '{"datos":{"type":"need_help","title":"Se perdió Toby, beagle, en Castilla","description":"Beagle llamado Toby perdido cerca al CAD de Castilla, Medellín, tras el sismo."},"lugar":"CAD de Castilla, Medellín"}',
    "EJEMPLO — Persona: «sí, mi whatsapp es 320 123 4567» →",
    '{"datos":{"contacts":[{"type":"whatsapp","value":"320 123 4567"}]}}',
    "",
    "Responde solo con el JSON:",
  ].join("\n");
}

// Pasada ENFOCADA de lugar: cuando el guion necesita la ubicación y el objeto
// principal no la trajo (el modelo chico a veces omite "lugar" aunque la
// persona lo haya dicho), esta mini-tarea sí la cumple con fiabilidad: SOLO
// detectar si hay un lugar en la conversación. Con el mismo historial.
export function buildLugarSystemPrompt(): string {
  return [
    "Detectas lugares mencionados por una persona en una conversación. Responde SOLO un objeto JSON de una línea:",
    '{"lugar":"el sitio que mencionó la persona, tal cual lo dijo"}',
    "o {} si NO mencionó ningún lugar (barrio, comuna, parque, institución, dirección o ciudad).",
    "No inventes ni adivines lugares. Si mencionó una ciudad y un sitio, incluye ambos (ej. \"CAD de Castilla, Medellín\").",
  ].join("\n");
}

// VERIFICADOR — segunda opinión con framing distinto (LLM-judge enfocado): se
// le pasa el BORRADOR acumulado + la conversación y corrige/completa lo que el
// pase principal omitió (el síntoma «ignora casos»). Generaliza la pasada
// enfocada de lugar a todos los campos. Su salida pasa la misma
// anti-fabricación: es el mismo modelo chico y también puede equivocarse.
export function buildVerifierSystemPrompt(draft: AiPointDraft | null): string {
  const draftJson = draft
    ? JSON.stringify({
        type: draft.type,
        helpType: draft.helpType,
        title: draft.title,
        description: draft.description,
        supplies: draft.supplies,
        contacts: draft.contacts,
      })
    : "(vacío)";
  return [
    "Eres un verificador de datos. Comparas el BORRADOR con la conversación de la persona y respondes SOLO un JSON de una línea:",
    '{"datos":{…},"lugar":"…"}',
    "Reglas:",
    "- Corrige o completa los campos del borrador que estén VACÍOS, incompletos o con errores, usando ÚNICAMENTE lo que la persona dijo (sus palabras exactas cuando sea posible). Copia nombres propios y lugares EXACTAMENTE como los escribió. Título: una frase corta sin repetir. Descripción: sin frases repetidas.",
    '- "lugar": el sitio que la persona mencionó (barrio, comuna, institución o ciudad), tal cual lo dijo.',
    "- NO inventes contactos, teléfonos, emails ni URLs. NO conviertas un @handle en email.",
    "- Si el borrador ya está completo y correcto según la conversación, responde {}.",
    "",
    `BORRADOR ACTUAL: ${draftJson}`,
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

// ── Anti-fabricación: valida el borrador contra lo que la persona escribió ──
// El modelo estructurador a veces inventa: títulos-pregunta de roleplay
// («¿Cómo puedo ayudarte?»), descripciones con URLs nunca enviadas, contactos
// fabricados («testtes@email.com» a partir de un @handle) o suministros no
// mencionados («Agua»). Regla de oro: solo se publica lo rastreable al texto
// REAL de la persona. Lo que no pasa la guarda se vacía (el llamador puede
// restaurar el valor anterior).

function normForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@._\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokens de comparación: normalizados y SIN puntuación de bordes (los puntos
// se permiten en normForMatch para emails/handles, pero «toby.» ≠ «toby» y
// rompería tanto la trazabilidad como la deduplicación).
function tokens(s: string): string[] {
  return normForMatch(s)
    .split(" ")
    .map((w) => w.replace(/^[._@-]+|[._-]+$/g, ""))
    .filter((w) => w.length >= 3);
}

// Palabra rastreable: prefijo de 4+ caracteres (tolera inflexiones del
// español: «perdí» ↔ «perdido»); cortas exigen coincidencia exacta.
function wordMatches(word: string, hay: string): boolean {
  if (word.length >= 4) return hay.includes(word.slice(0, 4));
  return hay.includes(word);
}

function overlapRatio(text: string, hay: string): number {
  const words = tokens(text);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => wordMatches(w, hay)).length;
  return hits / words.length;
}

// Contacto rastreable según su tipo (p. ej. un email exige que la persona lo
// escribiera completo; un @handle basta para instagram; dígitos para teléfono).
function contactTraceable(c: ContactInfo, hay: string, hayCompact: string, hayDigits: string): boolean {
  const v = normForMatch(c.value);
  if (!v) return false;
  switch (c.type) {
    case "email":
      return hay.includes(v);
    case "instagram":
      return hay.includes(v.replace(/^@/, ""));
    case "phone":
    case "whatsapp": {
      const digits = c.value.replace(/\D/g, "");
      return digits.length >= 7 && hayDigits.includes(digits);
    }
    default:
      return hayCompact.includes(v.replace(/\s/g, ""));
  }
}

export function sanitizeDraftAgainstText(d: AiPointDraft, userText: string): AiPointDraft {
  const hay = normForMatch(userText);
  const hayCompact = hay.replace(/\s/g, "");
  const hayDigits = userText.replace(/\D/g, "");
  const title = d.title.trim();
  const titleOK =
    title.length >= 3 && !title.includes("?") && overlapRatio(title, hay) >= 0.5;
  const desc = d.description.trim();
  const descOK = desc.length >= 10 && overlapRatio(desc, hay) >= 0.4;
  return {
    ...d,
    title: titleOK ? condenseTitle(d.title) : "",
    description: descOK ? condenseDescription(d.description) : "",
    supplies: d.supplies.filter((s) => hayCompact.includes(normForMatch(s.name).replace(/\s/g, ""))),
    contacts: d.contacts.filter((c) => contactTraceable(c, hay, hayCompact, hayDigits)),
  };
}

// ── Tipo de ayuda por keywords (determinista) ───────────────────────────────
// Cuando la persona responde a «¿qué tipo de ayuda?» con algo que no es del
// catálogo («solo necesito que me ayuden», «mascota perdida»), el guion no
// puede quedarse en bucle: se infiere del texto si hay pista, y si no, queda
// «Otro» (válido) y se avanza.
const HELP_TYPE_KEYWORDS: Array<[HelpTypeOption, string[]]> = [
  ["Médico", ["medic", "herid", "salud", "enferm", "ambulanc", "rescat", "atencion medica"]],
  ["Refugio", ["refugio", "albergue", "alojamiento", "techo", "dormir", "hospedaje"]],
  ["Alimentos", ["alimento", "comida", "mercado", "despensa", "almuerzo", "cena"]],
  ["Agua", ["agua potable", "agua"]],
];

export function inferHelpType(text: string): HelpTypeOption | null {
  const hay = normForMatch(text);
  if (!hay) return null;
  for (const [type, keys] of HELP_TYPE_KEYWORDS) {
    if (keys.some((k) => hay.includes(k))) return type;
  }
  return null;
}

// Temas claramente FUERA del catálogo de tipos de ayuda (mascotas, personas
// perdidas, rescate, transporte, documentos…): preguntar «¿refugio, alimentos,
// agua, médico u otra?» sería ruido — el contexto ya responde y el tipo
// correcto es «Otro». Solo se consulta cuando inferHelpType no encontró nada
// (el llamador garantiza el orden), así que un texto con señal de catálogo
// («mi gato está herido» → Médico) nunca se salta por esta vía.
const OUT_OF_CATALOG_TOPICS = [
  "perro", "gato", "mascota", "animal", "veterinari",
  "herman", "famili", "desaparecid", "extravi",
  "atrapad", "derrumb", "escombro",
  "transporte", "traslad", "ropa", "documento",
];

export function helpTypeOutOfCatalog(text: string): boolean {
  const hay = normForMatch(text);
  if (!hay) return false;
  return OUT_OF_CATALOG_TOPICS.some((k) => hay.includes(k));
}

// ── Condensación determinista de texto repetitivo ───────────────────────────
// El modelo a veces genera frases redundantes con palabras rastreables
// («Beagle llamado Toby, un beagle… es un perro que es un beagle»): pasan la
// anti-fabricación pero son basura. Se condensa sin recurrir al modelo.

function sentences(t: string): string[] {
  return t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordSet(s: string): Set<string> {
  return new Set(tokens(s));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

// Título: primera frase, sin palabras duplicadas consecutivas, recortado a
// límite de palabras (sin cortar a medias) con elipsis si hace falta.
export function condenseTitle(t: string, max = 90): string {
  const first = sentences(t)[0] ?? t;
  const deduped = first.replace(/\b(\w+) \1\b/gi, "$1").trim();
  if (deduped.length <= max) return deduped;
  const cut = deduped.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// Descripción: colapsa palabras consecutivas repetidas, elimina frases casi
// duplicadas (Jaccard ≥ 0.55) y frases PARÁFRASIS (aportan ≤1 palabra
// significativa nueva tras quitar genéricas: «Es un perro que es un beagle y
// su nombre es Toby» no aporta nada nuevo y se elimina).
const GENERIC_WORDS = new Set([
  "que", "es", "son", "era", "un", "una", "del", "al", "los", "las", "le", "lo",
  "y", "o", "su", "sus", "se", "con", "por", "para", "como", "mas", "muy", "ya",
  "no", "si", "este", "esta", "eso", "tiene", "hay", "fue", "llama", "llamado",
  "llamada", "nombre", "encuentra", "encontraba", "esta", "estaba", "tambien",
]);

function significantWords(s: string): Set<string> {
  return new Set(tokens(s).filter((w) => !GENERIC_WORDS.has(w)));
}

export function condenseDescription(d: string, max = 600): string {
  const collapsed = d.replace(/\b(\w+) \1\b/gi, "$1");
  const kept: string[] = [];
  let keptWords = new Set<string>();
  const keptSets: Set<string>[] = [];
  for (const s of sentences(collapsed)) {
    const ws = wordSet(s);
    if (keptSets.some((k) => jaccard(k, ws) >= 0.55)) continue;
    const sig = significantWords(s);
    let news = 0;
    for (const w of sig) if (!keptWords.has(w)) news++;
    if (news <= 1) continue; // paráfrasis: no aporta información nueva
    kept.push(s);
    keptSets.push(ws);
    keptWords = new Set([...keptWords, ...sig]);
  }
  const out = kept.join(" ");
  if (out.length <= max) return out;
  const cut = out.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// ── Contactos deterministas: extraídos por regex del texto de la persona ────
// No dependen del modelo: si la persona escribe @handle, un email o un número
// con «whatsapp», el contacto entra aunque el modelo falle o invente otro.
export function extractContactsFromText(text: string): ContactInfo[] {
  const out: ContactInfo[] = [];
  const seen = new Set<string>();
  const push = (type: ContactType, value: string) => {
    const v = value.trim();
    const key = `${type}:${v.toLowerCase()}`;
    if (!v || seen.has(key)) return;
    seen.add(key);
    out.push({ type, value: v });
  };
  // Emails primero (usuario@dominio.com no es un @handle).
  for (const m of text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []) {
    push("email", m.toLowerCase());
  }
  // Instagram: @handle (que no sea email) o instagram.com/handle.
  for (const m of text.matchAll(/@([a-z0-9._]{3,30})(?![\w.-]*@[a-z])/gi)) {
    push("instagram", `@${m[1].toLowerCase()}`);
  }
  const igUrl = text.match(/instagram\.com\/([a-z0-9._]{2,30})/i);
  if (igUrl) push("instagram", `@${igUrl[1].toLowerCase()}`);
  // Teléfono / WhatsApp: 7-15 dígitos; «whatsapp» cerca → tipo whatsapp.
  const lower = text.toLowerCase();
  for (const m of text.matchAll(/\+?\d[\d\s().-]{5,}\d/g)) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) continue;
    // Contexto ANTES de ESTA aparición: matchAll da el índice real del match
    // (indexOf devolvía siempre la primera aparición y clasificaba mal el
    // número cuando salía dos veces en el texto).
    const idx = m.index ?? 0;
    const before = idx > 0 ? lower.slice(Math.max(0, idx - 20), idx) : "";
    push(/whats|wsp|\bws\b/.test(before) ? "whatsapp" : "phone", raw.trim());
  }
  return out;
}

// Union de contactos sin duplicados (tope 3, igual que el formulario).
function dedupeContacts(existing: ContactInfo[], add: ContactInfo[]): ContactInfo[] {
  const seen = new Set(existing.map((c) => `${c.type}:${c.value.toLowerCase()}`));
  const out = [...existing];
  for (const c of add) {
    const k = `${c.type}:${c.value.toLowerCase()}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out.slice(0, 3);
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
    title: clampText(r.title, TITLE_MAX_CHARS),
    description: clampText(r.description, 2000),
    helpType,
    locationQuery: clampText(r.locationQuery, 200),
    supplies: sanitizeSupplies(r.supplies),
    contacts: sanitizeContacts(r.contacts),
  };
}

// Limpia un texto antes de reutilizarlo (transcript de la extracción de
// respaldo): quita JSON de control residual del agente y las vallas de
// markdown que a veces envuelven el JSON del modelo.
export function stripMarkers(text: string): string {
  return stripStateJson(text)
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
    s.includes('"datos"') ||
    s.includes('"lugar"') ||
    s.includes('"pedir"') ||
    s.includes('"resumen"') ||
    s.includes('"tool"') ||
    s.includes('"a"') ||
    s.includes('"f"') ||
    s.includes('"p"')
  );
}

// Extrae el JSON del punto: primer objeto balanceado {…} que parezca un punto.
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
  // Primer objeto balanceado que contenga "title".
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

  const title = clampText(r.title, TITLE_MAX_CHARS);
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
