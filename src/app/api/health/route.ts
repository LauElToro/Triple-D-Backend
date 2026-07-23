import { ok } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET() {
  return ok({ status: "ok", service: "triple-d-api", time: new Date().toISOString() });
}
