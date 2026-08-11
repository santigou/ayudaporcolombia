import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { MapView } from "../components/MapView";
import { FiltersBar } from "../components/FiltersBar";
import { PointList } from "../components/PointList";
import { PointDetail } from "../components/PointDetail";
import type { Point, PointCategory, PointType } from "../types";

export function Home() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<PointType | "todos">("todos");
  const [category, setCategory] = useState<PointCategory | "todas">("todas");
  const [selected, setSelected] = useState<Point | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (type !== "todos") params.set("type", type);
    if (type === "ayuda" && category !== "todas") params.set("category", category);

    api
      .get<Point[]>(`/points?${params.toString()}`)
      .then((data) => {
        if (!cancelled) setPoints(data);
      })
      .catch(() => {
        if (!cancelled) setError("No pudimos cargar los puntos. Intenta de nuevo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, category]);

  const handleSelectPoint = useCallback((point: Point) => setSelected(point), []);

  const sidePanel = useMemo(() => {
    if (selected) {
      return <PointDetail point={selected} onClose={() => setSelected(null)} />;
    }
    return (
      <>
        <FiltersBar
          type={type}
          category={category}
          onTypeChange={(t) => {
            setType(t);
            setCategory("todas");
          }}
          onCategoryChange={setCategory}
        />
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Cargando puntos…</p>
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <PointList points={points} selectedId={selected?.id} onSelect={handleSelectPoint} />
        )}
      </>
    );
  }, [selected, type, category, loading, error, points, handleSelectPoint]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)]">
      <div className="relative h-[55vh] md:h-auto md:flex-1">
        <MapView points={points} selectedId={selected?.id} onSelectPoint={handleSelectPoint} />
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
