import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireModerator } from "../middleware/auth.middleware.js";

export const moderatorRouter = Router();

moderatorRouter.use(requireAuth, requireModerator);

moderatorRouter.get("/points/pending", async (_req, res) => {
  const points = await prisma.point.findMany({
    where: { type: "ayuda", status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true, contactInfo: true } },
    },
  });
  res.json(points);
});

moderatorRouter.post("/points/:id/approve", async (req, res) => {
  const point = await prisma.point.findUnique({ where: { id: req.params.id } });
  if (!point || point.type !== "ayuda" || point.status !== "pending") {
    return res.status(404).json({ error: "Punto no encontrado o ya revisado" });
  }
  const updated = await prisma.point.update({
    where: { id: point.id },
    data: { status: "approved", reviewedById: req.user!.userId, reviewedAt: new Date() },
  });
  res.json(updated);
});

moderatorRouter.post("/points/:id/reject", async (req, res) => {
  const point = await prisma.point.findUnique({ where: { id: req.params.id } });
  if (!point || point.type !== "ayuda" || point.status !== "pending") {
    return res.status(404).json({ error: "Punto no encontrado o ya revisado" });
  }
  const updated = await prisma.point.update({
    where: { id: point.id },
    data: { status: "rejected", reviewedById: req.user!.userId, reviewedAt: new Date() },
  });
  res.json(updated);
});

moderatorRouter.get("/requests", async (_req, res) => {
  const requests = await prisma.moderatorRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, contactInfo: true } } },
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
