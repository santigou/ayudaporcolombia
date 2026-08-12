import jwt from "jsonwebtoken";

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error("JWT_SECRET no está definido en el entorno");
}
// Const tipada como `string` (no `string | undefined`) para que los overloads
// de jsonwebtoken resuelvan correctamente.
const JWT_SECRET: string = rawSecret;

export type TokenPayload = {
  userId: string;
  role: "user" | "moderator";
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
}
