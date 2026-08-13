import { useEffect, useRef } from "react";
import maplibregl, { type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LOCATION_TYPE_LABELS, type Point, type PointLocationEntry, type PointLocationType } from "../types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const COLOR_OFFER = "#1d6f5c";
const COLOR_NEED = "#dc2626";

function roleColor(role: PointLocationType, pointColor: string): string {
  if (role === "origin") return "#2563eb";
  if (role === "destination") return "#d97706";
  return pointColor;
}

interface PointMiniMapProps {
  locations: PointLocationEntry[];
  pointType: Point["type"];
  points?: Point[];
  // Índice activo y callback: el estado vive en el padre para que "Cómo llegar"
  // pueda calcular la ruta según la ubicación seleccionada.
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  className?: string;
}

// Mini-mapa del detalle: muestra TODAS las ubicaciones (semipuntos) del punto
// como marcadores numerados y permite navegar entre ellas con ‹ › (circular).
export function PointMiniMap({ locations, pointType, points = [], activeIndex, onActiveIndexChange, className = "" }: PointMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const locationMarkersRef = useRef<Marker[]>([]);
  const nearbyMarkersRef = useRef<Marker[]>([]);
  const mainColor = pointType === "need_help" ? COLOR_NEED : COLOR_OFFER;
  const safeIndex = Math.min(activeIndex, Math.max(0, locations.length - 1));

  useEffect(() => {
    if (!containerRef.current || locations.length === 0) return;
    const map = new maplibregl.Map({ container: containerRef.current, style: STYLE_URL, center: [locations[0].lng, locations[0].lat], zoom: 13, attributionControl: false });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    mapRef.current = map;
    map.on("load", () => { map.dragRotate.disable(); map.keyboard.disable(); map.scrollZoom.disable(); map.doubleClickZoom.disable(); map.touchZoomRotate.disableRotation(); });
    return () => { map.remove(); mapRef.current = null; locationMarkersRef.current = []; nearbyMarkersRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || locations.length === 0) return;
    fitLocations(map, locations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    locationMarkersRef.current.forEach((m) => m.remove());
    locationMarkersRef.current = locations.map((loc, i) => new maplibregl.Marker({ element: buildLocationMarker(loc.type, mainColor, i, i === safeIndex) }).setLngLat([loc.lng, loc.lat]).addTo(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, safeIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    nearbyMarkersRef.current.forEach((m) => m.remove());
    nearbyMarkersRef.current = [];
    for (const p of points) {
      if (!p.location) continue;
      const el = document.createElement("div");
      el.style.cssText = `width:8px;height:8px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.4);opacity:0.55;background-color:${p.type === "need_help" ? COLOR_NEED : COLOR_OFFER}`;
      nearbyMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.location.lng, p.location.lat]).addTo(map));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  function zoomIn() { mapRef.current?.zoomIn(); }
  function zoomOut() { mapRef.current?.zoomOut(); }
  function fitAll() { const m = mapRef.current; if (m && locations.length) fitLocations(m, locations); }
  // Navegación circular: ‹ en el 1º va al último; › en el último vuelve al 1º.
  function goTo(i: number) {
    const n = locations.length;
    if (n === 0) return;
    const c = ((i % n) + n) % n;
    onActiveIndexChange(c);
    const loc = locations[c];
    if (loc) mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 15 });
  }

  if (locations.length === 0) return null;

  return (
    <div className={`mini-map relative overflow-hidden rounded-lg border border-gray-200 ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow">
        <button type="button" onClick={zoomIn} aria-label="Acercar" className="px-2.5 text-lg leading-none text-gray-700 hover:bg-gray-50">+</button>
        <div className="h-px bg-gray-200" />
        <button type="button" onClick={zoomOut} aria-label="Alejar" className="px-2.5 text-lg leading-none text-gray-700 hover:bg-gray-50">−</button>
        <div className="h-px bg-gray-200" />
        <button type="button" onClick={fitAll} aria-label="Ver todas" title="Ver todas las ubicaciones" className="flex items-center justify-center px-2.5 py-1.5 text-gray-700 hover:bg-gray-50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3.5" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /></svg>
        </button>
      </div>
      {locations.length > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-1.5 py-1 text-xs shadow-md ring-1 ring-black/5">
          <button type="button" onClick={() => goTo(safeIndex - 1)} aria-label="Anterior" className="flex h-6 w-6 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100">‹</button>
          <span className="min-w-[88px] text-center font-medium text-gray-700">{safeIndex + 1}/{locations.length} · {LOCATION_TYPE_LABELS[locations[safeIndex].type]}</span>
          <button type="button" onClick={() => goTo(safeIndex + 1)} aria-label="Siguiente" className="flex h-6 w-6 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100">›</button>
        </div>
      )}
    </div>
  );
}

function fitLocations(map: maplibregl.Map, locs: PointLocationEntry[]) {
  if (locs.length === 1) { map.flyTo({ center: [locs[0].lng, locs[0].lat], zoom: 14 }); return; }
  const bounds = locs.reduce((b, l) => b.extend([l.lng, l.lat]), new maplibregl.LngLatBounds([locs[0].lng, locs[0].lat], [locs[0].lng, locs[0].lat]));
  map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
}

function buildLocationMarker(role: PointLocationType, pointColor: string, index: number, active: boolean): HTMLDivElement {
  const el = document.createElement("div");
  const size = active ? 28 : 22;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;border:${active ? 3 : 2}px solid ${active ? "#111827" : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,0.4);background-color:${roleColor(role, pointColor)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${active ? 13 : 11}px;line-height:1;cursor:pointer`;
  el.textContent = String(index + 1);
  return el;
}
