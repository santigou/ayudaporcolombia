import { useState } from "react";

export interface AddressResult {
  lat: number;
  lng: number;
  label: string;
  city?: string;
  neighborhood?: string;
}

interface AddressSearchProps {
  onSelect: (result: AddressResult) => void;
}

interface NominatimAddress {
  amenity?: string;
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  borough?: string;
  city_district?: string;
  hamlet?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

// En Colombia, OSM modela el casco urbano como "Perímetro Urbano X" (campo
// `city`) y a veces deja el municipio real en `county`/`municipality`. Quitamos
// ese prefijo para mostrar p. ej. "Medellín" en vez de "Perímetro Urbano Medellín".
function pickCity(a?: NominatimAddress): string | undefined {
  if (!a) return undefined;
  const raw = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  if (!raw) return undefined;
  return raw.replace(/^Per[íi]metro Urbano\s+/i, "").trim();
}

// Combinamos comuna (suburb) y barrio (neighbourhood) para dar contexto completo,
// p. ej. "Comuna 7 - Robledo - López de Mesa". Si solo hay uno, se usa ese.
function pickNeighborhood(a?: NominatimAddress): string | undefined {
  if (!a) return undefined;
  if (a.suburb && a.neighbourhood) return `${a.suburb} - ${a.neighbourhood}`;
  return a.neighbourhood ?? a.suburb ?? a.quarter ?? a.borough ?? a.city_district ?? a.hamlet;
}

// Etiqueta concisa para el geocoding inverso (click en el mapa):
// - Si cae sobre un POI (amenity: hospital, colegio…): "calle - amenity".
// - Si no: "calle, barrio". Evita el display_name saturado con muchos niveles.
function reverseLabel(a: NominatimAddress | undefined, display_name: string): string {
  if (!a) return display_name;
  if (a.amenity && a.road) return `${a.road} - ${a.amenity}`;
  if (a.amenity) return a.amenity;
  const parts = [a.road, a.neighbourhood].filter(Boolean);
  return parts.length ? parts.join(", ") : display_name;
}

// Búsqueda de direcciones (geocoding) reutilizable: la usa el componente
// AddressSearch y también el chat con IA local (tarjeta de ubicación).
// Nominatim (OpenStreetMap), limitado a Colombia. Devuelve [] si falla.
export async function searchAddress(query: string): Promise<AddressResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const params = new URLSearchParams({
      format: "json",
      limit: "5",
      addressdetails: "1",
      countrycodes: "co",
      q,
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    return data.map((item) => ({
      lat: Number(item.lat),
      lng: Number(item.lon),
      label: item.display_name,
      city: pickCity(item.address),
      neighborhood: pickNeighborhood(item.address),
    }));
  } catch {
    return [];
  }
}

// Etiqueta corta de lugar para UI: "Comuna 5 - Castilla, Perímetro Urbano
// Medellín, Medellín, …" → "Comuna 5 - Castilla, Medellín". Quita el prefijo
// "Perímetro Urbano X" de OSM y duplicados, y recorta a `max` caracteres.
export function shortPlaceLabel(label: string, max = 72): string {
  const parts = label
    .split(",")
    .map((s) => s.trim().replace(/^Per[íi]metro Urbano\s+/i, ""))
    .filter(Boolean);
  const seen = new Set<string>();
  const uniq = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  let out = uniq.slice(0, 3).join(", ");
  if (out.length > max) out = out.slice(0, max - 1).trimEnd() + "…";
  return out || label;
}

// EXPANSIÓN de la mención de lugar al sintagma COMPLETO del texto real.
// El modelo recorta la mención («casd de castilla en medellín» → «Castilla»)
// y el geocoder devuelve el centro de la comuna, lejos del sitio real. Aquí se
// recupera el sintagma: se localiza `lugar` en el texto y se extiende a
// izquierda/derecha mientras sean parte del nombre (conectores de/la/el y
// «en <ciudad>» como contexto), sin cruzar artículos, preposiciones o verbos.
const EXPAND_CONNECTORS = new Set(["de", "del", "la", "el", "los", "las"]);
const EXPAND_GAPS = new Set(["de", "del", "la", "el", "los", "las", "en", "a", "al", "y", "o"]);
const EXPAND_STOP = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "por", "en", "con",
  "para", "que", "y", "o", "se", "lo", "le", "es", "fue", "al", "a", "mi",
  "mis", "su", "sus", "hay", "esta", "estoy", "vivo", "perdi", "perdio",
]);

function normTokensForSearch(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const isSignificant = (t: string) => t.length >= 3 && !EXPAND_GAPS.has(t);

// `lugar` (p. ej. «Castilla» o «Casco de Castilla, Medellín») → sintagma
// completo del texto («casd de castilla en medellin»). El matching es sobre
// tokens SIGNIFICATIVOS del lugar, permitiendo huecos de conectores en el
// texto («castilla en medellín»); y si un token del lugar está corrupto (el
// modelo «corrige» casd→Casco y esa palabra no está en el texto), se reintenta
// saltándolo (k0 creciente: se prefiere cubrir más tokens del lugar). Si no
// aparece nada, se devuelve tal cual.
export function expandMention(rawText: string, lugar: string): string {
  const textTokens = normTokensForSearch(rawText);
  const lugarSig = normTokensForSearch(lugar).filter(isSignificant);
  if (textTokens.length === 0 || lugarSig.length === 0) return lugar;
  const matchesToken = (t: string, sig: string) =>
    t === sig || t.startsWith(sig.slice(0, 4));
  // Localiza la secuencia significativa (en orden, con huecos), reintentando
  // desde cada posición inicial del lugar hasta cubrir al menos 1 token.
  let span: [number, number] | null = null;
  for (let k0 = 0; k0 < lugarSig.length && !span; k0++) {
    const remaining = lugarSig.slice(k0);
    for (let i = 0; i < textTokens.length; i++) {
      if (!matchesToken(textTokens[i], remaining[0])) continue;
      let j = i + 1;
      let ok = true;
      for (let k = 1; k < remaining.length; k++) {
        while (j < textTokens.length && !isSignificant(textTokens[j])) j++;
        if (j >= textTokens.length || !matchesToken(textTokens[j], remaining[k])) {
          ok = false;
          break;
        }
        j++;
      }
      if (ok) {
        span = [i, j];
        break;
      }
    }
  }
  if (!span) return lugar;
  let [start, end] = span;
  // Izquierda: conectores y sustantivos forman parte del nombre; artículos,
  // preposiciones y verbos cortan (sin incluirse).
  while (start > 0) {
    const prev = textTokens[start - 1];
    if (EXPAND_CONNECTORS.has(prev)) {
      if (start - 2 >= 0) {
        start--;
        continue;
      }
      break;
    }
    if (isSignificant(prev) && !EXPAND_STOP.has(prev)) {
      start--;
      continue;
    }
    break;
  }
  while (start < span[0] && EXPAND_CONNECTORS.has(textTokens[start])) start++;
  // Derecha: «de/el X», «en <ciudad>» o una ciudad pegada al final.
  while (end < textTokens.length) {
    const tok = textTokens[end];
    const next = end + 1 < textTokens.length ? textTokens[end + 1] : null;
    if (EXPAND_CONNECTORS.has(tok) && next && isSignificant(next) && !EXPAND_STOP.has(next)) {
      end += 2;
      continue;
    }
    if (tok === "en" && next && isSignificant(next) && !EXPAND_STOP.has(next)) {
      end += 2;
      continue;
    }
    // Ciudad pegada sin preposición («castilla medellin»): solo si después
    // no sigue otra palabra de contenido (fin de frase o token de corte).
    if (
      isSignificant(tok) &&
      !EXPAND_STOP.has(tok) &&
      !EXPAND_GAPS.has(tok) &&
      (next === null || !isSignificant(next) || EXPAND_STOP.has(next))
    ) {
      end += 1;
      continue;
    }
    break;
  }
  const out = textTokens.slice(start, end).join(" ").trim();
  return out.length >= lugar.trim().length ? out : lugar;
}

export function rankByQuery(results: AddressResult[], query: string): AddressResult[] {
  const qTokens = normTokensForSearch(query).filter((t) => t.length >= 3);
  if (qTokens.length === 0) return results;
  const scored = results.map((r) => {
    const hay = normTokensForSearch(r.label).join(" ");
    let score = 0;
    for (const t of qTokens) if (hay.includes(t.slice(0, 4))) score++;
    return { r, score };
  });
  // Estable: conserva el orden de Nominatim entre empates.
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.r);
}

// Consultas SIMILARES progresivas para cuando la original no devuelve nada:
// pares de tokens clave (sitio + ciudad), el token más largo, el primero y el
// último. Devuelven resultados «parecidos» en vez de fracasar.
export function similarQueries(query: string): string[] {
  const sig = normTokensForSearch(query).filter(isSignificant);
  if (sig.length <= 1) return [];
  const longest = [...sig].sort((a, b) => b.length - a.length)[0];
  const candidates = [
    sig.slice(-2).join(" "), // «castilla medellin» (sitio + ciudad)
    sig.length >= 3 ? sig.slice(0, 2).join(" ") : "",
    longest,
    sig[0],
    sig[sig.length - 1],
  ];
  return [...new Set(candidates.map((q) => q.trim()).filter((q) => q.length >= 3))];
}

export function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchAddress(query);
      setResults(data);
      if (data.length === 0) setError("No encontramos esa dirección en Colombia.");
    } catch {
      setError("No pudimos buscar la dirección. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Busca una dirección (ej. Calle 10 #5-20, Armenia)"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="rounded-md bg-gray-800 text-white px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-1 border border-gray-200 rounded-md divide-y divide-gray-100 max-h-40 overflow-y-auto">
          {results.map((result, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onSelect(result);
                  setResults([]);
                  setQuery(result.label);
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Geocoding inverso: de coordenadas (click en el mapa) a dirección legible.
// Usa el endpoint `reverse` de Nominatim. Devuelve null si no hay resultado o falla.
export async function reverseGeocode(lat: number, lng: number): Promise<AddressResult | null> {
  try {
    const params = new URLSearchParams({
      format: "json",
      lat: String(lat),
      lon: String(lng),
      addressdetails: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
    if (!res.ok) return null;
    const item = (await res.json()) as NominatimResult & { error?: string };
    if (!item || item.error || !item.display_name) return null;
    return {
      lat: Number(item.lat),
      lng: Number(item.lon),
      label: reverseLabel(item.address, item.display_name),
      city: pickCity(item.address),
      neighborhood: pickNeighborhood(item.address),
    };
  } catch {
    return null;
  }
}
