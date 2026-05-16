/**
 * handshake.ts — uploads audit results to the Vauntico platform.
 * Fails silently on network errors. Never crashes the CLI.
 */

const AUDIT_REPORT_URL = "https://vauntico-official.vercel.app/api/audit/report";

function computeProjectHash(projectRoot?: string): string {
  const cwd = projectRoot ?? process.cwd();
  const dirName = cwd.split("/").pop() ?? "unknown";
  const envSlug = [process.env.GITHUB_REPOSITORY ?? "", process.env.VERCEL_GIT_REPO_SLUG ?? ""]
    .filter(Boolean)
    .join("|");
  const input = `${dirName}|${envSlug}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `proj_${Math.abs(h).toString(16).padStart(8, "0")}`;
}

export interface HandshakePayload {
  projectHash: string;
  score: number;
  leaksFound: number;
  timestamp: string;
}

export async function uploadResults(
  score: number,
  leaksFound: number,
  projectRoot?: string
): Promise<unknown | undefined> {
  const projectHash = computeProjectHash(projectRoot);
  const payload: HandshakePayload = {
    projectHash,
    score,
    leaksFound,
    timestamp: new Date().toISOString(),
  };
  try {
    const resp = await fetch(AUDIT_REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "vauntico-scan/1.0.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return undefined;
    return resp.json();
  } catch {
    return undefined;
  }
}