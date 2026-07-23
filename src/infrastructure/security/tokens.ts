import crypto from "node:crypto";

/** Cryptographically strong opaque token (used for refresh tokens, invitations). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Deterministic SHA-256 hash for storing opaque tokens at rest. */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Numeric OTP code of the given length (default 6 digits). */
export function numericOtp(length = 6): string {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, "0");
}
