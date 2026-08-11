import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { generateVerificationCode } from "../lib/code.js";

export const pointsRouter = Router();

const PUBLIC_STATUSES = {
  ayuda: ["approved"],
  necesita_ayuda: ["active", "resolved"],
} as const;

pointsRouter.get("/", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;

  const where: Record<string, unknown> = {};
  if (type === "ayuda" || type === "necesita_ayuda") {
    where.type = type;
    where.status = { in: PUBLIC_STATUSES[type] };
  } else {
    where.OR = [
      { type: "ayuda", status: { in: PUBLIC_STATUSES.ayuda } },
      { type: "necesita_ayuda", status: { in: PUBLIC_STATUSES.necesita_ayuda } },
    ];
  }
  if (category) {
    where.category = category;
  }

  const points = await prisma.point.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      lat: true,
      lng: true,
      addressText: true,
      category: true,
      photos: true,
      status: true,
      createdAt: true,
    },
  });
  res.json(points);
});

pointsRouter.get("/:id", async (req, res) => {
  const point = await prisma.point.findUnique({ where: { id: req.params.id } });
  if (!point) {
    return res.status(404).json({ error: "Punto no encontrado" });
  }
  const allowedStatuses = PUBLIC_STATUSES[point.type];
  if (!allowedStatuses.includes(point.status as never)) {
    return res.status(404).json({ error: "Punto no encontrado" });
  }
  res.json(point);
});

const createSchema = z.object({
  type: z.enum(["ayuda", "necesita_ayuda"]),
  title: z.string().min(3).max(150),
  description: z.string().min(10).max(2000),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  addressText: z.string().max(300).optional(),
  category: z.enum(["refugio", "alimentos", "agua", "medico", "otro"]).optional(),
  contactInfo: z.string().min(3).max(200),
});

pointsRouter.post("/", requireAuth, upload.array("photos", 5), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const data = parsed.data;

  if (data.type === "ayuda" && !data.category) {
    return res.status(400).json({ error: "Los puntos de ayuda requieren una categoría" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const photos = files.map((f) => `/uploads/${f.filename}`);

  const isAyuda = data.type === "ayuda";
  const point = await prisma.point.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      lat: data.lat,
      lng: data.lng,
      addressText: data.addressText,
      category: isAyuda ? data.category : undefined,
      contactInfo: data.contactInfo,
      photos,
      status: isAyuda ? "pending" : "active",
      verificationCode: isAyuda ? generateVerificationCode() : undefined,
      createdById: req.user!.userId,
    },
  });

  res.status(201).json(point);
});
