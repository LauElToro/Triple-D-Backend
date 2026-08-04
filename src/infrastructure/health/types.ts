export type HealthStatus = "ok" | "degraded" | "down";

export interface ServiceCheck {
  id: string;
  name: string;
  group: "platform" | "api" | "integration";
  status: HealthStatus;
  latencyMs: number | null;
  message?: string;
  details?: Record<string, unknown>;
  checkedAt: string;
}

export interface HealthReport {
  status: HealthStatus;
  checkedAt: string;
  services: ServiceCheck[];
  issues: string[];
}
