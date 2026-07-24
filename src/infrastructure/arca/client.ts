import { env } from "@/lib/env";

interface ArcaRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface ArcaResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

function buildUrl(path: string, query?: ArcaRequest["query"]): string {
  const url = new URL(path.replace(/^\//, ""), env.arcaBaseUrl.replace(/\/?$/, "/"));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Thin authenticated proxy to the ARCA FastAPI gateway (SET_API_ARCA).
 * Auth is via the shared X-API-Key; the per-client CUIT is passed per request.
 */
export async function callArca<T = unknown>(req: ArcaRequest): Promise<ArcaResult<T>> {
  const res = await fetch(buildUrl(req.path, req.query), {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.arcaApiKey,
    },
    body: req.body ? JSON.stringify(req.body) : undefined,
    cache: "no-store",
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, data: data as T };
}
