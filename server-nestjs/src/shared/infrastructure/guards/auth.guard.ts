import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../application/decorators/roles.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

// AuthGuard: exige usuario autenticado salvo en rutas marcadas @Public() o que
// no lleven @RequireAuth(). Replica requireAuth del Express.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireAuth = this.reflector.getAllAndOverride<boolean>('requireAuth', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Ruta pública explícita o sin @RequireAuth(): no exige sesión.
    if (isPublic || !requireAuth) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      throw new UnauthorizedException('Debes iniciar sesión');
    }
    // Verifica que el usuario del JWT aún existe en DB. Sin esto, un token válido
    // criptográficamente pero con un userId borrado (p. ej. tras un re-seed)
    // pasaría el guard y causaría FK violations downstream. También refresca el
    // rol desde DB por si cambió desde que se emitió el token.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, role: true },
    });
    if (!dbUser) {
      throw new UnauthorizedException('Debes iniciar sesión');
    }
    request.user.role = dbUser.role;
    return true;
  }
}

// RolesGuard: comprueba @Roles(...) para rutas de moderador.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      throw new UnauthorizedException('Debes iniciar sesión');
    }
    const hasRole = requiredRoles.some((role) => role === request.user.role);
    if (!hasRole) {
      throw new ForbiddenException('Permisos insuficientes');
    }
    return true;
  }
}
