import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { MapView } from "../components/MapView";
import { FiltersBar } from "../components/FiltersBar";
import { PointList } from "../components/PointList";
import { PointDetail } from "../components/PointDetail";
import type { BBox, HelpTypeOption, Point, PointsResponse, PointType } from "../types";

export function Home() {
  const [points, setPoints] = useState<Point[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<PointType | "todos">("todos");
  const [helpType, setHelpType] = useState<HelpTypeOption | "todas">("todas");
  const [selected, setSelected] = useState<Point | null>(null);
  const [bbox, setBbox] = useState<BBox | null>(null);

  // Reutiliza la última petición para descartar respuestas de bbox viejos (race).
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!bbox) return; // el mapa aún no reporta su zona visible
    const myId = ++reqIdRef.current;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      minLat: String(bbox.minLat),
      maxLat: String(bbox.maxLat),
      minLng: String(bbox.minLng),
      maxLng: String(bbox.maxLng),
    });
    if (type !== "todos") params.set("type", type);

    api
      .get<PointsResponse>(`/points?${params.toString()}`)
      .then((data) => {
        if (cancelled || reqIdRef.current !== myId) return;
        setPoints(data.points);
        setTruncated(data.truncated);
        setError(null);
      })
      .catch(() => {
        if (cancelled || reqIdRef.current !== myId) return;
        setError("No pudimos cargar los puntos. Intenta de nuevo.");
      })
      .finally(() => {
        if (cancelled || reqIdRef.current !== myId) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bbox, type]);

  // El filtro por tipo de ayuda es en el cliente (el catálogo es libre).
  const filteredPoints = useMemo(() => {
    if (type !== "offer_help" || helpType === "todas") return points;
    return points.filter((p) => p.helpType === helpType);
  }, [points, type, helpType]);

  const handleSelectPoint = useCallback((point: Point) => setSelected(point), []);
  const handleBoundsChange = useCallback((next: BBox) => setBbox(next), []);

  const selectedId = selected?.id;
  const sidePanel = useMemo(() => {
    if (selected) {
      return <PointDetail point={selected} onClose={() => setSelected(null)} />;
    }
    return (
      <>
        <FiltersBar
          type={type}
          helpType={helpType}
          onTypeChange={(t) => {
            setType(t);
            setHelpType("todas");
          }}
          onHelpTypeChange={setHelpType}
        />
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Cargando puntos…</p>
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <>
            {truncated && (
              <p className="px-4 pt-3 text-xs text-amber-700 bg-amber-50">
                Hay muchos puntos en esta zona. Mostrando los más recientes — acércate en
                el mapa para ver todos.
              </p>
            )}
            <PointList points={filteredPoints} selectedId={selectedId} onSelect={handleSelectPoint} />
          </>
        )}
      </>
    );
  }, [selected, type, helpType, loading, error, truncated, filteredPoints, handleSelectPoint]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)]">
      <div className="relative h-[55vh] md:h-auto md:flex-1">
        <MapView
          points={filteredPoints}
          selectedId={selected?.id}
          onSelectPoint={handleSelectPoint}
          onBoundsChange={handleBoundsChange}
        />
        <Link
          to="/crear"
          className="absolute bottom-4 right-4 z-10 rounded-full bg-brand text-white px-5 py-3 font-semibold shadow-lg hover:bg-brand-dark"
        >
          + Crear
        </Link>
      </div>
      <aside className="flex-1 md:flex-none md:w-96 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden bg-white">
        {sidePanel}
      </aside>
    </div>
  );
}
