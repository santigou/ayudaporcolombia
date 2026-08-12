import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, comparePassword } from "../lib/password.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// El rediseño eliminó `name` y `contactInfo` de `User`. El registro queda solo
// con email + contraseña (y, opcionalmente, una solicitud para ser moderador).
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  wantsModerator: z.boolean().optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const { email, password, wantsModerator } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      ...(wantsModerator ? { moderatorRequests: { create: { status: "pending" } } } : {}),
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  res.cookie("token", token, COOKIE_OPTIONS);
  res.status(201).json({ id: user.id, email: user.email, role: user.role });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Correo o contraseña inválidos" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.cookie("token", token, COOKIE_OPTIONS);
  res.json({ id: user.id, email: user.email, role: user.role });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", COOKIE_OPTIONS);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      role: true,
      moderatorRequests: {
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  const request = user.moderatorRequests[0] ?? null;
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    moderatorRequest: request ? { id: request.id, status: request.status } : null,
  });
});
