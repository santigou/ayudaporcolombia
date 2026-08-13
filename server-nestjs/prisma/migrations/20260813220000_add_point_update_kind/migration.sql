-- Tipo/categoría (kind) de una novedad del timeline de un Punto. Permite marcar
-- un mensaje como comentario normal, "estoy ayudando", "terminamos", importante
-- o urgente, para coordinar la ayuda en el chat en tiempo real.
-- Default 'message' para que las novedades existentes queden como comentario.
CREATE TYPE "UpdateKind" AS ENUM ('message', 'helping', 'done', 'important', 'urgent');

ALTER TABLE "PointUpdate" ADD COLUMN "kind" "UpdateKind" NOT NULL DEFAULT 'message';
