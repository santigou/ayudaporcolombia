import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedRequest extends Request {
  // Populado por este middleware si hay cookie/header con JWT válido.
  // Es OPCIONAL: las rutas públicas no lo exigen; las que sí usan @RequireAuth().
  user?: {
    userId: string;
    role: string;
  };
}

// Middleware de auth OPCIONAL (estilo attachUserIfPresent del Express): lee el
// JWT de la cookie `token` (o Authorization header) y, si es válido, popula
// req.user. Si no hay token o es inválido, simplemente continúa sin user.
// La obligatoriedad la deciden los guards @RequireAuth() / @Roles() por ruta.
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const token = this.extractToken(req);
    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        // Acepta tanto `sub` (NestJS) como `userId` (tokens del Express viejo),
        // para tolerar cookies preexistentes durante la migración.
        req.user = { userId: payload.sub ?? payload.userId, role: payload.role };
      } catch {
        // token inválido/expirado → no popula user, pero no falla.
      }
    }
    next();
  }

  private extractToken(req: Request): string | null {
    const cookies = req.headers.cookie;
    if (cookies) {
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) return tokenMatch[1];
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}
