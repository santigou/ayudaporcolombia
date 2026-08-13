import { PrismaService } from '../database/prisma.service';

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) para códigos legibles.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8; // 31^8 ≈ 8.5 mil M de combinaciones → colisión prácticamente imposible

// Genera un código alfanumérico de 8 caracteres, SIN prefijo (ej. "K7XQ2A9B").
// Reintenta si colisiona (caso extremo por el constraint unique) hasta encontrar
// uno libre. Case-insensitive: siempre se genera en mayúsculas y la búsqueda se
// normaliza a mayúsculas (getByCode), por lo que ABCD y abcd son el mismo punto.
export async function generateUniqueCode(prisma: PrismaService): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomString(CODE_LENGTH);
    const exists = await prisma.point.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  return randomString(CODE_LENGTH + 2);
}

function randomString(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
