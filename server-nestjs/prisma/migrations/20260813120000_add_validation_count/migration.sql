-- AddField: Point.validationCount
-- Contador desnormalizado de validaciones comunitarias confirmadas (estilo
-- "likes"). Se mantiene con increment/decrement atómico en validate() para no
-- tener que contar filas en cada listado del mapa, y permite ordenar por
-- popularidad (más verificados primero).
ALTER TABLE "Point" ADD COLUMN "validationCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: cuenta las validaciones confirmadas existentes por punto.
UPDATE "Point" p
SET "validationCount" = COALESCE((
  SELECT COUNT(*) FROM "Validation" v
  WHERE v."pointId" = p.id AND v.status = 'confirmed'
), 0);

-- Índice para ordenar el listado del mapa por verificaciones (desc).
CREATE INDEX "Point_validationCount_idx" ON "Point"("validationCount");
