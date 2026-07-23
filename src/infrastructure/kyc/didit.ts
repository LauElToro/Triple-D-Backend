import crypto from "node:crypto";
import { env } from "@/lib/env";

export interface DiditSession {
  session_id: string;
  session_token?: string;
  url: string;
  status: string;
  workflow_id?: string;
}

/**
 * Create a Didit KYC verification session (v3).
 * Docs: https://docs.didit.me/sessions-api/create-session
 */
export async function createDiditSession(params: {
  vendorData: string;
  callbackUrl?: string;
}): Promise<DiditSession> {
  if (!env.diditApiKey || !env.diditWorkflowId) {
    throw new Error("Didit is not configured (missing API key or workflow id).");
  }
  const res = await fetch(`${env.diditBaseUrl}/v3/session/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.diditApiKey,
    },
    body: JSON.stringify({
      workflow_id: env.diditWorkflowId,
      vendor_data: params.vendorData,
      callback: params.callbackUrl,
      callback_method: "both",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Didit session creation failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DiditSession;
}

/**
 * Verify the X-Signature-V2 HMAC of an incoming webhook.
 * Uses HMAC-SHA256 of the raw request body with the shared secret.
 */
export function verifyDiditSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !env.diditWebhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", env.diditWebhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature.trim())
    );
  } catch {
    return false;
  }
}

/** Map Didit status strings to our internal KycStatus. */
export function mapDiditStatus(status: string | undefined): "APPROVED" | "DECLINED" | "PENDING" {
  const s = (status || "").toLowerCase();
  if (["approved", "success", "completed"].includes(s)) return "APPROVED";
  if (["declined", "rejected", "failed", "abandoned", "expired"].includes(s)) return "DECLINED";
  return "PENDING";
}
