#!/usr/bin/env node
/**
 * vauntico-scan — binary shim
 * Runs the TypeScript entry via tsx so it works without a build step.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

const TS_ENTRY = resolve(__dirname, "..", "src", "index.ts");

const npxTsx = spawn("npx", ["--yes", "tsx", TS_ENTRY, ...process.argv.slice(2)], {
  stdio: "inherit",
});

npxTsx.on("close", (code) => process.exit(code ?? 0));