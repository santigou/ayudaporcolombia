import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  moderatorRequest?: { id: string; status: string } | null;
}

// Servicio de autenticación: registro, login y datos del usuario actual.
// Usa Prisma directamente y delega el JWT a JwtService. Replica la lógica del
// backend Express (auth.routes.ts) para que el frontend funcione sin cambios.
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, wantsModerator = false): Promise<AuthUser> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email: normalized, passwordHash, role: 'user' },
    });

    let moderatorRequest: { id: string; status: string } | null = null;
    if (wantsModerator) {
      const req = await this.prisma.moderatorRequest.create({
        data: { userId: user.id, status: 'pending' },
      });
      moderatorRequest = { id: req.id, status: req.status };
    }

    return { id: user.id, email: user.email, role: user.role, moderatorRequest };
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { moderatorRequests: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!user) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const moderatorRequest = user.moderatorRequests[0]
      ? { id: user.moderatorRequests[0].id, status: user.moderatorRequests[0].status }
      : null;
    return { id: user.id, email: user.email, role: user.role, moderatorRequest };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { moderatorRequests: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!user) {
      throw new UnauthorizedException('Sesión no válida');
    }
    const moderatorRequest = user.moderatorRequests[0]
      ? { id: user.moderatorRequests[0].id, status: user.moderatorRequests[0].status }
      : null;
    return { id: user.id, email: user.email, role: user.role, moderatorRequest };
  }

  signToken(user: AuthUser): string {
    return this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  }
}
