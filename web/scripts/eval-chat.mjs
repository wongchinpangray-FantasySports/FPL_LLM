#!/usr/bin/env node
/**
 * Golden-set evaluation for POST /api/chat (same tools + system prompt as the app).
 *
 * Prerequisites:
 *   - cd web && npm run dev
 *   - GEMINI_API_KEY (or GOOGLE_API_KEY) set for the Next server
 *
 * Run:
 *   node scripts/eval-chat.mjs
 *
 * Env:
 *   EVAL_BASE_URL   default http://localhost:3000
 *   EVAL_ENTRY_ID   optional FPL entry id so tests can use get_my_team / suggest_captain
 *
 * To compare another provider later: point EVAL_BASE_URL at a fork of /api/chat that
 * calls OpenAI/Anthropic instead — this script stays the same.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const goldenPath = join(root, "eval", "golden.json");

const base = (process.env.EVAL_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const defaultEntryId = process.env.EVAL_ENTRY_ID?.trim() || null;

let cases;
try {
  cases = JSON.parse(readFileSync(goldenPath, "utf8"));
} catch (e) {
  console.error("Missing or invalid eval/golden.json:", e.message);
  process.exit(1);
}

async function runCase(c) {
  const entryId =
    c.entryId !== undefined && c.entryId !== null
      ? String(c.entryId)
      : defaultEntryId;

  const body = {
    messages: [{ role: "user", content: c.prompt }],
    ...(entryId ? { entryId } : {}),
  };

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      id: c.id,
      ok: false,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
      tools: [],
      toolPass: null,
      skipped: false,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      id: c.id,
      ok: false,
      ms: Date.now() - t0,
      error: `${res.status} ${text.slice(0, 400)}`,
      tools: [],
      toolPass: null,
      skipped: false,
    };
  }

  const reader = res.body?.getReader();
  if (!reader) {
    return {
      id: c.id,
      ok: false,
      ms: Date.now() - t0,
      error: "No response body",
      tools: [],
      toolPass: null,
      skipped: false,
    };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const tools = [];
  let errMsg = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.startsWith("data:")) continue;
      const payload = part.slice(5).trim();
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "tool_use" && evt.name) tools.push(evt.name);
        if (evt.type === "error") errMsg = evt.message;
      } catch {
        /* ignore bad chunks */
      }
    }
  }

  const expect = Array.isArray(c.expectTools) ? c.expectTools : [];
  const toolPass =
    expect.length === 0 ? null : expect.every((name) => tools.includes(name));

  return {
    id: c.id,
    ok: !errMsg,
    ms: Date.now() - t0,
    error: errMsg,
    tools: [...new Set(tools)],
    calls: tools.length,
    expectTools: expect,
    toolPass,
    skipped: Boolean(c.skip),
  };
}

async function main() {
  console.log(`EVAL_BASE_URL=${base}`);
  console.log(
    defaultEntryId
      ? `EVAL_ENTRY_ID=${defaultEntryId} (squad-aware tools available)\n`
      : "EVAL_ENTRY_ID not set — prompts that need your squad may skip tools.\n",
  );

  const results = [];
  for (const c of cases) {
    if (c.skip) {
      console.log(`${c.id} … skipped`);
      continue;
    }
    process.stdout.write(`${c.id} … `);
    const r = await runCase(c);
    results.push(r);
    if (!r.ok) {
      console.log(`FAIL ${r.error ?? ""}`);
      continue;
    }
    const toolNote =
      r.toolPass === false
        ? ` ⚠ missing expected: ${JSON.stringify(r.expectTools)} (got ${JSON.stringify(r.tools)})`
        : r.toolPass === true
          ? " ✓ tools"
          : "";
    console.log(`${r.ms}ms calls=${r.calls} tools=${JSON.stringify(r.tools)}${toolNote}`);
  }

  const ran = results.filter((r) => !r.skipped);
  const failed = ran.filter((r) => !r.ok);
  const miss = ran.filter((r) => r.toolPass === false);

  console.log("\n--- summary ---");
  console.log(`cases run: ${ran.length}  stream/errors: ${failed.length}  tool mismatches: ${miss.length}`);
  if (failed.length) {
    console.log(
      "failed ids:",
      failed.map((r) => r.id).join(", "),
    );
  }
  if (miss.length && process.env.EVAL_STRICT === "1") {
    console.log("strict: failing on tool mismatches");
  }
  const strict = process.env.EVAL_STRICT === "1";
  process.exit(failed.length || (strict && miss.length) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
