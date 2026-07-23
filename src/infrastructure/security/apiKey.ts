import crypto from "node:crypto";
import { env } from "@/lib/env";

const PREFIX = "tdk_live_";

export interface GeneratedApiKey {
  /** Full plaintext key - shown to the user only once. */
  plaintext: string;
  /** Public prefix stored for display/lookup (e.g. tdk_live_9f2a). */
  prefix: string;
  /** HMAC hash stored at rest. */
  keyHash: string;
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHmac("sha256", env.apiKeyPepper).update(plaintext).digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const secret = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${PREFIX}${secret}`;
  const prefix = `${PREFIX}${secret.slice(0, 4)}`;
  return { plaintext, prefix, keyHash: hashApiKey(plaintext) };
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(PREFIX);
}
