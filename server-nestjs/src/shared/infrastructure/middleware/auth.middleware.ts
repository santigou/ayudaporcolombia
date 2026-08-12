import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = this.extractToken(req);

    if (!token) {
      throw new ForbiddenException('Access token required');
    }

    try {
      const payload = this.jwtService.verify(token);
      req.user = {
        userId: payload.sub,
        role: payload.role,
      };
      next();
    } catch (error) {
      throw new ForbiddenException('Invalid or expired token');
    }
  }

  private extractToken(req: Request): string | null {
    // Try to get from cookie first
    const cookies = req.headers.cookie;
    if (cookies) {
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }

    // Try to get from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}