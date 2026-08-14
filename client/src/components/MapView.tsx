import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BBox, LocationDraft, Point, PointLocationEntry } from "../types";

// El mapa usa SIEMPRE el estilo claro (positron), incluso en modo oscuro de la
// app: es más fácil de entender que el dark y mantiene legibles las etiquetas y
// las zonas verdes/agua. Para que no sea un blanco "fuerte"/plano, suavizamos
// los grises muy claros del positron tirándolos a un gris medio más cálido tras
// cargar el estilo (applySoftTint). Así se ve como un light "apagado".
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}
function parseColorStr(v: string): [number, number, number] | null {
  let m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = v.match(/hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (m) return hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
  m = v.match(/^#([\da-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = v.match(/^#([\da-f]{3})$/i);
  if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]; }
  return null;
}
// Suaviza los grises del positron: los tonos muy claros (casi blanco) se bajan a
// un gris medio cálido para reducir el deslumbramiento sin perder legibilidad.
// Respeta el agua, las zonas verdes, los edificios y los textos (tienen color o
// son grises ya oscuros).
function applySoftTint(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    let prop: string | null = null;
    if (layer.type === "background") prop = "background-color";
    else if (layer.type === "fill") prop = "fill-color";
    else continue;
    try {
      const v = map.getPaintProperty(layer.id, prop);
      if (typeof v !== "string") continue;
      const rgb = parseColorStr(v);
      if (!rgb) continue;
      const [, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      if (s > 0.06) continue; // tiene color (agua/parques): respetar
      if (l < 0.8) continue; // gris medio/oscuro: no tocar
      // De casi-blanco → gris cálido suave (menos "fuerte" a la vista).
      const tinted = hslToRgb(40, 0.06, 0.93);
      map.setPaintProperty(layer.id, prop, `rgb(${tinted[0]},${tinted[1]},${tinted[2]})`);
    } catch {
      /* propiedad no admitida en esta capa: se ignora */
    }
  }
}
// Centro por defecto: Medellín. Se usa si el navegador no da/permite GPS.
const DEFAULT_CENTER: [number, number] = [-75.5636, 6.2518];
const DEFAULT_ZOOM = 11;

// Colores de marcador por tipo de punto (modo lectura / clustering).
const COLOR_OFFER = "#1d6f5c"; // verde — offer_help
const COLOR_NEED = "#dc2626"; // rojo — need_help

// Color del marcador picker según el rol de la ubicación.
function pickerMarkerColor(type: LocationDraft["type"]): string {
  if (type === "origin") return "#2563eb"; // azul
  if (type === "destination") return "#d97706"; // ámbar
  return COLOR_OFFER; // verde (ubicación principal)
}

function buildPickerMarkerEl(draft: LocationDraft, index: number, active: boolean): HTMLDivElement {
  const el = document.createElement("div");
  const size = active ? 30 : 24;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.border = `${active ? 3 : 2}px solid ${active ? "#111827" : "#ffffff"}`;
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  el.style.backgroundColor = pickerMarkerColor(draft.type);
  el.style.cursor = "pointer";
  // Número de orden (1, 2, 3…) para distinguir cada ubicación en el mapa y
  // asociarla con su caja del acordeón.
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.color = "#ffffff";
  el.style.fontWeight = "700";
  el.style.fontSize = active ? "13px" : "11px";
  el.style.lineHeight = "1";
  el.textContent = String(index + 1);
  return el;
}

// Marcador de una sub-ubicación cuando se selecciona un punto con varias
// ubicaciones (modo lectura): numerado, coloreado por tipo de punto.
function buildExpandedMarkerEl(pointType: Point["type"], index: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "24px";
  el.style.height = "24px";
  el.style.borderRadius = "50%";
  el.style.border = "2px solid #ffffff";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  el.style.backgroundColor = pointType === "need_help" ? COLOR_NEED : COLOR_OFFER;
  el.style.cursor = "pointer";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.color = "#ffffff";
  el.style.fontWeight = "700";
  el.style.fontSize = "12px";
  el.style.lineHeight = "1";
  el.textContent = String(index + 1);
  return el;
}

interface MapViewProps {
  points: Point[];
  selectedId?: string | null;
  onSelectPoint?: (point: Point) => void;
  pickerMode?: boolean;
  pickedLocations?: LocationDraft[];
  activeIndex?: number | null;
  onPickLocation?: (lat: number, lng: number) => void;
  flyTo?: { lat: number; lng: number } | null;
  // En modo lectura: notifica el rectángulo visible al mover el mapa (con debounce)
  // para que el padre cargue solo los puntos de esa zona.
  onBoundsChange?: (bbox: BBox) => void;
}

export function MapView({
  points,
  selectedId,
  onSelectPoint,
  pickerMode,
  pickedLocations,
  activeIndex,
  onPickLocation,
  flyTo,
  onBoundsChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const expandedMarkersRef = useRef<Marker[]>([]); // sub-ubicaciones del punto seleccionado
  const pickerMarkersRef = useRef<Marker[]>([]);
  // Para evitar refetch en movimientos chicos: guardamos el último bbox notificado.
  const lastBboxRef = useRef<BBox | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref al callback para poder llamarlo sin que el efecto del mapa dependa de él
  // (evita destruir/recrear el mapa en cada render del padre).
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onSelectPointRef = useRef(onSelectPoint);
  const pointsRef = useRef(points);
  const selectedIdRef = useRef(selectedId);
  const pointsSourceRef = useRef<GeoJSONSource | null>(null);
  const lastExpandedFitRef = useRef<string | null>(null);
  // Clave del último conjunto de coordenadas marcadas a las que encuadramos,
  // para no re-encuadrar si no cambiaron los puntos (solo cambió la activa).
  const lastFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
    onSelectPointRef.current = onSelectPoint;
    pointsRef.current = points;
    selectedIdRef.current = selectedId;
  });

  // --- Modo lectura (clustering) ---
  // Actualiza los datos del source (clustering) y los sub-marcadores.
  // Cada UBICACIÓN es un feature del source: así, al alejar el zoom las
  // ubicaciones (incluidas las de un mismo punto) se agrupan, y al acercar se
  // separan de forma natural. Al seleccionar un punto con varias ubicaciones,
  // sus ubicaciones salen del source y se dibujan como sub-marcadores numerados.
  function syncMap() {
    const map = mapRef.current;
    const src = pointsSourceRef.current;
    if (!map || !src) return;
    const pts = pointsRef.current;
    const selId = selectedIdRef.current;
    const selPoint = selId ? pts.find((p) => p.id === selId) ?? null : null;
    const expandSelected = !!selPoint && (selPoint.locations?.length ?? 0) > 1;

    // Un feature por ubicación (no por punto). Así una punto con N ubicaciones
    // contribuye con N features que clusterizan/separan al hacer zoom. La primera
    // ubicación de cada punto se marca como isPrimary para el conteo híbrido.
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const p of pts) {
      const locs = p.locations && p.locations.length > 0 ? p.locations : p.location ? [p.location] : [];
      locs.forEach((loc, idx) => {
        // Si el punto seleccionado tiene varias ubicaciones, lo expandimos fuera
        // del source (se dibuja como sub-marcadores numerados).
        if (expandSelected && p.id === selId) return;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
          properties: { id: p.id, pointType: p.type, isPrimary: idx === 0 },
        });
      });
    }
    src.setData({ type: "FeatureCollection", features });

    // Anillo de selección sobre las ubicaciones del punto elegido (cuando no
    // está expandido, pues esas salen del source).
    if (map.getLayer("selected-point")) {
      const ringFilter = !selId || expandSelected
        ? ["==", ["get", "id"], ""]
        : ["==", ["get", "id"], selId];
      map.setFilter("selected-point", ringFilter as maplibregl.ExpressionSpecification);
    }

    // Sub-marcadores numerados SOLO del punto seleccionado con varias ubicaciones.
    expandedMarkersRef.current.forEach((m) => m.remove());
    expandedMarkersRef.current = [];
    if (expandSelected && selPoint) {
      selPoint.locations!.forEach((loc, i) => {
        const el = buildExpandedMarkerEl(selPoint.type, i);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .addTo(map);
        expandedMarkersRef.current.push(marker);
      });
      // Encuadra solo al cambiar de selección (no en cada recarga de puntos).
      if (lastExpandedFitRef.current !== selId) {
        lastExpandedFitRef.current = selId ?? null;
        fitLocations(selPoint.locations!);
      }
    } else {
      lastExpandedFitRef.current = null;
    }
  }

  function fitLocations(locs: PointLocationEntry[]) {
    const map = mapRef.current;
    if (!map || locs.length === 0) return;
    const lngs = locs.map((l) => l.lng);
    const lats = locs.map((l) => l.lat);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    const doFit = () => map.fitBounds(bounds, { padding: 100, maxZoom: 17 });
    if (map.loaded()) doFit();
    else map.once("load", doFit);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      // Desactiva la atribución por defecto (texto completo siempre visible en
      // pantallas grandes) y añadimos una COMPACTA (solo el botón ⓘ) que arranca
      // cerrada y se expande al pasar el ratón / pulsar.
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Botón 🎯 para recentrar en la ubicación del usuario. showUserLocation (default
    // true) dibuja el punto azul; trigger() lo activa automáticamente al cargar.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      // Al centrar, no hacer zoom más allá de 11 (~50 km de diámetro visible).
      fitBoundsOptions: { maxZoom: 11 },
      showUserLocation: true,
      // Sin círculo de precisión: con geolocalización por IP/Wi-Fi el radio de
      // error puede ser de varios km y termina cubriendo medio departamento sin
      // aportar información útil. Dejamos solo el punto azul de ubicación.
      showAccuracyCircle: false,
    });
    map.addControl(geolocate, "top-right");
    mapRef.current = map;

    // Activa la geolocalización al cargar: pide permiso y, si se concede, centra
    // + muestra el punto azul. Si se rechaza, el mapa queda en Medellín (DEFAULT_CENTER).
    // Además suavizamos los grises muy blancos del positron (ver applySoftTint).
    map.on("load", () => {
      try { applySoftTint(map); } catch { /* estilo no listo: se ignora */ }
      geolocate.trigger();
    });

    // Notifica el bbox actual al padre (primer carga y cada vez que termina de
    // mover/zoom). Con debounce para no inundar al servidor, y comparando con el
    // último enviado para ignorar movimientos diminutos.
    const emit = () => {
      const b = map.getBounds();
      const bbox: BBox = {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      };
      const prev = lastBboxRef.current;
      const similar =
        prev &&
        Math.abs(prev.minLat - bbox.minLat) < 1e-4 &&
        Math.abs(prev.maxLat - bbox.maxLat) < 1e-4 &&
        Math.abs(prev.minLng - bbox.minLng) < 1e-4 &&
        Math.abs(prev.maxLng - bbox.maxLng) < 1e-4;
      if (similar) return;
      lastBboxRef.current = bbox;
      onBoundsChangeRef.current?.(bbox);
    };

    const debouncedEmit = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(emit, 400);
    };

    // Emite el bbox inicial en cuanto el mapa tiene su tamaño, y en cada moveend.
    map.on("load", emit);
    map.on("moveend", debouncedEmit);

    // --- Modo lectura: clustering nativo + selección/expansión de ubicaciones ---
    // Source GeoJSON con clustering: los puntos cercanos se agrupan al alejarse.
    map.on("load", () => {
      map.addSource("points-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 16,
        // Cuenta de PUNTOS ORIGINALES en el cluster (no de ubicaciones): suma 1
        // solo por la ubicación primaria (isPrimary) de cada punto. Sirve para el
        // conteo híbrido de la etiqueta (ver capa cluster-count).
        clusterProperties: {
          pointsCount: ["+", ["case", ["get", "isPrimary"], 1, 0]],
        },
      });
      pointsSourceRef.current = map.getSource("points-src") as unknown as GeoJSONSource;

      // Grupos: círculo verde + número de puntos. Tamaño fijo para que todos los
      // marcadores se vean iguales (el número indica cuántos agrupa).
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "points-src",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": COLOR_OFFER,
          "circle-radius": 15,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "points-src",
        filter: ["has", "point_count"],
        layout: {
          // Conteo híbrido: si el cluster agrupa un SOLO punto (varias de sus
          // ubicaciones) → muestra el nº de ubicaciones (point_count); si agrupa
          // VARIOS puntos → muestra el nº de puntos (pointsCount, sin contar
          // semi-puntos).
          "text-field": [
            "case",
            ["==", ["get", "pointsCount"], 1],
            ["get", "point_count"],
            ["get", "pointsCount"],
          ],
          "text-size": 13,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });
      // Puntos individuales (color según tipo de punto). Tamaño visible y
      // coherente con los grupos.
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "points-src",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 10,
          "circle-color": ["match", ["get", "pointType"], "need_help", COLOR_NEED, COLOR_OFFER],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      // Anillo de selección (filtro dinámico en syncMap) sobre las ubicaciones
      // del punto elegido. Radio mayor que el punto (10) para rodearlo.
      map.addLayer({
        id: "selected-point",
        type: "circle",
        source: "points-src",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": 14,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#111827",
        },
      });

      // Click en grupo → zoom hasta que los puntos se separen.
      map.on("click", "clusters", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const cid = f.properties?.cluster_id as number | undefined;
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        if (cid == null) return;
        pointsSourceRef.current?.getClusterExpansionZoom(cid).then((zoom) => {
          map.easeTo({ center: coords, zoom });
        });
      });
      // Click en punto individual → seleccionarlo.
      map.on("click", "unclustered-point", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (!id) return;
        const pt = pointsRef.current.find((p) => p.id === id);
        if (pt) onSelectPointRef.current?.(pt);
      });
      // Cursor pointer sobre grupos y puntos.
      const setCursor = () => (map.getCanvas().style.cursor = "pointer");
      const unsetCursor = () => (map.getCanvas().style.cursor = "");
      map.on("mouseenter", "clusters", setCursor);
      map.on("mouseleave", "clusters", unsetCursor);
      map.on("mouseenter", "unclustered-point", setCursor);
      map.on("mouseleave", "unclustered-point", unsetCursor);

      // Pinta los puntos iniciales (los siguientes llegan vía el effect syncMap).
      syncMap();
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      map.remove();
      mapRef.current = null;
    };
    // El mapa se crea una sola vez; el callback se lee vía ref (estable).
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function handleClick(e: maplibregl.MapMouseEvent) {
      if (!pickerMode || !onPickLocation) return;
      onPickLocation(e.lngLat.lat, e.lngLat.lng);
    }
    if (pickerMode) {
      map.on("click", handleClick);
    }
    return () => {
      map.off("click", handleClick);
    };
  }, [pickerMode, onPickLocation]);

  // Modo lectura: actualiza los datos del cluster (y la expansión) cuando
  // cambian los puntos o la selección. La lógica vive en syncMap().
  useEffect(() => {
    syncMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickerMarkersRef.current.forEach((m) => m.remove());
    pickerMarkersRef.current = [];
    if (pickerMode && pickedLocations) {
      pickedLocations.forEach((draft, i) => {
        if (draft.lat == null || draft.lng == null) return;
        const el = buildPickerMarkerEl(draft, i, i === activeIndex);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([draft.lng, draft.lat])
          .addTo(map);
        pickerMarkersRef.current.push(marker);
      });
    }
  }, [pickedLocations, activeIndex, pickerMode]);

  // Auto-encuadra el mapa para que se vean TODAS las ubicaciones marcadas a la
  // vez (útil con varias: origen/destino, o tras restaurar un borrador). Solo
  // actúa cuando cambian las coordenadas marcadas (no cuando solo cambia la
  // activa), para no rebotar el mapa mientras el usuario trabaja.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickerMode || !pickedLocations) return;
    const placed = pickedLocations.filter((l) => l.lat != null && l.lng != null);
    if (placed.length === 0) return;
    const key = placed.map((l) => `${l.lat!.toFixed(5)},${l.lng!.toFixed(5)}`).join("|");
    if (lastFitKeyRef.current === key) return;
    lastFitKeyRef.current = key;
    const lngs = placed.map((l) => l.lng!);
    const lats = placed.map((l) => l.lat!);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    const doFit = () => map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    if (map.loaded()) doFit();
    else map.once("load", doFit);
  }, [pickedLocations, pickerMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: Math.max(map.getZoom(), 15),
      essential: true,
    });
  }, [flyTo]);

  return <div ref={containerRef} className="h-full w-full" />;
}
