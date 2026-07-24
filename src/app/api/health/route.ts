import { ok } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET() {
  return ok({ status: "ok", service: "set-api", time: new Date().toISOString() });
}
