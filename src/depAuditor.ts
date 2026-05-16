import { readFileSync } from "fs";
import { resolve } from "path";

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

export interface DepFinding {
  name: string;
  version: string;
  publishedAt: string;
  ageMonths: number;
}

const FIRST_PUBLISHED: Record<string, string> = {
  "next": "2016-10-25T00:00:00.000Z",
  "react": "2013-05-29T00:00:00.000Z",
  "react-dom": "2013-05-29T00:00:00.000Z",
  "express": "2010-05-22T00:00:00.000Z",
  "fastify": "2016-09-20T00:00:00.000Z",
  "@supabase/supabase-js": "2021-04-01T00:00:00.000Z",
  "@supabase/auth-helpers-nextjs": "2021-04-01T00:00:00.000Z",
  "@supabase/auth-helpers-react": "2021-04-01T00:00:00.000Z",
  "@google/generative-ai": "2023-11-01T00:00:00.000Z",
  "zod": "2020-12-05T00:00:00.000Z",
  "stripe": "2012-06-12T00:00:00.000Z",
  "axios": "2014-09-01T00:00:00.000Z",
  "framer-motion": "2018-06-01T00:00:00.000Z",
  "lucide-react": "2022-09-01T00:00:00.000Z",
  "resend": "2022-10-01T00:00:00.000Z",
  "recharts": "2018-03-01T00:00:00.000Z",
  "clsx": "2018-05-01T00:00:00.000Z",
  "dotenv": "2015-03-15T00:00:00.000Z",
  "bcryptjs": "2010-04-01T00:00:00.000Z",
  "gray-matter": "2016-09-01T00:00:00.000Z",
  "concurrently": "2014-03-01T00:00:00.000Z",
  "uuid": "2011-11-01T00:00:00.000Z",
};

export function scanDependencies(pkgDir?: string): DepFinding[] {
  const dir = pkgDir ? resolve(pkgDir) : process.cwd();
  const pkgPath = resolve(dir, "package.json");
  const raw = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
  if (!pkg.dependencies) return [];

  const findings: DepFinding[] = [];
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    const firstPub = FIRST_PUBLISHED[name];
    if (!firstPub) continue;
    const published = new Date(firstPub);
    const diffMs = Date.now() - published.getTime();
    const ageMonths = Math.floor(diffMs / (30 * 24 * 60 * 60 * 1000));
    if (diffMs >= SIX_MONTHS_MS) {
      findings.push({ name, version, publishedAt: published.toISOString().slice(0, 10), ageMonths });
    }
  }
  return findings;
}