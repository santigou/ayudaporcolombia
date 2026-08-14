import { createHmac, timingSafeEqual } from 'crypto';

// Token de borrado STATELESS para puntos anónimos (need_help creados vía SOS,
// sin sesión). Como el punto no tiene dueño autenticado, no podemos autorizar el
// borrado por sesión. En lugar de guardar un token en BD (migración + estado),
// derivamos un token del id del punto con un secreto del servidor (JWT_SECRET):
//   deleteToken = HMAC-SHA256(secret, pointId)
// Solo el servidor puede computarlo, así que un atacante no puede borrar puntos
// arbitrarios. El token se devuelve ÚNICAMENTE al creador en la respuesta del
// POST; si lo pierde (p. ej. recarga), ya no podrá borrar el punto. Es la misma
// técnica de los "signed URLs" / tokens sin estado.

function getSecret(secret: string | undefined): string {
  // Fallback intencionado solo para dev: en prod JWT_SECRET es obligatorio.
  return (secret && secret.length > 0) ? secret : 'dev-delete-token-secret';
}

export function signDeleteToken(pointId: string, secret: string | undefined): string {
  return createHmac('sha256', getSecret(secret)).update(pointId).digest('hex');
}

// Verifica un token de borrado con comparación en tiempo constante (anti-timing).
export function verifyDeleteToken(pointId: string, token: string, secret: string | undefined): boolean {
  const expected = signDeleteToken(pointId, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}