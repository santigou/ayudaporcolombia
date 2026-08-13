import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../application/decorators/roles.decorator';

// AuthGuard: exige usuario autenticado salvo en rutas marcadas @Public() o que
// no lleven @RequireAuth(). Replica requireAuth del Express.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
