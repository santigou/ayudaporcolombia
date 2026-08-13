-- AddTable: PointStatusRequest
-- Solicitudes de cambio de estado (ciclo de vida) hechas por usuarios que no son
-- el creador ni moderador. El usuario propone un estado objetivo + motivo; el
-- moderador aprueba (aplica el cambio) o rechaza.

CREATE TABLE "PointStatusRequest" (
    "id" UUID NOT NULL,
    "pointId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "targetStatus" "PointStatus" NOT NULL,
    "reason" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointStatusRequest_pkey" PRIMARY KEY ("id")
);

-- Relaciones.
ALTER TABLE "PointStatusRequest"
  ADD CONSTRAINT "PointStatusRequest_pointId_fkey"
  FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointStatusRequest"
  ADD CONSTRAINT "PointStatusRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointStatusRequest"
  ADD CONSTRAINT "PointStatusRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices de consulta frecuentes: cola de pendientes del moderador, historial
-- por punto, y solicitudes de un usuario.
CREATE INDEX "PointStatusRequest_pointId_idx" ON "PointStatusRequest"("pointId");
CREATE INDEX "PointStatusRequest_status_idx" ON "PointStatusRequest"("status");
CREATE INDEX "PointStatusRequest_userId_idx" ON "PointStatusRequest"("userId");

-- Una solicitud PENDIENTE por (usuario, punto): constraint parcial UNIQUE para
-- evitar que un usuario acumule varias solicitudes activas sobre el mismo punto.
-- Prisma no soporta índices parciales en el schema, así que se declaran aquí.
CREATE UNIQUE INDEX "PointStatusRequest_pointId_userId_status_pending_key"
  ON "PointStatusRequest"("pointId", "userId")
  WHERE "status" = 'pending';
