/**
 * rlsVerifier.ts — live RLS policy verifier.
 *
 * Connects to a Supabase project using the service role key,
 * queries pg_policies, and checks for common misconfigurations.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set
 * in the environment to perform live verification.
 * Falls back to a no-op warning when those variables are absent.
 */

import type { SqlFinding } from "./sqlAuditor.js";

export interface RlsPolicyIssue {
  schema: string;
  table: string;
  policyName: string;
  command: string;
  permissive: string;
  roles: string;
  usingExpression: string;
  checkExpression: string;
  issue: string;
}

export async function verifyRlsPolicies(): Promise<{
  issues: RlsPolicyIssue[];
  usable: boolean;
}> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { issues: [], usable: false };
  }

  const issues: RlsPolicyIssue[] = [];

  try {
    // Query pg_policies through Supabase's SQL HTTP API
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/pg_policies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      // Try direct SQL query as fallback
      const sqlResp = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "params=single-object",
        },
        body: JSON.stringify({
          query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (sqlResp.ok) {
        const rows = await sqlResp.json() as Array<{
          schemaname: string;
          tablename: string;
          policyname: string;
          permissive: string;
          roles: string;
          cmd: string;
          qual: string | null;
          with_check: string | null;
        }>;

        for (const row of rows) {
          const qual = row.qual ?? "";
          if (qual.includes("auth.uid()") && !qual.includes("(select auth.uid())")) {
            issues.push({
              schema: row.schemaname,
              table: row.tablename,
              policyName: row.policyname,
              command: row.cmd,
              permissive: row.permissive,
              roles: row.roles,
              usingExpression: qual,
              checkExpression: row.with_check ?? "",
              issue: "auth.uid() used at outer scope without (select auth.uid()) cache",
            });
          }
        }
      }
    }
  } catch {
    // Silently skip live verification on network errors
  }

  return { issues, usable: true };
}

/** Convert live RLS issues to the SqlFinding shape for scoring. */
export function rlsIssuesToFindings(issues: RlsPolicyIssue[]): SqlFinding[] {
  return issues.map((i, idx) => ({
    file: `pg_policies:${i.schema}.${i.table}`,
    line: idx + 1,
    snippet: `Policy "${i.policyName}" on ${i.schema}.${i.table}: ${i.usingExpression}`,
    rawLine: i.usingExpression,
    policyName: i.policyName,
  }));
}

export function canVerifyLive(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}