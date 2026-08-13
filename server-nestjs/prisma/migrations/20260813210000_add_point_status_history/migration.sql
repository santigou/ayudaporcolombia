-- AddTable: PointStatusHistory
-- Registro (log) de cada cambio de estado del ciclo de vida APLICADO a un Punto:
-- ya sea directo (creador/moderador) o por solicitud aprobada. Una fila por
-- transición, con from→to, el actor que la aplicó, motivo opcional y enlace a la
-- solicitud aprobada (si vino de ahí). Es la fuente del tab "Estado" del detalle.

CREATE TABLE "PointStatusHistory" (
    "id" UUID NOT NULL,
    "pointId" UUID NOT NULL,
    "fromStatus" "PointStatus" NOT NULL,
    "toStatus" "PointStatus" NOT NULL,
    "reason" TEXT,
    "actorId" UUID NOT NULL,
    "requestId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointStatusHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PointStatusHistory"
  ADD CONSTRAINT "PointStatusHistory_pointId_fkey"
  FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointStatusHistory"
  ADD CONSTRAINT "PointStatusHistory_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- requestId apunta a una PointStatusRequest aprobada; sin FK estricta para no
-- acoplar el ciclo de vida de ambos modelos (la solicitud puede existir igual).
CREATE INDEX "PointStatusHistory_pointId_createdAt_idx"
  ON "PointStatusHistory"("pointId", "createdAt");
CREATE INDEX "PointStatusHistory_actorId_idx" ON "PointStatusHistory"("actorId");
