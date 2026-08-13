-- AddField: Point.code (código público corto y compartible)
ALTER TABLE "Point" ADD COLUMN "code" TEXT;

-- Backfill: códigos únicos secuenciales para los puntos existentes.
WITH "numbered" AS (
  SELECT "id", ROW_NUMBER() OVER () AS "rn" FROM "Point"
)
UPDATE "Point" SET "code" = 'AYUDA-' || lpad("numbered"."rn"::text, 5, '0')
FROM "numbered" WHERE "Point"."id" = "numbered"."id";

ALTER TABLE "Point" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Point_code_key" ON "Point"("code");
CREATE INDEX "Point_code_idx" ON "Point"("code");
