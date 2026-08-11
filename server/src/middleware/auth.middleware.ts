import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Debes iniciar sesión" });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

export function requireModerator(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "moderator") {
    return res.status(403).json({ error: "Requiere rol de moderador" });
  }
  next();
}

export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // token inválido: se ignora, la ruta sigue como anónima
    }
  }
  next();
}
