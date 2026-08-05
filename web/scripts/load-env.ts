import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Load env from web/.env.local then repo-root .env (does not override existing vars). */
export function loadScriptEnv(cwd = process.cwd()): void {
  for (const rel of [".env.local", join("..", ".env")]) {
    const envPath = join(cwd, rel);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
