const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateVerificationCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
