import { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Point } from "../types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const COLOMBIA_CENTER: [number, number] = [-74.297, 4.5709];

function markerColor(point: Point): string {
  if (point.type === "necesita_ayuda") return "#dc2626";
  return "#1d6f5c";
}

function buildMarkerEl(point: Point): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "22px";
  el.style.height = "22px";
  el.style.borderRadius = "50%";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  el.style.backgroundColor = markerColor(point);
  el.style.cursor = "pointer";
  return el;
}

interface MapViewProps {
  points: Point[];
  selectedId?: string | null;
  onSelectPoint?: (point: Point) => void;
  pickerMode?: boolean;
  pickedLocation?: { lat: number; lng: number } | null;
  onPickLocation?: (lat: number, lng: number) => void;
  flyTo?: { lat: number; lng: number } | null;
}

export function MapView({
  points,
  selectedId,
  onSelectPoint,
  pickerMode,
  pickedLocation,
  onPickLocation,
  flyTo,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const pickerMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: COLOMBIA_CENTER,
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const point of points) {
      const el = buildMarkerEl(point);
      if (point.id === selectedId) {
        el.style.width = "28px";
        el.style.height = "28px";
        el.style.border = "3px solid #111827";
      }
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      el.addEventListener("click", (evt) => {
        evt.stopPropagation();
        onSelectPoint?.(point);
      });
      markersRef.current.push(marker);
    }
  }, [points, selectedId, onSelectPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.remove();
      pickerMarkerRef.current = null;
    }
    if (pickedLocation) {
      const el = document.createElement("div");
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.borderRadius = "50%";
      el.style.border = "3px solid #1d6f5c";
      el.style.backgroundColor = "#ffffff";
      pickerMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([pickedLocation.lng, pickedLocation.lat])
        .addTo(map);
    }
  }, [pickedLocation]);

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
