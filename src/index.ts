#!/usr/bin/env node

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve } from "path";
import { Command } from "commander";
import chalk from "chalk";
import "dotenv/config";
import { scanAllMigrations, type SqlFinding } from "./sqlAuditor.js";
import { scanDependencies, type DepFinding } from "./depAuditor.js";
import { computeScore } from "./scorer.js";
import { uploadResults } from "./handshake.js";
import { renderFunnel, trustTier, type FunnelData } from "./funnel.js";
import { runLeakProber, countLeaks } from "./leakProber.js";
import { verifyRlsPolicies, rlsIssuesToFindings, canVerifyLive } from "./rlsVerifier.js";

const __fieldDir = fileURLToPath(new URL(".", import.meta.url));
const VERSION = JSON.parse(readFileSync(resolve(__fieldDir, "..", "package.json"), "utf-8")).version as string;

function log(msg: string, json: boolean): void {
  if (!json) console.log(msg);
}

const main = async (options: { path?: string; json?: boolean }) => {
  const startDir = options.path ?? process.cwd();
  const j = options.json ?? false;

  if (!j) {
    console.log("");
    console.log(chalk.hex("#00E5FF")(`  ⚡  vauntico-scan v${VERSION}`));
    console.log(chalk.gray(`  Scope : ${startDir}`));
    console.log("");
  }

  // ── Phase 1 · SQL Auditor ────────────────────────────────────────────
  log(chalk.cyan("▸ Phase 1 / 5  ") + chalk.bold("SQL Auditor — scanning migrations…"), j);
  let sqlFindings: SqlFinding[];
  try {
    sqlFindings = scanAllMigrations(startDir);
    if (!j) {
      if (sqlFindings.length === 0) {
        log(chalk.green("  ✔  No RLS Auth Leaks found in migration SQL."), j);
      } else {
        log(chalk.red.bold(`  ✖  ${sqlFindings.length} RLS Auth Leak(s) detected:\n`), j);
        const seen = new Set<string>();
        for (const f of sqlFindings) {
          const key = `${f.policyName}|${f.line}`;
          if (seen.has(key)) continue;
          seen.add(key);
          log(`  ${chalk.gray("   •")} ${chalk.red(f.policyName)} ${chalk.gray(`(line ${f.line} in ${f.file.split("/").pop()})`)}`, j);
          log(`     ${chalk.gray(f.snippet)}`, j);
        }
      }
    }
  } catch (err) {
    log(chalk.red("  ✖  SQL Auditor failed: ") + (err as Error).message, j);
    sqlFindings = [];
  }
  log("", j);

  // ── Phase 2 · Dependency Auditor ─────────────────────────────────────
  log(chalk.cyan("▸ Phase 2 / 5  ") + chalk.bold("Dependency Auditor — checking package.json…"), j);
  let depFindings: DepFinding[];
  try {
    depFindings = scanDependencies(startDir);
    if (!j) {
      if (depFindings.length === 0) {
        log(chalk.green("  ✔  No stale dependencies found."), j);
      } else {
        log(chalk.yellow.bold(`  ⚠  ${depFindings.length} stale dependency(s) detected:\n`), j);
        for (const d of depFindings) {
          log(`  ${chalk.gray("   •")} ${chalk.yellow(d.name)} ${chalk.gray(`v${d.version} · published ${d.publishedAt} · ~${d.ageMonths}mo old`)}`, j);
        }
      }
    }
  } catch (err) {
    log(chalk.red("  ✖  Dependency Auditor failed: ") + (err as Error).message, j);
    depFindings = [];
  }
  log("", j);

  // ── Phase 3 · Live RLS Verifier ──────────────────────────────────────
  log(chalk.cyan("▸ Phase 3 / 5  ") + chalk.bold("Live RLS Policy Verifier…"), j);
  let liveRlsIssues: SqlFinding[] = [];
  if (canVerifyLive()) {
    try {
      const { issues, usable } = await verifyRlsPolicies();
      if (!j) {
        if (!usable) log(chalk.yellow("  ⚠  Could not query pg_policies (check service role permissions)."), j);
        else if (issues.length === 0) log(chalk.green("  ✔  No live RLS policy issues detected."), j);
        else {
          log(chalk.red.bold(`  ✖  ${issues.length} live RLS policy issue(s) detected:\n`), j);
          for (const i of issues) log(`  ${chalk.gray("   •")} ${chalk.red(i.policyName)} ${chalk.gray(`on ${i.schema}.${i.table} — ${i.issue}`)}`, j);
        }
      }
      if (usable) liveRlsIssues = rlsIssuesToFindings(issues);
    } catch {
      log(chalk.yellow("  ⚠  Live RLS verification skipped (network error)."), j);
    }
  } else {
    log(chalk.gray("  —  Skipped (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)"), j);
  }
  log("", j);

  // ── Phase 4 · Endpoint Leak Prober ───────────────────────────────────
  log(chalk.cyan("▸ Phase 4 / 5  ") + chalk.bold("Endpoint Leak Prober…"), j);
  let leakCount = 0;
  try {
    const leakFindings = await runLeakProber();
    leakCount = countLeaks(leakFindings);
    if (!j) {
      if (leakCount === 0) log(chalk.green("  ✔  No endpoint leaks detected."), j);
      else {
        log(chalk.red.bold(`  ✖  ${leakCount} endpoint(s) leaking data:\n`), j);
        for (const f of leakFindings) {
          if (f.leaked) log(`  ${chalk.gray("   •")} ${chalk.red(f.endpoint)} ${chalk.gray(`(HTTP ${f.status})`)}`, j);
        }
      }
    }
  } catch {
    log(chalk.yellow("  ⚠  Endpoint leak prober skipped (network error)."), j);
  }
  log("", j);

  // ── Phase 5 · Scorer ─────────────────────────────────────────────────
  const allFindings = [...sqlFindings, ...liveRlsIssues];
  log(chalk.cyan("▸ Phase 5 / 5  ") + chalk.bold("Scorer…"), j);
  const report = computeScore(allFindings);
  const tier = trustTier(report.score);
  if (!j) {
    const tierColor = tier === "ARCHITECT" ? chalk.green : tier === "BUILDER" ? chalk.yellow : chalk.red;
    log(`  Score:    ${tierColor.bold(`${report.score} / 100`)}`, j);
    log(`  Trust Tier: ${tierColor.bold(tier)}`, j);
    log("", j);
  }

  // ── Output ───────────────────────────────────────────────────────────
  const funnelData: FunnelData = {
    score: report.score,
    tier,
    sqlIssues: sqlFindings.length,
    depIssues: depFindings.length,
    leakIssues: leakCount,
    rlsPolicyIssues: liveRlsIssues.length,
    projectHash: report.projectHash,
  };

  if (j) {
    console.log(JSON.stringify(funnelData, null, 2));
  } else {
    renderFunnel(funnelData).forEach((line) => console.log(line));
  }

  // ── Handshake (fire-and-forget) ──────────────────────────────────────
  try {
    await uploadResults(report.score, allFindings.length, startDir);
    log(chalk.green("  ✔  Report delivered to Vauntico audit endpoint."), j);
  } catch {
    log(chalk.gray("  ⚠  Handshake skipped (endpoint unreachable)."), j);
  }
  log("", j);
};

new Command()
  .name("vauntico-scan")
  .description("Vauntico Security & Dependency Audit Scanner")
  .version(VERSION)
  .option("--path <dir>", "Directory to scan (defaults to CWD)")
  .option("--json", "Emit raw JSON instead of the ANSI funnel", false)
  .action(main)
  .parseAsync(process.argv);