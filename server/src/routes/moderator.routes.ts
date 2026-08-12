import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireModerator } from "../middleware/auth.middleware.js";

export const moderatorRouter = Router();

moderatorRouter.use(requireAuth, requireModerator);

// Cola de puntos de oferta (offer_help) pendientes de verificación.
moderatorRouter.get("/points/pending", async (_req, res) => {
  const points = await prisma.point.findMany({
    where: { type: "offer_help", verificationStatus: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { id: true, email: true } },
      locations: { include: { location: true } },
      helpType: true,
      contacts: true,
      attachments: true,
    },
  });

  // Normalizamos al mismo shape público del listado + datos de moderación
  // (contactos y creador), para que el frontend reutilice un solo tipo.
  const mapped = points.map((p) => {
    const loc = (p.locations.find((l) => l.locationType === "location") ?? p.locations[0])
      ?.location;
    return {
      id: p.id,
      type: p.type,
      title: p.title,
      description: p.description,
      status: p.status,
      verificationStatus: p.verificationStatus,
      createdAt: p.createdAt,
      helpType: p.helpType?.name ?? null,
      location: loc
        ? {
            lat: loc.latitude,
            lng: loc.longitude,
            address: loc.address,
            city: loc.city,
            neighborhood: loc.neighborhood,
          }
        : null,
      locations: p.locations.map((l) => ({
        type: l.locationType,
        lat: l.location.latitude,
        lng: l.location.longitude,
        address: l.location.address,
        city: l.location.city,
        neighborhood: l.location.neighborhood,
      })),
      photos: p.attachments.filter((a) => a.type === "image").map((a) => a.url),
      contacts: p.contacts.map((c) => ({ type: c.type, value: c.value })),
      createdBy: p.createdBy,
    };
  });

  res.json(mapped);
});

// Aprobar: deja registro en `Verification` y marca el punto como verificado + activo.
moderatorRouter.post("/points/:id/approve", async (req, res) => {
  const point = await prisma.point.findUnique({ where: { id: req.params.id } });
  if (!point || point.type !== "offer_help" || point.verificationStatus !== "pending") {
    return res.status(404).json({ error: "Punto no encontrado o ya revisado" });
  }

  const [, updatedPoint] = await prisma.$transaction([
    prisma.verification.create({
      data: { pointId: point.id, moderatorId: req.user!.userId, status: "approved" },
    }),
    prisma.point.update({
      where: { id: point.id },
      data: { verificationStatus: "approved", status: "active" },
    }),
  ]);

  res.json(updatedPoint);
});

// Rechazar: deja registro en `Verification` (con nota opcional) y marca el punto.
moderatorRouter.post("/points/:id/reject", async (req, res) => {
  const point = await prisma.point.findUnique({ where: { id: req.params.id } });
  if (!point || point.type !== "offer_help" || point.verificationStatus !== "pending") {
    return res.status(404).json({ error: "Punto no encontrado o ya revisado" });
  }

  const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note : null;

  const [, updatedPoint] = await prisma.$transaction([
    prisma.verification.create({
      data: { pointId: point.id, moderatorId: req.user!.userId, status: "rejected", note },
    }),
    prisma.point.update({
      where: { id: point.id },
      data: { verificationStatus: "rejected", status: "rejected" },
    }),
  ]);

  res.json(updatedPoint);
});

// Solicitudes para ser moderador.
moderatorRouter.get("/requests", async (_req, res) => {
  const requests = await prisma.moderatorRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, email: true } } },
  });
  res.json(requests);
});

moderatorRouter.post("/requests/:id/approve", async (req, res) => {
  const request = await prisma.moderatorRequest.findUnique({ where: { id: req.params.id } });
  if (!request || request.status !== "pending") {
    return res.status(404).json({ error: "Solicitud no encontrada o ya revisada" });
  }

  const [updatedRequest] = await prisma.$transaction([
    prisma.moderatorRequest.update({
      where: { id: request.id },
      data: { status: "approved", reviewedById: req.user!.userId, reviewedAt: new Date() },
    }),
    prisma.user.update({ where: { id: request.userId }, data: { role: "moderator" } }),
  ]);

  res.json(updatedRequest);
});

moderatorRouter.post("/requests/:id/reject", async (req, res) => {
  const request = await prisma.moderatorRequest.findUnique({ where: { id: req.params.id } });
  if (!request || request.status !== "pending") {
    return res.status(404).json({ error: "Solicitud no encontrada o ya revisada" });
  }

  const updated = await prisma.moderatorRequest.update({
    where: { id: request.id },
    data: { status: "rejected", reviewedById: req.user!.userId, reviewedAt: new Date() },
  });

  res.json(updated);
});
