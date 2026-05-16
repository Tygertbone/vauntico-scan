import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

function findRepoRoot(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    try {
      const entries = readdirSync(dir);
      if (entries.includes("package.json") || entries.includes("supabase")) return dir;
    } catch {}
    dir = dir.split("/").slice(0, -1).join("/") || "/";
  }
  return process.cwd();
}

export function getMigrationFiles(scanDir?: string): string[] {
  const root = scanDir ? resolve(scanDir) : findRepoRoot();
  const migrationsPath = join(root, "supabase", "migrations");
  try {
    const files = readdirSync(migrationsPath).filter((f) => f.endsWith(".sql"));
    return files.sort().map((f) => join(migrationsPath, f));
  } catch {
    return [];
  }
}

export interface SqlFinding {
  file: string;
  line: number;
  snippet: string;
  rawLine: string;
  policyName: string;
}

function findPolicyScope(lines: string[], matchLineIndex: number): string {
  const start = Math.max(0, matchLineIndex - 15);
  for (let i = matchLineIndex; i >= start; i--) {
    const line = lines[i].trim();
    if (/^(?:CREATE|ALTER)\s+POLICY\s+/i.test(line)) {
      const nameMatch = line.match(/POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
      return nameMatch ? nameMatch[1] : line.slice(0, 80);
    }
  }
  return "(unknown policy scope)";
}

export function scanSqlFile(filePath: string): SqlFinding[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const findings: SqlFinding[] = [];
  const RLS_AUTH_LEAK_RE = /(?:where)\s*\(\s*auth\.uid\(\)\s*=\s*user_id/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    RLS_AUTH_LEAK_RE.lastIndex = 0;
    const match = RLS_AUTH_LEAK_RE.exec(line);
    if (match) {
      const beforeMatch = line.slice(0, match.index + match[0].indexOf("auth.uid()"));
      const openParens = (beforeMatch.match(/\(/g) || []).length;
      const closedParens = (beforeMatch.match(/\)/g) || []).length;
      const depth = openParens - closedParens;
      if (depth === 0) {
        const policyName = findPolicyScope(lines, i);
        const trimmed = line.trim();
        findings.push({
          file: filePath,
          line: i + 1,
          rawLine: trimmed,
          snippet: trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed,
          policyName,
        });
      }
    }
  }
  return findings;
}

export function scanAllMigrations(scanDir?: string): SqlFinding[] {
  return getMigrationFiles(scanDir).flatMap(scanSqlFile);
}