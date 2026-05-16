import chalk from "chalk";
import { table } from "table";

export interface FunnelData {
  score: number;
  tier: string;
  sqlIssues: number;
  depIssues: number;
  leakIssues: number;
  rlsPolicyIssues: number;
  projectHash: string;
}

export function trustTier(score: number): string {
  if (score >= 80) return "ARCHITECT";
  if (score >= 50) return "BUILDER";
  return "SEEDLING";
}

const TIER_COLOR: Record<string, typeof chalk.green> = {
  ARCHITECT: chalk.green,
  BUILDER: chalk.yellow,
  SEEDLING: chalk.red,
};

function prettyTier(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function renderFunnel(data: FunnelData): string[] {
  const lines: string[] = [];
  const tierColor = TIER_COLOR[data.tier] ?? chalk.gray;

  lines.push("");
  lines.push(chalk.hex("#00E5FF").bold("  ╔══════════════════════════════════════════════════════╗"));
  lines.push(chalk.hex("#00E5FF").bold("  ║       🏆  VAUNTICO SECURITY AUDIT REPORT           ║"));
  lines.push(chalk.hex("#00E5FF").bold("  ╚══════════════════════════════════════════════════════╝"));
  lines.push("");
  lines.push("  " + chalk.gray("Score:") + "     " + tierColor.bold(`      ${data.score} / 100`));
  lines.push("  " + chalk.gray("Trust Tier:") + "  " + tierColor.bold(`  ${prettyTier(data.tier)}`));
  lines.push("  " + chalk.gray("SQL Issues:") + " " + (data.sqlIssues > 0 ? chalk.red(`${data.sqlIssues}`) : chalk.green("0")));
  lines.push("  " + chalk.gray("Dep Issues:") + " " + (data.depIssues > 0 ? chalk.yellow(`${data.depIssues}`) : chalk.green("0")));
  lines.push("  " + chalk.gray("Endpoint Leaks:") + " " + (data.leakIssues > 0 ? chalk.red(`${data.leakIssues}`) : chalk.green("0")));
  lines.push("  " + chalk.gray("RLS Policy Issues:") + " " + (data.rlsPolicyIssues > 0 ? chalk.red(`${data.rlsPolicyIssues}`) : chalk.green("0")));
  lines.push("");
  lines.push(chalk.gray("  ─────────────────────────────────────────────────────────────"));
  lines.push("");

  const ctaUrl = `https://vauntico.com/verify?s=${data.score}&t=${data.tier}`;
  lines.push("  " + chalk.cyan.bold("🚀  Trust Certificate: ") + chalk.gray(ctaUrl));
  lines.push("");

  if (data.sqlIssues > 0 || data.depIssues > 0 || data.leakIssues > 0 || data.rlsPolicyIssues > 0) {
    lines.push("  " + chalk.bold(chalk.hex("#FFF9C4")("  Issues Breakdown")));
    lines.push("");

    const tblRows: Array<[string, string, string]> = [["#", "Type", "Count"]];
    let idx = 0;
    if (data.sqlIssues > 0) tblRows.push([`${++idx}`, chalk.red("🔒 RLS Auth Leak"), `${data.sqlIssues}`]);
    if (data.depIssues > 0) tblRows.push([`${++idx}`, chalk.yellow("📦 Stale Dep"), `${data.depIssues}`]);
    if (data.leakIssues > 0) tblRows.push([`${++idx}`, chalk.red("🔓 Endpoint Leak"), `${data.leakIssues}`]);
    if (data.rlsPolicyIssues > 0) tblRows.push([`${++idx}`, chalk.red("🔐 RLS Policy Issue"), `${data.rlsPolicyIssues}`]);

    const output = table(tblRows as any, {
      border: { topBody: "─", topJoin: "┬", bottomBody: "─", bottomJoin: "┴", bodyLeft: "│", bodyRight: "│" },
    });
    output.split("\n").forEach((line) => lines.push("  " + chalk.gray(line)));
    lines.push("");
  }

  lines.push("");
  lines.push(chalk.gray("  Report delivered to Vauntico · " + new Date().toISOString()));
  lines.push("");
  return lines;
}