import type { SqlFinding } from "./sqlAuditor.js";

export interface AuditReport {
  score: number;
  checksFailed: string[];
  projectHash: string;
}

const MAX_SCORE = 100;
const PENALTY_PER_FINDING = 10;

export function computeScore(sqlFindings: SqlFinding[]): AuditReport {
  const checksFailed: string[] = [];
  let score = MAX_SCORE;
  for (const f of sqlFindings) {
    const detail = "auth.uid() = user_id at outer scope — no (select auth.uid()) cache subquery";
    const msg = `RLS Auth Leak | Policy: "${f.policyName}" | ${f.file.split("/").pop()} line ${f.line} | ${detail}`;
    checksFailed.push(msg);
    score = Math.max(0, score - PENALTY_PER_FINDING);
  }
  return { score, checksFailed, projectHash: "" };
}