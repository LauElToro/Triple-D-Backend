import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { HealthStatus, ServiceCheck } from "./types";

const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? "5000");

function nowIso(): string {
  return new Date().toISOString();
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ res: Response; latencyMs: number }> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    return { res, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error(`Timeout after ${timeoutMs}ms`), { latencyMs });
    }
    throw Object.assign(err instanceof Error ? err : new Error("Fetch failed"), { latencyMs });
  } finally {
    clearTimeout(timer);
  }
}

function makeCheck(
  partial: Omit<ServiceCheck, "checkedAt"> & { checkedAt?: string }
): ServiceCheck {
  return { ...partial, checkedAt: partial.checkedAt ?? nowIso() };
}

export async function checkDatabase(): Promise<ServiceCheck> {
  const started = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return makeCheck({
      id: "database",
      name: "PostgreSQL",
      group: "platform",
      status: "ok",
      latencyMs: Math.round(performance.now() - started),
      message: "Conexión activa",
    });
  } catch (err) {
    return makeCheck({
      id: "database",
      name: "PostgreSQL",
      group: "platform",
      status: "down",
      latencyMs: Math.round(performance.now() - started),
      message: err instanceof Error ? err.message : "Error de conexión",
    });
  }
}

export async function checkBackendApi(): Promise<ServiceCheck> {
  const started = performance.now();
  try {
    const url = new URL("/api/health", env.apiUrl).toString();
    const { res, latencyMs } = await fetchWithTimeout(url, { method: "GET" }, DEFAULT_TIMEOUT_MS);
    if (!res.ok) {
      return makeCheck({
        id: "backend-api",
        name: "Backend API",
        group: "api",
        status: "degraded",
        latencyMs,
        message: `HTTP ${res.status}`,
      });
    }
    const data = (await res.json()) as { status?: string; service?: string };
    return makeCheck({
      id: "backend-api",
      name: "Backend API",
      group: "api",
      status: data.status === "ok" ? "ok" : "degraded",
      latencyMs,
      message: "Liveness OK",
      details: { service: data.service ?? "set-api" },
    });
  } catch (err) {
    const latencyMs =
      typeof err === "object" && err && "latencyMs" in err
        ? Number((err as { latencyMs: number }).latencyMs)
        : Math.round(performance.now() - started);
    return makeCheck({
      id: "backend-api",
      name: "Backend API",
      group: "api",
      status: "down",
      latencyMs,
      message: err instanceof Error ? err.message : "No responde",
    });
  }
}

interface ArcaProbe {
  status?: string;
  checks?: { id: string; status: string; message?: string }[];
  issues?: string[];
}

export async function checkArca(): Promise<ServiceCheck> {
  const started = performance.now();
  const base = env.arcaBaseUrl.replace(/\/$/, "");

  try {
    const { res, latencyMs } = await fetchWithTimeout(
      `${base}/health`,
      {
        method: "GET",
        headers: { "X-API-Key": env.arcaApiKey },
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      return makeCheck({
        id: "arca",
        name: "ARCA Gateway",
        group: "platform",
        status: "down",
        latencyMs,
        message: `HTTP ${res.status}`,
      });
    }

    let health: ArcaProbe = {};
    try {
      health = (await res.json()) as ArcaProbe;
    } catch {
      health = { status: "ok" };
    }

    let ready: ArcaProbe | null = null;
    let readyLatency: number | null = null;
    try {
      const readyProbe = await fetchWithTimeout(
        `${base}/ready`,
        {
          method: "GET",
          headers: { "X-API-Key": env.arcaApiKey },
        },
        DEFAULT_TIMEOUT_MS
      );
      readyLatency = readyProbe.latencyMs;
      if (readyProbe.res.ok) {
        ready = (await readyProbe.res.json()) as ArcaProbe;
      }
    } catch {
      // /ready is optional on older deployments
    }

    const readyStatus = ready?.status as HealthStatus | undefined;
    const status: HealthStatus =
      readyStatus ?? (health.status === "ok" ? "ok" : health.status === "degraded" ? "degraded" : "down");

    return makeCheck({
      id: "arca",
      name: "ARCA Gateway",
      group: "platform",
      status,
      latencyMs: readyLatency ?? latencyMs,
      message:
        ready?.issues?.[0] ??
        (status === "ok" ? "Gateway operativo" : "Gateway con advertencias"),
      details: {
        healthStatus: health.status ?? "unknown",
        readyStatus: ready?.status ?? null,
        checks: ready?.checks ?? health.checks ?? [],
        readyLatencyMs: readyLatency,
        healthLatencyMs: latencyMs,
      },
    });
  } catch (err) {
    const latencyMs =
      typeof err === "object" && err && "latencyMs" in err
        ? Number((err as { latencyMs: number }).latencyMs)
        : Math.round(performance.now() - started);
    return makeCheck({
      id: "arca",
      name: "ARCA Gateway",
      group: "platform",
      status: "down",
      latencyMs,
      message: err instanceof Error ? err.message : "No responde",
    });
  }
}

export async function checkFrontend(): Promise<ServiceCheck> {
  const started = performance.now();
  const url = env.webAppUrl.replace(/\/$/, "");

  try {
    const { res, latencyMs } = await fetchWithTimeout(url, { method: "GET" }, DEFAULT_TIMEOUT_MS);
    const status: HealthStatus = res.ok || res.status === 304 ? "ok" : "degraded";
    return makeCheck({
      id: "frontend",
      name: "Frontend Web",
      group: "platform",
      status,
      latencyMs,
      message: res.ok ? "Sitio accesible" : `HTTP ${res.status}`,
      details: { url },
    });
  } catch (err) {
    const latencyMs =
      typeof err === "object" && err && "latencyMs" in err
        ? Number((err as { latencyMs: number }).latencyMs)
        : Math.round(performance.now() - started);
    return makeCheck({
      id: "frontend",
      name: "Frontend Web",
      group: "platform",
      status: "down",
      latencyMs,
      message: err instanceof Error ? err.message : "No responde",
      details: { url },
    });
  }
}

function integrationCheck(
  id: string,
  name: string,
  configured: boolean,
  label: string
): ServiceCheck {
  return makeCheck({
    id,
    name,
    group: "integration",
    status: configured ? "ok" : "degraded",
    latencyMs: null,
    message: configured ? `${label} configurado` : `${label} no configurado`,
    details: { configured },
  });
}

export function checkIntegrations(): ServiceCheck[] {
  return [
    integrationCheck("email", "Email (Gmail)", Boolean(env.gmailUser && env.gmailAppPassword), "SMTP"),
    integrationCheck("kyc-didit", "KYC (Didit)", Boolean(env.diditApiKey && env.diditWorkflowId), "Didit"),
    integrationCheck("google-oauth", "Google Sign-In", Boolean(env.googleClientId), "GIS"),
  ];
}

export async function checkArcaApiRoutes(): Promise<ServiceCheck[]> {
  const base = env.arcaBaseUrl.replace(/\/$/, "");
  const routes = [
    { id: "arca-padron", name: "ARCA Padrón", path: "/health" },
    { id: "arca-comprobantes", name: "ARCA Comprobantes", path: "/health" },
    { id: "arca-constataciones", name: "ARCA Constataciones", path: "/health" },
  ];

  const started = performance.now();
  try {
    const { res, latencyMs } = await fetchWithTimeout(
      `${base}/ready`,
      {
        method: "GET",
        headers: { "X-API-Key": env.arcaApiKey },
      },
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      return routes.map((r) =>
        makeCheck({
          id: r.id,
          name: r.name,
          group: "api",
          status: "down",
          latencyMs,
          message: `Readiness HTTP ${res.status}`,
        })
      );
    }

    const ready = (await res.json()) as ArcaProbe;
    const byId = new Map((ready.checks ?? []).map((c) => [c.id, c]));
    const perRouteLatency = Math.round(latencyMs / Math.max(1, routes.length));

    return routes.map((r) => {
      const match = byId.get(r.id.replace("arca-", ""));
      const routeStatus = (match?.status as HealthStatus | undefined) ?? (ready.status as HealthStatus) ?? "ok";
      return makeCheck({
        id: r.id,
        name: r.name,
        group: "api",
        status: routeStatus === "down" ? "degraded" : routeStatus,
        latencyMs: perRouteLatency,
        message: match?.message ?? (routeStatus === "ok" ? "Disponible vía gateway" : "Con advertencias"),
      });
    });
  } catch (err) {
    const latencyMs =
      typeof err === "object" && err && "latencyMs" in err
        ? Number((err as { latencyMs: number }).latencyMs)
        : Math.round(performance.now() - started);
    const message = err instanceof Error ? err.message : "No responde";
    return routes.map((r) =>
      makeCheck({
        id: r.id,
        name: r.name,
        group: "api",
        status: "down",
        latencyMs,
        message,
      })
    );
  }
}

export async function buildHealthReport(): Promise<{
  report: import("./types").HealthReport;
  readiness: HealthStatus;
}> {
  const [database, backendApi, arca, frontend, arcaApis] = await Promise.all([
    checkDatabase(),
    checkBackendApi(),
    checkArca(),
    checkFrontend(),
    checkArcaApiRoutes(),
  ]);

  const integrations = checkIntegrations();
  const services = [database, backendApi, arca, frontend, ...integrations];
  const apis = arcaApis;
  const all = [...services.filter((s) => s.group !== "integration"), ...apis];

  const issues: string[] = [];
  for (const s of [...services, ...apis]) {
    if (s.status === "down") {
      issues.push(`${s.name}: ${s.message ?? "caído"}`);
    } else if (s.status === "degraded") {
      issues.push(`${s.name}: ${s.message ?? "degradado"}`);
    }
  }

  const platformStatuses = [database.status, arca.status, frontend.status, backendApi.status];
  const readiness = worstStatus([database.status, arca.status]);
  const overall = worstStatus([...platformStatuses, ...apis.map((a) => a.status)]);

  return {
    readiness,
    report: {
      status: overall,
      checkedAt: nowIso(),
      services: [...services, ...apis],
      issues,
    },
  };
}
