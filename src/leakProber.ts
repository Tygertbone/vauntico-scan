/**
 * leakProber.ts — anonymous endpoint leak test.
 *
 * Probes a list of sensitive API endpoints without authentication
 * and reports which ones return real data (indicating a leak).
 *
 * Base URL and endpoints are configurable via environment variables.
 */

export interface LeakFinding {
  endpoint: string;
  status: number;
  leaked: boolean;
}

function getBaseUrl(): string {
  return process.env.VAUNTICO_BASE_URL ?? "https://vauntico.com";
}

function getEndpoints(): string[] {
  const env = process.env.VAUNTICO_LEAK_ENDPOINTS;
  if (env) {
    return env.split(",").map((e) => e.trim());
  }
  return [
    "/api/admin/approve",
    "/api/morning-brief/test-user-id",
    "/api/referral/invite",
    "/api/referral/claim",
    "/api/trust/certificate/test-user-id",
    "/api/cron/phantom-scan",
    "/api/cron/morning-brief-email",
  ];
}

export async function probeEndpoint(baseUrl: string, endpoint: string): Promise<LeakFinding> {
  const url = `${baseUrl}${endpoint}`;
  try {
    const r = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    const body = await r.text();
    const leaked = r.status === 200 && body.length > 100 && !body.includes("<!DOCTYPE");
    return { endpoint, status: r.status, leaked };
  } catch {
    return { endpoint, status: 0, leaked: false };
  }
}

export async function runLeakProber(): Promise<LeakFinding[]> {
  const baseUrl = getBaseUrl();
  const endpoints = getEndpoints();
  const findings: LeakFinding[] = [];

  for (const ep of endpoints) {
    const result = await probeEndpoint(baseUrl, ep);
    findings.push(result);
  }
  return findings;
}

export function countLeaks(findings: LeakFinding[]): number {
  return findings.filter((f) => f.leaked).length;
}