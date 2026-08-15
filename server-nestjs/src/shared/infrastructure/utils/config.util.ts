import { ConfigService } from '@nestjs/config';

// Lee una variable de entorno numérica con default (las env llegan como string).
// Devuelve el default si falta, no es número o es <= 0.
export function intConfig(config: ConfigService, key: string, defaultValue: number): number {
  const raw = config.get<string>(key);
  const n = raw != null && raw !== '' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}