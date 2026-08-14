#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_points.py — Importa puntos de ayuda desde fuentes externas a la BD del proyecto.

Fuentes:
  1. https://www.emergencias-colombia.com  (scraping del HTML de la home; ~120 puntos
     verificados con fuente de prensa). Sin coordenadas → se geocodifican con Nominatim
     usando el mismo query de Google Maps que publica la propia página.
  2. https://ayudaspereira.com  (SPA sobre Supabase; se consulta la API REST pública
     con la publishable key del bundle: tablas `centros`, `ciudades`, `necesidades`).
     La mayoría ya trae lat/lng.

Los puntos se crean como `offer_help`. La visibilidad depende de la VALIDACIÓN de la
dirección (regla acordada): solo quedan activos+aprobados (visibles en el mapa) los
puntos cuya dirección en el texto concuerda con sus coordenadas (geocodificando la
dirección y comparando, tolerancia --match-radius). Todo lo demás — sin dirección en
el texto, dirección no localizable o que no concuerda — queda en estado `pending`
para revisión de moderadores. Los contactos (teléfono/whatsapp/email/instagram)
extraídos del texto se guardan en la tabla Contact como enriquecimiento.

Anti-duplicados: distancia haversine contra los puntos YA existentes en la BD y contra
los candidatos ya aceptados en este lote. Se considera duplicado si:
  - dist <= --hard-radius (30 m) aunque el tipo de ayuda difiera, o
  - dist <= --radius (100 m) y además el tipo de ayuda (HelpType) coincide.
Así no se pierden puntos legítimos distintos en un mismo edificio (p. ej. un hospital
con "Atención médica" Y "Donación de sangre"), pero sí se atrapan re-ejecuciones y
duplicados entre fuentes.

Idempotente: el `code` de cada punto es determinista (hash de fuente|título|dirección),
y el dedup por radio evita duplicados aunque el script se corra varias veces.

Uso:
  python scripts/import_points.py --dry-run              # solo muestra qué haría
  python scripts/import_points.py --source emergencias   # solo esa fuente
  python scripts/import_points.py --yes                  # sin confirmación interactiva
  python scripts/import_points.py --radius 150 --hard-radius 40

Requiere: psycopg2 (pip install psycopg2-binary) y Postgres levantado (docker compose up -d postgres).
"""
import argparse
import hashlib
import html as htmllib
import json
import math
import os
import re
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlencode, unquote, urlparse

try:
    import psycopg2
except ImportError:
    print("Falta psycopg2. Instálalo con:  pip install psycopg2-binary")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]

# --- Constantes de las fuentes -------------------------------------------------
EMERGENCIAS_URL = "https://www.emergencias-colombia.com/"
SUPABASE_URL = "https://yjkyzfuixdpuhgthoeua.supabase.co"
SUPABASE_KEY = "sb_publishable_hWboFTjrnhfsAn5gXDW_Gg_rqx2iGLR"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "authorization": "Bearer " + SUPABASE_KEY,
    "accept": "*/*",
    "accept-profile": "public",
    "origin": "https://ayudaspereira.com",
    "referer": "https://ayudaspereira.com/",
}

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
)
NOMINATIM_UA = "ayudaporcolombia-importer/1.0 (proyecto Ayuda por Colombia; dev@ayudaporcolombia.co)"

# Bounding box aproximado de Colombia (sanity check del geocoding).
CO_LAT_MIN, CO_LAT_MAX = -4.5, 12.8
CO_LNG_MIN, CO_LNG_MAX = -82.3, -66.7

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # mismo alfabeto sin ambiguos del backend

# data-tipo de emergencias-colombia → HelpType del proyecto
TIPO_MAP = {
    "acopio": "Punto de acopio",
    "refugio": "Refugio",
    "medico": "Médico",
    "agua": "Agua",
    "sangre": "Donación de sangre",
}
HELP_TYPE_DESC = {
    "Punto de acopio": "Centros que reciben donaciones",
    "Donación de sangre": "Bancos de sangre y hemocentros",
    "Refugio": "Alojamiento temporal",
    "Médico": "Atención médica",
    "Agua": "Suministro de agua",
    "Otro": "Otros tipos de ayuda",
}


# --- Helpers --------------------------------------------------------------------
def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def http_get(url: str, headers: dict = None, timeout: int = 30, retries: int = 3) -> str:
    import urllib.request
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GET falló tras {retries} intentos: {url} → {last_err}")


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def candidate_code(seed: str) -> str:
    """Código determinista de 8 chars a partir de la semilla (fuente|título|dirección)."""
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return "".join(ALPHABET[b % len(ALPHABET)] for b in digest[:8])


def make_code(seed: str, used: set) -> str:
    """Código determinista; reintenta con sufijo si colisiona con uno ya usado."""
    code = candidate_code(seed)
    n = 0
    while code in used:
        n += 1
        code = "".join(ALPHABET[b % len(ALPHABET)] for b in digest8(seed)[:7]) + ALPHABET[n % len(ALPHABET)]
    used.add(code)
    return code


def digest8(seed: str) -> bytes:
    return hashlib.sha256(seed.encode("utf-8")).digest()[:8]


# --- Extracción de contactos del texto libre -------------------------------------
PHONE_RE = re.compile(r"(?:\+?57[\s.\-]?)?\b(3\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2})\b"
                      r"|\b(60\d[\s.\-]?\d{3}[\s.\-]?\d{3})\b")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
IG_RE = re.compile(r"instagram\.com/([A-Za-z0-9_.]{2,30})|(?:^|[\s:,])(@([A-Za-z0-9_.]{3,30}))")
# Segmentos de URL de Instagram que NO son usuarios (evita falsos positivos).
IG_BLOCKLIST = {"reels", "reel", "p", "stories", "share", "watch", "www", "explore",
                "profile", "hashtag", "accounts", "tv"}


def fmt_phone(digits: str) -> str:
    if len(digits) == 10 and digits.startswith("3"):
        return f"+57 {digits[:3]} {digits[3:6]} {digits[6:]}"
    if len(digits) in (7, 8):
        return f"+57 {digits}"
    return digits


def extract_contacts(text: str) -> list:
    """Detecta teléfonos/whatsapp/emails/instagram en texto libre (notas, tarjetas)."""
    out, seen = [], set()
    if not text:
        return out
    for m in EMAIL_RE.finditer(text):
        v = m.group(0).strip().lower()
        if v not in seen:
            seen.add(v)
            out.append({"type": "email", "value": v})
    for m in PHONE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) == 12 and digits.startswith("57"):
            digits = digits[2:]
        if not ((len(digits) == 10 and digits[0] == "3") or (len(digits) in (7, 8) and digits[0] == "6")):
            continue  # no parece número colombiano
        ctx = text[max(0, m.start() - 40): m.end() + 40].lower()
        ctype = "whatsapp" if re.search(r"whats\s*app|wpp", ctx) else "phone"
        key = ("d", digits)
        if key not in seen:
            seen.add(key)
            out.append({"type": ctype, "value": fmt_phone(digits)})
    for m in IG_RE.finditer(text):
        handle = (m.group(1) or m.group(3) or "").strip().lstrip("@").lower().rstrip(".")
        if not handle or handle in IG_BLOCKLIST:
            continue
        if EMAIL_RE.fullmatch(handle):
            continue
        key = ("ig", handle)
        if key not in seen:
            seen.add(key)
            out.append({"type": "instagram", "value": "@" + handle})
    return out


# --- Modelo intermedio de un candidato ------------------------------------------
class Candidate:
    def __init__(self, source, title, help_type, city, department="", address="",
                 lat=None, lng=None, supplies=None, description="", geocode_query=None,
                 approx_address=False, code_seed="", contacts=None):
        self.source = source                  # 'emergencias' | 'pereira'
        self.title = title.strip()
        self.help_type = help_type
        self.city = (city or "").strip()
        self.department = (department or "").strip()
        self.address = (address or "").strip()
        self.lat = lat
        self.lng = lng
        self.supplies = supplies or []        # nombres normalizados de Supply
        self.description = description.strip()
        self.geocode_query = geocode_query    # query principal para Nominatim
        self.approx_address = approx_address  # la fuente no publica dirección exacta
        self.contacts = contacts or []        # [{type: phone|whatsapp|email|instagram, value}]
        self.code_seed = code_seed or f"{source}|{title}|{address or city}"
        self.geo_precision = "fuente"         # fuente | geocodificada | aproximada
        self.visible = False                  # ¿dirección validada contra coords?
        self.pend_reason = ""                 # motivo si queda pending


# --- Geocoder (Nominatim, 1 req/s, con caché en disco) ---------------------------
class Geocoder:
    def __init__(self, cache_path: Path, enabled: bool = True):
        self.cache_path = cache_path
        self.enabled = enabled
        self.cache = {}
        if cache_path.exists():
            try:
                self.cache = json.loads(cache_path.read_text(encoding="utf-8"))
            except Exception:
                self.cache = {}
        self._last_call = 0.0

    def save(self) -> None:
        try:
            self.cache_path.write_text(
                json.dumps(self.cache, ensure_ascii=False, indent=0), encoding="utf-8")
        except Exception as e:
            print(f"  [warn] no se pudo guardar la caché de geocoding: {e}")

    def geocode(self, query: str):
        """Devuelve (lat, lng) o None. Los fallos de red NO se cachean."""
        key = re.sub(r"\s+", " ", query).strip().lower()
        if key in self.cache:
            v = self.cache[key]
            return tuple(v) if v else None
        if not self.enabled:
            return None
        import urllib.request
        wait = 1.1 - (time.monotonic() - self._last_call)  # política: máx ~1 req/seg
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()
        url = "https://nominatim.openstreetmap.org/search?" + urlencode(
            {"q": query, "format": "json", "limit": 1, "countrycodes": "co", "addressdetails": 0})
        try:
            req = urllib.request.Request(url, headers={"User-Agent": NOMINATIM_UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"  [warn] Nominatim falló para {query!r}: {e}")
            return None
        result = None
        if isinstance(data, list) and data:
            try:
                lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
                if CO_LAT_MIN <= lat <= CO_LAT_MAX and CO_LNG_MIN <= lng <= CO_LNG_MAX:
                    result = (lat, lng)
            except (KeyError, ValueError):
                result = None
        self.cache[key] = list(result) if result else None
        self.save()
        return result


# --- Fuente 1: emergencias-colombia.com (scraping HTML) --------------------------
ARTICLE_RE = re.compile(
    r'<article class="punto" data-tipo="([^"]+)" data-estado="([^"]+)">(.*?)</article>', re.S)


def fetch_emergencias(limit: int = 0) -> list:
    print("→ Descargando emergencias-colombia.com ...", flush=True)
    html = http_get(EMERGENCIAS_URL)
    articles = ARTICLE_RE.findall(html)
    print(f"  {len(articles)} tarjetas <article class='punto'> encontradas", flush=True)

    cands = []
    for tipo, estado, art in articles:
        m_name = re.search(r'<h3 class="punto__nombre">(.*?)</h3>', art, re.S)
        m_city = re.search(r'<p class="punto__ciudad"><a href="/([^"/]+)/([^"/]+)/">(.*?)</a></p>', art)
        if not m_name or not m_city:
            continue
        title = strip_tags(m_name.group(1))
        city = strip_tags(m_city.group(3))          # texto visible de la ciudad
        if not title:
            continue

        # Pares <dt>etiqueta</dt><dd>valor</dd> (Dónde / Horario / Responsable)
        fields, approx = {}, False
        for dt, dd in re.findall(r"<dt>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", art, re.S):
            label = strip_tags(dt)
            value = strip_tags(dd)
            if label == "Dónde":
                approx = "punto__aproximado" in dd
            fields[label] = value
        address = fields.get("Dónde", "").strip()
        if address.startswith("Sin dirección exacta"):
            address = ""
            approx = True

        # "Necesitan ahora": <ul class="etiquetas"><li>…</li></ul>
        supplies = []
        m_needs = re.search(r'Necesitan ahora</h4>\s*<ul class="etiquetas">(.*?)</ul>', art, re.S)
        if m_needs:
            supplies = [strip_tags(li) for li in re.findall(r"<li>(.*?)</li>", m_needs.group(1))]
            supplies = [s for s in supplies if s]

        # Fuente + verificación: <p class="fuente punto__fuente">Fuente: <a…>…</a> — verificado…</p>
        fuente = ""
        m_src = re.search(r'<p class="fuente punto__fuente">(.*?)</p>', art, re.S)
        if m_src:
            fuente = strip_tags(m_src.group(1))

        # Estado legible ("Recibiendo", …) y aviso de "Dato sin confirmar"
        estado_label = ""
        m_estado = re.search(r'<span class="estado" data-estado="[^"]+">(.*?)</span>', art)
        if m_estado:
            estado_label = strip_tags(m_estado.group(1))
        unconfirmed = ("sin confirmar" in art.lower()) or ("Dato sin confirmar" in art)

        # Query de Google Maps (el que usa la propia página): query=addr, Ciudad, Colombia
        geocode_query = None
        m_maps = re.search(
            r'href="https://www\.google\.com/maps/search/\?api=1&amp;query=([^"]+)"', art)
        if m_maps:
            geocode_query = unquote(m_maps.group(1).replace("&amp;", "&"))
        elif address:
            geocode_query = f"{address}, {city}, Colombia"

        # Contactos: campo "Teléfono" oficial + patrones en el texto de la tarjeta
        phone = re.sub(r"[^\d+]", "", fields.get("Teléfono", ""))
        contacts = extract_contacts(strip_tags(art))
        if len(phone) >= 7 and not any(re.sub(r"\D", "", x["value"]).endswith(phone)
                                       for x in contacts if x["type"] in ("phone", "whatsapp")):
            contacts.insert(0, {"type": "phone", "value": fmt_phone(phone)})

        # Descripción compuesta (los insumos van aparte, a PointSupply)
        lines = []
        if address:
            lines.append(f"Dirección: {address}")
        if fields.get("Horario"):
            lines.append(f"Horario: {fields['Horario']}")
        if fields.get("Responsable"):
            lines.append(f"Responsable: {fields['Responsable']}")
        if contacts:
            phones_txt = ", ".join(x["value"] for x in contacts if x["type"] in ("phone", "whatsapp"))
            if phones_txt:
                lines.append(f"Teléfono: {phones_txt}")
        if estado_label and estado_label.lower() != "recibiendo":
            lines.append(f"Estado: {estado_label}")
        if unconfirmed:
            lines.append("Dato sin confirmar por la fuente; verifica antes de desplazarte.")
        if fuente:
            lines.append(f"{fuente} (vía emergencias-colombia.com)")
        description = "\n".join(lines) or "Punto de ayuda publicado por emergencias-colombia.com."

        cands.append(Candidate(
            source="emergencias",
            title=title,
            help_type=TIPO_MAP.get(tipo, "Otro"),
            city=city,
            department=m_city.group(1),            # slug del departamento (solo referencia)
            address=address,
            supplies=supplies,
            description=description,
            geocode_query=geocode_query,
            approx_address=approx,
            contacts=contacts,
            # Semilla ESTABLE: título+ciudad (sin dirección, que la fuente puede
            # completar después — cambiaría el código y no reconocería el punto).
            code_seed=f"emergencias|{title}|{city}",
        ))
        if limit and len(cands) >= limit:
            break
    return cands


# --- Fuente 2: ayudaspereira.com (API REST pública de Supabase) -------------------
def sb_get(path: str, select: str) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{path}?select={select}"
    return json.loads(http_get(url, headers=SUPABASE_HEADERS))


def norm_key(text) -> str:
    return " ".join((text or "").split()).lower()


def title_key_of(title, city, is_pereira):
    """Clave estable (título, ciudad, fuente) para reconocer puntos ya importados
    aunque cambien campos mutables de la fuente (dirección, coordenadas)."""
    return (norm_key(title), norm_key(city), is_pereira)


def fetch_pereira(limit: int = 0) -> list:
    print("→ Consultando API de ayudaspereira.com (Supabase) ...", flush=True)
    centros = sb_get("centros", "id,ciudad_id,nombre,direccion,responsable,notas,activo,lat,lng")
    ciudades = {c["id"]: c for c in sb_get("ciudades", "*")}
    necesidades = sb_get("necesidades", "*")
    print(f"  {len(centros)} centros · {len(ciudades)} ciudades · {len(necesidades)} necesidades", flush=True)

    # Necesidades agrupadas por centro; solo las NO cubiertas son "necesitan ahora".
    needs_by_centro = {}
    for n in necesidades:
        if (n.get("estado") or "").lower() == "cubierta":
            continue
        needs_by_centro.setdefault(n.get("centro_id"), []).append(n)

    def valid_coords(lat, lng):
        try:
            lat, lng = float(lat), float(lng)
        except (TypeError, ValueError):
            return None, None
        if lat == 0 and lng == 0:
            return None, None
        if not (CO_LAT_MIN <= lat <= CO_LAT_MAX and CO_LNG_MIN <= lng <= CO_LNG_MAX):
            return None, None
        return lat, lng

    cands = []
    for c in centros:
        if not c.get("activo"):
            continue
        nombre = (c.get("nombre") or "").strip()
        if not nombre or "prueba" in nombre.lower():
            continue
        ciudad = ciudades.get(c.get("ciudad_id")) or {}
        city = (ciudad.get("nombre") or "").strip()
        if not city or not ciudad.get("activa", True) or "prueba" in city.lower():
            continue
        address = (c.get("direccion") or "").strip()
        responsable = (c.get("responsable") or "").strip()
        notas = (c.get("notas") or "").strip()
        lat, lng = valid_coords(c.get("lat"), c.get("lng"))

        needs = needs_by_centro.get(c.get("id"), [])
        supplies, need_lines = [], []
        for n in needs:
            cat = (n.get("categoria") or "").strip()
            if cat and cat not in supplies:
                supplies.append(cat)
            detalle = (n.get("descripcion") or "").strip()
            prior = (n.get("prioridad") or "").strip()
            line = cat or "Necesidad"
            if prior:
                line += f" ({prior})"
            if detalle:
                line += f": {detalle[:200]}"
            if line not in need_lines:
                need_lines.append(line)

        lines = []
        if address:
            lines.append(f"Dirección: {address}")
        if responsable:
            lines.append(f"Responsable: {responsable}")
        if notas:
            lines.append(f"Notas: {notas[:600]}")
        if need_lines:
            lines.append("Necesidades: " + "; ".join(need_lines[:6]))
        lines.append("Fuente: ayudaspereira.com")
        description = "\n".join(lines)

        # Contactos escondidos en las notas (teléfonos, whatsapp, IG, emails)
        contacts = extract_contacts(f"{notas} {address}")

        # Geocoding solo si la fuente no trae coordenadas.
        geo_q = None
        if lat is None:
            base = address if address else nombre
            geo_q = f"{base}, {city}, Colombia"

        cands.append(Candidate(
            source="pereira",
            title=nombre,
            help_type="Punto de acopio",
            city=city,
            department=(ciudad.get("departamento") or "").strip(),
            address=address,
            lat=lat, lng=lng,
            supplies=supplies,
            description=description,
            geocode_query=geo_q,
            approx_address=not address,
            contacts=contacts,
            # Semilla ESTABLE: el UUID del centro en la fuente no cambia aunque
            # editen nombre/dirección/coordenadas.
            code_seed=f"pereira|{c.get('id')}",
        ))
        if limit and len(cands) >= limit:
            break
    return cands


# --- Validación: ¿la ubicación concuerda con la dirección del texto? -------------
def check_address(address, city, lat, lng, geocoder, radius_m):
    """Geocodifica la dirección y la compara con las coordenadas del punto.

    Devuelve (ok, motivo, distancia_m):
      - sin dirección en el texto            → (False, 'sin dirección en el texto', None)
      - dirección no localizable por Nominatim → (False, 'dirección no localizable en el mapa', None)
      - distancia > radius_m                 → (False, 'la ubicación no concuerda con la dirección (X m)', d)
      - en cualquier otro caso               → (True,  'dirección válida (X m)', d)
    """
    if not address:
        return False, "sin dirección en el texto", None
    g = geocoder.geocode(f"{address}, {city}, Colombia")
    if not g:
        return False, "dirección no localizable en el mapa", None
    d = haversine_m(lat, lng, g[0], g[1])
    if d <= radius_m:
        return True, f"dirección válida o cercana ({d:.0f} m)", d
    return False, f"la ubicación no concuerda con la dirección ({d:.0f} m)", d


# --- Base de datos ----------------------------------------------------------------
def load_database_url(override: str = None) -> str:
    if override:
        return override
    env = os.environ.get("DATABASE_URL")
    if env:
        return env.strip().strip('"')
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r'^\s*DATABASE_URL\s*=\s*"?([^"#\n]+)"?', line)
            if m:
                return m.group(1).strip()
    raise SystemExit("No se encontró DATABASE_URL (ni en .env ni en variables de entorno).")


def connect_db(url: str, retries: int = 5):
    u = urlparse(url)
    last = None
    for i in range(retries):
        try:
            import psycopg2
            return psycopg2.connect(
                host=u.hostname or "localhost", port=u.port or 5432,
                user=u.username, password=u.password, dbname=u.path.lstrip("/"),
                connect_timeout=10)
        except Exception as e:
            last = e
            print(f"  [retry {i+1}/{retries}] no se pudo conectar a Postgres: {e}", flush=True)
            time.sleep(3)
    raise SystemExit(f"Imposible conectar a la base de datos: {last}")


def load_existing(conn):
    """Devuelve (anclas espaciales, códigos existentes, índice título→id).

    El índice por (título, ciudad, fuente) permite reconocer puntos ya importados
    aunque su semilla/código haya cambiado (p. ej. puntos importados con semillas
    antiguas, o cuando la fuente edita campos mutables)."""
    points, codes, by_title = [], set(), {}
    with conn.cursor() as cur:
        cur.execute('''
            SELECT p.id, p.code, p.title, ht.name, l.city, l.latitude, l.longitude,
                   (p.description LIKE '%ayudaspereira.com%') AS is_pereira
            FROM "Point" p
            JOIN "PointLocation" pl ON pl."pointId" = p.id
            JOIN "Location" l ON l.id = pl."locationId"
            LEFT JOIN "HelpType" ht ON ht.id = p."helpTypeId"''')
        for pid, code, title, help_type, city, lat, lng, is_pereira in cur.fetchall():
            codes.add(code)
            points.append({"title": title or "", "help_type": (help_type or "").lower(),
                           "lat": float(lat), "lng": float(lng), "precise": True})
            by_title.setdefault(title_key_of(title, city, bool(is_pereira)), pid)
    return points, codes, by_title


def find_duplicate(cand, pool: list, radius_m: float, hard_m: float):
    """Duplicado si dist<=hard (cualquier tipo) o dist<=radius con mismo HelpType.

    Solo se comparan puntos con ubicación PRECISA: las coordenadas de
    centro-de-ciudad (aproximadas) no deben deduplicar nada porque varios puntos
    legítimos distintos comparten esas coords.
    """
    for p in pool:
        if not p.get("precise", True):
            continue
        d = haversine_m(cand.lat, cand.lng, p["lat"], p["lng"])
        if d <= hard_m:
            return p, d
        if d <= radius_m and p["help_type"] == cand.help_type.strip().lower():
            return p, d
    return None, None


def insert_candidates(conn, to_create: list, existing_codes: set = None) -> int:
    help_type_ids, supply_ids = {}, {}
    used_codes = set(existing_codes or [])  # evita colisionar con códigos en BD

    def get_help_type(cur, name: str) -> str:
        if name not in help_type_ids:
            cur.execute('''INSERT INTO "HelpType" ("id","name","description")
                           VALUES (%s,%s,%s)
                           ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description"
                           RETURNING "id"''',
                        (str(uuid.uuid4()), name, HELP_TYPE_DESC.get(name, "Importado")))
            help_type_ids[name] = cur.fetchone()[0]
        return help_type_ids[name]

    def get_supply(cur, name: str) -> str:
        if name not in supply_ids:
            cur.execute('''INSERT INTO "Supply" ("id","name") VALUES (%s,%s)
                           ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
                           RETURNING "id"''', (str(uuid.uuid4()), name))
            supply_ids[name] = cur.fetchone()[0]
        return supply_ids[name]

    created = 0
    with conn.cursor() as cur:
        for c in to_create:
            point_id = str(uuid.uuid4())
            # Regla de visibilidad: solo activo+aprobado si la dirección del texto
            # concuerda con las coordenadas; el resto queda pending para moderación.
            status = "active" if c.visible else "pending"
            verif = "approved" if c.visible else "pending"
            desc = c.description
            if not c.visible:
                desc = (desc + f"\n[Pendiente: {c.pend_reason}. Queda a la espera de revisión.]").strip()
            cur.execute('''
                INSERT INTO "Point" ("id","code","type","title","description","helpTypeId",
                                     "status","verificationStatus","validationCount",
                                     "createdById","createdAt","updatedAt","expiresAt")
                VALUES (%s,%s,%s::"PointType",%s,%s,%s,
                        %s::"PointStatus",%s::"VerificationStatus",0,
                        NULL,NOW(),NOW(),NULL)
                RETURNING "id"''',
                (point_id, make_code(c.code_seed, used_codes), "offer_help", c.title,
                 desc, get_help_type(cur, c.help_type), status, verif))
            point_id = cur.fetchone()[0]

            loc_id = str(uuid.uuid4())
            cur.execute('''INSERT INTO "Location" ("id","city","neighborhood","address","latitude","longitude")
                           VALUES (%s,%s,'',%s,%s,%s)''',
                        (loc_id, c.city, c.address or None, c.lat, c.lng))
            cur.execute('''INSERT INTO "PointLocation" ("pointId","locationId","locationType")
                           VALUES (%s,%s,'location'::"PointLocationType")''', (point_id, loc_id))

            for ct in c.contacts:  # teléfonos/whatsapp/IG/emails → tabla Contact
                cur.execute('''INSERT INTO "Contact" ("id","pointId","type","value","isPublic")
                               VALUES (%s,%s,%s::"ContactType",%s,true)''',
                            (str(uuid.uuid4()), point_id, ct["type"], ct["value"]))

            for s in c.supplies:
                cur.execute('''INSERT INTO "PointSupply" ("pointId","supplyId","targetQuantity","receivedQuantity","unit")
                               VALUES (%s,%s,NULL,NULL,NULL) ON CONFLICT DO NOTHING''',
                            (point_id, get_supply(cur, s)))
            created += 1
            mark = "✅" if c.visible else "⏳"
            print(f"  {mark} [{c.source}] {c.title} — {c.city} ({c.help_type})"
                  + ("" if c.visible else f" [pending: {c.pend_reason}]"), flush=True)
    conn.commit()
    return created


def backfill_contacts(conn, already_list) -> int:
    """Agrega contactos (tel/whatsapp/IG/email) a puntos YA importados.

    Idempotente: compara por valor exacto y por dígitos del teléfono (así
    "+57 320 587 4422" no duplica a "3205874422" ya guardado).
    """
    added = 0
    with conn.cursor() as cur:
        for c in already_list:
            if not c.contacts or not getattr(c, "db_id", None):
                continue
            point_id = c.db_id
            cur.execute('SELECT "value" FROM "Contact" WHERE "pointId" = %s', (point_id,))
            existing = [r[0] for r in cur.fetchall()]

            def is_dup(value):
                digits = re.sub(r"\D", "", value)
                for e in existing:
                    if e == value or (digits and re.sub(r"\D", "", e) == digits):
                        return True
                return False

            for ct in c.contacts:
                if is_dup(ct["value"]):
                    continue
                cur.execute('''INSERT INTO "Contact" ("id","pointId","type","value","isPublic")
                               VALUES (%s,%s,%s::"ContactType",%s,true)''',
                            (str(uuid.uuid4()), point_id, ct["type"], ct["value"]))
                existing.append(ct["value"])
                added += 1
                print(f"  ☎ contacto agregado: {c.title} → {ct['type']}: {ct['value']}", flush=True)
    conn.commit()
    return added


def backfill_addresses(conn, already_list) -> int:
    """Completa la dirección de puntos YA importados cuando la fuente la publicó después.

    En ayudaspereira los administradores completan `direccion` con el tiempo: un centro
    importado sin dirección puede tenerla hoy. Localizamos el punto por su código
    determinista y, si su Location no tiene address pero el candidato sí, la escribimos
    en Location.address (ubicaciones) y añadimos la línea "Dirección:" a la descripción
    (detalles). Idempotente: si ya tiene dirección, no se toca nada.
    """
    updated = 0
    with conn.cursor() as cur:
        for c in already_list:
            if not c.address:
                continue
            point_id = getattr(c, "db_id", None)
            if not point_id:
                continue
            # Ubicación principal del punto (rol 'location' primero).
            cur.execute('''SELECT l.id, l.address FROM "Location" l
                           JOIN "PointLocation" pl ON pl."locationId" = l.id
                           WHERE pl."pointId" = %s
                           ORDER BY CASE pl."locationType" WHEN 'location' THEN 0 ELSE 1 END
                           LIMIT 1''', (point_id,))
            loc = cur.fetchone()
            if not loc or (loc[1] or "").strip():
                continue  # no tiene Location o ya tiene dirección
            loc_id = loc[0]

            cur.execute('UPDATE "Location" SET "address" = %s WHERE "id" = %s',
                        (c.address, loc_id))

            cur.execute('SELECT "description" FROM "Point" WHERE "id" = %s', (point_id,))
            desc = cur.fetchone()[0] or ""
            line = f"Dirección: {c.address}"
            if "Dirección:" not in desc:
                if "\nFuente:" in desc:  # inserta antes de la línea de fuente
                    desc = desc.replace("\nFuente:", f"\n{line}\nFuente:", 1)
                else:
                    desc = (desc + "\n" + line).strip()
            # La nota de "sin dirección exacta" ya no aplica: se suaviza.
            desc = desc.replace(
                "la fuente no publica dirección exacta. Confirma antes de desplazarte.",
                "las coordenadas son aproximadas; confirma antes de desplazarte.")
            cur.execute('''UPDATE "Point" SET "description" = %s, "updatedAt" = NOW()
                           WHERE "id" = %s''', (desc, point_id))

            updated += 1
            print(f"  📍 dirección agregada: {c.title} → {c.address}", flush=True)
    conn.commit()
    return updated


def retrofit_points(conn, already_list, match_radius, geocoder) -> int:
    """Re-evalúa puntos YA importados con la regla de dirección válida/cercana.

    - Dirección concuerda con las coords → active+approved (visible).
    - Sin dirección / no localizable / no concuerda → pending+pending (moderación).
    - Se saltan los puntos que un moderador ya revisó (con filas en Verification):
      el script nunca pisa una decisión humana.
    - Idempotente: limpia notas "[Pendiente: …]" anteriores antes de re-etiquetar.
    """
    changed = 0
    with conn.cursor() as cur:
        for c in already_list:
            if not getattr(c, "db_id", None):
                continue
            pid = c.db_id
            cur.execute('SELECT 1 FROM "Verification" WHERE "pointId" = %s LIMIT 1', (pid,))
            if cur.fetchone():
                continue  # un moderador ya revisó este punto: no tocar
            cur.execute('''SELECT p.status, p."verificationStatus", p.description,
                                  l.address, l.city, l.latitude, l.longitude
                           FROM "Point" p
                           JOIN "PointLocation" pl ON pl."pointId" = p.id
                           JOIN "Location" l ON l.id = pl."locationId"
                           WHERE p.id = %s
                           ORDER BY CASE pl."locationType" WHEN 'location' THEN 0 ELSE 1 END
                           LIMIT 1''', (pid,))
            row = cur.fetchone()
            if not row:
                continue
            status, verif, desc, addr, city, lat, lng = row
            addr = ((addr or "").strip() or c.address)   # la fuente puede traerla ahora
            ok, reason, _ = check_address(addr, (city or c.city or "").strip(),
                                          float(lat), float(lng), geocoder, match_radius)
            desc = re.sub(r"\n?\[Pendiente:[^\]]*\]", "", desc or "").rstrip()
            if addr and "Dirección:" not in desc:        # dirección siempre en el texto
                desc = (desc + f"\nDirección: {addr}").strip()

            if ok and status == "pending" and verif == "pending":
                cur.execute('''UPDATE "Point" SET status = 'active'::"PointStatus",
                               "verificationStatus" = 'approved'::"VerificationStatus",
                               "description" = %s, "updatedAt" = NOW() WHERE "id" = %s''',
                            (desc, pid))
                changed += 1
                print(f"  ✅ ahora visible: {c.title} ({reason})", flush=True)
            elif not ok and status == "active" and verif == "approved":
                desc += f"\n[Pendiente: {reason}. Queda a la espera de revisión.]"
                cur.execute('''UPDATE "Point" SET status = 'pending'::"PointStatus",
                               "verificationStatus" = 'pending'::"VerificationStatus",
                               "description" = %s, "updatedAt" = NOW() WHERE "id" = %s''',
                            (desc, pid))
                changed += 1
                print(f"  ⏳ a pending: {c.title} — {reason}", flush=True)
            elif desc != (row[2] or ""):
                cur.execute('UPDATE "Point" SET "description" = %s, "updatedAt" = NOW() WHERE "id" = %s',
                            (desc, pid))
    conn.commit()
    return changed


# --- Main ---------------------------------------------------------------------------
def main():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    ap = argparse.ArgumentParser(description="Importa puntos de ayuda externos a la BD")
    ap.add_argument("--source", choices=["all", "emergencias", "pereira"], default="all")
    ap.add_argument("--radius", type=float, default=100.0,
                    help="metros: duplicado si hay punto más cercano que esto Y mismo tipo (default 100)")
    ap.add_argument("--hard-radius", type=float, default=30.0,
                    help="metros: duplicado con cualquier punto más cercano que esto (default 30)")
    ap.add_argument("--match-radius", type=float, default=500.0,
                    help="metros: tolerancia dirección vs coordenadas; si supera, el punto queda pending (default 500)")
    ap.add_argument("--limit", type=int, default=0, help="procesar solo N candidatos por fuente (debug)")
    ap.add_argument("--dry-run", action="store_true", help="no escribir en la base de datos")
    ap.add_argument("--yes", action="store_true", help="no pedir confirmación")
    ap.add_argument("--no-geocode", action="store_true", help="desactivar Nominatim (solo coords de la fuente)")
    ap.add_argument("--db-url", default=None, help="override de DATABASE_URL")
    ap.add_argument("--cache", default=str(Path(__file__).parent / ".geocache.json"),
                    help="ruta de la caché de geocoding")
    args = ap.parse_args()

    print("=== Importador de puntos de ayuda ===")
    print(f"fuente={args.source} radius={args.radius}m hard={args.hard_radius}m "
          f"dry_run={args.dry_run} geocode={'no' if args.no_geocode else 'si'}")

    conn = connect_db(load_database_url(args.db_url))
    existing, existing_codes, by_title = load_existing(conn)
    print(f"\nPuntos existentes en la BD (anclas de dedup): {len(existing)}")

    cands = []
    if args.source in ("all", "emergencias"):
        cands += fetch_emergencias(args.limit)
    if args.source in ("all", "pereira"):
        cands += fetch_pereira(args.limit)
    if not cands:
        print("No se obtuvieron candidatos.")
        return

    # --- 1) Resolver coordenadas (los que no las traen de la fuente) -------------
    geocoder = Geocoder(Path(args.cache), enabled=not args.no_geocode)
    pending = [c for c in cands if c.lat is None]
    print(f"\nGeocodificando {len(pending)} de {len(cands)} candidatos con Nominatim (~1 req/s)...")
    try:
        for i, c in enumerate(pending, 1):
            got = None
            if c.geocode_query:
                got = geocoder.geocode(c.geocode_query)
                if got:
                    c.geo_precision = "geocodificada"
            if not got and c.city:  # fallback: centro de la ciudad (aproximado)
                got = geocoder.geocode(f"{c.city}, Colombia")
                if got:
                    c.geo_precision = "aproximada"
            if got:
                c.lat, c.lng = got
            show = (i % 10 == 0) or (i == len(pending)) or (not got)
            if show:
                if got:
                    print(f"  [{i}/{len(pending)}] {c.title[:48]:50} -> {c.lat:.5f},{c.lng:.5f} ({c.geo_precision})")
                else:
                    print(f"  [{i}/{len(pending)}] {c.title[:48]:50} -> SIN COORDENADAS", flush=True)
    finally:
        geocoder.save()

    no_geo = [c for c in cands if c.lat is None]
    located = [c for c in cands if c.lat is not None]

    # --- 1b) Validar: la ubicación debe concordar con la dirección del texto ------
    print(f"\nValidando direccion vs coordenadas (tolerancia {args.match_radius:.0f} m)...")
    for i, c in enumerate(located, 1):
        ok, reason, _ = check_address(c.address, c.city, c.lat, c.lng,
                                      geocoder, args.match_radius)
        c.visible, c.pend_reason = ok, reason
        if i % 20 == 0 or i == len(located):
            print(f"  [{i}/{len(located)}] validados", flush=True)
    geocoder.save()
    n_vis = sum(1 for c in located if c.visible)
    print(f"  → {n_vis} con dirección válida/cercana · {len(located) - n_vis} quedarían pending")


    # --- 2) Dedup: código determinista (re-ejecuciones) + radio (solo coords precisas)
    pool = list(existing)          # anclas espaciales (solo cuentan las precisas)
    to_create, dups, already = [], [], []
    seen_seeds, approx_batch = set(), set()
    for c in located:
        # a) Idempotencia: código determinista en BD/lote O punto ya importado con
        #    el mismo título+ciudad+fuente (semillas antiguas o campos mutables).
        if (c.code_seed in seen_seeds or candidate_code(c.code_seed) in existing_codes
                or title_key_of(c.title, c.city, c.source == "pereira") in by_title):
            already.append(c)
            continue
        seen_seeds.add(c.code_seed)

        if c.geo_precision == "aproximada":
            # b) Coordenadas de centro-de-ciudad: sin dedup espacial (varios puntos
            #    legítimos comparten esas coords). Solo título+ciudad dentro del lote.
            key = (c.title.strip().lower(), c.city.strip().lower())
            if key in approx_batch:
                already.append(c)
                continue
            approx_batch.add(key)
            c.description += ("\nUbicación aproximada (centro de la ciudad): la fuente no "
                              "publica dirección exacta. Confirma antes de desplazarte.")
            to_create.append(c)
            continue

        # c) Punto preciso: dedup espacial contra precisos existentes/aceptados.
        dup, dist = find_duplicate(c, pool, args.radius, args.hard_radius)
        if dup:
            dups.append((c, dup, dist))
        else:
            to_create.append(c)
            pool.append({"title": c.title, "help_type": c.help_type.lower(),
                         "lat": c.lat, "lng": c.lng, "precise": True})

    # Adjunta el id real del punto ya importado (por título+ciudad+fuente) para que
    # los backfills de teléfono/dirección lo encuentren sin depender del código.
    for c in already:
        c.db_id = by_title.get(title_key_of(c.title, c.city, c.source == "pereira"))

    # --- 3) Reporte ---------------------------------------------------------------
    by_src = {}
    for c in to_create:
        by_src[c.source] = by_src.get(c.source, 0) + 1
    print("\n===== RESUMEN =====")
    print(f"candidatos:                {len(cands)}")
    print(f"  con coords de la fuente: {sum(1 for c in cands if c.geo_precision == 'fuente')}")
    print(f"  geocodificados:          {sum(1 for c in cands if c.geo_precision == 'geocodificada')}")
    print(f"  aprox. (centro ciudad):  {sum(1 for c in cands if c.geo_precision == 'aproximada')}")
    print(f"duplicados por radio:      {len(dups)}")
    print(f"ya existentes (skip):      {len(already)}")
    print(f"sin geolocalizar (skip):   {len(no_geo)}")
    print(f"A CREAR:                   {len(to_create)}  {by_src}")
    tc_vis = [c for c in to_create if c.visible]
    print(f"  → visibles (dir. valida): {len(tc_vis)}")
    print(f"  → pending (a moderar):    {len(to_create) - len(tc_vis)}")
    cats = {}
    for c in to_create:
        if c.visible:
            continue
        cat = re.sub(r"\s*\([\d.,]+ m\)$", "", c.pend_reason)  # agrupa sin la distancia
        cats[cat] = cats.get(cat, 0) + 1
    for reason, n in sorted(cats.items(), key=lambda kv: -kv[1]):
        print(f"      · {n:3} {reason}")

    if dups:
        print("\n-- Duplicados omitidos (mas cercano existente) --")
        for c, dup, dist in dups:
            print(f"  ~ [{c.source}] {c.title[:44]:46} a {dist:5.0f} m de <<{dup['title'][:40]}>>")
    if no_geo:
        print("\n-- Sin coordenadas (omitidos) --")
        for c in no_geo:
            print(f"  x [{c.source}] {c.title} - {c.city}")
    if to_create:
        print("\n-- Puntos a crear --")
        for c in to_create:
            print(f"  * [{c.source}] {c.title[:52]:54} {c.city} | {c.help_type} "
                  f"| {len(c.supplies)} insumos | ({c.geo_precision}) "
                  f"| {'VISIBLE' if c.visible else 'PENDING'}")

    # --- 4) Escritura --------------------------------------------------------------
    if args.dry_run:
        print("\n[dry-run] No se escribio nada en la base de datos.")
        return

    created = 0
    if to_create:
        if not args.yes:
            resp = input(f"\nInsertar {len(to_create)} puntos en la BD? [s/N] ").strip().lower()
            if resp not in ("s", "si", "sí", "y", "yes"):
                print("Cancelado.")
                return
        print("\nInsertando ...")
        created = insert_candidates(conn, to_create, existing_codes)

    # Contactos y direcciones publicados DESPUÉS por las fuentes → se completan
    # en los puntos ya importados (idempotente).
    contacts_added = backfill_contacts(conn, already)
    addr_added = backfill_addresses(conn, already)

    # Re-clasificación de los ya importados con la regla de dirección válida/cercana
    # (respeta lo que haya revisado un moderador).
    retro = retrofit_points(conn, already, args.match_radius, geocoder)

    with conn.cursor() as cur:
        cur.execute('''SELECT count(*) FROM "Point" p
                       JOIN "PointLocation" pl ON pl."pointId" = p.id''')
        total = cur.fetchone()[0]
        cur.execute('''SELECT count(*) FROM "Point" p
                       JOIN "PointLocation" pl ON pl."pointId" = p.id
                       WHERE p.status = 'active' AND p."verificationStatus" = 'approved' ''')
        total_vis = cur.fetchone()[0]
    conn.close()
    print(f"\nListo: {created} puntos creados, {contacts_added} contactos agregados, "
          f"{addr_added} direcciones completadas, {retro} puntos re-clasificados. "
          f"Total en BD: {total} · visibles en el mapa: {total_vis}")


if __name__ == "__main__":
    main()






